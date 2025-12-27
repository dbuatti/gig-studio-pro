"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import UGChordsReader from '@/components/UGChordsReader';
import { transposeKey, calculateSemitones } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showSuccess, showError } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useToneAudio } from '@/hooks/use-tone-audio';
import SheetReaderHeader from '@/components/SheetReaderHeader';
import SheetReaderFooter from '@/components/SheetReaderFooter';
import RepertoirePicker from '@/components/RepertoirePicker';
import ResourceAuditModal from '@/components/ResourceAuditModal';
import SongStudioModal from '@/components/SongStudioModal';
import PreferencesModal from '@/components/PreferencesModal';
import { AnimatePresence, motion } from 'framer-motion';
import FloatingCommandDock from '@/components/FloatingCommandDock';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import { useIsMobile } from '@/hooks/use-mobile';

const SheetReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId } = useParams<{ songId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const { forceReaderResource, ignoreConfirmedGate, forceDesktopView } = useReaderSettings();

  const isMobileHook = useIsMobile();
  const isTabletOrLarger = !isMobileHook || window.innerWidth >= 768;
  const isMobile = forceDesktopView ? false : isMobileHook;
  const showSidebar = isTabletOrLarger;

  // State
  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Immersive states
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [isDockVisible, setIsDockVisible] = useState(true);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  // Modals
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [isResourceAuditOpen, setIsResourceAuditOpen] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  // Chord scroll
  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);

  // Refs
  const touchStartX = useRef<number | null>(null);
  const dockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // Audio
  const audioEngine = useToneAudio(true);
  const {
    isPlaying,
    progress,
    duration,
    loadFromUrl,
    togglePlayback,
    stopPlayback,
    setPitch: setAudioPitch,
    setProgress: setAudioProgress,
    volume,
    setVolume,
  } = audioEngine;

  const [localPitch, setLocalPitch] = useState(0);

  // === Data Fetching ===
  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title');

      if (error) throw error;

      const mappedSongs: SetlistSong[] = (data || []).map((d) => ({
        id: d.id,
        master_id: d.id,
        name: d.title,
        artist: d.artist,
        originalKey: d.original_key,
        targetKey: d.target_key,
        pitch: d.pitch,
        previewUrl: d.preview_url,
        ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        isApproved: d.is_approved,
        pdfUrl: d.pdf_url,
        leadsheetUrl: d.leadsheet_url,
        ugUrl: d.ug_url,
        bpm: d.bpm,
        is_ug_chords_present: d.is_ug_chords_present,
        is_sheet_verified: d.is_sheet_verified,
        is_ug_link_verified: d.is_ug_link_verified,
      }));

      setAllSongs(mappedSongs);

      const targetId = routeSongId || searchParams.get('id');
      if (targetId) {
        const idx = mappedSongs.findIndex((s) => s.id === targetId);
        if (idx !== -1) setCurrentIndex(idx);
      }
    } catch (err) {
      showError('Failed to load repertoire');
    } finally {
      setLoading(false);
    }
  }, [user, routeSongId, searchParams]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // === Filtering ===
  const filteredSongs = useMemo(() => {
    let result = allSongs.filter((s) => ignoreConfirmedGate || s.isApproved);
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [allSongs, ignoreConfirmedGate]);

  // Index safety
  useEffect(() => {
    if (filteredSongs.length === 0) return;
    if (currentIndex >= filteredSongs.length) {
      setCurrentIndex(Math.max(0, filteredSongs.length - 1));
    }
  }, [filteredSongs, currentIndex]);

  // URL sync
  useEffect(() => {
    const song = filteredSongs[currentIndex];
    if (song) setSearchParams({ id: song.id }, { replace: true });
  }, [currentIndex, filteredSongs, setSearchParams]);

  const currentSong = filteredSongs[currentIndex];

  // === Audio ===
  useEffect(() => {
    if (currentSong?.previewUrl) {
      loadFromUrl(currentSong.previewUrl, currentSong.pitch || 0);
      setLocalPitch(currentSong.pitch || 0);
    } else {
      stopPlayback();
      setLocalPitch(0);
    }
  }, [currentSong, loadFromUrl, stopPlayback]);

  // === Navigation ===
  const goToSong = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      stopPlayback();
      setIsImmersiveMode(false);
      showTemporaryUI();
    },
    [stopPlayback]
  );

  const handleNext = useCallback(() => {
    if (filteredSongs.length === 0) return;
    goToSong((currentIndex + 1) % filteredSongs.length);
  }, [currentIndex, filteredSongs.length, goToSong]);

  const handlePrev = useCallback(() => {
    if (filteredSongs.length === 0) return;
    goToSong((currentIndex - 1 + filteredSongs.length) % filteredSongs.length);
  }, [currentIndex, filteredSongs.length, goToSong]);

  // === Swipe Navigation ===
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 80) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
  };

  // === UI Visibility ===
  const showTemporaryUI = useCallback(() => {
    setIsUiVisible(true);
    setIsDockVisible(true);
    setIsImmersiveMode(false);

    if (dockTimeoutRef.current) clearTimeout(dockTimeoutRef.current);
    dockTimeoutRef.current = setTimeout(() => {
      if (!isOverlayOpen) {
        setIsUiVisible(false);
        setIsDockVisible(false);
      }
    }, 5000);
  }, [isOverlayOpen]);

  const toggleImmersive = useCallback(() => {
    setIsImmersiveMode((prev) => !prev);
    if (!isImmersiveMode) {
      setIsUiVisible(false);
      setIsDockVisible(false);
    } else {
      showTemporaryUI();
    }
  }, [isImmersiveMode, showTemporaryUI]);

  useEffect(() => {
    if (!isImmersiveMode) showTemporaryUI();
  }, [isImmersiveMode, showTemporaryUI]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (dockTimeoutRef.current) clearTimeout(dockTimeoutRef.current);
    };
  }, []);

  // === Key Update ===
  const handleUpdateKey = useCallback(
    async (newTargetKey: string) => {
      if (!currentSong || !user) return;
      const newPitch = calculateSemitones(currentSong.originalKey || 'C', newTargetKey);
      setLocalPitch(newPitch);
      setAudioPitch(newPitch);

      try {
        const { error } = await supabase
          .from('repertoire')
          .update({ target_key: newTargetKey, pitch: newPitch })
          .eq('id', currentSong.id);
        if (error) throw error;

        setAllSongs((prev) =>
          prev.map((s) =>
            s.id === currentSong.id ? { ...s, targetKey: newTargetKey, pitch: newPitch } : s
          )
        );
        showSuccess(`Stage Key set to ${newTargetKey}`);
      } catch {
        showError('Failed to update key');
      }
    },
    [currentSong, user, setAudioPitch]
  );

  // === Chart Content ===
  const chartContent = useMemo(() => {
    if (!currentSong) {
      return (
        <div className="h-full flex items-center justify-center text-slate-500">
          <Music className="w-20 h-20" />
          <span className="text-2xl ml-4">Select a song</span>
        </div>
      );
    }

    const readiness = calculateReadiness(currentSong);
    if (readiness < 40 && forceReaderResource !== 'simulation' && !ignoreConfirmedGate) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <AlertCircle className="w-24 h-24 text-red-500 mb-8" />
          <h2 className="text-4xl font-black uppercase text-white mb-4">Missing Resources</h2>
          <p className="text-xl text-slate-400 mb-8">Audit this track to link charts or audio.</p>
          <Button onClick={() => setIsResourceAuditOpen(true)} className="text-lg px-10 py-6 bg-indigo-600 rounded-2xl">
            Audit Resources
          </Button>
        </div>
      );
    }

    // Force chords
    if (forceReaderResource === 'force-chords' && currentSong.ug_chords_text) {
      return (
        <UGChordsReader
          chordsText={currentSong.ug_chords_text}
          config={currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
          isMobile={isMobile}
          originalKey={currentSong.originalKey}
          targetKey={transposeKey(currentSong.originalKey || 'C', localPitch)}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          chordAutoScrollEnabled={chordAutoScrollEnabled}
          chordScrollSpeed={chordScrollSpeed}
        />
      );
    }

    // Fallback to chords
    if (
      currentSong.ug_chords_text &&
      !currentSong.pdfUrl &&
      !currentSong.leadsheetUrl &&
      !currentSong.ugUrl
    ) {
      return (
        <UGChordsReader
          chordsText={currentSong.ug_chords_text}
          config={currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
          isMobile={isMobile}
          originalKey={currentSong.originalKey}
          targetKey={transposeKey(currentSong.originalKey || 'C', localPitch)}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          chordAutoScrollEnabled={chordAutoScrollEnabled}
          chordScrollSpeed={chordScrollSpeed}
        />
      );
    }

    const chartUrl = currentSong.pdfUrl || currentSong.leadsheetUrl || currentSong.ugUrl;
    if (chartUrl) {
      return (
        <iframe
          key={currentSong.id}
          src={`${chartUrl}#toolbar=0&view=FitH&zoom=100`}
          className="w-full h-full bg-white"
          style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
          title="Sheet Music"
          allowFullScreen
        />
      );
    }

    return null;
  }, [
    currentSong,
    forceReaderResource,
    ignoreConfirmedGate,
    isMobile,
    localPitch,
    isPlaying,
    progress,
    duration,
    chordAutoScrollEnabled,
    chordScrollSpeed,
  ]);

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-slate-950 text-white">
      {/* Swipe Indicators */}
      {isImmersiveMode && (
        <>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-30">
            <ChevronLeft className="w-16 h-16" />
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-30">
            <ChevronRight className="w-16 h-16" />
          </div>
        </>
      )}

      {/* UI Panels */}
      <AnimatePresence>
        {isUiVisible && !isImmersiveMode && (
          <>
            <motion.div
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              exit={{ y: -100 }}
              className="fixed top-0 left-0 right-0 z-50"
            >
              <SheetReaderHeader
                currentSong={currentSong}
                onClose={() => navigate('/')}
                onSearchClick={() => setIsRepertoirePickerOpen(true)}
                onPrevSong={handlePrev}
                onNextSong={handleNext}
                currentSongIndex={currentIndex}
                totalSongs={filteredSongs.length}
                isLoading={loading}
                keyPreference={globalKeyPreference}
                onUpdateKey={handleUpdateKey}
                isFullScreen={false}
                onToggleFullScreen={() => {}}
                setIsOverlayOpen={setIsOverlayOpen}
                isOverrideActive={forceReaderResource !== 'default' || ignoreConfirmedGate}
              />
            </motion.div>

            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-0 left-0 right-0 z-50"
            >
              <SheetReaderFooter
                currentSong={currentSong}
                isPlaying={isPlaying}
                progress={progress}
                duration={duration}
                onTogglePlayback={togglePlayback}
                onStopPlayback={stopPlayback}
                onSetProgress={setAudioProgress}
                localPitch={localPitch}
                setLocalPitch={setLocalPitch}
                volume={volume}
                setVolume={setVolume}
                keyPreference={globalKeyPreference}
                chordAutoScrollEnabled={chordAutoScrollEnabled}
                setChordAutoScrollEnabled={setChordAutoScrollEnabled}
                chordScrollSpeed={chordScrollSpeed}
                setChordScrollSpeed={setChordScrollSpeed}
              />
            </motion.div>

            {showSidebar && (
              <motion.aside
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                className="fixed left-0 top-0 bottom-0 w-96 bg-slate-900/95 backdrop-blur-md border-r border-white/10 z-40 pt-24 pb-32"
              >
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-2xl font-black uppercase tracking-wider">Setlist</h2>
                  <p className="text-indigo-400 text-lg mt-1">{filteredSongs.length} songs</p>
                </div>
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    {filteredSongs.map((song, index) => (
                      <button
                        key={song.id}
                        onClick={() => goToSong(index)}
                        className={cn(
                          'w-full text-left p-5 rounded-3xl transition-all',
                          index === currentIndex
                            ? 'bg-indigo-600 text-white shadow-2xl scale-105'
                            : 'hover:bg-white/10 text-slate-300'
                        )}
                      >
                        <div className="font-bold text-xl truncate">{song.name}</div>
                        {song.artist && <div className="text-sm opacity-75 mt-1 truncate">{song.artist}</div>}
                        <div className="text-xs opacity-50 mt-2">{(index + 1).toString().padStart(2, '0')}</div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </motion.aside>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Main Chart Area */}
      <main
        ref={mainRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={toggleImmersive}
        className={cn(
          'flex-1 bg-black transition-all duration-500',
          showSidebar && isUiVisible && !isImmersiveMode ? 'ml-96' : 'ml-0'
        )}
      >
        <div className="h-full w-full relative">
          {chartContent}

          {/* Immersive Hint */}
          {isImmersiveMode && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-black/60 backdrop-blur-md px-10 py-5 rounded-full text-xl">
                Tap screen to show controls
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Dock */}
      <AnimatePresence>
        {isDockVisible && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <FloatingCommandDock
              onOpenSearch={() => setIsRepertoirePickerOpen(true)}
              onOpenPractice={togglePlayback}
              onOpenReader={() => {}}
              onOpenAdmin={() => setIsResourceAuditOpen(true)}
              onOpenPreferences={() => setIsPreferencesOpen(true)}
              onToggleHeatmap={() => {}}
              onOpenUserGuide={() => {}}
              showHeatmap={false}
              viewMode="repertoire"
              hasPlayableSong={!!currentSong?.previewUrl}
              hasReadableChart={true}
              isPlaying={isPlaying}
              onTogglePlayback={togglePlayback}
              isReaderMode={true}
              onSetMenuOpen={setIsOverlayOpen}
              onSetUiVisible={setIsUiVisible}
              isMenuOpen={isOverlayOpen}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <RepertoirePicker
        isOpen={isRepertoirePickerOpen}
        onClose={() => setIsRepertoirePickerOpen(false)}
        repertoire={allSongs}
        currentSetlistSongs={[]}
        onAdd={(selectedSong: SetlistSong) => {
          const filteredIndex = filteredSongs.findIndex((s) => s.id === selectedSong.id);
          if (filteredIndex !== -1) goToSong(filteredIndex);
          setIsRepertoirePickerOpen(false);
        }}
      />

      <ResourceAuditModal
        isOpen={isResourceAuditOpen}
        onClose={() => setIsResourceAuditOpen(false)}
        songs={allSongs}
        onVerify={(id, updates) => {
          setAllSongs((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
        }}
      />

      <SongStudioModal
        isOpen={isStudioModalOpen}
        onClose={() => setIsStudioModalOpen(false)}
        gigId="library"
        songId={currentSong?.id || null}
      />

      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
      />
    </div>
  );
};

export default SheetReaderMode;
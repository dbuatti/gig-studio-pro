"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Music, Loader2, AlertCircle,
} from 'lucide-react';
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
import { useDebouncedCallback } from 'use-debounce';

interface FilterState {
  hasAudio: boolean;
  isApproved: boolean;
  hasCharts: boolean;
  hasUgChords: boolean;
}

type SortOption = 'alphabetical' | 'readiness_asc' | 'readiness_desc';

const SheetReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId } = useParams<{ songId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const { forceReaderResource, ignoreConfirmedGate, forceDesktopView } = useReaderSettings();
  const isMobileHook = useIsMobile();
  const isMobile = forceDesktopView ? false : isMobileHook;

  // Core state
  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // UI state
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Modals
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [isResourceAuditOpen, setIsResourceAuditOpen] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  // Chord scroll
  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);

  const uiHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      // Recover song from URL
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

  // === Filtering & Sorting ===
  const filteredSongs = useMemo(() => {
    let result = allSongs;

    if (!ignoreConfirmedGate) {
      result = result.filter((s) => s.isApproved);
    }

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          (s.artist && s.artist.toLowerCase().includes(query))
      );
    }

    // Sort (currently only alphabetical)
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [allSongs, searchTerm, ignoreConfirmedGate]);

  // Preserve current song when filtering changes
  useEffect(() => {
    const currentSong = filteredSongs[currentIndex];
    if (!currentSong && filteredSongs.length > 0) {
      setCurrentIndex(0);
    }
  }, [filteredSongs, currentIndex]);

  // Sync URL with current song
  useEffect(() => {
    const song = filteredSongs[currentIndex];
    if (song) {
      setSearchParams({ id: song.id }, { replace: true });
    }
  }, [currentIndex, filteredSongs, setSearchParams]);

  const currentSong = filteredSongs[currentIndex];

  // === Audio Loading ===
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

  // === Fullscreen ===
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  }, []);

  // === Keyboard Shortcuts ===
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;

      switch (e.key) {
        case 'Escape':
          navigate('/');
          break;
        case 'ArrowLeft':
          handlePrev();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case ' ':
          e.preventDefault();
          togglePlayback();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullScreen();
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          setIsStudioModalOpen(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, handlePrev, handleNext, togglePlayback, toggleFullScreen]);

  // === UI Auto-Hide ===
  const resetHideTimer = useCallback(() => {
    if (uiHideTimeoutRef.current) clearTimeout(uiHideTimeoutRef.current);
    if (!isOverlayOpen) {
      uiHideTimeoutRef.current = setTimeout(() => setIsUiVisible(false), 8000);
    }
  }, [isOverlayOpen]);

  useEffect(() => {
    if (isUiVisible && !isOverlayOpen) {
      resetHideTimer();
    }
    return () => {
      if (uiHideTimeoutRef.current) clearTimeout(uiHideTimeoutRef.current);
    };
  }, [isUiVisible, isOverlayOpen, resetHideTimer]);

  const handleMainClick = useCallback(() => {
    if (!isOverlayOpen) {
      setIsUiVisible((v) => !v);
      if (!isUiVisible) resetHideTimer();
    }
  }, [isOverlayOpen, isUiVisible, resetHideTimer]);

  // === Content Rendering ===
  const chartContent = useMemo(() => {
    if (!currentSong) {
      return (
        <div className="h-full flex items-center justify-center text-slate-500">
          <Music className="w-12 h-12 mr-4" />
          Select a song
        </div>
      );
    }

    const readiness = calculateReadiness(currentSong);
    if (readiness < 40 && forceReaderResource !== 'simulation' && !ignoreConfirmedGate) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-black uppercase text-white">Missing Resources</h2>
          <p className="text-slate-400 mt-2">Audit this track to link charts or audio.</p>
          <Button onClick={() => setIsResourceAuditOpen(true)} className="mt-6 bg-indigo-600 rounded-xl px-8">
            Audit Resources
          </Button>
        </div>
      );
    }

    // Force overrides
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

    // Prefer UG chords if no PDF/leadsheet
    if (currentSong.ug_chords_text && !currentSong.pdfUrl && !currentSong.leadsheetUrl) {
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
          src={`${chartUrl}#toolbar=0&view=FitH`}
          className="w-full h-full bg-white"
          title="Sheet Music"
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
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-slate-950 text-white selection:bg-indigo-500/30">
      {/* UI Panels */}
      <AnimatePresence>
        {isUiVisible && (
          <>
            <motion.div
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              exit={{ y: -100 }}
              className="fixed top-0 left-0 right-0 z-70"
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
                isFullScreen={isFullScreen}
                onToggleFullScreen={toggleFullScreen}
                setIsOverlayOpen={setIsOverlayOpen}
                isOverrideActive={forceReaderResource !== 'default' || ignoreConfirmedGate}
              />
            </motion.div>

            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-0 left-0 right-0 z-70"
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

            {!isMobile && (
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-white/10 z-60 pt-24 pb-32"
              >
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Immersive List
                  </span>
                  <span className="text-[10px] font-mono text-indigo-400">
                    {filteredSongs.length} Tracks
                  </span>
                </div>
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    {filteredSongs.map((s, idx) => (
                      <button
                        key={s.id}
                        onClick={() => goToSong(idx)}
                        className={cn(
                          'w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 group',
                          idx === currentIndex
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'hover:bg-white/5 text-slate-400'
                        )}
                      >
                        <span className="text-[10px] font-mono opacity-50">
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <span className="text-xs font-bold uppercase truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </motion.aside>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main
        onClick={handleMainClick}
        onMouseMove={resetHideTimer}
        className={cn(
          'flex-1 transition-all duration-500 bg-black',
          isUiVisible && !isMobile ? 'ml-64' : 'ml-0'
        )}
      >
        <div className="h-full w-full">{chartContent}</div>
      </main>

      {/* Floating Dock */}
      <FloatingCommandDock
        onOpenSearch={() => setIsRepertoirePickerOpen(true)}
        onOpenPractice={togglePlayback}
        onOpenAdmin={() => setIsResourceAuditOpen(true)}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
        hasPlayableSong={!!currentSong?.previewUrl}
        hasReadableChart={true}
        isPlaying={isPlaying}
        onTogglePlayback={togglePlayback}
        isReaderMode={true}
        onSetMenuOpen={setIsOverlayOpen}
        onSetUiVisible={setIsUiVisible}
        isMenuOpen={isOverlayOpen}
      />

      {/* Modals */}
      <RepertoirePicker
        isOpen={isRepertoirePickerOpen}
        onClose={() => setIsRepertoirePickerOpen(false)}
        repertoire={allSongs}
        currentSetlistSongs={[]}
        onAdd={(s) => {
          const idx = allSongs.findIndex((x) => x.id === s.id);
          if (idx !== -1) goToSong(idx);
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

      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
    </div>
  );
};

export default SheetReaderMode;
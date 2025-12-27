"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Music, X, Loader2, FileText, AlertCircle, ShieldCheck, ExternalLink, Bug
} from 'lucide-react';
import { cn } from '@/lib/utils';
import UGChordsReader from '@/components/UGChordsReader';
import { calculateSemitones, transposeKey } from '@/utils/keyUtils';
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
  
  const {
    forceReaderResource,
    alwaysShowAllToasts,
    ignoreConfirmedGate,
    forceDesktopView,
  } = useReaderSettings();

  const isMobileHook = useIsMobile();
  const isMobile = forceDesktopView ? false : isMobileHook;

  // State Management
  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<SetlistSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters] = useState<FilterState>({
    hasAudio: false,
    isApproved: false,
    hasCharts: false,
    hasUgChords: false,
  });
  const [sortOption] = useState<SortOption>('alphabetical');

  // Audio Engine
  const audioEngine = useToneAudio(true);
  const { isPlaying, progress, duration, loadFromUrl, togglePlayback, stopPlayback, setPitch: setAudioPitch, setProgress: setAudioProgress, resetEngine } = audioEngine;

  const currentSong = filteredSongs[currentIndex];
  const [localPitch, setLocalPitch] = useState(0);
  
  // Unified UI visibility state (Persistent Sidebar requested)
  const [isUiVisible, setIsUiVisible] = useState(true);
  
  // Modals
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [isResourceAuditOpen, setIsResourceAuditOpen] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const uiHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      const mappedSongs: SetlistSong[] = (data || []).map(d => ({
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
        is_ug_link_verified: d.is_ug_link_verified
      }));
      setAllSongs(mappedSongs);

      // Refresh Recovery Logic: Prioritize URL param, then query param
      const targetId = routeSongId || searchParams.get('id');
      if (targetId) {
        const initialIdx = mappedSongs.findIndex(s => s.id === targetId);
        if (initialIdx !== -1) {
          setCurrentIndex(initialIdx);
        }
      }
    } catch (err) {
      showError("Failed to load repertoire.");
    } finally {
      setLoading(false);
    }
  }, [user, routeSongId, searchParams]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // Filtering Logic
  useEffect(() => {
    let result = [...allSongs];
    if (!ignoreConfirmedGate) {
      result = result.filter(s => s.isApproved);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));
    }
    setFilteredSongs(result);
  }, [allSongs, searchTerm, ignoreConfirmedGate]);

  // Sync URL with state for persistence
  useEffect(() => {
    if (currentSong) {
      setSearchParams({ id: currentSong.id }, { replace: true });
    }
  }, [currentSong, setSearchParams]);

  // Load Audio when song changes
  useEffect(() => {
    if (currentSong?.previewUrl) {
      loadFromUrl(currentSong.previewUrl, currentSong.pitch || 0);
      setLocalPitch(currentSong.pitch || 0);
    } else {
      resetEngine();
      setLocalPitch(0);
    }
  }, [currentSong, loadFromUrl, resetEngine]);

  const handleNext = useCallback(() => {
    if (filteredSongs.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % filteredSongs.length);
    stopPlayback();
  }, [filteredSongs, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (filteredSongs.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + filteredSongs.length) % filteredSongs.length);
    stopPlayback();
  }, [filteredSongs, stopPlayback]);

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.key === 'Escape') navigate('/');
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.code === 'Space') { e.preventDefault(); togglePlayback(); }
      if (e.key.toLowerCase() === 'i') { e.preventDefault(); setIsStudioModalOpen(true); }
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFullScreen(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, handlePrev, handleNext, togglePlayback]);

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  }, []);

  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;
    const newPitch = calculateSemitones(currentSong.originalKey || "C", newTargetKey);
    setLocalPitch(newPitch);
    setAudioPitch(newPitch);
    try {
      await supabase.from('repertoire').update({ target_key: newTargetKey, pitch: newPitch }).eq('id', currentSong.id);
      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, targetKey: newTargetKey, pitch: newPitch } : s));
      showSuccess(`Stage Key set to ${newTargetKey}`);
    } catch (err) {}
  }, [currentSong, user, setAudioPitch]);

  // Tap-to-Hide UI logic (Unit Toggle: Sidebar + Header + Footer)
  const handleMainContentClick = () => {
    if (!isOverlayOpen) {
      setIsUiVisible(prev => !prev);
    }
  };

  useEffect(() => {
    if (uiHideTimeoutRef.current) clearTimeout(uiHideTimeoutRef.current);
    if (isUiVisible && !isOverlayOpen) {
      uiHideTimeoutRef.current = setTimeout(() => setIsUiVisible(false), 8000);
    }
    return () => { if (uiHideTimeoutRef.current) clearTimeout(uiHideTimeoutRef.current); };
  }, [isUiVisible, isOverlayOpen]);

  const renderChart = useMemo(() => {
    if (!currentSong) return <div className="h-full flex items-center justify-center text-slate-500"><Music className="w-12 h-12 mr-4" /> Select a song</div>;

    const readiness = calculateReadiness(currentSong);
    if (readiness < 40 && forceReaderResource !== 'simulation') {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-black uppercase text-white">Missing Resources</h2>
          <p className="text-slate-400 mt-2">Audit this track to link charts or audio.</p>
          <Button onClick={() => setIsResourceAuditOpen(true)} className="mt-6 bg-indigo-600 rounded-xl px-8">Audit Resources</Button>
        </div>
      );
    }

    let chartUrl = currentSong.pdfUrl || currentSong.leadsheetUrl || currentSong.ugUrl;
    
    // Debug Overrides
    if (forceReaderResource === 'force-pdf') chartUrl = currentSong.pdfUrl;
    if (forceReaderResource === 'force-chords' && currentSong.ug_chords_text) {
      return (
        <UGChordsReader
          chordsText={currentSong.ug_chords_text}
          config={currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
          isMobile={isMobile}
          originalKey={currentSong.originalKey}
          targetKey={transposeKey(currentSong.originalKey || "C", localPitch)}
        />
      );
    }

    if (currentSong.ug_chords_text && !chartUrl) {
      return (
        <UGChordsReader
          chordsText={currentSong.ug_chords_text}
          config={currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
          isMobile={isMobile}
          originalKey={currentSong.originalKey}
          targetKey={transposeKey(currentSong.originalKey || "C", localPitch)}
        />
      );
    }

    return chartUrl ? (
      <iframe src={`${chartUrl}#toolbar=0&view=FitH`} className="w-full h-full bg-white" title="Sheet" />
    ) : null;
  }, [currentSong, forceReaderResource, isMobile, localPitch]);

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-slate-950 text-white selection:bg-indigo-500/30">
      {/* Immersive UI Elements */}
      <AnimatePresence>
        {isUiVisible && (
          <>
            <motion.div initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }} className="fixed top-0 left-0 right-0 z-[70]">
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

            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-0 left-0 right-0 z-[70]">
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
                volume={audioEngine.volume}
                setVolume={audioEngine.setVolume}
                keyPreference={globalKeyPreference}
              />
            </motion.div>

            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-white/10 z-[60] pt-24 pb-32">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Immersive List</span>
                <span className="text-[10px] font-mono text-indigo-400">{filteredSongs.length} Tracks</span>
              </div>
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {filteredSongs.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => { setCurrentIndex(idx); stopPlayback(); }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 group",
                        idx === currentIndex ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-white/5 text-slate-400"
                      )}
                    >
                      <span className="text-[10px] font-mono opacity-50">{(idx + 1).toString().padStart(2, '0')}</span>
                      <span className="text-xs font-bold uppercase truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main 
        onClick={handleMainContentClick}
        className={cn(
          "flex-1 transition-all duration-500 bg-black",
          isUiVisible && !isMobile ? "ml-64" : "ml-0"
        )}
      >
        <div className="h-full w-full">{renderChart}</div>
      </main>

      {/* Floating Control for Audio/Studio access */}
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
      />

      <RepertoirePicker isOpen={isRepertoirePickerOpen} onClose={() => setIsRepertoirePickerOpen(false)} repertoire={allSongs} currentSetlistSongs={[]} onAdd={(s) => {
        const idx = allSongs.findIndex(x => x.id === s.id);
        if (idx !== -1) setCurrentIndex(idx);
        setIsRepertoirePickerOpen(false);
      }} />

      <ResourceAuditModal isOpen={isResourceAuditOpen} onClose={() => setIsResourceAuditOpen(false)} songs={allSongs} onVerify={(id, updates) => {
        setAllSongs(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      }} />

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
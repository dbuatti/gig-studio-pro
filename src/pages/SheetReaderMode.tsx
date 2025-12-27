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
  const [isOverlayOpen, setIsOverlayOpen] = useState(false); // Controls FloatingCommandDock menu

  // NEW: Chord auto-scroll state
  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);

  const uiHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  console.log("[SheetReaderMode] Component Rendered. isMobile:", isMobile, "forceDesktopView:", forceDesktopView);

  const fetchSongs = useCallback(async () => {
    console.log("[SheetReaderMode] fetchSongs called.");
    if (!user) {
      console.log("[SheetReaderMode] No user, skipping fetchSongs.");
      return;
    }
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
      console.log("[SheetReaderMode] All songs fetched:", mappedSongs.length);

      // Refresh Recovery Logic: Prioritize URL param, then query param
      const targetId = routeSongId || searchParams.get('id');
      if (targetId) {
        const initialIdx = mappedSongs.findIndex(s => s.id === targetId);
        if (initialIdx !== -1) {
          setCurrentIndex(initialIdx);
          console.log("[SheetReaderMode] Initial song set from URL/params:", mappedSongs[initialIdx].name);
        } else {
          console.log("[SheetReaderMode] Target song ID from URL/params not found in fetched songs.");
        }
      } else {
        console.log("[SheetReaderMode] No initial song ID from URL/params.");
      }
    } catch (err) {
      console.error("[SheetReaderMode] Failed to load repertoire:", err);
      showError("Failed to load repertoire.");
    } finally {
      setLoading(false);
      console.log("[SheetReaderMode] fetchSongs finished. Loading set to false.");
    }
  }, [user, routeSongId, searchParams]);

  useEffect(() => {
    console.log("[SheetReaderMode] Effect: Initial fetchSongs on mount/user change.");
    fetchSongs();
  }, [fetchSongs]);

  // Filtering Logic
  useEffect(() => {
    console.log("[SheetReaderMode] Effect: Filtering songs. allSongs count:", allSongs.length, "searchTerm:", searchTerm, "ignoreConfirmedGate:", ignoreConfirmedGate);
    let result = [...allSongs];
    if (!ignoreConfirmedGate) {
      result = result.filter(s => s.isApproved);
      console.log("[SheetReaderMode] Filtered by isApproved. Count:", result.length);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));
      console.log("[SheetReaderMode] Filtered by searchTerm. Count:", result.length);
    }
    setFilteredSongs(result);
    console.log("[SheetReaderMode] Filtered songs updated. Count:", result.length);
  }, [allSongs, searchTerm, ignoreConfirmedGate]);

  // Sync URL with state for persistence
  useEffect(() => {
    if (currentSong) {
      console.log("[SheetReaderMode] Effect: Updating URL with current song ID:", currentSong.id);
      setSearchParams({ id: currentSong.id }, { replace: true });
    }
  }, [currentSong, setSearchParams]);

  // Load Audio when song changes
  useEffect(() => {
    console.log("[SheetReaderMode] Effect: currentSong changed. Loading audio...");
    if (currentSong?.previewUrl) {
      console.log("[SheetReaderMode] Loading audio from URL:", currentSong.previewUrl, "initial pitch:", currentSong.pitch);
      loadFromUrl(currentSong.previewUrl, currentSong.pitch || 0);
      setLocalPitch(currentSong.pitch || 0);
    } else {
      console.log("[SheetReaderMode] No previewUrl for current song. Resetting audio engine.");
      resetEngine();
      setLocalPitch(0);
    }
  }, [currentSong, loadFromUrl, resetEngine]);

  const handleNext = useCallback(() => {
    console.log("[SheetReaderMode] handleNext called.");
    if (filteredSongs.length === 0) {
      console.log("[SheetReaderMode] No filtered songs to navigate.");
      return;
    }
    setCurrentIndex((prev) => {
      const nextIdx = (prev + 1) % filteredSongs.length;
      console.log("[SheetReaderMode] Next song index:", nextIdx);
      return nextIdx;
    });
    stopPlayback();
  }, [filteredSongs, stopPlayback]);

  const handlePrev = useCallback(() => {
    console.log("[SheetReaderMode] handlePrev called.");
    if (filteredSongs.length === 0) {
      console.log("[SheetReaderMode] No filtered songs to navigate.");
      return;
    }
    setCurrentIndex((prev) => {
      const prevIdx = (prev - 1 + filteredSongs.length) % filteredSongs.length;
      console.log("[SheetReaderMode] Previous song index:", prevIdx);
      return prevIdx;
    });
    stopPlayback();
  }, [filteredSongs, stopPlayback]);

  const toggleFullScreen = useCallback(() => {
    console.log("[SheetReaderMode] toggleFullScreen called. Current fullscreenElement:", document.fullscreenElement);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => console.error("[SheetReaderMode] Fullscreen request failed:", e));
      setIsFullScreen(true);
      console.log("[SheetReaderMode] Fullscreen activated.");
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
      console.log("[SheetReaderMode] Fullscreen deactivated.");
    }
  }, []);

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log("[SheetReaderMode] KeyDown event:", e.key, "target:", e.target);
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.key === 'Escape') {
        console.log("[SheetReaderMode] Escape key pressed. Navigating to /.");
        navigate('/');
      }
      if (e.key === 'ArrowLeft') {
        console.log("[SheetReaderMode] ArrowLeft key pressed.");
        handlePrev();
      }
      if (e.key === 'ArrowRight') {
        console.log("[SheetReaderMode] ArrowRight key pressed.");
        handleNext();
      }
      if (e.code === 'Space') { 
        e.preventDefault(); 
        console.log("[SheetReaderMode] Spacebar pressed. Toggling playback.");
        togglePlayback(); 
      }
      if (e.key.toLowerCase() === 'i') { 
        e.preventDefault(); 
        console.log("[SheetReaderMode] 'i' key pressed. Opening Studio Modal.");
        setIsStudioModalOpen(true); 
      }
      if (e.key.toLowerCase() === 'f') { 
        e.preventDefault(); 
        console.log("[SheetReaderMode] 'f' key pressed. Toggling Fullscreen.");
        toggleFullScreen(); 
      }
    };
    console.log("[SheetReaderMode] Adding global keydown listener.");
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      console.log("[SheetReaderMode] Removing global keydown listener.");
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate, handlePrev, handleNext, togglePlayback, toggleFullScreen]);

  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    console.log("[SheetReaderMode] handleUpdateKey called. New target key:", newTargetKey);
    if (!currentSong || !user) {
      console.log("[SheetReaderMode] Cannot update key: currentSong or user missing.");
      return;
    }
    const newPitch = calculateSemitones(currentSong.originalKey || "C", newTargetKey);
    setLocalPitch(newPitch);
    setAudioPitch(newPitch);
    try {
      console.log("[SheetReaderMode] Updating Supabase with new targetKey and pitch.");
      await supabase.from('repertoire').update({ target_key: newTargetKey, pitch: newPitch }).eq('id', currentSong.id);
      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, targetKey: newTargetKey, pitch: newPitch } : s));
      showSuccess(`Stage Key set to ${newTargetKey}`);
      console.log("[SheetReaderMode] Supabase update successful.");
    } catch (err) {
      console.error("[SheetReaderMode] Failed to update key in Supabase:", err);
      showError("Failed to update key.");
    }
  }, [currentSong, user, setAudioPitch]);

  // Tap-to-Hide UI logic (Unit Toggle: Sidebar + Header + Footer)
  const handleMainContentClick = () => {
    console.log("[SheetReaderMode] Main content clicked. isOverlayOpen:", isOverlayOpen);
    if (!isOverlayOpen) {
      setIsUiVisible(prev => !prev);
      console.log("[SheetReaderMode] Toggling isUiVisible to:", !isUiVisible);
    }
  };

  useEffect(() => {
    console.log("[SheetReaderMode] Effect: isUiVisible or isOverlayOpen changed. Setting UI hide timeout.");
    if (uiHideTimeoutRef.current) clearTimeout(uiHideTimeoutRef.current);
    if (isUiVisible && !isOverlayOpen) {
      uiHideTimeoutRef.current = setTimeout(() => {
        setIsUiVisible(false);
        console.log("[SheetReaderMode] UI hide timeout triggered. isUiVisible set to false.");
      }, 8000);
    }
    return () => { 
      if (uiHideTimeoutRef.current) {
        clearTimeout(uiHideTimeoutRef.current); 
        console.log("[SheetReaderMode] Clearing UI hide timeout on cleanup.");
      }
    };
  }, [isUiVisible, isOverlayOpen]);

  const renderChartContent = useMemo(() => {
    console.log("[SheetReaderMode] renderChartContent memo re-evaluating. currentSong:", currentSong?.name, "forceReaderResource:", forceReaderResource);
    if (!currentSong) {
      console.log("[SheetReaderMode] No current song, rendering placeholder.");
      return <div className="h-full flex items-center justify-center text-slate-500"><Music className="w-12 h-12 mr-4" /> Select a song</div>;
    }

    const readiness = calculateReadiness(currentSong);
    if (readiness < 40 && forceReaderResource !== 'simulation') {
      console.log("[SheetReaderMode] Song readiness is low and not in simulation mode. Rendering audit prompt.");
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
    if (forceReaderResource === 'force-pdf') {
      chartUrl = currentSong.pdfUrl;
      console.log("[SheetReaderMode] forceReaderResource: force-pdf. Chart URL:", chartUrl);
    }
    if (forceReaderResource === 'force-chords' && currentSong.ug_chords_text) {
      console.log("[SheetReaderMode] forceReaderResource: force-chords. Rendering UGChordsReader.");
      return (
        <UGChordsReader
          key={currentSong.id + "-chords"} // Add key to ensure re-render on song change
          chordsText={currentSong.ug_chords_text}
          config={currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
          isMobile={isMobile}
          originalKey={currentSong.originalKey}
          targetKey={transposeKey(currentSong.originalKey || "C", localPitch)}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          chordAutoScrollEnabled={chordAutoScrollEnabled}
          chordScrollSpeed={chordScrollSpeed}
        />
      );
    }

    if (currentSong.ug_chords_text && !chartUrl) {
      console.log("[SheetReaderMode] currentSong has ug_chords_text but no other chartUrl. Rendering UGChordsReader.");
      return (
        <UGChordsReader
          key={currentSong.id + "-chords-fallback"} // Add key
          chordsText={currentSong.ug_chords_text}
          config={currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
          isMobile={isMobile}
          originalKey={currentSong.originalKey}
          targetKey={transposeKey(currentSong.originalKey || "C", localPitch)}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          chordAutoScrollEnabled={chordAutoScrollEnabled}
          chordScrollSpeed={chordScrollSpeed}
        />
      );
    }

    if (chartUrl) {
      console.log("[SheetReaderMode] Rendering iframe with chartUrl:", chartUrl);
      return (
        <iframe 
          key={currentSong.id + "-iframe"} // Add key
          src={`${chartUrl}#toolbar=0&view=FitH`} 
          className="w-full h-full bg-white" 
          title="Sheet" 
        />
      );
    }
    
    console.log("[SheetReaderMode] No chart URL or UG chords text found. Rendering null.");
    return null;
  }, [currentSong, forceReaderResource, isMobile, localPitch, isPlaying, progress, duration, chordAutoScrollEnabled, chordScrollSpeed, ignoreConfirmedGate]);

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-slate-950 text-white selection:bg-indigo-500/30">
      {/* Immersive UI Elements */}
      <AnimatePresence>
        {isUiVisible && (
          <>
            <motion.div key="header-motion" initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }} className="fixed top-0 left-0 right-0 z-[70]">
              <SheetReaderHeader
                key="sheet-reader-header"
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

            <motion.div key="footer-motion" initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-0 left-0 right-0 z-[70]">
              <SheetReaderFooter
                key="sheet-reader-footer"
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
                chordAutoScrollEnabled={chordAutoScrollEnabled}
                setChordAutoScrollEnabled={setChordAutoScrollEnabled}
                chordScrollSpeed={chordScrollSpeed}
                setChordScrollSpeed={setChordScrollSpeed}
              />
            </motion.div>

            <motion.aside key="aside-motion" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-white/10 z-[60] pt-24 pb-32">
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
        <div className="h-full w-full">{renderChartContent}</div>
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
        onSetMenuOpen={setIsOverlayOpen} // Pass setter for overlay
        onSetUiVisible={setIsUiVisible} // Pass setter for UI visibility
        isMenuOpen={isOverlayOpen} // Pass current overlay state
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
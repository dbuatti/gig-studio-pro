"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Loader2, AlertCircle, ChevronLeft, ChevronRight, X, Settings, Maximize2, Minimize2, ExternalLink, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import UGChordsReader from '@/components/UGChordsReader';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { transposeKey, calculateSemitones } from '@/utils/keyUtils';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import PreferencesModal from '@/components/PreferencesModal';
import SongStudioModal from '@/components/SongStudioModal';
import SheetReaderHeader from '@/components/SheetReaderHeader';
import SheetReaderFooter from '@/components/SheetReaderFooter';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { motion } from 'framer-motion'; // Import motion

// Define a type for a rendered chart in the stack
interface RenderedChart {
  id: string;
  content: React.ReactNode;
  isLoaded: boolean;
  opacity: number;
  zIndex: number;
  url: string | null; // The URL or identifier for the chart content
}

const SheetReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId } = useParams<{ songId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const { forceReaderResource, ignoreConfirmedGate } = useReaderSettings();

  // State
  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]); // All readable songs
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true); // For initial data fetch
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false); // For dropdowns in header

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

  // Auto-scroll state
  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);

  // Harmonic Sync Hook
  const [formData, setFormData] = useState<Partial<SetlistSong>>({}); // Local formData for the hook
  const handleAutoSave = useCallback((updates: Partial<SetlistSong>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const {
    pitch,
    setPitch,
    targetKey,
    setTargetKey,
    isPitchLinked,
    setIsPitchLinked,
  } = useHarmonicSync({ formData, handleAutoSave, globalKeyPreference });

  // Sync localPitch with pitch from useHarmonicSync
  useEffect(() => {
    console.log("[SheetReaderMode] Syncing audio pitch:", pitch);
    setAudioPitch(pitch);
  }, [pitch, setAudioPitch]);

  // === Multi-Chart Stack State ===
  const [renderedCharts, setRenderedCharts] = useState<RenderedChart[]>([]);
  const chartLoadTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // === Data Fetching ===
  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setInitialLoading(true);
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title');

      if (error) {
        showError('Failed to load repertoire data.');
        throw error;
      }

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

      // Filter for readable and approved songs for navigation
      const readableAndApprovedSongs = mappedSongs.filter(s => {
        const readiness = calculateReadiness(s);
        const hasChart = s.ugUrl || s.pdfUrl || s.leadsheetUrl || s.ug_chords_text;
        const meetsReadiness = readiness >= 40 || forceReaderResource === 'simulation' || ignoreConfirmedGate;
        return hasChart && meetsReadiness;
      });

      setAllSongs(readableAndApprovedSongs);

      // Determine initial index
      let initialIndex = 0;
      const targetId = routeSongId || searchParams.get('id');
      
      if (targetId) {
        const idx = readableAndApprovedSongs.findIndex((s) => s.id === targetId);
        if (idx !== -1) initialIndex = idx;
      }
      
      setCurrentIndex(initialIndex);
      console.log("[SheetReaderMode] Fetched songs. Initial song:", readableAndApprovedSongs[initialIndex]?.name, "ID:", readableAndApprovedSongs[initialIndex]?.id);

    } catch (err) {
      if (!(err instanceof Error && err.message.includes('Supabase fetch error'))) {
        showError('Failed to load repertoire');
      }
    } finally {
      setInitialLoading(false);
    }
  }, [user, routeSongId, searchParams, forceReaderResource, ignoreConfirmedGate]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // === Song Selection ===
  const currentSong = allSongs[currentIndex];

  // Update formData for useHarmonicSync when currentSong changes
  useEffect(() => {
    if (currentSong) {
      console.log("[SheetReaderMode] currentSong changed. Updating formData for harmonic sync:", {
        id: currentSong.id,
        name: currentSong.name,
        originalKey: currentSong.originalKey, 
        targetKey: currentSong.targetKey, 
        pitch: currentSong.pitch,
        is_pitch_linked: currentSong.is_pitch_linked,
      });
      setFormData({ 
        originalKey: currentSong.originalKey, 
        targetKey: currentSong.targetKey, 
        pitch: currentSong.pitch,
        is_pitch_linked: currentSong.is_pitch_linked,
      });
    }
  }, [currentSong]);

  // Load audio when song changes
  useEffect(() => {
    // Always stop playback when the song changes, to ensure a clean state
    stopPlayback(); 

    if (!currentSong?.previewUrl) {
      console.log("[SheetReaderMode] No previewUrl for current song. Stopping playback.");
      // No need to set pitch to 0 here, useHarmonicSync will manage it based on formData
      return;
    }

    console.log("[SheetReaderMode] currentSong changed. Current song:", currentSong.name, "URL:", currentSong.previewUrl, "Initial Pitch:", pitch);
    
    // If the audio URL is different from what's currently loaded in Tone.js, load the new audio.
    // The `loadFromUrl` function in `useToneAudio` already handles preventing redundant fetches
    // if the URL is truly the same and a buffer exists.
    if (audioEngine.currentUrl !== currentSong.previewUrl || !audioEngine.currentBuffer) {
      console.log("[SheetReaderMode] Loading new audio URL or buffer not present:", currentSong.previewUrl);
      loadFromUrl(currentSong.previewUrl, pitch || 0);
    } else {
      // If the same audio URL is already loaded, just ensure the pitch is updated in Tone.js
      // and reset the playback progress.
      console.log("[SheetReaderMode] Same audio URL, updating pitch in Tone.js and resetting progress.");
      setAudioProgress(0);
    }
  }, [currentSong, loadFromUrl, stopPlayback, pitch, setAudioProgress, audioEngine.currentUrl, audioEngine.currentBuffer]);

  // Update URL when song changes
  useEffect(() => {
    if (currentSong) {
      console.log("[SheetReaderMode] Updating URL search params for song:", currentSong.id);
      setSearchParams({ id: currentSong.id }, { replace: true });
    }
  }, [currentSong, setSearchParams]);

  // === Navigation ===
  const handleNext = useCallback(() => {
    if (allSongs.length === 0) return;
    const nextIndex = (currentIndex + 1) % allSongs.length;
    setCurrentIndex(nextIndex);
    stopPlayback();
    console.log("[SheetReaderMode] Navigating to next song. New index:", nextIndex, "Song:", allSongs[nextIndex]?.name);
  }, [currentIndex, allSongs.length, stopPlayback, allSongs]);

  const handlePrev = useCallback(() => {
    if (allSongs.length === 0) return;
    const prevIndex = (currentIndex - 1 + allSongs.length) % allSongs.length;
    setCurrentIndex(prevIndex);
    stopPlayback();
    console.log("[SheetReaderMode] Navigating to previous song. New index:", prevIndex, "Song:", allSongs[prevIndex]?.name);
  }, [currentIndex, allSongs.length, stopPlayback, allSongs]);

  // === Key Update ===
  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;
    
    console.log("[SheetReaderMode] handleUpdateKey: Setting new target key to:", newTargetKey);
    setTargetKey(newTargetKey);

    const newPitch = calculateSemitones(currentSong.originalKey || 'C', newTargetKey);
    console.log("[SheetReaderMode] handleUpdateKey: Calculated new pitch:", newPitch, "from originalKey:", currentSong.originalKey, "and newTargetKey:", newTargetKey);

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
      console.log("[SheetReaderMode] handleUpdateKey: Successfully updated song in DB and local state.");
    } catch (err) {
      console.error("[SheetReaderMode] handleUpdateKey: Failed to update key:", err);
      showError('Failed to update key');
    }
  }, [currentSong, user, setTargetKey]);

  // Helper to check if a URL can be embedded
  const isFramable = useCallback((url: string | null | undefined) => {
    if (!url) return true; // No URL, so nothing to embed
    const blockedSites = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blockedSites.some(site => url.includes(site));
  }, []);

  // === Chart Content Rendering Logic ===
  const renderChartForSong = useCallback((song: SetlistSong, isCurrent: boolean, isPreloading: boolean) => {
    const readiness = calculateReadiness(song);
    if (readiness < 40 && forceReaderResource !== 'simulation' && !ignoreConfirmedGate) {
      console.log(`[SheetReaderMode] Rendering fallback for ${song.name}: Low readiness (${readiness}%)`);
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <AlertCircle className="w-24 h-24 text-red-500 mb-8" />
          <h2 className="text-4xl font-black uppercase text-white mb-4">Missing Resources</h2>
          <p className="text-xl text-slate-400 mb-8">Audit this track to link charts or audio.</p>
          <Button onClick={() => navigate('/')} className="text-lg px-10 py-6 bg-indigo-600 rounded-2xl">
            Go to Dashboard
          </Button>
        </div>
      );
    }

    // Determine which chart type to render
    const renderUgChordsReader = (s: SetlistSong, onUgLoad: () => void) => (
      <UGChordsReader
        key={s.id}
        chordsText={s.ug_chords_text || ""}
        config={s.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
        isMobile={false}
        originalKey={s.originalKey}
        targetKey={targetKey}
        isPlaying={isPlaying}
        progress={progress}
        duration={duration}
        chordAutoScrollEnabled={chordAutoScrollEnabled}
        chordScrollSpeed={chordScrollSpeed}
        onLoad={onUgLoad} // Pass the onLoad callback
      />
    );

    const chartUrl = song.pdfUrl || song.leadsheetUrl || song.ugUrl;
    const googleViewer = chartUrl ? `https://docs.google.com/viewer?url=${encodeURIComponent(chartUrl)}&embedded=true` : null;

    const handleIframeLoad = () => {
      console.log(`[SheetReaderMode] Iframe loaded for song ID: ${song.id}`);
      // Delay setting loaded state to allow iframe content to fully render visually
      chartLoadTimers.current.set(song.id, setTimeout(() => {
        setRenderedCharts(prev => prev.map(rc => rc.id === song.id ? { ...rc, isLoaded: true } : rc));
        chartLoadTimers.current.delete(song.id);
      }, 150)); // Small delay for smoother transition
    };

    const handleUgLoad = () => {
      console.log(`[SheetReaderMode] UGChordsReader content loaded for song ID: ${song.id}`);
      setRenderedCharts(prev => prev.map(rc => rc.id === song.id ? { ...rc, isLoaded: true } : rc));
    };

    // NEW LOGIC: Prioritize ug_chords_text if available
    if (song.ug_chords_text && song.ug_chords_text.trim().length > 0) {
      console.log(`[SheetReaderMode] Rendering UGChordsReader for ${song.name} (ug_chords_text present)`);
      return renderUgChordsReader(song, handleUgLoad);
    }
    // Fallback to other chart types if ug_chords_text is not present
    else if (forceReaderResource === 'force-chords' && song.ug_chords_text) {
      console.log(`[SheetReaderMode] Rendering UGChordsReader for ${song.name} (force-chords override)`);
      return renderUgChordsReader(song, handleUgLoad);
    } else if (chartUrl && isFramable(chartUrl)) { // If URL exists and is framable
      console.log(`[SheetReaderMode] Rendering iframe for ${song.name} (URL: ${chartUrl})`);
      return (
        <div className="w-full h-full relative bg-black">
          <iframe
            key={`${song.id}-google`}
            src={googleViewer}
            className="absolute inset-0 w-full h-full"
            title="Chart - Google Viewer"
            style={{ border: 'none' }}
            allowFullScreen
            onLoad={handleIframeLoad}
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            <a
              href={chartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-600 hover:bg-indigo-700 px-8 py-4 rounded-2xl text-lg font-bold shadow-2xl"
            >
              Open Chart Externally →
            </a>
          </div>
        </div>
      );
    } else if (chartUrl && !isFramable(chartUrl)) { // If URL exists but is not framable
      console.log(`[SheetReaderMode] Rendering protected asset fallback for ${song.name} (URL: ${chartUrl})`);
      return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-6 md:p-12 text-center">
          <ShieldCheck className="w-12 h-12 md:w-16 md:h-16 text-indigo-400 mb-6 md:mb-10" />
          <h4 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4 md:mb-6 text-white">Asset Protected</h4>
          <p className="text-slate-500 max-xl mb-8 md:mb-16 text-lg md:text-xl font-medium leading-relaxed">
            External security prevents in-app display. Use the button below to launch in a secure dedicated performance window.
          </p>
          <Button 
            onClick={() => window.open(chartUrl, '_blank')} 
            className="bg-indigo-600 hover:bg-indigo-700 h-16 md:h-20 px-10 md:px-16 font-black uppercase tracking-[0.2em] text-xs md:text-sm rounded-2xl md:rounded-3xl shadow-2xl shadow-indigo-600/30 gap-4 md:gap-6"
          >
            <ExternalLink className="w-6 h-6 md:w-8 md:h-8" /> Launch Chart Window
          </Button>
        </div>
      );
    } else {
      console.log(`[SheetReaderMode] Rendering no chart available fallback for ${song.name}`);
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <Music className="w-24 h-24 text-slate-700 mb-8" />
          <h2 className="text-4xl font-black uppercase text-white mb-4">No Chart Available</h2>
          <p className="text-xl text-slate-400 mb-8">Link a PDF or Ultimate Guitar tab in the Studio to view it here.</p>
          <Button onClick={() => setIsStudioModalOpen(true)} className="text-lg px-10 py-6 bg-indigo-600 rounded-2xl">
            Open Studio
          </Button>
        </div>
      );
    }
  }, [forceReaderResource, ignoreConfirmedGate, navigate, targetKey, isPlaying, progress, duration, chordAutoScrollEnabled, chordScrollSpeed, pitch, isFramable]);

  // Effect to manage the renderedCharts stack
  useEffect(() => {
    if (!currentSong) {
      setRenderedCharts([]);
      return;
    }

    setRenderedCharts(prevCharts => {
      const newCharts: RenderedChart[] = [];
      const currentChartId = currentSong.id;

      // Add/update current song's chart
      const existingCurrent = prevCharts.find(c => c.id === currentChartId);
      if (existingCurrent) {
        newCharts.push({ ...existingCurrent, opacity: 1, zIndex: 10 });
      } else {
        newCharts.push({
          id: currentChartId,
          content: renderChartForSong(currentSong, true, false),
          isLoaded: false,
          opacity: 0.5, // Start dimmed
          zIndex: 10,
          url: currentSong.pdfUrl || currentSong.leadsheetUrl || currentSong.ugUrl || null,
        });
      }

      // Add/update next song's chart for pre-loading
      const nextSongIndex = (currentIndex + 1) % allSongs.length;
      const nextSong = allSongs[nextSongIndex];
      if (nextSong && nextSong.id !== currentChartId) {
        const existingNext = prevCharts.find(c => c.id === nextSong.id);
        if (existingNext) {
          newCharts.push({ ...existingNext, opacity: 0, zIndex: 0 }); // Keep hidden
        } else {
          newCharts.push({
            id: nextSong.id,
            content: renderChartForSong(nextSong, false, true),
            isLoaded: false,
            opacity: 0, // Hidden for pre-loading
            zIndex: 0,
            url: nextSong.pdfUrl || nextSong.leadsheetUrl || nextSong.ugUrl || null,
          });
        }
      }

      // Add/update previous song's chart for pre-loading
      const prevSongIndex = (currentIndex - 1 + allSongs.length) % allSongs.length;
      const prevSong = allSongs[prevSongIndex];
      if (prevSong && prevSong.id !== currentChartId) {
        const existingPrev = prevCharts.find(c => c.id === prevSong.id);
        if (existingPrev) {
          newCharts.push({ ...existingPrev, opacity: 0, zIndex: 0 }); // Keep hidden
        } else {
          newCharts.push({
            id: prevSong.id,
            content: renderChartForSong(prevSong, false, true),
            isLoaded: false,
            opacity: 0, // Hidden for pre-loading
            zIndex: 0,
            url: prevSong.pdfUrl || prevSong.leadsheetUrl || prevSong.ugUrl || null,
          });
        }
      }

      // Clean up old charts that are no longer current, next, or previous
      const relevantIds = new Set(newCharts.map(c => c.id));
      const filteredPrevCharts = prevCharts.filter(c => relevantIds.has(c.id));

      // Merge and ensure uniqueness, prioritizing newCharts for updates
      const finalChartsMap = new Map<string, RenderedChart>();
      filteredPrevCharts.forEach(c => finalChartsMap.set(c.id, c));
      newCharts.forEach(c => finalChartsMap.set(c.id, c));

      console.log("[SheetReaderMode] Updated renderedCharts stack:", Array.from(finalChartsMap.values()).map(c => ({ id: c.id, isLoaded: c.isLoaded, opacity: c.opacity, zIndex: c.zIndex })));
      return Array.from(finalChartsMap.values());
    });

    // Clear any pending timers for charts that are no longer relevant
    chartLoadTimers.current.forEach((timer, id) => {
      if (id !== currentSong.id) {
        clearTimeout(timer);
        chartLoadTimers.current.delete(id);
      }
    });

  }, [currentSong, currentIndex, allSongs, renderChartForSong, targetKey, isPlaying, progress, duration, chordAutoScrollEnabled, chordScrollSpeed]);

  // NEW: Keyboard shortcut for 'I' to open Song Studio Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'i' && currentSong && !isStudioModalOpen) {
        e.preventDefault();
        setIsStudioModalOpen(true);
        console.log("[SheetReaderMode] 'I' key pressed. Opening Song Studio Modal.");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong, isStudioModalOpen]);


  if (initialLoading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white">
      {/* Left Sidebar */}
      <aside className={cn("bg-slate-900 border-r border-white/10 flex flex-col shrink-0", isImmersive ? "w-0 opacity-0 pointer-events-none" : "w-80")}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Reader</h1>
            <p className="text-indigo-400 text-sm font-bold mt-1">{allSongs.length} Songs</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {allSongs.map((song, index) => (
              <button
                key={song.id}
                onClick={() => {
                  setCurrentIndex(index);
                  stopPlayback();
                }}
                className={cn(
                  'w-full text-left p-4 rounded-xl transition-all border',
                  index === currentIndex
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg'
                    : 'bg-slate-800 text-slate-300 border-transparent hover:bg-slate-700'
                )}
              >
                <div className="font-bold text-lg truncate">{song.name}</div>
                {song.artist && <div className="text-sm opacity-75 mt-1 truncate">{song.artist}</div>}
                <div className="text-xs opacity-50 mt-2 flex items-center gap-2">
                  <span>{(index + 1).toString().padStart(2, '0')}</span>
                  {song.pdfUrl && <span className="bg-white/10 px-1.5 rounded">PDF</span>}
                  {song.ug_chords_text && <span className="bg-white/10 px-1.5 rounded">CH</span>}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/10">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2 text-slate-400 hover:text-white hover:bg-white/10"
            onClick={() => setIsPreferencesOpen(true)}
          >
            <Settings className="w-4 h-4" /> Reader Settings
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <SheetReaderHeader
          currentSong={currentSong}
          onClose={() => navigate('/')}
          onSearchClick={() => setIsStudioModalOpen(true)} // Open Studio Modal for search
          onPrevSong={handlePrev}
          onNextSong={handleNext}
          currentSongIndex={currentIndex}
          totalSongs={allSongs.length}
          isLoading={!currentSong || !renderedCharts.find(c => c.id === currentSong?.id)?.isLoaded} // Use chart-specific loading
          keyPreference={globalKeyPreference}
          onUpdateKey={handleUpdateKey}
          isFullScreen={isImmersive}
          onToggleFullScreen={() => setIsImmersive(!isImmersive)}
          setIsOverlayOpen={setIsOverlayOpen}
          isOverrideActive={forceReaderResource !== 'default'}
          pitch={pitch}
          setPitch={setPitch}
        />

        {/* Chart Viewer */}
        <div className={cn("flex-1 bg-black overflow-hidden relative", isImmersive ? "mt-0" : "mt-16")}>
          {renderedCharts.map(rc => (
            <motion.div
              key={rc.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: rc.opacity }}
              transition={{ duration: 0.3 }}
              style={{ zIndex: rc.zIndex }}
            >
              {rc.content}
            </motion.div>
          ))}
          {/* Show a global loader if no chart is loaded yet for the current song */}
          {currentSong && !renderedCharts.find(c => c.id === currentSong.id)?.isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20">
              <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
            </div>
          )}
        </div>

        {/* Footer Controls */}
        {!isImmersive && currentSong && (
          <SheetReaderFooter
            currentSong={currentSong}
            isPlaying={isPlaying}
            progress={progress}
            duration={duration}
            onTogglePlayback={togglePlayback}
            onStopPlayback={stopPlayback}
            onSetProgress={setAudioProgress}
            pitch={pitch}
            setPitch={setPitch}
            volume={volume}
            setVolume={setVolume}
            keyPreference={globalKeyPreference}
            chordAutoScrollEnabled={chordAutoScrollEnabled}
            setChordAutoScrollEnabled={setChordAutoScrollEnabled}
            chordScrollSpeed={chordScrollSpeed}
            setChordScrollSpeed={setChordScrollSpeed}
          />
        )}
      </main>

      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      
      {/* Song Studio Modal */}
      {currentSong && (
        <SongStudioModal
          isOpen={isStudioModalOpen}
          onClose={() => setIsStudioModalOpen(false)}
          gigId="library" // Always open in library context for Reader
          songId={currentSong.id}
        />
      )}
    </div>
  );
};

export default SheetReaderMode;
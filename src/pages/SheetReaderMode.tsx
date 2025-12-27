"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Loader2, AlertCircle, ChevronLeft, ChevronRight, X, Settings, Maximize2, Minimize2 } from 'lucide-react';
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
    if (currentSong?.previewUrl) {
      // Only load audio if the URL is different or no buffer is loaded
      if (audioEngine.currentUrl !== currentSong.previewUrl) {
        loadFromUrl(currentSong.previewUrl, pitch || 0);
      } else {
        // If same URL and buffer exists, just update pitch and reset progress
        setAudioPitch(pitch || 0);
        setAudioProgress(0);
        stopPlayback(); // Ensure it's stopped to start fresh
      }
    } else {
      stopPlayback();
      setPitch(0); // Reset pitch when no audio
    }
  }, [currentSong, loadFromUrl, stopPlayback, pitch, setPitch, setAudioPitch, setAudioProgress, audioEngine.currentUrl]);

  // Update URL when song changes
  useEffect(() => {
    if (currentSong) {
      setSearchParams({ id: currentSong.id }, { replace: true });
    }
  }, [currentSong, setSearchParams]);

  // === Navigation ===
  const handleNext = useCallback(() => {
    if (allSongs.length === 0) return;
    const nextIndex = (currentIndex + 1) % allSongs.length;
    setCurrentIndex(nextIndex);
    stopPlayback();
  }, [currentIndex, allSongs.length, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (allSongs.length === 0) return;
    const prevIndex = (currentIndex - 1 + allSongs.length) % allSongs.length;
    setCurrentIndex(prevIndex);
    stopPlayback();
  }, [currentIndex, allSongs.length, stopPlayback]);

  // === Key Update ===
  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;
    
    setTargetKey(newTargetKey);

    const newPitch = calculateSemitones(currentSong.originalKey || 'C', newTargetKey);

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
  }, [currentSong, user, setTargetKey]);

  // === Chart Content Rendering Logic ===
  const renderChartForSong = useCallback((song: SetlistSong, isCurrent: boolean, isPreloading: boolean) => {
    const readiness = calculateReadiness(song);
    if (readiness < 40 && forceReaderResource !== 'simulation' && !ignoreConfirmedGate) {
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
      // Delay setting loaded state to allow iframe content to fully render visually
      chartLoadTimers.current.set(song.id, setTimeout(() => {
        setRenderedCharts(prev => prev.map(rc => rc.id === song.id ? { ...rc, isLoaded: true } : rc));
        chartLoadTimers.current.delete(song.id);
      }, 150)); // Small delay for smoother transition
    };

    const handleUgLoad = () => {
      setRenderedCharts(prev => prev.map(rc => rc.id === song.id ? { ...rc, isLoaded: true } : rc));
    };

    if (forceReaderResource === 'force-chords' && song.ug_chords_text) {
      return renderUgChordsReader(song, handleUgLoad);
    } else if (song.ug_chords_text && !song.pdfUrl && !song.leadsheetUrl && !song.ugUrl) {
      return renderUgChordsReader(song, handleUgLoad);
    } else if (googleViewer) {
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
    } else {
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
  }, [forceReaderResource, ignoreConfirmedGate, navigate, targetKey, isPlaying, progress, duration, chordAutoScrollEnabled, chordScrollSpeed, pitch]);

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

  // Effect to handle the "ghosting" transition
  useEffect(() => {
    if (!currentSong) return;

    const currentChartInStack = renderedCharts.find(c => c.id === currentSong.id);

    if (currentChartInStack && currentChartInStack.isLoaded) {
      // Once the current chart is fully loaded, ensure it's fully opaque and on top
      setRenderedCharts(prev => prev.map(rc => {
        if (rc.id === currentSong.id) {
          return { ...rc, opacity: 1, zIndex: 10 };
        } else {
          // Hide other charts that are not the current one
          return { ...rc, opacity: 0, zIndex: 0 };
        }
      }));
    } else if (currentChartInStack && !currentChartInStack.isLoaded) {
      // If the current chart is not yet loaded, dim it and keep it on top
      setRenderedCharts(prev => prev.map(rc => {
        if (rc.id === currentSong.id) {
          return { ...rc, opacity: 0.5, zIndex: 10 };
        } else {
          return { ...rc, opacity: 0, zIndex: 0 };
        }
      }));
    }
  }, [currentSong, renderedCharts]);

  // NEW: Keyboard shortcut for 'I' to open Song Studio Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'i' && currentSong && !isStudioModalOpen) {
        e.preventDefault();
        setIsStudioModalOpen(true);
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
            <div
              key={rc.id}
              className="absolute inset-0 transition-opacity duration-300"
              style={{ opacity: rc.opacity, zIndex: rc.zIndex }}
            >
              {rc.content}
            </div>
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
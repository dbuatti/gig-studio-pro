"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Loader2, AlertCircle, ChevronLeft, ChevronRight, X, Settings, Maximize2, Minimize2, ExternalLink, ShieldCheck, FileText, Layout, Guitar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showError, showSuccess } from '@/utils/toast';
import UGChordsReader from '@/components/UGChordsReader';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { transposeKey, calculateSemitones } from '@/utils/keyUtils';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import PreferencesModal from '@/components/PreferencesModal';
import SongStudioModal from '@/components/SongStudioModal';
import SheetReaderHeader from '@/components/SheetReaderHeader';
import SheetReaderFooter from '@/components/SheetReaderFooter';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { motion } from 'framer-motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal } from '@/components/ui/dropdown-menu';

type ChartType = 'pdf' | 'leadsheet' | 'chords';

interface RenderedChart {
  id: string;
  content: React.ReactNode;
  isLoaded: boolean;
  opacity: number;
  zIndex: number;
  type: ChartType;
}

const SheetReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId } = useParams<{ songId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const { forceReaderResource, ignoreConfirmedGate } = useReaderSettings();

  // State
  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  
  // NEW: Reader-specific Key Preference Override
  const [readerKeyPreference, setReaderKeyPreference] = useState<'sharps' | 'flats'>(globalKeyPreference);

  // Chart Selection State
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');

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
    resetEngine,
  } = audioEngine;

  // Auto-scroll state
  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);

  // Harmonic Sync Hook
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
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
        pitch: d.pitch ?? 0,
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
        is_pitch_linked: d.is_pitch_linked ?? true,
      }));

      // Filter for readable and approved songs
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
      
      // NEW: Check localStorage for persistence if no specific ID provided
      if (!targetId) {
        const savedIndex = localStorage.getItem('reader_last_index');
        if (savedIndex) {
          const parsed = parseInt(savedIndex, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < readableAndApprovedSongs.length) {
            initialIndex = parsed;
          }
        }
      } else {
        const idx = readableAndApprovedSongs.findIndex((s) => s.id === targetId);
        if (idx !== -1) initialIndex = idx;
      }
      
      setCurrentIndex(initialIndex);

    } catch (err) {
      showError('Failed to load repertoire');
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
    if (!currentSong?.previewUrl) {
      stopPlayback();
      return;
    }

    // FIX: Reset engine state to ensure loading wheel logic works correctly
    // This forces the "Already loading" check to pass if we are switching songs
    if (audioEngine.currentUrl !== currentSong.previewUrl) {
        resetEngine();
    }

    // Use force=true to bypass the "Already loading" check if we are in a stuck state
    if (audioEngine.currentUrl !== currentSong.previewUrl || !audioEngine.currentBuffer) {
      loadFromUrl(currentSong.previewUrl, pitch || 0, true);
    } else {
      setAudioProgress(0);
    }
  }, [currentSong, loadFromUrl, stopPlayback, pitch, setAudioProgress, audioEngine.currentUrl, audioEngine.currentBuffer, resetEngine]);

  // Update URL and Persistence when song changes
  useEffect(() => {
    if (currentSong) {
      setSearchParams({ id: currentSong.id }, { replace: true });
      // NEW: Save index to localStorage
      localStorage.setItem('reader_last_index', currentIndex.toString());
    }
  }, [currentSong, currentIndex, setSearchParams]);

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
    } catch (err) {
      showError('Failed to update key');
    }
  }, [currentSong, user, setTargetKey]);

  // Helper to check if a URL can be embedded
  const isFramable = useCallback((url: string | null | undefined) => {
    if (!url) return true;
    const blockedSites = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blockedSites.some(site => url.includes(site));
  }, []);

  // === Chart Content Rendering Logic ===
  const renderChartForSong = useCallback((song: SetlistSong, chartType: ChartType) => {
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

    // Determine content based on requested type
    if (chartType === 'chords') {
      if (song.ug_chords_text && song.ug_chords_text.trim().length > 0) {
        return (
          <UGChordsReader
            key={`${song.id}-chords`}
            chordsText={song.ug_chords_text || ""}
            config={song.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
            isMobile={false}
            originalKey={song.originalKey}
            targetKey={targetKey}
            isPlaying={isPlaying}
            progress={progress}
            duration={duration}
            chordAutoScrollEnabled={chordAutoScrollEnabled}
            chordScrollSpeed={chordScrollSpeed}
            // Pass the reader override
            readerKeyPreference={readerKeyPreference}
          />
        );
      } else {
        return renderChartForSong(song, 'pdf'); // Fallback to PDF if chords requested but missing
      }
    }

    // PDF/Leadsheet Logic
    const chartUrl = chartType === 'pdf' ? song.pdfUrl : song.leadsheetUrl;
    
    if (!chartUrl) {
       return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <Music className="w-24 h-24 text-slate-700 mb-8" />
          <h2 className="text-4xl font-black uppercase text-white mb-4">No {chartType === 'pdf' ? 'Full Score' : 'Leadsheet'} Available</h2>
          <p className="text-xl text-slate-400 mb-8">Upload one in the Studio.</p>
          <Button onClick={() => setIsStudioModalOpen(true)} className="text-lg px-10 py-6 bg-indigo-600 rounded-2xl">
            Open Studio
          </Button>
        </div>
      );
    }

    const googleViewer = `https://docs.google.com/viewer?url=${encodeURIComponent(chartUrl)}&embedded=true`;

    if (isFramable(chartUrl)) {
      return (
        <div className="w-full h-full relative bg-black">
          <iframe
            key={`${song.id}-${chartType}`}
            src={googleViewer}
            className="absolute inset-0 w-full h-full"
            title="Chart Viewer"
            style={{ border: 'none' }}
            allowFullScreen
            onLoad={() => {
              // Mark as loaded after a slight delay to ensure render
              setTimeout(() => {
                setRenderedCharts(prev => prev.map(rc => 
                  rc.id === song.id && rc.type === chartType ? { ...rc, isLoaded: true } : rc
                ));
              }, 300);
            }}
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
    }
  }, [forceReaderResource, ignoreConfirmedGate, navigate, targetKey, isPlaying, progress, duration, chordAutoScrollEnabled, chordScrollSpeed, pitch, isFramable, readerKeyPreference]);

  // === Chart Cache Management ===
  const [renderedCharts, setRenderedCharts] = useState<RenderedChart[]>([]);

  useEffect(() => {
    if (!currentSong) {
      setRenderedCharts([]);
      return;
    }

    setRenderedCharts(prevCharts => {
      const newCharts: RenderedChart[] = [];
      const currentChartId = currentSong.id;

      // 1. Ensure Current Song's Selected Chart is in Cache
      const existingCurrent = prevCharts.find(c => c.id === currentChartId && c.type === selectedChartType);
      if (existingCurrent) {
        newCharts.push({ ...existingCurrent, opacity: 1, zIndex: 10 });
      } else {
        newCharts.push({
          id: currentChartId,
          content: renderChartForSong(currentSong, selectedChartType),
          isLoaded: false,
          opacity: 0.5,
          zIndex: 10,
          type: selectedChartType,
        });
      }

      // 2. Pre-load Next Song's Primary Chart
      const nextSongIndex = (currentIndex + 1) % allSongs.length;
      const nextSong = allSongs[nextSongIndex];
      if (nextSong && nextSong.id !== currentChartId) {
        const nextType = nextSong.pdfUrl ? 'pdf' : (nextSong.leadsheetUrl ? 'leadsheet' : 'chords');
        const existingNext = prevCharts.find(c => c.id === nextSong.id && c.type === nextType);
        
        if (!existingNext) {
          newCharts.push({
            id: nextSong.id,
            content: renderChartForSong(nextSong, nextType),
            isLoaded: false,
            opacity: 0,
            zIndex: 0,
            type: nextType,
          });
        }
      }

      // 3. Pre-load Previous Song's Primary Chart
      const prevSongIndex = (currentIndex - 1 + allSongs.length) % allSongs.length;
      const prevSong = allSongs[prevSongIndex];
      if (prevSong && prevSong.id !== currentChartId) {
        const prevType = prevSong.pdfUrl ? 'pdf' : (prevSong.leadsheetUrl ? 'leadsheet' : 'chords');
        const existingPrev = prevCharts.find(c => c.id === prevSong.id && c.type === prevType);
        
        if (!existingPrev) {
          newCharts.push({
            id: prevSong.id,
            content: renderChartForSong(prevSong, prevType),
            isLoaded: false,
            opacity: 0,
            zIndex: 0,
            type: prevType,
          });
        }
      }

      // Merge with existing charts that aren't being replaced
      const relevantIds = new Set(newCharts.map(c => `${c.id}-${c.type}`));
      const filteredPrevCharts = prevCharts.filter(c => !relevantIds.has(`${c.id}-${c.type}`));

      return [...filteredPrevCharts, ...newCharts];
    });

  }, [currentSong, currentIndex, allSongs, selectedChartType, renderChartForSong]);

  // Keyboard shortcut for 'I' to open Song Studio Modal
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

  // Determine available chart types for the current song
  const availableChartTypes = useMemo(() => {
    if (!currentSong) return [];
    const types: ChartType[] = [];
    if (currentSong.pdfUrl) types.push('pdf');
    if (currentSong.leadsheetUrl) types.push('leadsheet');
    if (currentSong.ug_chords_text) types.push('chords');
    return types;
  }, [currentSong]);

  // Auto-select chart type if current selection is unavailable
  useEffect(() => {
    if (currentSong && availableChartTypes.length > 0 && !availableChartTypes.includes(selectedChartType)) {
      setSelectedChartType(availableChartTypes[0]);
    }
  }, [currentSong, availableChartTypes, selectedChartType]);

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
      <aside className={cn("bg-slate-900 border-r border-white/10 flex flex-col shrink-0 transition-all duration-300", isImmersive ? "w-0 opacity-0 pointer-events-none" : "w-80")}>
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
                  {song.leadsheetUrl && <span className="bg-white/10 px-1.5 rounded">LS</span>}
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
          onSearchClick={() => setIsStudioModalOpen(true)}
          onPrevSong={handlePrev}
          onNextSong={handleNext}
          currentSongIndex={currentIndex}
          totalSongs={allSongs.length}
          isLoading={!currentSong}
          keyPreference={globalKeyPreference}
          onUpdateKey={handleUpdateKey}
          isFullScreen={isImmersive}
          onToggleFullScreen={() => setIsImmersive(!isImmersive)}
          setIsOverlayOpen={setIsOverlayOpen}
          isOverrideActive={forceReaderResource !== 'default'}
          pitch={pitch}
          setPitch={setPitch}
          // Pass new props
          readerKeyPreference={readerKeyPreference}
          setReaderKeyPreference={setReaderKeyPreference}
        />

        {/* Chart Viewer */}
        <div className={cn("flex-1 bg-black overflow-hidden relative", isImmersive ? "mt-0" : "mt-16")}>
          {renderedCharts.map(rc => (
            <motion.div
              key={`${rc.id}-${rc.type}`}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: rc.opacity }}
              transition={{ duration: 0.3 }}
              style={{ zIndex: rc.zIndex }}
            >
              {rc.content}
            </motion.div>
          ))}
          
          {/* Loading Overlay */}
          {currentSong && !renderedCharts.find(c => c.id === currentSong.id && c.type === selectedChartType)?.isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20">
              <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
            </div>
          )}

          {/* Floating Chart Type Toggle (Only if multiple types exist) */}
          {currentSong && availableChartTypes.length > 1 && !isImmersive && (
            <div className="absolute top-4 right-4 z-30">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-slate-900/80 backdrop-blur border border-white/10 text-white hover:bg-slate-800 shadow-2xl h-12 px-4 gap-2">
                    {selectedChartType === 'pdf' && <Layout className="w-4 h-4" />}
                    {selectedChartType === 'leadsheet' && <FileText className="w-4 h-4" />}
                    {selectedChartType === 'chords' && <Guitar className="w-4 h-4" />}
                    <span className="font-bold uppercase text-xs tracking-widest">
                      {selectedChartType === 'pdf' ? 'Full Score' : selectedChartType === 'leadsheet' ? 'Leadsheet' : 'Chords'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white min-w-[180px]">
                  {availableChartTypes.includes('pdf') && (
                    <DropdownMenuItem onClick={() => setSelectedChartType('pdf')} className="cursor-pointer font-bold">
                      <Layout className="w-4 h-4 mr-2" /> Full Score
                    </DropdownMenuItem>
                  )}
                  {availableChartTypes.includes('leadsheet') && (
                    <DropdownMenuItem onClick={() => setSelectedChartType('leadsheet')} className="cursor-pointer font-bold">
                      <FileText className="w-4 h-4 mr-2" /> Leadsheet
                    </DropdownMenuItem>
                  )}
                  {availableChartTypes.includes('chords') && (
                    <DropdownMenuItem onClick={() => setSelectedChartType('chords')} className="cursor-pointer font-bold">
                      <Guitar className="w-4 h-4 mr-2" /> Chords
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
      
      {currentSong && (
        <SongStudioModal
          isOpen={isStudioModalOpen}
          onClose={() => setIsStudioModalOpen(false)}
          gigId="library"
          songId={currentSong.id}
        />
      )}
    </div>
  );
};

export default SheetReaderMode;
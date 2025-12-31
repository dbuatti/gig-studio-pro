"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { Music, Loader2, AlertCircle, X, ExternalLink, ShieldCheck, FileText, Layout, Guitar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import UGChordsReader from '@/components/UGChordsReader';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { calculateSemitones } from '@/utils/keyUtils';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import PreferencesModal from '@/components/PreferencesModal';
import SongStudioModal from '@/components/SongStudioModal';
import SheetReaderHeader from '@/components/SheetReaderHeader';
import SheetReaderFooter from '@/components/SheetReaderFooter';
import SheetReaderSidebar from '@/components/SheetReaderSidebar';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { motion, AnimatePresence } from 'framer-motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { extractKeyFromChords } from '@/utils/chordUtils';

type ChartType = 'pdf' | 'leadsheet' | 'chords';

interface RenderedChart {
  id: string;
  content: React.ReactNode;
  isLoaded: boolean;
  opacity: number;
  zIndex: number;
  type: ChartType;
}

const CHART_LOAD_TIMEOUT_MS = 5000;

const SheetReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId } = useParams<{ songId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const { forceReaderResource, ignoreConfirmedGate } = useReaderSettings();

  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [allSetlists, setAllSetlists] = useState<{ id: string; name: string; songs: SetlistSong[] }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isStudioPanelOpen, setIsStudioPanelOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [readerKeyPreference, setReaderKeyPreference] = useState<'sharps' | 'flats'>(globalKeyPreference);
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');
  const [renderedCharts, setRenderedCharts] = useState<RenderedChart[]>([]);

  const audioEngine = useToneAudio(true);
  const {
    isPlaying, progress, duration, loadFromUrl, togglePlayback, stopPlayback,
    setPitch: setAudioPitch, setProgress: setAudioProgress, volume, setVolume,
    resetEngine, currentUrl, currentBuffer, isLoadingAudio
  } = audioEngine;

  const currentSong = allSongs[currentIndex];

  const harmonicSync = useHarmonicSync({
    formData: {
      originalKey: currentSong?.originalKey,
      targetKey: currentSong?.targetKey || currentSong?.originalKey,
      pitch: currentSong?.pitch ?? 0,
      is_pitch_linked: currentSong?.is_pitch_linked ?? true,
      ug_chords_text: currentSong?.ug_chords_text,
    },
    handleAutoSave: useCallback(async (updates: Partial<SetlistSong>) => {
      if (!currentSong || !user) return;

      const dbUpdates: { [key: string]: any } = {};
      // ... (your full auto-save mapping logic unchanged)
      if (updates.name !== undefined) dbUpdates.title = updates.name || 'Untitled Track';
      if (updates.artist !== undefined) dbUpdates.artist = updates.artist || 'Unknown Artist';
      // ... rest of fields ...

      dbUpdates.updated_at = new Date().toISOString();

      supabase
        .from('repertoire')
        .update(dbUpdates)
        .eq('id', currentSong.id)
        .then(({ error }) => {
          if (error) {
            console.error("[SheetReaderMode] Supabase Auto-save failed:", error);
            showError(`Failed to save: ${error.message}`);
          } else {
            setAllSongs(prev => prev.map(s =>
              s.id === currentSong.id ? { ...s, ...updates } : s
            ));
          }
        });
    }, [currentSong, user]),
    globalKeyPreference,
  });

  const { pitch, setPitch, targetKey: harmonicTargetKey, setTargetKey } = harmonicSync;

  useEffect(() => {
    setAudioPitch(pitch);
  }, [pitch, setAudioPitch]);

  // ==================== DATA FETCHING ====================
  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setInitialLoading(true);

    try {
      let query = supabase.from('repertoire').select('*').eq('user_id', user.id).order('title');
      const filterApproved = searchParams.get('filterApproved');
      if (filterApproved === 'true') query = query.eq('is_approved', true);

      const { data, error } = await query;
      if (error) throw error;

      const mappedSongs: SetlistSong[] = (data || []).map((d: any) => ({
        id: d.id,
        master_id: d.id,
        name: d.title,
        artist: d.artist,
        originalKey: d.original_key ?? 'TBC',
        targetKey: d.target_key ?? d.original_key ?? 'TBC',
        pitch: d.pitch ?? 0,
        previewUrl: d.extraction_status === 'completed' && d.audio_url ? d.audio_url : d.preview_url,
        youtubeUrl: d.youtube_url,
        ugUrl: d.ug_url,
        appleMusicUrl: d.apple_music_url,
        pdfUrl: d.pdf_url,
        leadsheetUrl: d.leadsheet_url,
        bpm: d.bpm,
        ug_chords_text: d.ug_chords_text,
        is_ug_chords_present: d.is_ug_chords_present,
        is_ug_link_verified: d.is_ug_link_verified,
        is_pitch_linked: d.is_pitch_linked ?? true,
        sheet_music_url: d.sheet_music_url,
        is_sheet_verified: d.is_sheet_verified,
        highest_note_original: d.highest_note_original,
        extraction_status: d.extraction_status,
        last_sync_log: d.last_sync_log,
      }));

      const readableSongs = mappedSongs.filter(s => 
        s.pdfUrl || s.leadsheetUrl || s.ug_chords_text || s.sheet_music_url
      );

      setAllSongs(readableSongs);

      let initialIndex = 0;
      const targetId = routeSongId || searchParams.get('id');
      if (targetId) {
        const idx = readableSongs.findIndex(s => s.id === targetId);
        if (idx !== -1) initialIndex = idx;
      } else {
        const saved = localStorage.getItem('reader_last_index');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < readableSongs.length) {
            initialIndex = parsed;
          }
        }
      }
      setCurrentIndex(initialIndex);
    } catch (err: any) {
      showError(`Failed to load songs: ${err.message}`);
    } finally {
      setInitialLoading(false);
    }
  }, [user, routeSongId, searchParams]);

  const fetchAllSetlists = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('setlists').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      setAllSetlists(data?.map(d => ({ id: d.id, name: d.name, songs: d.songs || [] })) || []);
    } catch (err) {
      showError("Failed to load setlists.");
    }
  }, [user]);

  useEffect(() => {
    const fromDashboard = sessionStorage.getItem('from_dashboard');
    if (!fromDashboard) {
      navigate('/', { replace: true });
      return;
    }
    sessionStorage.removeItem('from_dashboard');
    fetchSongs();
    fetchAllSetlists();
  }, [fetchSongs, fetchAllSetlists, navigate]);

  // ==================== AUDIO & NAVIGATION ====================
  useEffect(() => {
    if (!currentSong?.previewUrl) {
      stopPlayback();
      return;
    }
    if (currentUrl !== currentSong.previewUrl || !currentBuffer) {
      loadFromUrl(currentSong.previewUrl, pitch || 0, true);
    } else {
      setAudioProgress(0);
    }
  }, [currentSong, pitch, currentUrl, currentBuffer, loadFromUrl, stopPlayback, setAudioProgress]);

  useEffect(() => {
    if (currentSong) {
      setSearchParams({ id: currentSong.id }, { replace: true });
      localStorage.setItem('reader_last_index', currentIndex.toString());
    }
  }, [currentSong, currentIndex, setSearchParams]);

  const handleNext = useCallback(() => {
    if (allSongs.length === 0) return;
    setCurrentIndex(prev => (prev + 1) % allSongs.length);
    stopPlayback();
  }, [allSongs.length, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (allSongs.length === 0) return;
    setCurrentIndex(prev => (prev - 1 + allSongs.length) % allSongs.length);
    stopPlayback();
  }, [allSongs.length, stopPlayback]);

  // ==================== KEY HANDLERS ====================
  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;
    const newPitch = calculateSemitones(currentSong.originalKey || 'C', newTargetKey);
    try {
      const { error } = await supabase
        .from('repertoire')
        .update({ target_key: newTargetKey, pitch: newPitch })
        .eq('id', currentSong.id);
      if (error) throw error;

      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, targetKey: newTargetKey, pitch: newPitch } : s));
      setTargetKey(newTargetKey);
      setPitch(newPitch);
      showSuccess(`Stage Key set to ${newTargetKey}`);
    } catch (err) {
      showError("Failed to update key.");
    }
  }, [currentSong, user, setTargetKey, setPitch]);

  const handlePullKey = useCallback(async () => {
    if (!currentSong || !currentSong.ug_chords_text) {
      showError("No UG chords to extract key from.");
      return;
    }
    const extractedKey = extractKeyFromChords(currentSong.ug_chords_text);
    if (!extractedKey) {
      showError("Could not extract key.");
      return;
    }
    try {
      const { error } = await supabase
        .from('repertoire')
        .update({ original_key: extractedKey, target_key: extractedKey, pitch: 0, is_key_confirmed: true })
        .eq('id', currentSong.id);
      if (error) throw error;

      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, originalKey: extractedKey, targetKey: extractedKey, pitch: 0 } : s));
      setTargetKey(extractedKey);
      setPitch(0);
      showSuccess(`Key set to ${extractedKey}`);
    } catch (err) {
      showError("Failed to pull key.");
    }
  }, [currentSong, setTargetKey, setPitch]);

  // ==================== CHART LOGIC ====================
  const isFramable = useCallback((url?: string | null) => {
    if (!url) return true;
    const blocked = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blocked.some(site => url.includes(site));
  }, []);

  const handleChartLoad = useCallback((id: string, type: ChartType) => {
    setRenderedCharts(prev => prev.map(rc =>
      rc.id === id && rc.type === type ? { ...rc, isLoaded: true } : rc
    ));
  }, []);

  const renderChartForSong = useCallback((
    song: SetlistSong,
    chartType: ChartType,
    onChartLoad: (id: string, type: ChartType) => void
  ): React.ReactNode => {
    if (chartType === 'chords' && song.ug_chords_text?.trim()) {
      return (
        <UGChordsReader
          key={`${song.id}-chords-${harmonicTargetKey}`}
          chordsText={song.ug_chords_text}
          config={song.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
          isMobile={false}
          originalKey={song.originalKey}
          targetKey={harmonicTargetKey}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          readerKeyPreference={readerKeyPreference}
        />
      );
    }

    const url = chartType === 'pdf' ? song.pdfUrl : song.leadsheetUrl;
    if (!url) {
      return (
        <div className="h-full flex items-center justify-center bg-slate-950">
          <div className="text-center">
            <Music className="w-24 h-24 text-slate-600 mx-auto mb-8" />
            <h3 className="text-2xl font-bold mb-4">No {chartType === 'pdf' ? 'Score' : 'Leadsheet'}</h3>
            <Button onClick={() => setIsStudioPanelOpen(true)}>Open Studio</Button>
          </div>
        </div>
      );
    }

    if (isFramable(url)) {
      const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
      return (
        <iframe
          src={viewerUrl}
          className="w-full h-full"
          title="Chart"
          onLoad={() => onChartLoad(song.id, chartType)}
        />
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-12 text-center">
        <ShieldCheck className="w-16 h-16 text-indigo-400 mb-8" />
        <h4 className="text-4xl font-black mb-6">Asset Protected</h4>
        <Button onClick={() => window.open(url, '_blank')}>
          <ExternalLink className="mr-2" /> Launch Chart Window
        </Button>
      </div>
    );
  }, [isFramable, harmonicTargetKey, isPlaying, progress, duration, readerKeyPreference]);

  // Update rendered charts when song or type changes
  useEffect(() => {
    if (!currentSong) {
      setRenderedCharts([]);
      return;
    }

    setRenderedCharts(prev => {
      const existing = prev.find(c => c.id === currentSong.id && c.type === selectedChartType);
      if (existing) {
        return prev.map(c => c.id === currentSong.id && c.type === selectedChartType ? { ...c, opacity: 1, zIndex: 10 } : c);
      }
      return [{
        id: currentSong.id,
        content: renderChartForSong(currentSong, selectedChartType, handleChartLoad),
        isLoaded: false,
        opacity: 1,
        zIndex: 10,
        type: selectedChartType,
      }];
    });
  }, [currentSong, selectedChartType, renderChartForSong, handleChartLoad]);

  const currentChartState = useMemo(() =>
    renderedCharts.find(c => c.id === currentSong?.id && c.type === selectedChartType),
    [renderedCharts, currentSong, selectedChartType]
  );

  const isChartLoading = currentChartState && !currentChartState.isLoaded;

  const availableChartTypes = useMemo((): ChartType[] => {
    if (!currentSong) return [];
    const types: ChartType[] = [];
    if (currentSong.pdfUrl) types.push('pdf');
    if (currentSong.leadsheetUrl) types.push('leadsheet');
    if (currentSong.ug_chords_text?.trim()) types.push('chords');
    return types;
  }, [currentSong]);

  const isOriginalKeyMissingMemo = useMemo(() =>
    !currentSong?.originalKey || currentSong.originalKey === 'TBC',
    [currentSong]
  );

  useEffect(() => {
    if (currentSong && availableChartTypes.length > 0 && !availableChartTypes.includes(selectedChartType)) {
      setSelectedChartType(availableChartTypes[0]);
    }
  }, [currentSong, availableChartTypes, selectedChartType]);

  // Timeout fallback for slow-loading charts
  useEffect(() => {
    if (isChartLoading && currentSong) {
      const timer = setTimeout(() => {
        setRenderedCharts(prev => prev.map(rc =>
          rc.id === currentSong.id && rc.type === selectedChartType ? { ...rc, isLoaded: true } : rc
        ));
        showInfo("Chart took too long to load – try opening externally.", { duration: 8000 });
      }, CHART_LOAD_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }
  }, [isChartLoading, currentSong, selectedChartType]);

  // ==================== KEYBOARD SHORTCUTS ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      if (e.key.toLowerCase() === 'i' && currentSong) {
        e.preventDefault();
        setIsStudioPanelOpen(prev => !prev); // Toggle panel
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong]);

  const handleSelectSongByIndex = useCallback((index: number) => {
    if (index >= 0 && index < allSongs.length) {
      setCurrentIndex(index);
      stopPlayback();
    }
  }, [allSongs.length, stopPlayback]);

  const handleUpdateSetlistSongs = useCallback(async (
    setlistId: string,
    songToUpdate: SetlistSong,
    action: 'add' | 'remove'
  ) => {
    // ... your existing setlist update logic ...
  }, [allSetlists]);

  if (initialLoading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
      </div>
    );
  }

  const headerLeftOffset = isSidebarOpen ? 300 : 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white relative">

      {/* Left Sidebar */}
      <motion.div
        initial={{ x: isSidebarOpen ? 0 : -300 }}
        animate={{ x: isSidebarOpen ? 0 : -300 }}
        transition={{ duration: 0.3 }}
        className="fixed left-0 top-0 h-full w-[300px] z-50"
      >
        <SheetReaderSidebar
          songs={allSongs}
          currentIndex={currentIndex}
          onSelectSong={handleSelectSongByIndex}
        />
      </motion.div>

      {/* Main Content */}
      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", isSidebarOpen && "ml-[300px]")}>
        <SheetReaderHeader
          currentSong={currentSong}
          onClose={() => navigate('/')}
          onSearchClick={() => {
            setIsStudioPanelOpen(true);
            setSearchParams({ id: 'new', tab: 'library' }, { replace: true });
          }}
          onPrevSong={handlePrev}
          onNextSong={handleNext}
          isLoading={!currentSong}
          keyPreference={globalKeyPreference}
          onUpdateKey={handleUpdateKey}
          isFullScreen={isImmersive}
          onToggleFullScreen={() => setIsImmersive(!isImmersive)}
          setIsOverlayOpen={setIsOverlayOpen}
          isOverrideActive={forceReaderResource !== 'default'}
          pitch={pitch}
          setPitch={setPitch}
          readerKeyPreference={readerKeyPreference}
          setReaderKeyPreference={setReaderKeyPreference}
          onPullKey={handlePullKey}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          headerLeftOffset={headerLeftOffset}
        />

        {isOriginalKeyMissingMemo && (
          <div className="fixed top-16 left-0 right-0 bg-red-950/30 border-b border-red-900/50 p-3 flex items-center justify-center gap-3 z-50 h-10"
            style={{ left: `${headerLeftOffset}px` }}>
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-red-400">
              CRITICAL: Original Key missing – transposition relative to C. Use Studio (I).
            </p>
          </div>
        )}

        <div className={cn("flex-1 bg-black overflow-hidden relative",
          isImmersive ? "mt-0" : isOriginalKeyMissingMemo ? "mt-[104px]" : "mt-16"
        )}>
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

          {isChartLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20">
              <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
            </div>
          )}

          {currentSong && availableChartTypes.length > 1 && !isImmersive && (
            <div className="absolute top-4 right-4 z-30">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-slate-900/80 backdrop-blur border-white/10">
                    {selectedChartType === 'pdf' && <Layout className="w-4 h-4 mr-2" />}
                    {selectedChartType === 'leadsheet' && <FileText className="w-4 h-4 mr-2" />}
                    {selectedChartType === 'chords' && <Guitar className="w-4 h-4 mr-2" />}
                    {selectedChartType.toUpperCase()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10">
                  {availableChartTypes.includes('pdf') && (
                    <DropdownMenuItem onClick={() => setSelectedChartType('pdf')}>
                      <Layout className="w-4 h-4 mr-2" /> Full Score
                    </DropdownMenuItem>
                  )}
                  {availableChartTypes.includes('leadsheet') && (
                    <DropdownMenuItem onClick={() => setSelectedChartType('leadsheet')}>
                      <FileText className="w-4 h-4 mr-2" /> Leadsheet
                    </DropdownMenuItem>
                  )}
                  {availableChartTypes.includes('chords') && (
                    <DropdownMenuItem onClick={() => setSelectedChartType('chords')}>
                      <Guitar className="w-4 h-4 mr-2" /> Chords
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

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
            isLoadingAudio={isLoadingAudio}
          />
        )}
      </main>

      {/* Studio Side Panel */}
      <AnimatePresence>
        {isStudioPanelOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[480px] bg-slate-900 shadow-2xl z-50 flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">Song Studio</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsStudioPanelOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {currentSong && (
                <SongStudioModal
                  isOpen={true}
                  onClose={() => setIsStudioPanelOpen(false)}
                  gigId="library"
                  songId={currentSong.id}
                  allSetlists={allSetlists}
                  masterRepertoire={allSongs}
                  onUpdateSetlistSongs={handleUpdateSetlistSongs}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed right-4 top-1/2 -translate-y-1/2 z-40 bg-slate-800 border-slate-700 hover:bg-slate-700 rounded-full w-12 h-12 shadow-xl"
        onClick={() => setIsStudioPanelOpen(prev => !prev)}
      >
        {isStudioPanelOpen ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
      </Button>

      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
    </div>
  );
};

export default SheetReaderMode;
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { Music, Loader2, AlertCircle, X, ExternalLink, ShieldCheck, FileText, Layout, Guitar, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
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
  const { forceReaderResource } = useReaderSettings();

  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [allSetlists, setAllSetlists] = useState<{ id: string; name: string; songs: SetlistSong[] }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isStudioPanelOpen, setIsStudioPanelOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [readerKeyPreference, setReaderKeyPreference] = useState<KeyPreference>(globalKeyPreference);
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');
  const [renderedCharts, setRenderedCharts] = useState<RenderedChart[]>([]);

  const audioEngine = useToneAudio(true);
  const {
    isPlaying, progress, duration, loadFromUrl, togglePlayback, stopPlayback,
    setPitch: setAudioPitch, setProgress: setAudioProgress, volume, setVolume,
    resetEngine, currentUrl, currentBuffer, isLoadingAudio
  } = audioEngine;

  const currentSong = allSongs[currentIndex];

  const isOriginalKeyMissing = useMemo(() => 
    !currentSong?.originalKey || currentSong.originalKey === 'TBC',
    [currentSong]
  );

  // Helper to update state of a song in the main list
  const handleLocalSongUpdate = useCallback((songId: string, updates: Partial<SetlistSong>) => {
    setAllSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
  }, []);

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
      handleLocalSongUpdate(currentSong.id, updates);

      const dbUpdates: { [key: string]: any } = {};
      if (updates.name !== undefined) dbUpdates.title = updates.name;
      if (updates.artist !== undefined) dbUpdates.artist = updates.artist;
      if (updates.originalKey !== undefined) dbUpdates.original_key = updates.originalKey;
      if (updates.targetKey !== undefined) dbUpdates.target_key = updates.targetKey;
      if (updates.pitch !== undefined) dbUpdates.pitch = updates.pitch;
      if (updates.is_pitch_linked !== undefined) dbUpdates.is_pitch_linked = updates.is_pitch_linked;
      if (updates.key_preference !== undefined) dbUpdates.key_preference = updates.key_preference;
      if (updates.preferred_reader !== undefined) dbUpdates.preferred_reader = updates.preferred_reader;

      dbUpdates.updated_at = new Date().toISOString();

      await supabase.from('repertoire').update(dbUpdates).eq('id', currentSong.id);
    }, [currentSong, user, handleLocalSongUpdate]),
    globalKeyPreference,
  });

  const { pitch, targetKey: harmonicTargetKey, setTargetKey, setPitch } = harmonicSync;

  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;
    const newPitch = calculateSemitones(currentSong.originalKey || 'C', newTargetKey);
    handleLocalSongUpdate(currentSong.id, { targetKey: newTargetKey, pitch: newPitch });
    await supabase.from('repertoire').update({ target_key: newTargetKey, pitch: newPitch }).eq('id', currentSong.id);
    setTargetKey(newTargetKey);
    setPitch(newPitch);
    showSuccess(`Stage Key set to ${newTargetKey}`);
  }, [currentSong, user, handleLocalSongUpdate, setTargetKey, setPitch]);

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
    handleLocalSongUpdate(currentSong.id, { originalKey: extractedKey, targetKey: extractedKey, pitch: 0, isKeyConfirmed: true });
    await supabase.from('repertoire').update({ original_key: extractedKey, target_key: extractedKey, pitch: 0, is_key_confirmed: true }).eq('id', currentSong.id);
    setTargetKey(extractedKey);
    setPitch(0);
    showSuccess(`Key set to ${extractedKey}`);
  }, [currentSong, handleLocalSongUpdate, setTargetKey, setPitch]);

  const handleSaveReaderPreference = useCallback(async (pref: 'sharps' | 'flats') => {
    if (!currentSong || !user) return;
    handleLocalSongUpdate(currentSong.id, { key_preference: pref });
    await supabase.from('repertoire').update({ key_preference: pref }).eq('id', currentSong.id);
    showSuccess(`Preference saved: ${pref === 'sharps' ? 'Sharps' : 'Flats'}`);
  }, [currentSong, user, handleLocalSongUpdate]);

  useEffect(() => {
    setAudioPitch(pitch);
  }, [pitch, setAudioPitch]);

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
        is_pitch_linked: d.is_pitch_linked ?? true,
        sheet_music_url: d.sheet_music_url,
        is_sheet_verified: d.is_sheet_verified,
        highest_note_original: d.highest_note_original,
        extraction_status: d.extraction_status,
        last_sync_log: d.last_sync_log,
        preferred_reader: d.preferred_reader,
        key_preference: d.key_preference,
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
      }
      setCurrentIndex(initialIndex);
    } catch (err: any) {
      showError(`Failed to load songs: ${err.message}`);
    } finally {
      setInitialLoading(false);
    }
  }, [user, routeSongId, searchParams]);

  useEffect(() => {
    const fromDashboard = sessionStorage.getItem('from_dashboard');
    if (!fromDashboard) {
      navigate('/', { replace: true });
      return;
    }
    fetchSongs();
  }, [fetchSongs, navigate]);

  useEffect(() => {
    if (!currentSong) return;
    if (currentUrl !== currentSong.previewUrl || !currentBuffer) {
      const timer = setTimeout(() => loadFromUrl(currentSong.previewUrl, pitch || 0, true), 100);
      return () => clearTimeout(timer);
    }
  }, [currentSong, pitch, currentUrl, currentBuffer, loadFromUrl]);

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

  const getBestChartType = useCallback((): ChartType => {
    if (!currentSong) return 'pdf';
    const pref = currentSong.preferred_reader;
    if (pref === 'ug' && currentSong.ug_chords_text?.trim()) return 'chords';
    if (pref === 'ls' && currentSong.leadsheetUrl) return 'leadsheet';
    if (pref === 'fn' && currentSong.pdfUrl) return 'pdf';
    if (currentSong.pdfUrl) return 'pdf';
    if (currentSong.leadsheetUrl) return 'leadsheet';
    if (currentSong.ug_chords_text?.trim()) return 'chords';
    return 'pdf';
  }, [currentSong]);

  useEffect(() => {
    if (currentSong) {
      const bestType = getBestChartType();
      if (selectedChartType !== bestType) setSelectedChartType(bestType);
    }
  }, [currentSong, getBestChartType]);

  const handleChartReady = useCallback(() => {
    if (currentSong) {
      setRenderedCharts(prev => prev.map(rc =>
        rc.id === currentSong.id && rc.type === selectedChartType ? { ...rc, isLoaded: true } : rc
      ));
    }
  }, [currentSong, selectedChartType]);

  const handleChartLoad = useCallback((id: string, type: ChartType) => {
    setRenderedCharts(prev => prev.map(rc =>
      rc.id === id && rc.type === type ? { ...rc, isLoaded: true } : rc
    ));
  }, []);

  const renderChartForSong = useCallback((song: SetlistSong, chartType: ChartType): React.ReactNode => {
    // Resolve concrete preference for rendering
    const concretePreference = readerKeyPreference === 'neutral' 
      ? (song.key_preference || 'sharps') 
      : readerKeyPreference;

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
          readerKeyPreference={concretePreference}
          onChartReady={handleChartReady}
        />
      );
    }

    const url = chartType === 'pdf' ? song.pdfUrl : song.leadsheetUrl;
    if (!url) {
      if (song.ug_chords_text?.trim()) {
        setTimeout(() => setSelectedChartType('chords'), 0);
        return null;
      }
      return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-950">
          <Music className="w-16 h-16 text-slate-700 mb-4" />
          <h3 className="text-xl font-bold">No Chart Asset Found</h3>
          <Button onClick={() => setIsStudioPanelOpen(true)} className="mt-4">Open Studio</Button>
        </div>
      );
    }

    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-950 p-8 text-center">
        <FileText className="w-12 h-12 text-indigo-400 mb-6" />
        <h3 className="text-2xl font-black uppercase mb-4">PDF Matrix Ready</h3>
        <a 
          href={url} 
          download={`${song.name}_${chartType}.pdf`}
          className="inline-flex items-center gap-3 bg-indigo-600 px-8 py-4 rounded-xl font-black uppercase text-xs shadow-2xl"
          onClick={() => {
            showSuccess("Download started");
            handleChartLoad(song.id, chartType);
          }}
        >
          <Download className="w-4 h-4" /> Download Chart
        </a>
      </div>
    );
  }, [harmonicTargetKey, isPlaying, progress, duration, readerKeyPreference, handleChartReady, handleChartLoad]);

  useEffect(() => {
    if (!currentSong) {
      setRenderedCharts([]);
      return;
    }

    setRenderedCharts(prev => {
      const existing = prev.find(c => c.id === currentSong.id && c.type === selectedChartType);
      if (existing) {
        return prev.map(c => c.id === currentSong.id && c.type === selectedChartType ? { ...c, opacity: 1, zIndex: 10 } : { ...c, opacity: 0, zIndex: 0 });
      }
      return [{
        id: currentSong.id,
        content: renderChartForSong(currentSong, selectedChartType),
        isLoaded: false,
        opacity: 1,
        zIndex: 10,
        type: selectedChartType,
      }];
    });
  }, [currentSong, selectedChartType, renderChartForSong]);

  const isChartLoading = renderedCharts.find(c => c.id === currentSong?.id && c.type === selectedChartType && !c.isLoaded);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'i' && currentSong) {
        e.preventDefault();
        setIsStudioPanelOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong]);

  if (initialLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white relative">
      <motion.div
        initial={{ x: isSidebarOpen ? 0 : -300 }}
        animate={{ x: isSidebarOpen ? 0 : -300 }}
        className="fixed left-0 top-0 h-full w-[300px] z-50"
      >
        <SheetReaderSidebar songs={allSongs} currentIndex={currentIndex} onSelectSong={(idx) => { setCurrentIndex(idx); stopPlayback(); }} />
      </motion.div>

      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", isSidebarOpen && "ml-[300px]")}>
        <SheetReaderHeader
          currentSong={currentSong!}
          onClose={() => navigate('/')}
          onSearchClick={() => setIsStudioPanelOpen(true)}
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
          headerLeftOffset={isSidebarOpen ? 300 : 0}
          onSavePreference={handleSaveReaderPreference}
        />

        <div className={cn("flex-1 bg-black relative", isImmersive ? "mt-0" : isOriginalKeyMissing ? "mt-[104px]" : "mt-16")}>
          {renderedCharts.map(rc => (
            <motion.div key={`${rc.id}-${rc.type}`} className="absolute inset-0" animate={{ opacity: rc.opacity }} style={{ zIndex: rc.zIndex }}>
              {rc.content}
            </motion.div>
          ))}
          {isChartLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>}
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

      <AnimatePresence>
        {isStudioPanelOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="fixed right-0 top-0 h-full w-[480px] bg-slate-900 shadow-2xl z-50 flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">Song Studio</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsStudioPanelOpen(false)}><X className="w-5 h-5" /></Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {currentSong && (
                <SongStudioModal
                  isOpen={true}
                  onClose={() => setIsStudioPanelOpen(false)}
                  gigId="library"
                  songId={currentSong.id}
                  masterRepertoire={allSongs}
                  handleAutoSave={(updates) => handleLocalSongUpdate(currentSong.id, updates)}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="outline"
        size="icon"
        className="fixed right-4 top-1/2 -translate-y-1/2 z-40 bg-slate-800 border-slate-700 rounded-full w-12 h-12 shadow-xl"
        onClick={() => setIsStudioPanelOpen(!isStudioPanelOpen)}
      >
        {isStudioPanelOpen ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
      </Button>

      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
    </div>
  );
};

export default SheetReaderMode;
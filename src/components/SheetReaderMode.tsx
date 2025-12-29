"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Loader2, AlertCircle, X, Settings, ExternalLink, ShieldCheck, FileText, Layout, Guitar, Sparkles } from 'lucide-react';
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
import SheetReaderSidebar from '@/components/SheetReaderSidebar'; // NEW: Import Sidebar
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { motion } from 'framer-motion';
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
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // NEW: Sidebar state

  const [readerKeyPreference, setReaderKeyPreference] = useState<'sharps' | 'flats'>(globalKeyPreference);
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');

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
    currentUrl,
    currentBuffer,
    isLoadingAudio
  } = audioEngine;

  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(false); // Default to false
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);

  const currentSong = allSongs[currentIndex];

  const handleAutoSave = useCallback(async (updates: Partial<SetlistSong>) => {
    if (!currentSong || !user) return;

    const dbUpdates: { [key: string]: any } = {};
    
    if (updates.name !== undefined) dbUpdates.title = updates.name;
    if (updates.artist !== undefined) dbUpdates.artist = updates.artist;
    if (updates.previewUrl !== undefined) dbUpdates.preview_url = updates.previewUrl;
    if (updates.youtubeUrl !== undefined) dbUpdates.youtube_url = updates.youtubeUrl;
    if (updates.ugUrl !== undefined) dbUpdates.ug_url = updates.ugUrl;
    if (updates.appleMusicUrl !== undefined) dbUpdates.apple_music_url = updates.appleMusicUrl;
    if (updates.pdfUrl !== undefined) dbUpdates.pdf_url = updates.pdfUrl;
    if (updates.leadsheetUrl !== undefined) dbUpdates.leadsheet_url = updates.leadsheetUrl;
    if (updates.originalKey !== undefined) dbUpdates.original_key = updates.originalKey;
    if (updates.targetKey !== undefined) dbUpdates.target_key = updates.targetKey;
    if (updates.pitch !== undefined) dbUpdates.pitch = updates.pitch;
    if (updates.bpm !== undefined) dbUpdates.bpm = updates.bpm;
    if (updates.genre !== undefined) dbUpdates.genre = updates.genre;
    if (updates.isMetadataConfirmed !== undefined) dbUpdates.is_metadata_confirmed = updates.isMetadataConfirmed;
    if (updates.isKeyConfirmed !== undefined) dbUpdates.is_key_confirmed = updates.isKeyConfirmed;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.lyrics !== undefined) dbUpdates.lyrics = updates.lyrics;
    if (updates.resources !== undefined) dbUpdates.resources = updates.resources;
    if (updates.user_tags !== undefined) dbUpdates.user_tags = updates.user_tags;
    if (updates.is_pitch_linked !== undefined) dbUpdates.is_pitch_linked = updates.is_pitch_linked;
    if (updates.duration_seconds !== undefined) dbUpdates.duration_seconds = Math.round(updates.duration_seconds || 0);
    if (updates.isApproved !== undefined) dbUpdates.is_approved = updates.isApproved;
    if (updates.preferred_reader !== undefined) dbUpdates.preferred_reader = updates.preferred_reader;
    if (updates.ug_chords_text !== undefined) dbUpdates.ug_chords_text = updates.ug_chords_text;
    if (updates.ug_chords_config !== undefined) dbUpdates.ug_chords_config = updates.ug_chords_config;
    if (updates.sheet_music_url !== undefined) dbUpdates.sheet_music_url = updates.sheet_music_url;
    if (updates.is_sheet_verified !== undefined) dbUpdates.is_sheet_verified = updates.is_sheet_verified;
    
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('repertoire')
      .update(dbUpdates)
      .eq('id', currentSong.id);

    if (error) {
      console.error("[SheetReaderMode] Auto-save failed:", error.message);
      showError('Auto-save failed');
    } else {
      setAllSongs(prev => prev.map(s =>
        s.id === currentSong.id ? { ...s, ...updates } : s
      ));
    }
  }, [currentSong, user]);

  const harmonicSync = useHarmonicSync({
    formData: {
      originalKey: currentSong?.originalKey,
      targetKey: currentSong?.targetKey || currentSong?.originalKey,
      pitch: currentSong?.pitch ?? 0,
      is_pitch_linked: currentSong?.is_pitch_linked ?? true,
      ug_chords_text: currentSong?.ug_chords_text,
    },
    handleAutoSave,
    globalKeyPreference,
  });

  const { pitch, setPitch, targetKey: harmonicTargetKey, setTargetKey } = harmonicSync;

  useEffect(() => {
    setAudioPitch(pitch);
  }, [pitch, setAudioPitch]);

  useEffect(() => {
    if (currentSong) {
      setTargetKey(currentSong.targetKey || currentSong.originalKey || 'C');
      setPitch(currentSong.pitch ?? 0);
    }
  }, [currentSong, setTargetKey, setPitch]);

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
        console.error("[SheetReaderMode] Fetch Error:", error.message);
        showError(`Failed to load repertoire: ${error.message}`);
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
        is_ug_link_verified: d.is_ug_link_verified,
        is_pitch_linked: d.is_pitch_linked ?? true,
        sheet_music_url: d.sheet_music_url,
        is_sheet_verified: d.is_sheet_verified,
        highest_note_original: d.highest_note_original,
        extraction_status: d.extraction_status
      }));

      const filtered = mappedSongs.filter(s => {
        const readiness = calculateReadiness(s);
        const hasChart = s.ugUrl || s.pdfUrl || s.leadsheetUrl || s.ug_chords_text;
        const meetsReadiness = readiness >= 40 || forceReaderResource === 'simulation' || ignoreConfirmedGate;
        return hasChart && meetsReadiness;
      });

      setAllSongs(filtered);

      let initialIndex = 0;
      const targetId = routeSongId || searchParams.get('id');

      if (targetId) {
        const idx = filtered.findIndex(s => s.id === targetId);
        if (idx !== -1) initialIndex = idx;
      } else {
        const saved = localStorage.getItem('reader_last_index');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < filtered.length) {
            initialIndex = parsed;
          }
        }
      }

      setCurrentIndex(initialIndex);
    } catch (err) {
    } finally {
      setInitialLoading(false);
    }
  }, [user, routeSongId, searchParams, forceReaderResource, ignoreConfirmedGate]);

  const fetchAllSetlists = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('setlists')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mapped = data.map(d => ({
          id: d.id,
          name: d.name,
          songs: (d.songs as any[]) || [],
          time_goal: d.time_goal
        }));
        setAllSetlists(mapped);
      }
    } catch (err: any) {
      console.error("[SheetReaderMode] Error fetching setlists:", err.message);
    }
  }, [user]);

  useEffect(() => {
    // FIX: Removed the session storage check to allow direct access/refresh, 
    // but kept the navigation to '/' if no user is present (handled by App.tsx ProtectedRoute)
    fetchSongs();
    fetchAllSetlists();
  }, [fetchSongs, fetchAllSetlists]);

  useEffect(() => {
    if (!currentSong?.previewUrl) {
      stopPlayback();
      return;
    }
    // FIX: Ensure audio is reset and reloaded if the song changes, even if the URL is the same 
    // (to ensure pitch/tempo settings are applied correctly to the new song context)
    if (currentUrl !== currentSong.previewUrl || !currentBuffer) {
      resetEngine();
      loadFromUrl(currentSong.previewUrl, pitch || 0, true);
    } else {
      setAudioProgress(0);
    }
  }, [currentSong, pitch, currentUrl, currentBuffer, loadFromUrl, stopPlayback, resetEngine, setAudioProgress]);

  useEffect(() => {
    if (currentSong) {
      setSearchParams({ id: currentSong.id }, { replace: true });
      localStorage.setItem('reader_last_index', currentIndex.toString());
    }
  }, [currentSong, currentIndex, setSearchParams]);

  const handleSelectSongByIndex = useCallback((index: number) => {
    if (index >= 0 && index < allSongs.length) {
      setCurrentIndex(index);
      stopPlayback();
    }
  }, [allSongs.length, stopPlayback]);

  const handleNext = useCallback(() => {
    if (allSongs.length === 0) return;
    handleSelectSongByIndex((currentIndex + 1) % allSongs.length);
  }, [allSongs.length, currentIndex, handleSelectSongByIndex]);

  const handlePrev = useCallback(() => {
    if (allSongs.length === 0) return;
    handleSelectSongByIndex((currentIndex - 1 + allSongs.length) % allSongs.length);
  }, [allSongs.length, currentIndex, handleSelectSongByIndex]);

  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;
    const newPitch = calculateSemitones(currentSong.originalKey || 'C', newTargetKey);
    handleAutoSave({ targetKey: newTargetKey, pitch: newPitch });
    showSuccess(`Stage Key set to ${newTargetKey}`);
  }, [currentSong, user, handleAutoSave]);

  const handlePullKey = useCallback(async () => {
    if (!currentSong || !user || !currentSong.ug_chords_text) {
      showError("No chords text available.");
      return;
    }
    const extracted = extractKeyFromChords(currentSong.ug_chords_text);
    if (extracted) {
      handleAutoSave({ 
        originalKey: extracted,
        targetKey: extracted,
        pitch: 0,
        isKeyConfirmed: true 
      });
      showSuccess(`Key extracted: ${extracted}`);
    } else {
      showError("Could not extract key.");
    }
  }, [currentSong, user, handleAutoSave]);

  const handleUpdateSetlistSongs = useCallback(async (
    setlistId: string,
    songToUpdate: SetlistSong,
    action: 'add' | 'remove'
  ) => {
    const targetSetlist = allSetlists.find(l => l.id === setlistId);
    if (!targetSetlist) return;

    let updated = [...targetSetlist.songs];
    if (action === 'add') {
      const exists = updated.some(s => (s.master_id === songToUpdate.master_id) || s.id === songToUpdate.id);
      if (!exists) {
        updated.push({
          ...songToUpdate,
          id: Math.random().toString(36).substr(2, 9),
          master_id: songToUpdate.master_id || songToUpdate.id,
          isPlayed: false,
          isApproved: false,
        });
      }
    } else {
      updated = updated.filter(s => (s.master_id !== songToUpdate.master_id) && s.id !== songToUpdate.id);
    }

    const { error } = await supabase.from('setlists').update({ songs: updated, updated_at: new Date().toISOString() }).eq('id', setlistId);
    if (error) showError('Failed to update setlist');
    else {
      setAllSetlists(prev => prev.map(l => l.id === setlistId ? { ...l, songs: updated } : l));
      showSuccess('Setlist updated');
    }
  }, [allSetlists]);

  const isFramable = useCallback((url: string | null | undefined) => {
    if (!url) return true;
    return !['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'].some(site => url.includes(site));
  }, []);

  const [renderedCharts, setRenderedCharts] = useState<RenderedChart[]>([]);

  const handleChartLoad = useCallback((id: string, type: ChartType) => {
    setRenderedCharts(prev => prev.map(rc => 
      rc.id === id && rc.type === type ? { ...rc, isLoaded: true } : rc
    ));
  }, []);

  const renderChartForSong = useCallback((song: SetlistSong, chartType: ChartType, onChartLoad: (id: string, type: ChartType) => void): React.ReactNode => {
    const readiness = calculateReadiness(song);
    const isReadyGatePassed = readiness >= 40 || forceReaderResource === 'simulation' || ignoreConfirmedGate;

    if (!isReadyGatePassed) {
      setTimeout(() => onChartLoad(song.id, chartType), 50);
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <AlertCircle className="w-24 h-24 text-red-500 mb-8" />
          <h2 className="text-4xl font-black uppercase text-white mb-4">Missing Resources</h2>
          <p className="text-xl text-slate-400 mb-8">Audit this track to link charts or audio.</p>
          <Button onClick={() => navigate('/')} className="text-lg px-10 py-6 bg-indigo-600 rounded-2xl">Go to Dashboard</Button>
        </div>
      );
    }

    if (chartType === 'chords') {
      if (song.ug_chords_text?.trim()) {
        setTimeout(() => onChartLoad(song.id, chartType), 50);
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
            chordAutoScrollEnabled={chordAutoScrollEnabled}
            chordScrollSpeed={chordScrollSpeed}
            readerKeyPreference={readerKeyPreference}
          />
        );
      }
      return renderChartForSong(song, 'pdf', onChartLoad);
    }

    const chartUrl = chartType === 'pdf' ? song.pdfUrl : song.leadsheetUrl;
    if (!chartUrl) {
      setTimeout(() => onChartLoad(song.id, chartType), 50);
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <Music className="w-24 h-24 text-slate-700 mb-8" />
          <h2 className="text-4xl font-black uppercase text-white mb-4">No {chartType === 'pdf' ? 'Score' : 'Leadsheet'}</h2>
          <Button onClick={() => setIsStudioModalOpen(true)} className="text-lg px-10 py-6 bg-indigo-600 rounded-2xl">Open Studio</Button>
        </div>
      );
    }

    const googleViewer = `https://docs.google.com/viewer?url=${encodeURIComponent(chartUrl)}&embedded=true`;

    if (isFramable(chartUrl)) {
      return (
        <div className="w-full h-full relative bg-black">
          <iframe key={`${song.id}-${chartType}`} src={googleViewer} className="absolute inset-0 w-full h-full" title="Viewer" style={{ border: 'none' }} allowFullScreen onLoad={() => onChartLoad(song.id, chartType)} />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            <a href={chartUrl} target="_blank" rel="noopener noreferrer" className="bg-indigo-600 hover:bg-indigo-700 px-8 py-4 rounded-2xl text-lg font-bold shadow-2xl">Open Externally →</a>
          </div>
        </div>
      );
    }

    setTimeout(() => onChartLoad(song.id, chartType), 50);
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
        <ShieldCheck className="w-12 h-12 text-indigo-400 mb-6" />
        <h4 className="text-3xl font-black uppercase text-white mb-4">Protected Asset</h4>
        <Button onClick={() => window.open(chartUrl, '_blank')} className="bg-indigo-600 h-16 px-10 font-black uppercase text-xs rounded-2xl shadow-2xl gap-4">
          <ExternalLink className="w-6 h-6" /> Launch Window
        </Button>
      </div>
    );
  }, [forceReaderResource, ignoreConfirmedGate, navigate, harmonicTargetKey, isFramable, isPlaying, progress, duration, chordAutoScrollEnabled, chordScrollSpeed, readerKeyPreference]);

  useEffect(() => {
    if (!currentSong) {
      setRenderedCharts([]);
      return;
    }
    setRenderedCharts(prev => {
      const currentId = currentSong.id;
      let current = prev.find(c => c.id === currentId && c.type === selectedChartType);
      if (!current) {
        current = {
          id: currentId,
          content: renderChartForSong(currentSong, selectedChartType, handleChartLoad),
          isLoaded: false,
          opacity: 1,
          zIndex: 10,
          type: selectedChartType,
        };
      } else {
        current.opacity = 1;
        current.zIndex = 10;
      }
      return [current];
    });
  }, [currentSong, selectedChartType, renderChartForSong, handleChartLoad]);

  const currentChartState = useMemo(() => 
    renderedCharts.find(c => c.id === currentSong?.id && c.type === selectedChartType),
    [renderedCharts, currentSong?.id, selectedChartType]
  );

  useEffect(() => {
    if (currentChartState && !currentChartState.isLoaded && currentSong) {
      const timeoutId = setTimeout(() => {
        if (!currentChartState.isLoaded) {
          setRenderedCharts(prev => prev.map(rc => rc.id === currentSong.id && rc.type === selectedChartType ? { ...rc, isLoaded: true } : rc));
        }
      }, CHART_LOAD_TIMEOUT_MS);
      return () => clearTimeout(timeoutId);
    }
  }, [currentChartState, currentSong, selectedChartType]);

  const availableChartTypes = useMemo((): ChartType[] => {
    if (currentSong) {
      const types: ChartType[] = [];
      if (currentSong.pdfUrl) types.push('pdf');
      if (currentSong.leadsheetUrl) types.push('leadsheet');
      if (currentSong.ug_chords_text?.trim()) types.push('chords');
      return types;
    }
    return [];
  }, [currentSong]);

  useEffect(() => {
    if (currentSong && availableChartTypes.length > 0 && !availableChartTypes.includes(selectedChartType)) {
      setSelectedChartType(availableChartTypes[0]);
    }
  }, [currentSong, availableChartTypes, selectedChartType]);

  // NEW: Keyboard navigation for songs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key.toLowerCase() === 'i' && currentSong) {
        e.preventDefault();
        setIsStudioModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong, handleNext, handlePrev]);

  if (initialLoading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white">
      
      {/* Sidebar */}
      <motion.div
        initial={{ x: isSidebarOpen ? 0 : -300 }}
        animate={{ x: isSidebarOpen ? 0 : -300 }}
        transition={{ duration: 0.3 }}
        className="h-full w-[300px] shrink-0 z-50"
      >
        <SheetReaderSidebar 
          songs={allSongs} 
          currentIndex={currentIndex} 
          onSelectSong={handleSelectSongByIndex} 
        />
      </motion.div>

      <main className="flex-1 flex flex-col overflow-hidden relative">
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
          readerKeyPreference={readerKeyPreference}
          setReaderKeyPreference={setReaderKeyPreference}
          onPullKey={handlePullKey}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {(!currentSong?.originalKey || currentSong.originalKey === 'TBC') && (
          <div className="fixed top-16 left-0 right-0 bg-red-950/30 border-b border-red-900/50 p-3 flex items-center justify-center gap-3 shrink-0 z-50 h-10">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-red-400">CRITICAL: Original Key missing. Set it in Studio (I).</p>
          </div>
        )}

        <div className={cn("flex-1 bg-black overflow-hidden relative", isImmersive ? "mt-0" : (!currentSong?.originalKey || currentSong.originalKey === 'TBC') ? "mt-[104px]" : "mt-16")}>
          {renderedCharts.map(rc => (
            <motion.div key={`${rc.id}-${rc.type}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: rc.opacity }} transition={{ duration: 0.3 }} style={{ zIndex: rc.zIndex }}>
              {rc.content}
            </motion.div>
          ))}
          {currentSong && !currentChartState?.isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20"><Loader2 className="w-16 h-16 animate-spin text-indigo-500" /></div>
          )}
          {currentSong && availableChartTypes.length > 1 && !isImmersive && (
            <div className="absolute top-4 right-4 z-30">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-slate-900/80 backdrop-blur border border-white/10 h-12 px-4 gap-2 shadow-2xl">
                    {selectedChartType === 'pdf' && <Layout className="w-4 h-4" />}
                    {selectedChartType === 'leadsheet' && <FileText className="w-4 h-4" />}
                    {selectedChartType === 'chords' && <Guitar className="w-4 h-4" />}
                    <span className="font-bold uppercase text-xs tracking-widest">{selectedChartType.toUpperCase()}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white min-w-[180px]">
                  {availableChartTypes.includes('pdf') && <DropdownMenuItem onClick={() => setSelectedChartType('pdf')} className="cursor-pointer font-bold"><Layout className="w-4 h-4 mr-2" /> Score</DropdownMenuItem>}
                  {availableChartTypes.includes('leadsheet') && <DropdownMenuItem onClick={() => setSelectedChartType('leadsheet')} className="cursor-pointer font-bold"><FileText className="w-4 h-4 mr-2" /> Leadsheet</DropdownMenuItem>}
                  {availableChartTypes.includes('chords') && <DropdownMenuItem onClick={() => setSelectedChartType('chords')} className="cursor-pointer font-bold"><Guitar className="w-4 h-4 mr-2" /> Chords</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {!isImmersive && currentSong && (
          <SheetReaderFooter
            currentSong={currentSong}
            isPlaying={isPlaying}
            progress={audioEngine.progress}
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
            isLoadingAudio={isLoadingAudio}
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
          allSetlists={allSetlists}
          masterRepertoire={allSongs}
          onUpdateSetlistSongs={handleUpdateSetlistSongs}
        />
      )}
    </div>
  );
};

export default SheetReaderMode;
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
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import UGChordsReader from '@/components/UGChordsReader';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { calculateSemitones } from '@/utils/keyUtils';
import { useReaderSettings, ReaderResourceForce } from '@/hooks/use-reader-settings';
import PreferencesModal from '@/components/PreferencesModal';
import SongStudioModal from '@/components/SongStudioModal';
import SheetReaderHeader from '@/components/SheetReaderHeader';
import SheetReaderSidebar from '@/components/SheetReaderSidebar';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { motion, AnimatePresence } from 'framer-motion';
import { extractKeyFromChords } from '@/utils/chordUtils';
import RepertoireSearchModal from '@/components/RepertoireSearchModal';

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
  const { forceReaderResource } = useReaderSettings();

  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [fullMasterRepertoire, setFullMasterRepertoire] = useState<SetlistSong[]>([]);
  const [currentSetlistSongs, setCurrentSetlistSongs] = useState<SetlistSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isBrowserFullScreen, setIsBrowserFullScreen] = useState(false);
  const [isStudioPanelOpen, setIsStudioPanelOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRepertoireSearchModalOpen, setIsRepertoireSearchModalOpen] = useState(false);

  const [readerKeyPreference, setReaderKeyPreference] = useState<'sharps' | 'flats'>(
    globalKeyPreference === 'neutral' ? 'sharps' : globalKeyPreference
  );
  
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');
  const [renderedCharts, setRenderedCharts] = useState<RenderedChart[]>([]);

  const audioEngine = useToneAudio(true);
  const {
    isPlaying, progress, duration, loadFromUrl, stopPlayback,
    setPitch: setAudioPitch, setProgress: setAudioProgress, volume, setVolume,
    currentUrl, currentBuffer, isLoadingAudio, tempo
  } = audioEngine;

  const currentSong = allSongs[currentIndex];

  // Sync state to current song's saved preference
  useEffect(() => {
    if (currentSong?.key_preference) {
      setReaderKeyPreference(currentSong.key_preference as 'sharps' | 'flats');
    } else if (globalKeyPreference !== 'neutral') {
      setReaderKeyPreference(globalKeyPreference as 'sharps' | 'flats');
    }
  }, [currentSong?.id, globalKeyPreference]);

  const handleLocalSongUpdate = useCallback((songId: string, updates: Partial<SetlistSong>) => {
    setAllSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
    setFullMasterRepertoire(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
    setCurrentSetlistSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
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
      console.log("[SheetReader] Auto-saving master updates via utility:", updates);
      
      try {
        const result = await syncToMasterRepertoire(user.id, [{
          ...updates,
          id: currentSong.id,
          name: currentSong.name,
          artist: currentSong.artist
        }]);
        
        if (result[0]) {
          handleLocalSongUpdate(currentSong.id, result[0]);
        }
      } catch (err) {
        console.error("Sheet Reader Auto-save failed:", err);
      }
    }, [currentSong, user, handleLocalSongUpdate]),
    globalKeyPreference,
  });

  const { pitch, targetKey: harmonicTargetKey, setTargetKey, setPitch } = harmonicSync;

  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;
    const newPitch = calculateSemitones(currentSong.originalKey || 'C', newTargetKey);
    
    try {
      // Use the utility to ensure timestamps are updated
      const result = await syncToMasterRepertoire(user.id, [{
        id: currentSong.id,
        name: currentSong.name,
        artist: currentSong.artist,
        targetKey: newTargetKey,
        pitch: newPitch
      }]);
      
      if (result[0]) {
        handleLocalSongUpdate(currentSong.id, result[0]);
        setTargetKey(newTargetKey);
        setPitch(newPitch);
        showSuccess(`Stage Key set to ${newTargetKey}`);
      }
    } catch (err) {
      showError("Failed to update Stage Key.");
    }
  }, [currentSong, user, handleLocalSongUpdate, setTargetKey, setPitch]);

  const handlePullKey = useCallback(async () => {
    if (!currentSong || !currentSong.ug_chords_text || !user) {
      showError("No UG chords to extract key from.");
      return;
    }
    const extractedKey = extractKeyFromChords(currentSong.ug_chords_text);
    if (!extractedKey) {
      showError("Could not extract key.");
      return;
    }
    
    try {
      const result = await syncToMasterRepertoire(user.id, [{
        id: currentSong.id,
        name: currentSong.name,
        artist: currentSong.artist,
        originalKey: extractedKey,
        targetKey: extractedKey,
        pitch: 0,
        isKeyConfirmed: true
      }]);
      
      if (result[0]) {
        handleLocalSongUpdate(currentSong.id, result[0]);
        setTargetKey(extractedKey);
        setPitch(0);
        showSuccess(`Key set to ${extractedKey}`);
      }
    } catch (err) {
      showError("Failed to pull key.");
    }
  }, [currentSong, user, handleLocalSongUpdate, setTargetKey, setPitch]);

  const handleSaveReaderPreference = useCallback(async (pref: 'sharps' | 'flats') => {
    if (!currentSong || !user) return;
    
    try {
      const result = await syncToMasterRepertoire(user.id, [{
        id: currentSong.id,
        name: currentSong.name,
        artist: currentSong.artist,
        key_preference: pref
      }]);
      
      if (result[0]) {
        handleLocalSongUpdate(currentSong.id, result[0]);
        showSuccess(`Preference saved: ${pref === 'sharps' ? 'Sharps' : 'Flats'}`);
      }
    } catch (err) {
      showError("Failed to save preference.");
    }
  }, [currentSong, user, handleLocalSongUpdate]);

  useEffect(() => {
    setAudioPitch(pitch);
  }, [pitch, setAudioPitch]);

  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setInitialLoading(true);

    try {
      const filterApproved = searchParams.get('filterApproved');
      const targetId = routeSongId || searchParams.get('id');

      let currentViewSongs: SetlistSong[] = [];
      let masterRepertoireList: SetlistSong[] = [];
      let activeSetlistSongsList: SetlistSong[] = [];

      // Always fetch full master repertoire
      const { data: masterData, error: masterError } = await supabase.from('repertoire').select('*').eq('user_id', user.id).order('title');
      if (masterError) throw masterError;
      masterRepertoireList = (masterData || []).map((d: any) => ({
        id: d.id,
        master_id: d.id,
        name: d.title,
        artist: d.artist,
        originalKey: d.original_key ?? 'TBC',
        targetKey: d.target_key ?? d.original_key ?? 'TBC',
        pitch: d.pitch ?? 0,
        // --- FIX: Prioritize audio_url for previewUrl ---
        previewUrl: d.extraction_status === 'completed' && d.audio_url ? d.audio_url : d.preview_url,
        // --- END FIX ---
        youtubeUrl: d.youtube_url,
        ugUrl: d.ug_url,
        appleMusicUrl: d.apple_music_url,
        pdfUrl: d.pdf_url,
        leadsheetUrl: d.leadsheet_url,
        bpm: d.bpm,
        genre: d.genre,
        isSyncing: false,
        isMetadataConfirmed: d.is_metadata_confirmed,
        isKeyConfirmed: d.is_key_confirmed,
        notes: d.notes,
        lyrics: d.lyrics,
        resources: d.resources || [],
        user_tags: d.user_tags || [],
        is_pitch_linked: d.is_pitch_linked ?? true,
        duration_seconds: d.duration_seconds,
        key_preference: d.key_preference,
        is_active: d.is_active,
        isApproved: d.is_approved,
        preferred_reader: d.preferred_reader,
        ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: d.is_ug_chords_present,
        highest_note_original: d.highest_note_original,
        metadata_source: d.metadata_source,
        sync_status: d.sync_status,
        last_sync_log: d.last_sync_log,
        auto_synced: d.auto_synced,
        is_sheet_verified: d.is_sheet_verified,
        sheet_music_url: d.sheet_music_url,
        extraction_status: d.extraction_status,
        extraction_error: d.extraction_error,
        audio_url: d.audio_url,
        lyrics_updated_at: d.lyrics_updated_at,
        chords_updated_at: d.chords_updated_at,
        ug_link_updated_at: d.ug_link_updated_at,
        highest_note_updated_at: d.highest_note_updated_at,
        original_key_updated_at: d.original_key_updated_at,
        target_key_updated_at: d.target_key_updated_at,
      }));
      setFullMasterRepertoire(masterRepertoireList);

      if (filterApproved === 'true') {
        const { data: setlistsData, error: setlistsError } = await supabase
          .from('setlists')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (setlistsError || !setlistsData || setlistsData.length === 0) {
          throw new Error("No active setlist found for approved songs.");
        }
        const activeSetlistId = setlistsData[0].id;

        const { data: junctionData, error: junctionError } = await supabase
          .from('setlist_songs')
          .select(`
            *,
            repertoire:song_id (
              id, title, artist, original_key, target_key, pitch, preview_url, youtube_url, ug_url, 
              apple_music_url, pdf_url, leadsheet_url, bpm, genre, is_metadata_confirmed, is_key_confirmed, 
              notes, lyrics, resources, user_tags, is_pitch_linked, duration_seconds, key_preference, 
              is_active, is_approved, preferred_reader, ug_chords_text, 
              ug_chords_config, is_ug_chords_present, highest_note_original, 
              metadata_source, sync_status, last_sync_log, auto_synced, is_sheet_verified, sheet_music_url, 
              extraction_status, extraction_error, audio_url, lyrics_updated_at, chords_updated_at, 
              ug_link_updated_at, highest_note_updated_at, original_key_updated_at, target_key_updated_at
            )
          `)
          .eq('setlist_id', activeSetlistId)
          .order('sort_order', { ascending: true });

        if (junctionError) throw junctionError;

        activeSetlistSongsList = (junctionData || []).map((junction: any) => {
          const masterSong = junction.repertoire;
          if (!masterSong) return null;
          return {
            id: junction.id,
            master_id: masterSong.id,
            name: masterSong.title,
            artist: masterSong.artist,
            originalKey: masterSong.original_key ?? 'TBC',
            targetKey: masterSong.target_key ?? masterSong.original_key ?? 'TBC',
            pitch: masterSong.pitch ?? 0,
            // --- FIX: Prioritize audio_url for previewUrl ---
            previewUrl: masterSong.extraction_status === 'completed' && masterSong.audio_url ? masterSong.audio_url : masterSong.preview_url,
            // --- END FIX ---
            youtubeUrl: masterSong.youtube_url,
            ugUrl: masterSong.ug_url,
            appleMusicUrl: masterSong.apple_music_url,
            pdfUrl: masterSong.pdf_url,
            leadsheetUrl: masterSong.leadsheet_url,
            bpm: masterSong.bpm,
            genre: masterSong.genre,
            isSyncing: false,
            isMetadataConfirmed: masterSong.is_metadata_confirmed,
            isKeyConfirmed: masterSong.is_key_confirmed,
            notes: masterSong.notes,
            lyrics: masterSong.lyrics,
            resources: masterSong.resources || [],
            user_tags: masterSong.user_tags || [],
            is_pitch_linked: masterSong.is_pitch_linked ?? true,
            duration_seconds: masterSong.duration_seconds,
            key_preference: masterSong.key_preference,
            is_active: masterSong.is_active,
            isApproved: masterSong.is_approved,
            preferred_reader: masterSong.preferred_reader,
            ug_chords_text: masterSong.ug_chords_text,
            ug_chords_config: masterSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
            is_ug_chords_present: masterSong.is_ug_chords_present,
            highest_note_original: masterSong.highest_note_original,
            metadata_source: masterSong.metadata_source,
            sync_status: masterSong.sync_status,
            last_sync_log: masterSong.last_sync_log,
            auto_synced: masterSong.auto_synced,
            is_sheet_verified: masterSong.is_sheet_verified,
            sheet_music_url: masterSong.sheet_music_url,
            extraction_status: masterSong.extraction_status,
            extraction_error: masterSong.extraction_error,
            audio_url: masterSong.audio_url,
            lyrics_updated_at: masterSong.lyrics_updated_at,
            chords_updated_at: masterSong.chords_updated_at,
            ug_link_updated_at: masterSong.ug_link_updated_at,
            highest_note_updated_at: masterSong.highest_note_updated_at,
            original_key_updated_at: masterSong.original_key_updated_at,
            target_key_updated_at: masterSong.target_key_updated_at,
            isPlayed: junction.isPlayed || false,
          };
        }).filter(Boolean) as SetlistSong[];
        setCurrentSetlistSongs(activeSetlistSongsList);
        currentViewSongs = activeSetlistSongsList;
      } else {
        currentViewSongs = masterRepertoireList;
      }

      const readableSongs = currentViewSongs.filter(s => 
        s.pdfUrl || s.leadsheetUrl || s.ug_chords_text || s.sheet_music_url
      );

      const uniqueSongsMap = new Map<string, SetlistSong>();
      readableSongs.forEach(song => {
        const key = song.master_id || song.id;
        if (key && !uniqueSongsMap.has(key)) {
          uniqueSongsMap.set(key, song);
        }
      });
      const uniqueReadableSongs = Array.from(uniqueSongsMap.values());

      setAllSongs(uniqueReadableSongs);

      let initialIndex = 0;
      if (targetId) {
        const idx = uniqueReadableSongs.findIndex(s => s.id === targetId || s.master_id === targetId);
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
    // --- FIX: Use currentSong.previewUrl which is now correctly prioritized ---
    if (currentUrl !== currentSong.previewUrl || !currentBuffer) {
      const timer = setTimeout(() => loadFromUrl(currentSong.previewUrl, pitch || 0), 100);
      return () => clearTimeout(timer);
    }
    // --- END FIX ---
  }, [currentSong, currentUrl, currentBuffer, loadFromUrl, pitch]);

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

    // 1. Prioritize based on user's preferred_reader setting
    if (pref === 'ug' && currentSong.ug_chords_text?.trim()) return 'chords';
    if (pref === 'ls' && currentSong.leadsheetUrl) return 'leadsheet';
    if (pref === 'fn' && currentSong.pdfUrl) return 'pdf';

    // 2. Prioritize UG Chords if present (default preference)
    if (currentSong.ug_chords_text?.trim()) return 'chords';

    // 3. Then PDF
    if (currentSong.pdfUrl) return 'pdf';

    // 4. Then Leadsheet
    if (currentSong.leadsheetUrl) return 'leadsheet';

    // 5. Fallback
    return 'pdf';
  }, [currentSong]);

  useEffect(() => {
    if (currentSong) {
      const bestType = getBestChartType();
      if (selectedChartType !== bestType) setSelectedChartType(bestType);
    }
  }, [currentSong, getBestChartType, selectedChartType]);

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
          onChartReady={handleChartReady}
        />
      );
    }

    const url = chartType === 'pdf' ? song.pdfUrl : song.leadsheetUrl;
    if (!url) {
      // If no PDF/Leadsheet URL, and chords are available, switch to chords view
      if (song.ug_chords_text?.trim()) {
        setTimeout(() => setSelectedChartType('chords'), 0);
        return null; // Return null for now, the effect will re-render with chords
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
  }, [harmonicTargetKey, isPlaying, progress, duration, readerKeyPreference, handleChartReady, handleChartLoad, setSelectedChartType, setIsStudioPanelOpen]);

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

  // Browser Fullscreen API logic
  const toggleBrowserFullScreen = useCallback(() => {
    // This function uses the standard Fullscreen API, which is generally well-supported
    // across modern browsers on various devices, including mobile and tablets.
    // The button triggering this is designed to be touch-friendly.
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        showError(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsBrowserFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const onOpenCurrentSongStudio = useCallback(() => {
    if (currentSong) {
      setIsStudioPanelOpen(true);
    } else {
      showInfo("No song selected to open in Studio.");
    }
  }, [currentSong]);

  const handleSelectSongFromRepertoireSearch = useCallback((song: SetlistSong) => {
    const idx = allSongs.findIndex(s => s.id === song.id || s.master_id === song.master_id);
    if (idx !== -1) {
      setCurrentIndex(idx);
    } else {
      // If the selected song isn't in the current 'allSongs' list (e.g., due to filters),
      // we need to re-fetch or add it. For simplicity, let's just navigate to it.
      navigate(`/sheet-reader/${song.id}`);
    }
    stopPlayback();
    setIsRepertoireSearchModalOpen(false);
  }, [allSongs, navigate, stopPlayback]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'i':
        case 'I':
          if (currentSong) {
            e.preventDefault();
            onOpenCurrentSongStudio();
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong, onOpenCurrentSongStudio, handlePrev, handleNext]);

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
          onOpenRepertoireSearch={() => setIsRepertoireSearchModalOpen(true)}
          onOpenCurrentSongStudio={onOpenCurrentSongStudio}
          onPrevSong={handlePrev}
          onNextSong={handleNext}
          isLoading={!currentSong}
          keyPreference={globalKeyPreference}
          onUpdateKey={handleUpdateKey}
          isFullScreen={isBrowserFullScreen}
          onToggleFullScreen={toggleBrowserFullScreen}
          setIsOverlayOpen={setIsOverlayOpen}
          isOverrideActive={forceReaderResource !== 'default'}
          pitch={pitch}
          setPitch={setPitch}
          isPlaying={isPlaying}
          isLoadingAudio={isLoadingAudio}
          onTogglePlayback={audioEngine.togglePlayback}
          onLoadAudio={loadFromUrl}
          progress={progress}
          duration={duration}
          onSetProgress={setAudioProgress}
          onStopPlayback={stopPlayback}
          volume={volume}
          setVolume={setVolume}
          tempo={tempo}
          readerKeyPreference={readerKeyPreference}
          setReaderKeyPreference={setReaderKeyPreference}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          headerLeftOffset={isSidebarOpen ? 300 : 0}
          onSavePreference={handleSaveReaderPreference}
          audioEngine={audioEngine}
        />

        <div className={cn("flex-1 bg-black relative", isBrowserFullScreen ? "mt-0" : "mt-[112px]")}>
          {renderedCharts.map(rc => (
            <motion.div key={`${rc.id}-${rc.type}`} className="absolute inset-0" animate={{ opacity: rc.opacity }} style={{ zIndex: rc.zIndex }}>
              {rc.content}
            </motion.div>
          ))}
          {isChartLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>}
        </div>
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
                  visibleSongs={allSongs}
                  handleAutoSave={(updates) => handleLocalSongUpdate(currentSong.id, updates)}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RepertoireSearchModal
        isOpen={isRepertoireSearchModalOpen}
        onClose={() => setIsRepertoireSearchModalOpen(false)}
        masterRepertoire={fullMasterRepertoire}
        currentSetlistSongs={currentSetlistSongs}
        onSelectSong={handleSelectSongFromRepertoireSearch}
      />

      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
    </div>
  );
};

export default SheetReaderMode;
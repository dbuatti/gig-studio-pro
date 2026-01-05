"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong, UGChordsConfig } from '@/components/SetlistManager';
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
import { extractKeyFromChords } from '@/utils/chordUtils';
import RepertoireSearchModal from '@/components/RepertoireSearchModal';
import FullScreenSongInfo from '@/components/FullScreenSongInfo';
import { AnimatePresence } from 'framer-motion';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

// Configure PDF.js worker source to point to the file in the public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
console.log("[SheetReaderMode] pdfjs.GlobalWorkerOptions.workerSrc set to:", pdfjs.GlobalWorkerOptions.workerSrc);


export type ChartType = 'pdf' | 'leadsheet' | 'chords';

const SheetReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId } = useParams<{ songId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { 
    keyPreference: globalKeyPreference,
    ugChordsFontFamily,
    ugChordsFontSize,
    ugChordsChordBold,
    ugChordsChordColor,
    ugChordsLineSpacing,
    ugChordsTextAlign,
    preventStageKeyOverwrite,
    setKeyPreference: setGlobalKeyPreference
  } = useSettings();
  const { forceReaderResource } = useReaderSettings();

  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [fullMasterRepertoire, setFullMasterRepertoire] = useState<SetlistSong[]>([]);
  const [currentSetlistSongs, setCurrentSetlistSongs] = useState<SetlistSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isBrowserFullScreen, setIsBrowserFullScreen] = useState(false);
  const [isStudioPanelOpen, setIsStudioPanel] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRepertoireSearchModalOpen, setIsRepertoireSearchModalOpen] = useState(false);

  const [readerKeyPreference, setReaderKeyPreference] = useState<'sharps' | 'flats'>(
    globalKeyPreference === 'neutral' ? 'sharps' : globalKeyPreference
  );
  
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');
  const [isChartContentLoading, setIsChartContentLoading] = useState(false);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);

  const audioEngine = useToneAudio(true);
  const {
    isPlaying, progress, duration, loadFromUrl, stopPlayback,
    setPitch: setAudioPitch, setProgress: setAudioProgress, volume, setVolume,
    currentUrl, currentBuffer, isLoadingAudio, tempo
  } = audioEngine;

  const currentSong = allSongs[currentIndex];

  // Refs for PDF scrolling and swipe detection
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const swipeThreshold = 80; // Pixels for horizontal swipe to register
  const navigatedRef = useRef(false); // NEW: Ref to prevent multiple navigations per swipe

  // Animation for horizontal drag
  const [{ x: springX }, api] = useSpring(() => ({ x: 0 }));

  // Sync state to current song's saved preference
  useEffect(() => {
    if (currentSong?.key_preference) {
      setReaderKeyPreference(currentSong.key_preference as 'sharps' | 'flats');
    } else if (globalKeyPreference !== 'neutral') {
      setReaderKeyPreference(globalKeyPreference as 'sharps' | 'flats');
    }
  }, [currentSong?.id, globalKeyPreference]);

  // Reset PDF page when current song changes
  useEffect(() => {
    setPdfCurrentPage(1);
    setPdfNumPages(null); // Reset total pages too
  }, [currentSong?.id]);

  const handleLocalSongUpdate = useCallback((songId: string, updates: Partial<SetlistSong>) => {
    setAllSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
    setFullMasterRepertoire(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
    setCurrentSetlistSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
  }, []);

  const harmonicSync = useHarmonicSync({
    formData: {
      id: currentSong?.id,
      originalKey: currentSong?.originalKey,
      targetKey: currentSong?.targetKey || currentSong?.originalKey,
      pitch: currentSong?.pitch ?? 0,
      is_pitch_linked: currentSong?.is_pitch_linked ?? true,
      ug_chords_text: currentSong?.ug_chords_text,
      isKeyConfirmed: currentSong?.isKeyConfirmed,
    },
    handleAutoSave: useCallback(async (updates: Partial<SetlistSong>) => {
      if (!currentSong || !user) return;
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
    preventStageKeyOverwrite,
  });

  const { 
    pitch: effectivePitch,
    targetKey: effectiveTargetKey,
    setTargetKey, 
    setPitch, 
    isStageKeyLocked 
  } = harmonicSync;

  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;

    setTargetKey(newTargetKey); 
    setAudioPitch(calculateSemitones(currentSong.originalKey || 'C', newTargetKey));
    
    if (isStageKeyLocked) {
      showInfo(`Stage Key temporarily set to ${newTargetKey}`);
    } else {
      showSuccess(`Stage Key set to ${newTargetKey}`);
    }
  }, [currentSong, user, isStageKeyLocked, setTargetKey, setAudioPitch]);

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
    
    setTargetKey(extractedKey); 
    setPitch(0);
    setAudioPitch(0);
    
    if (isStageKeyLocked) {
      showInfo(`Key temporarily set to ${extractedKey}`);
    } else {
      showSuccess(`Key set to ${extractedKey}`);
    }
  }, [currentSong, user, isStageKeyLocked, setTargetKey, setPitch, setAudioPitch]);

  useEffect(() => {
    setAudioPitch(effectivePitch);
  }, [effectivePitch, setAudioPitch]);

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
        previewUrl: d.extraction_status === 'completed' && d.audio_url ? d.audio_url : d.preview_url,
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
            previewUrl: masterSong.extraction_status === 'completed' && masterSong.audio_url ? masterSong.audio_url : masterSong.preview_url,
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
      console.error("[SheetReaderMode] Error fetching songs:", err);
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

  const getBestChartType = useCallback((song: SetlistSong): ChartType => {
    if (forceReaderResource === 'force-pdf' && song.pdfUrl) return 'pdf';
    if (forceReaderResource === 'force-ug' && (song.ugUrl || song.ug_chords_text)) return 'chords';
    if (forceReaderResource === 'force-chords' && song.ug_chords_text) return 'chords';

    if (song.preferred_reader === 'ug' && (song.ugUrl || song.ug_chords_text)) return 'chords';
    if (song.preferred_reader === 'ls' && song.leadsheetUrl) return 'leadsheet';
    if (song.preferred_reader === 'fn' && (song.sheet_music_url || song.pdfUrl)) return 'pdf';

    if (song.pdfUrl) return 'pdf';
    if (song.leadsheetUrl) return 'leadsheet';
    if (song.ug_chords_text) return 'chords';
    if (song.ugUrl) return 'chords';
    if (song.sheet_music_url) return 'pdf';

    return 'pdf';
  }, [forceReaderResource]);

  const getChartUrlForType = useCallback((song: SetlistSong, type: ChartType): string | null => {
    switch (type) {
      case 'pdf': return song.pdfUrl;
      case 'leadsheet': return song.leadsheetUrl;
      case 'chords': return null; // Chords are handled by UGChordsReader, not an iframe URL
      default: return null;
    }
  }, []);

  useEffect(() => {
    if (currentSong) {
      const bestType = getBestChartType(currentSong);
      if (selectedChartType !== bestType) {
        setSelectedChartType(bestType);
        setIsChartContentLoading(true);
      }
    } else {
      setSelectedChartType('pdf');
      setIsChartContentLoading(false);
    }
  }, [currentSong, getBestChartType, selectedChartType]);

  const isFramable = useCallback((url: string | null | undefined) => {
    if (!url) return true;
    const blockedSites = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blockedSites.some(site => url.includes(site));
  }, []);

  const handleNext = useCallback(() => {
    if (allSongs.length > 0) {
      console.log(`[SheetReaderMode] handleNext called. Current index: ${currentIndex}`);
      setCurrentIndex((prevIndex) => {
        const newIndex = (prevIndex + 1) % allSongs.length;
        console.log(`[SheetReaderMode] New index after next: ${newIndex}`);
        return newIndex;
      });
      stopPlayback();
      if (chartContainerRef.current) {
        chartContainerRef.current.scrollLeft = 0;
      }
    }
  }, [allSongs, currentIndex, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (allSongs.length > 0) {
      console.log(`[SheetReaderMode] handlePrev called. Current index: ${currentIndex}`);
      setCurrentIndex((prevIndex) => {
        const newIndex = (prevIndex - 1 + allSongs.length) % allSongs.length;
        console.log(`[SheetReaderMode] New index after prev: ${newIndex}`);
        return newIndex;
      });
      stopPlayback();
      if (chartContainerRef.current) {
        chartContainerRef.current.scrollLeft = 0;
      }
    }
  }, [allSongs, currentIndex, stopPlayback]);

  const toggleBrowserFullScreen = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setIsBrowserFullScreen(prev => !prev);
      return;
    }

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
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      if (!isStandalone) {
        setIsBrowserFullScreen(!!document.fullscreenElement);
      }
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const onOpenCurrentSongStudio = useCallback(() => {
    if (currentSong) {
      setIsStudioPanel(true);
    } else {
      showInfo("No song selected to open in Studio.");
    }
  }, [currentSong]);

  const handleSelectSongFromRepertoireSearch = useCallback((song: SetlistSong) => {
    const idx = allSongs.findIndex(s => s.id === song.id || s.master_id === song.master_id);
    if (idx !== -1) {
      setCurrentIndex(idx);
    } else {
      navigate(`/sheet-reader/${song.id}`);
    }
    stopPlayback();
    setIsRepertoireSearchModalOpen(false);
  }, [allSongs, navigate, stopPlayback]);

  const handleSaveReaderPreference = useCallback((pref: 'sharps' | 'flats') => {
    setReaderKeyPreference(pref);
    if (globalKeyPreference !== 'neutral') {
      setGlobalKeyPreference(pref);
    }
    showSuccess(`Reader preference saved to ${pref === 'sharps' ? 'Sharps' : 'Flats'}`);
  }, [setGlobalKeyPreference, globalKeyPreference]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
            setPdfCurrentPage(prev => Math.max(1, prev - 1));
          } else {
            handlePrev();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
            setPdfCurrentPage(prev => Math.min(prev + 1, pdfNumPages || 999));
          } else {
            handleNext();
          }
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
  }, [currentSong, onOpenCurrentSongStudio, handlePrev, handleNext, selectedChartType, pdfNumPages]);

  // --- Gesture Implementation ---
  const bind = useDrag(({ first, down, movement: [mx, my], direction: [dx], velocity: [vx], cancel, intentional }) => {
    console.log(`[Drag Event] first: ${first}, down: ${down}, mx: ${mx.toFixed(2)}, my: ${my.toFixed(2)}, dx: ${dx.toFixed(2)}, vx: ${vx.toFixed(2)}, navigatedRef: ${navigatedRef.current}`);

    // Reset navigatedRef unconditionally at the very beginning of a new gesture
    if (first) {
      navigatedRef.current = false;
    }

    api.start({ x: down ? mx : 0, immediate: down });

    // Only process swipe if intentional and primarily horizontal
    if (!intentional || Math.abs(mx) < Math.abs(my)) {
      return;
    }

    const isFastSwipe = Math.abs(vx) > 0.3; // velocity in pixels/ms
    const isLongSwipe = Math.abs(mx) > swipeThreshold;
    const isMediumFastSwipe = Math.abs(mx) > swipeThreshold / 2 && isFastSwipe; // Moved at least half threshold AND fast

    // The core condition for triggering navigation
    const shouldTriggerNavigation = (isLongSwipe || isMediumFastSwipe) && !navigatedRef.current;
    
    if (shouldTriggerNavigation) {
      navigatedRef.current = true; // Mark as navigated for this gesture
      cancel(); // Stop further updates for this specific gesture

      if (dx < 0) { // Swiping left (next)
        if (selectedChartType === 'chords') {
          handleNext();
        } else if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
          if (pdfCurrentPage < (pdfNumPages || 1)) {
            setPdfCurrentPage(prev => prev + 1);
          } else {
            handleNext(); // Last PDF page, go to next song
          }
        }
      } else { // Swiping right (previous)
        if (selectedChartType === 'chords') {
          handlePrev();
        } else if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
          if (pdfCurrentPage > 1) {
            setPdfCurrentPage(prev => prev - 1);
          } else {
            handlePrev(); // First PDF page, go to previous song
          }
        }
      }
      api.start({ x: 0 });
    }
  }, {
    threshold: 20,        // Initial movement before drag starts
    filterTaps: true,     // Ignore quick taps
    axis: 'x',            // Lock to horizontal
    // Removed preventScroll and bounds
  });

  // NEW: Effect to reset navigatedRef when the drag gesture ends
  useEffect(() => {
    const handleDragEndReset = () => {
      if (navigatedRef.current) {
        navigatedRef.current = false;
      }
    };

    chartContainerRef.current?.addEventListener('pointerup', handleDragEndReset);
    chartContainerRef.current?.addEventListener('pointercancel', handleDragEndReset); // Also reset on cancel

    return () => {
      chartContainerRef.current?.removeEventListener('pointerup', handleDragEndReset);
      chartContainerRef.current?.removeEventListener('pointercancel', handleDragEndReset);
    };
  }, [bind]);


  if (initialLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white relative">
      {/* Sidebar */}
      <div className={cn("fixed left-0 top-0 h-full w-[300px] z-50 transition-transform duration-300", 
        isSidebarOpen && !isBrowserFullScreen ? "translate-x-0" : "-translate-x-full")}>
        <SheetReaderSidebar songs={allSongs} currentIndex={currentIndex} onSelectSong={(idx) => { setCurrentIndex(idx); stopPlayback(); }} isFullScreen={isBrowserFullScreen} />
      </div>

      {/* Main Content */}
      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", 
        isSidebarOpen && !isBrowserFullScreen && "ml-[300px]")}
      >
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
          pitch={effectivePitch}
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
          isSidebarOpen={isSidebarOpen && !isBrowserFullScreen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          headerLeftOffset={isSidebarOpen && !isBrowserFullScreen ? 300 : 0}
          onSavePreference={handleSaveReaderPreference}
          audioEngine={audioEngine}
          effectiveTargetKey={effectiveTargetKey}
          onPullKey={handlePullKey}
          pdfCurrentPage={pdfCurrentPage}
          setPdfCurrentPage={setPdfCurrentPage}
          selectedChartType={selectedChartType}
        />

        {/* Chart Container */}
        <div
          ref={chartContainerRef}
          className={cn(
            "flex-1 bg-black relative overflow-hidden", 
            isBrowserFullScreen ? "mt-0" : "mt-[112px]",
            "overscroll-behavior-x-contain"
          )}
        >
          <animated.div 
            {...bind()}  
            style={{ 
              x: springX, 
              touchAction: 'none'
            }} 
            className="h-full w-full relative"
          >
            {currentSong ? (
              selectedChartType === 'chords' ? (
                <UGChordsReader
                  chordsText={currentSong.ug_chords_text || ""}
                  config={currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
                  isMobile={false}
                  originalKey={currentSong.originalKey}
                  targetKey={effectiveTargetKey}
                  isPlaying={isPlaying}
                  progress={progress}
                  duration={duration}
                  readerKeyPreference={readerKeyPreference}
                  onChartReady={() => setIsChartContentLoading(false)}
                />
              ) : (
                (() => {
                  const url = getChartUrlForType(currentSong, selectedChartType);
                  console.log("[SheetReaderMode] Attempting to load PDF from URL:", url); // Log PDF URL
                  if (url) {
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        <Document
                          file={url}
                          onLoadSuccess={({ numPages }) => {
                            console.log("[SheetReaderMode] PDF Document loaded successfully. Pages:", numPages); // Log success
                            setPdfNumPages(numPages);
                            setIsChartContentLoading(false);
                          }}
                          onLoadError={(error) => {
                            console.error("[SheetReaderMode] Error loading PDF Document:", error); // Log error
                            showError("Failed to load PDF document.");
                            setIsChartContentLoading(false);
                          }}
                          loading={<Loader2 className="w-12 h-12 animate-spin text-indigo-500" />}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <Page
                            pageNumber={pdfCurrentPage}
                            width={chartContainerRef.current?.offsetWidth || undefined}
                            height={chartContainerRef.current?.offsetHeight || undefined}
                            renderAnnotationLayer={true}
                            renderTextLayer={true}
                            loading={<Loader2 className="w-8 h-8 animate-spin text-indigo-400" />}
                            onRenderSuccess={() => {
                              console.log("[SheetReaderMode] PDF Page rendered successfully."); // Log page render success
                              setIsChartContentLoading(false);
                            }}
                          />
                        </Document>
                      </div>
                    );
                  }
                  return (
                    <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                      <p>No {selectedChartType} available for this track.</p>
                    </div>
                  );
                })()
              )
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                <p>No song selected or available.</p>
              </div>
            )}
          </animated.div>
          
          {isChartContentLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>}
        </div>
      </main>

      {isBrowserFullScreen && currentSong && (
        <FullScreenSongInfo
          song={currentSong}
          onExitFullScreen={toggleBrowserFullScreen}
          readerKeyPreference={readerKeyPreference}
          onUpdateKey={handleUpdateKey}
          setIsOverlayOpen={setIsOverlayOpen}
          effectiveTargetKey={effectiveTargetKey}
        />
      )}

      <AnimatePresence>
        {isStudioPanelOpen && (
          <div className="fixed right-0 top-0 h-full w-[480px] bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">Song Studio</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsStudioPanel(false)}><X className="w-5 h-5" /></Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {currentSong && (
                <SongStudioModal
                  isOpen={true}
                  onClose={() => setIsStudioPanel(false)}
                  gigId="library"
                  songId={currentSong.id}
                  visibleSongs={allSongs}
                  handleAutoSave={(updates) => handleLocalSongUpdate(currentSong.id, updates)}
                  preventStageKeyOverwrite={preventStageKeyOverwrite}
                />
              )}
            </div>
          </div>
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
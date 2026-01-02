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
import PdfViewer from '@/components/PdfViewer'; // NEW import

export type ChartType = 'pdf' | 'leadsheet' | 'chords'; // Exporting ChartType

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
    setKeyPreference: setGlobalKeyPreference // NEW: Get the setter for global key preference
  } = useSettings();
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
  const [isChartContentLoading, setIsChartContentLoading] = useState(false); // NEW state for chart content loading
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1); // NEW: State for current PDF page

  const audioEngine = useToneAudio(true);
  const {
    isPlaying, progress, duration, loadFromUrl, stopPlayback,
    setPitch: setAudioPitch, setProgress: setAudioProgress, volume, setVolume,
    currentUrl, currentBuffer, isLoadingAudio, tempo
  } = audioEngine;

  const currentSong = allSongs[currentIndex];

  // Refs for PDF scrolling and swipe detection
  const chartContainerRef = useRef<HTMLDivElement>(null); // Renamed from pdfContainerRef for clarity
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const swipeThreshold = 50; // pixels

  // Sync state to current song's saved preference
  useEffect(() => {
    if (currentSong?.key_preference) {
      setReaderKeyPreference(currentSong.key_preference as 'sharps' | 'flats');
    } else if (globalKeyPreference !== 'neutral') {
      setReaderKeyPreference(globalKeyPreference as 'sharps' | 'flats');
    }
  }, [currentSong?.id, globalKeyPreference]);

  // NEW: Reset PDF page when current song changes
  useEffect(() => {
    setPdfCurrentPage(1);
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
        original_key_updated_at: d.original_key_updated_at, // FIX: Changed from masterData
        target_key_updated_at: d.target_key_updated_at, // FIX: Changed from masterData
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
            original_key_updated_at: masterSong.original_key_updated_at, // FIX: Changed from masterData
            target_key_updated_at: masterSong.target_key_updated_at, // FIX: Changed from masterData
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
      if (selectedChartType !== bestType) { // Only update if different
        setSelectedChartType(bestType);
        setIsChartContentLoading(true); // Start loading when chart type changes
      }
    } else {
      setSelectedChartType('pdf'); // Reset if no song
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
      setCurrentIndex((prevIndex) => (prevIndex + 1) % allSongs.length);
      stopPlayback();
      // Reset PDF scroll position when changing songs
      if (chartContainerRef.current) {
        chartContainerRef.current.scrollLeft = 0;
      }
      console.log("[SheetReaderMode] Navigating to next song.");
    }
  }, [allSongs, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (allSongs.length > 0) {
      setCurrentIndex((prevIndex) => (prevIndex - 1 + allSongs.length) % allSongs.length);
      stopPlayback();
      // Reset PDF scroll position when changing songs
      if (chartContainerRef.current) {
        chartContainerRef.current.scrollLeft = 0;
      }
      console.log("[SheetReaderMode] Navigating to previous song.");
    }
  }, [allSongs, stopPlayback]);

  // --- NEW: Touch/Swipe Logic for PDF Navigation ---
  
  const handleTouchStart = (e: React.TouchEvent) => {
    console.log("[SheetReaderMode] Touch Start: X:", e.touches[0].clientX, "Y:", e.touches[0].clientY);
    // Only handle touch if we are in PDF mode
    if (selectedChartType !== 'pdf' && selectedChartType !== 'leadsheet' && selectedChartType !== 'chords') return;
    
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    console.log("[SheetReaderMode] Touch Move: X:", e.touches[0].clientX, "Y:", e.touches[0].clientY);
    if (selectedChartType !== 'pdf' && selectedChartType !== 'leadsheet' && selectedChartType !== 'chords') return;
    
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    console.log("[SheetReaderMode] Touch End");
    if (selectedChartType !== 'pdf' && selectedChartType !== 'leadsheet' && selectedChartType !== 'chords') return;

    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = touchEndY.current - touchStartY.current;
    console.log("[SheetReaderMode] Touch End: DeltaX:", deltaX, "DeltaY:", deltaY);

    const container = chartContainerRef.current;
    if (!container) return;

    // Determine if it's a horizontal swipe (dominant direction)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > swipeThreshold) {
      if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
        // Swipe Left (Next PDF Page)
        if (deltaX < 0) { // Swiping left
          setPdfCurrentPage(prev => {
            console.log("[SheetReaderMode] Swiped left, next PDF page: Current prev:", prev);
            const newPage = Math.min(prev + 1, 999); // Arbitrary max page
            console.log("[SheetReaderMode] Swiped left, next PDF page: New page:", newPage);
            return newPage;
          });
        } 
        // Swipe Right (Prev PDF Page)
        else if (deltaX > 0) { // Swiping right
          setPdfCurrentPage(prev => {
            console.log("[SheetReaderMode] Swiped right, previous PDF page: Current prev:", prev);
            const newPage = Math.max(1, prev - 1);
            console.log("[SheetReaderMode] Swiped right, previous PDF page: New page:", newPage);
            return newPage;
          });
        }
      } else if (selectedChartType === 'chords') {
        // For chords, horizontal swipe navigates songs
        if (deltaX < 0) { // Swiping left
          console.log("[SheetReaderMode] Swiped left on chords, next song.");
          handleNext();
        } 
        else if (deltaX > 0) { // Swiped right
          console.log("[SheetReaderMode] Swiped right on chords, previous song.");
          handlePrev();
        }
      }
    }
    // For vertical swipes or non-significant horizontal swipes, allow native scrolling.
    // The `touchAction: 'pan-y'` on the container should handle vertical scrolling for chords.
    // For iframes, the browser handles internal scrolling.

    // Reset touch values
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchEndX.current = 0;
    touchEndY.current = 0;
  };

  // Tap Navigation (Left/Right side of screen)
  const handleContainerClick = (e: React.MouseEvent) => {
    console.log("[SheetReaderMode] Container Click");
    if (selectedChartType !== 'pdf' && selectedChartType !== 'leadsheet') return;
    
    const container = chartContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    // Only trigger if not a swipe (to avoid double-triggering on short taps that are also swipes)
    // This check is a bit tricky with the current touchEnd logic.
    // For now, let's assume a click is a distinct event.
    
    if (clickX < width * 0.3) {
      // Tap Left: Prev PDF Page
      setPdfCurrentPage(prev => {
        console.log("[SheetReaderMode] Tapped left, previous PDF page: Current prev:", prev);
        const newPage = Math.max(1, prev - 1);
        console.log("[SheetReaderMode] Tapped left, previous PDF page: New page:", newPage);
        return newPage;
      });
    } else if (clickX > width * 0.7) {
      // Tap Right: Next PDF Page
      setPdfCurrentPage(prev => {
        console.log("[SheetReaderMode] Tapped right, next PDF page: Current prev:", prev);
        const newPage = Math.min(prev + 1, 999); // Arbitrary max page
        console.log("[SheetReaderMode] Tapped right, next PDF page: New page:", newPage);
        return newPage;
      });
    }
  };

  // --- END NEW LOGIC ---

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
      navigate(`/sheet-reader/${song.id}`);
    }
    stopPlayback();
    setIsRepertoireSearchModalOpen(false);
  }, [allSongs, navigate, stopPlayback]);

  // FIX: Define handleSaveReaderPreference
  const handleSaveReaderPreference = useCallback((pref: 'sharps' | 'flats') => {
    setReaderKeyPreference(pref);
    // Also save to global settings if it's not 'neutral'
    if (globalKeyPreference !== 'neutral') { // Only save if global is not neutral, otherwise it's a temporary override
      setGlobalKeyPreference(pref);
    }
    showSuccess(`Reader preference saved to ${pref === 'sharps' ? 'Sharps' : 'Flats'}`);
  }, [setGlobalKeyPreference, globalKeyPreference]);

  // Keyboard shortcuts for navigation (Left/Right arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
            setPdfCurrentPage(prev => {
              console.log("[SheetReaderMode] Keyboard ArrowLeft, previous PDF page: Current prev:", prev);
              const newPage = Math.max(1, prev - 1);
              console.log("[SheetReaderMode] Keyboard ArrowLeft, previous PDF page: New page:", newPage);
              return newPage;
            });
          } else {
            handlePrev();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
            setPdfCurrentPage(prev => {
              console.log("[SheetReaderMode] Keyboard ArrowRight, next PDF page: Current prev:", prev);
              const newPage = Math.min(prev + 1, 999); // Arbitrary max page
              console.log("[SheetReaderMode] Keyboard ArrowRight, next PDF page: New page:", newPage);
              return newPage;
            });
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
  }, [currentSong, onOpenCurrentSongStudio, handlePrev, handleNext, selectedChartType]); // NEW: Add selectedChartType to dependencies

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
          pdfCurrentPage={pdfCurrentPage} // NEW: Pass pdfCurrentPage
          setPdfCurrentPage={setPdfCurrentPage} // NEW: Pass setPdfCurrentPage
          selectedChartType={selectedChartType} // NEW: Pass selectedChartType
        />

        {/* Chart Container */}
        <div
          ref={chartContainerRef}
          className={cn("flex-1 bg-black relative overflow-hidden", isBrowserFullScreen ? "mt-0" : "mt-[112px]")}
        >
          {/* Transparent overlay to capture touch events over the iframe */}
          {(selectedChartType === 'pdf' || selectedChartType === 'leadsheet' || selectedChartType === 'chords') && (
            <div 
              className="absolute inset-0 z-10"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={handleContainerClick}
              style={{ touchAction: 'pan-y' }}
            />
          )}

          {currentSong ? (
            <>
              {selectedChartType === 'chords' ? (
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
                  onChartReady={() => setIsChartContentLoading(false)} // Chart is ready
                />
              ) : (
                (() => {
                  const url = getChartUrlForType(currentSong, selectedChartType);
                  if (url && isFramable(url)) {
                    return (
                      <div className="w-full h-full">
                        <PdfViewer
                          url={url}
                          page={pdfCurrentPage}
                          onLoad={() => setIsChartContentLoading(false)} // Iframe loaded
                        />
                      </div>
                    );
                  } else if (url) {
                    // Protected asset view
                    return (
                      <div className="h-full w-full flex flex-col items-center justify-center p-6 md:p-12 text-center bg-slate-950">
                        <ShieldCheck className="w-12 h-12 md:w-16 md:h-16 text-indigo-400 mb-6 md:mb-10" />
                        <h4 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4 md:mb-6 text-white">Asset Protected</h4>
                        <p className="text-slate-500 max-xl mb-8 md:mb-16 text-lg md:text-xl font-medium leading-relaxed">
                          External security prevents in-app display. Use the button below to launch in a secure dedicated performance window.
                        </p>
                        <Button onClick={() => window.open(url, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-16 md:h-20 px-10 md:px-16 font-black uppercase tracking-[0.2em] text-xs md:text-sm rounded-2xl md:rounded-3xl shadow-2xl shadow-indigo-600/30 gap-4 md:gap-6">
                          <ExternalLink className="w-6 h-6 md:w-8 md:h-8" /> Launch Chart Window
                        </Button>
                      </div>
                    );
                  }
                  // No URL available for PDF/Leadsheet
                  return (
                    <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                      <p>No {selectedChartType} available for this track.</p>
                    </div>
                  );
                })()
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
              <p>No song selected or available.</p>
            </div>
          )}
          
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
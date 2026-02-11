"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong, UGChordsConfig } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { Music, Loader2, AlertCircle, X, ExternalLink, ShieldCheck, FileText, Layout, Guitar, ChevronLeft, ChevronRight, Download, Link as LinkIcon, Ruler, Edit3, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG, DEFAULT_FILTERS } from '@/utils/constants';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { showError, showSuccess, showInfo, showWarning } from '@/utils/toast';
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
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import SheetReaderAudioPlayer from '@/components/SheetReaderAudioPlayer';
import LinkEditorOverlay from '@/components/LinkEditorOverlay';
import LinkDisplayOverlay, { SheetLink } from '@/components/LinkDisplayOverlay';
import LinkSizeModal from '@/components/LinkSizeModal';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

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
    disablePortraitPdfScroll,
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRepertoireSearchModalOpen, setIsRepertoireSearchModalOpen] = useState(false);
  const [isInfoOverlayVisible, setIsInfoOverlayVisible] = useState(true);
  const [isAudioPlayerVisible, setIsAudioPlayerVisible] = useState(true);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  const currentSong = allSongs[currentIndex];

  const readerKeyPreference = useMemo<'sharps' | 'flats'>(() => {
    if (currentSong?.key_preference && currentSong.key_preference !== 'neutral') {
      return currentSong.key_preference as 'sharps' | 'flats';
    }
    if (globalKeyPreference !== 'neutral') {
      return globalKeyPreference as 'sharps' | 'flats';
    }
    return 'sharps';
  }, [currentSong?.key_preference, globalKeyPreference]);
  
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');
  const [isChartContentLoading, setIsChartContentLoading] = useState(false);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfScale, setPdfScale] = useState<number | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);

  const [links, setLinks] = useState<SheetLink[]>([]);
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  const [isLinkSizeModalOpen, setIsLinkSizeModalOpen] = useState(false);
  const [isEditingLinksMode, setIsEditingLinksMode] = useState(false);

  const audioEngine = useToneAudio(true);
  const {
    isPlaying, progress, duration, loadFromUrl, stopPlayback,
    setPitch: setAudioPitch, setProgress: setAudioProgress, volume, setVolume,
    currentUrl, currentBuffer, isLoadingAudio, tempo
  } = audioEngine;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const overlayWrapperRef = useRef<HTMLDivElement>(null);
  const swipeThreshold = 50;
  const navigatedRef = useRef(false);

  const [{}, api] = useSpring(() => ({ x: 0 }));

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setPdfCurrentPage(1);
    setPdfNumPages(null);
    setPdfScale(null);
    setPdfDocument(null);
    setLinks([]);
  }, [currentSong?.id]);

  const handleLocalSongUpdate = useCallback((songId: string, updates: Partial<SetlistSong>) => {
    setAllSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
    setFullMasterRepertoire(prev => prev.map(s => (s.master_id || s.id) === (updates.master_id || songId) ? { ...s, ...updates } : s));
    setCurrentSetlistSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
  }, []);

  const harmonicSync = useHarmonicSync({
    formData: {
      id: currentSong?.master_id || currentSong?.id,
      originalKey: currentSong?.originalKey,
      targetKey: currentSong?.targetKey || currentSong?.originalKey,
      pitch: currentSong?.pitch ?? 0,
      is_pitch_linked: currentSong?.is_pitch_linked ?? true,
      ug_chords_text: currentSong?.ug_chords_text,
      isKeyConfirmed: currentSong?.isKeyConfirmed,
      key_preference: currentSong?.key_preference,
    },
    handleAutoSave: useCallback(async (updates: Partial<SetlistSong>) => {
      if (!currentSong || !user) return;
      try {
        const masterId = currentSong.master_id || currentSong.id;
        const result = await syncToMasterRepertoire(user.id, [{
          ...updates,
          id: masterId,
          name: currentSong.name,
          artist: currentSong.artist
        }]);
        
        if (result[0]) {
          handleLocalSongUpdate(currentSong.id, { ...result[0], master_id: masterId });
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
      showError("Could not extract key from chords.");
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

  useEffect(() => {
    if (currentSong) {
      const urlToLoad = currentSong.audio_url || currentSong.previewUrl;
      audioEngine.setPitch(currentSong.pitch || 0);
      audioEngine.setTempo(currentSong.tempo || 1); 
      audioEngine.setFineTune(currentSong.fineTune || 0);

      if (urlToLoad) {
        audioEngine.loadFromUrl(urlToLoad, currentSong.pitch || 0);
      } else {
        audioEngine.resetEngine();
        showWarning("Selected song has no audio link.");
      }
    } else {
      audioEngine.resetEngine();
    }
  }, [currentSong, audioEngine]);

  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setInitialLoading(true);

    try {
      const readerViewMode = sessionStorage.getItem('reader_view_mode');
      const readerSetlistId = sessionStorage.getItem('reader_setlist_id');
      const targetId = routeSongId || searchParams.get('id');

      // Load filters from local storage
      const savedFilters = localStorage.getItem('gig_active_filters');
      const activeFilters = savedFilters ? JSON.parse(savedFilters) : DEFAULT_FILTERS;
      const searchTerm = (localStorage.getItem('gig_search_term') || "").toLowerCase();

      console.log("[SheetReader] Loaded filters from localStorage:", activeFilters);
      console.log("[SheetReader] Loaded searchTerm from localStorage:", searchTerm);

      let currentViewSongs: SetlistSong[] = [];
      let masterRepertoireList: SetlistSong[] = [];
      let activeSetlistSongsList: SetlistSong[] = [];

      const { data: masterData, error: masterError } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title');
      
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
        pdf_updated_at: d.pdf_updated_at,
        fineTune: d.fineTune,
        tempo: d.tempo,
        volume: d.volume,
        energy_level: d.energy_level,
      }));
      setFullMasterRepertoire(masterRepertoireList);

      if (readerViewMode === 'gigs' && readerSetlistId) {
        const { data: junctionData, error: junctionError } = await supabase
          .from('setlist_songs')
          .select('song_id, id, isPlayed, sort_order')
          .eq('setlist_id', readerSetlistId)
          .order('sort_order', { ascending: true });

        if (junctionError) throw junctionError;

        activeSetlistSongsList = (junctionData || []).map((junction: any) => {
          const masterSong = masterRepertoireList.find(m => m.id === junction.song_id);
          if (!masterSong) return null;
          return {
            ...masterSong,
            id: junction.id,
            master_id: masterSong.id,
            isPlayed: junction.isPlayed || false,
          };
        }).filter(Boolean) as SetlistSong[];
        
        setCurrentSetlistSongs(activeSetlistSongsList);
        currentViewSongs = activeSetlistSongsList;
      } else {
        currentViewSongs = masterRepertoireList;
      }

      console.log("[SheetReader] Total songs before filtering:", currentViewSongs.length);

      // Apply Filters and Search
      const filteredSongs = currentViewSongs.filter(s => {
        // Search
        if (searchTerm && !s.name.toLowerCase().includes(searchTerm) && !s.artist?.toLowerCase().includes(searchTerm)) {
          return false;
        }

        // Filters
        const readiness = calculateReadiness(s);
        const hasAudio = !!s.audio_url;
        const hasItunesPreview = !!s.previewUrl && (s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'));
        const hasVideo = !!s.youtubeUrl;
        const hasPdf = !!s.pdfUrl || !!s.leadsheetUrl || !!s.sheet_music_url;
        const hasUg = !!s.ugUrl;
        const hasUgChords = !!s.ug_chords_text && s.ug_chords_text.trim().length > 0;
        const hasLyrics = !!s.lyrics && s.lyrics.length > 20;

        if (activeFilters.readiness > 0 && readiness < activeFilters.readiness) return false;
        if (activeFilters.isConfirmed === 'yes' && !s.isKeyConfirmed) return false;
        if (activeFilters.isConfirmed === 'no' && s.isKeyConfirmed) return false;
        if (activeFilters.isApproved === 'yes' && !s.isApproved) return false;
        if (activeFilters.isApproved === 'no' && s.isApproved) return false;
        if (activeFilters.hasAudio === 'full' && !hasAudio) return false;
        if (activeFilters.hasAudio === 'itunes' && !hasItunesPreview) return false;
        if (activeFilters.hasAudio === 'none' && (hasAudio || hasItunesPreview)) return false;
        if (activeFilters.hasVideo === 'yes' && !hasVideo) return false;
        if (activeFilters.hasVideo === 'no' && hasVideo) return false;
        if (activeFilters.hasChart === 'yes' && !(hasPdf || hasUg || hasUgChords)) return false;
        if (activeFilters.hasChart === 'no' && (hasPdf || hasUg || hasUgChords)) return false;
        if (activeFilters.hasPdf === 'yes' && !hasPdf) return false;
        if (activeFilters.hasPdf === 'no' && hasPdf) return false;
        if (activeFilters.hasUg === 'yes' && !hasUg) return false;
        if (activeFilters.hasUg === 'no' && hasUg) return false;
        if (activeFilters.hasUgChords === 'yes' && !hasUgChords) return false;
        if (activeFilters.hasUgChords === 'no' && hasUgChords) return false;
        if (activeFilters.hasLyrics === 'yes' && !hasLyrics) return false;
        if (activeFilters.hasLyrics === 'no' && hasLyrics) return false;
        if (activeFilters.hasHighestNote === 'yes' && !s.highest_note_original) return false; 
        if (activeFilters.hasHighestNote === 'no' && s.highest_note_original) return false; 
        if (activeFilters.hasOriginalKey === 'yes' && (!s.originalKey || s.originalKey === 'TBC')) return false; 
        if (activeFilters.hasOriginalKey === 'no' && (s.originalKey && s.originalKey !== 'TBC')) return false; 

        return true;
      });

      console.log("[SheetReader] Songs after applying filters:", filteredSongs.length);

      const readableSongs = filteredSongs.filter(s => 
        s.pdfUrl || s.leadsheetUrl || s.ug_chords_text || s.sheet_music_url
      );

      console.log("[SheetReader] Songs after filtering for readability:", readableSongs.length);

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

  const fetchLinks = useCallback(async () => {
    if (!user || !currentSong?.master_id || selectedChartType === 'chords') {
      setLinks([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('sheet_links')
        .select('*')
        .eq('song_id', currentSong.master_id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      setLinks(data || []);
    } catch (err: any) {
      console.error("[SheetReaderMode] Error fetching links:", err.message);
      showError("Failed to load links.");
    }
  }, [user, currentSong?.master_id, selectedChartType]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

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

  const currentChartDisplayUrl = useMemo(() => {
    if (!currentSong) return null;
    switch (selectedChartType) {
      case 'pdf': return currentSong.pdfUrl || currentSong.sheet_music_url;
      case 'leadsheet': return currentSong.leadsheetUrl;
      case 'chords': return null; 
      default: return null;
    }
  }, [currentSong, selectedChartType]);

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
      setCurrentIndex((prevIndex) => {
        const newIndex = (prevIndex + 1) % allSongs.length;
        return newIndex;
      });
      stopPlayback();
      if (chartContainerRef.current) {
        chartContainerRef.current.scrollLeft = 0;
      }
    }
  }, [allSongs, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (allSongs.length > 0) {
      setCurrentIndex((prevIndex) => {
        const newIndex = (prevIndex - 1 + allSongs.length) % allSongs.length;
        return newIndex;
      });
      stopPlayback();
      if (chartContainerRef.current) {
        chartContainerRef.current.scrollLeft = 0;
      }
    }
  }, [allSongs, stopPlayback]);

  const toggleBrowserFullScreen = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setIsBrowserFullScreen(prev => !prev);
      setIsInfoOverlayVisible(true); 
      setIsAudioPlayerVisible(true); 
      return;
    }

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        showError(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
      });
      if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
        setIsInfoOverlayVisible(false);
      } else {
        setIsInfoOverlayVisible(true); 
      }
      setIsAudioPlayerVisible(true); 
    } else {
      document.exitFullscreen();
      setIsInfoOverlayVisible(false); 
      setIsAudioPlayerVisible(false); 
    }
  }, [selectedChartType]);

  useEffect(() => {
    const handleFullScreenChange = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      if (!isStandalone) {
        setIsBrowserFullScreen(!!document.fullscreenElement);
        if (!document.fullscreenElement) {
          setIsInfoOverlayVisible(false); 
          setIsAudioPlayerVisible(false); 
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  useEffect(() => {
    if (isBrowserFullScreen) {
      if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
        setIsInfoOverlayVisible(false); 
      } else {
        setIsInfoOverlayVisible(true); 
      }
    }
  }, [currentSong?.id, selectedChartType, isBrowserFullScreen]);


  const onOpenCurrentSongStudio = useCallback(() => {
    if (currentSong) {
      setIsStudioPanel(true);
    } else {
      showInfo("No song selected to open in Studio.");
    }
  }, [currentSong]);

  const onOpenRepertoireSearch = () => {
    setIsRepertoireSearchModalOpen(true);
  };

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
    if (globalKeyPreference !== 'neutral') {
      setGlobalKeyPreference(pref);
    }
    showSuccess(`Reader preference saved to ${pref === 'sharps' ? 'Sharps' : 'Flats'}`);
  }, [setGlobalKeyPreference, globalKeyPreference]);

  const onAddLink = useCallback(() => {
    if (currentChartDisplayUrl && pdfDocument) {
      setIsLinkEditorOpen(true);
    } else {
      showInfo("No PDF available to add links.");
    }
  }, [currentChartDisplayUrl, pdfDocument]);

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
            setPdfCurrentPage(prev => Math.min(prev + pageStep, pdfNumPages || 999)); 
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
        case 'p':
        case 'P':
          e.preventDefault();
          setIsAudioPlayerVisible(prev => !prev); 
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          navigate('/');
          break;
        case 'l': 
        case 'L':
          e.preventDefault();
          if (currentChartDisplayUrl && pdfDocument) { 
            setIsLinkEditorOpen(prev => !prev);
          } else {
            showInfo("No PDF available to add links.");
          }
          break;
        case 'e': 
        case 'E':
          e.preventDefault();
          if (currentChartDisplayUrl) { 
            setIsEditingLinksMode(prev => !prev);
            showInfo(`Link editing mode ${isEditingLinksMode ? 'disabled' : 'enabled'}.`);
          } else {
            showInfo("No PDF available to edit links.");
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong, onOpenCurrentSongStudio, handlePrev, handleNext, selectedChartType, pdfNumPages, isEditingLinksMode, currentChartDisplayUrl, onAddLink, navigate]);

  const calculatePdfScale = useCallback(async (pdf: PDFDocumentProxy, container: HTMLDivElement, pageNumber: number) => {
    if (!container || !pdf) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;

      // Add padding to prevent cutoff (reduce available height by 10%)
      const availableHeight = containerHeight * 0.95;
      const availableWidth = containerWidth * 0.95;

      const scaleX = availableWidth / pageWidth;
      const scaleY = availableHeight / pageHeight;

      setPdfScale(Math.min(scaleX, scaleY));
    } catch (error) {
      console.error("[SheetReaderMode] Error calculating PDF scale:", error);
    }
  }, []);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !pdfDocument) return; 

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === container) {
          calculatePdfScale(pdfDocument, container, pdfCurrentPage); 
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.unobserve(container);
    };
  }, [pdfDocument, pdfCurrentPage, calculatePdfScale]); 


  const bind = useDrag(({ first, down, movement: [mx], direction: [dx], velocity: [vx], cancel }) => {

    if (first) {
      navigatedRef.current = false; 
    }

    if (!down) { 
      if (navigatedRef.current) {
        navigatedRef.current = false; 
      }
      return;
    }

    if (navigatedRef.current) {
      return;
    }

    const isFastSwipe = Math.abs(vx) > 0.2; 
    const isLongSwipe = Math.abs(mx) > swipeThreshold;
    
    const shouldTriggerNavigation = isLongSwipe || isFastSwipe;
    
    if (shouldTriggerNavigation) {
      navigatedRef.current = true; 
      cancel(); 

      const pageStep = 1;

      if (dx < 0) { 
        if (selectedChartType === 'chords') {
          handleNext();
        } else if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
          if (pdfCurrentPage < (pdfNumPages || 1)) {
            setPdfCurrentPage(prev => Math.min(prev + pageStep, pdfNumPages || 999));
          } else {
            handleNext(); 
          }
        }
      } else { 
        if (selectedChartType === 'chords') {
          handlePrev();
        } else if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
          if (pdfCurrentPage > 1) {
            setPdfCurrentPage(prev => Math.max(1, prev - pageStep));
          } else {
            handlePrev(); 
          }
        }
      }
    }
  }, {
    threshold: 5,         
    filterTaps: true,     
    axis: 'x',            
  });

  const handleNavigateToPage = useCallback((pageNumber: number, x?: number, y?: number) => {
    setPdfCurrentPage(pageNumber);
    if (chartContainerRef.current && x !== undefined && y !== undefined) {
      const targetX = x * chartContainerRef.current.scrollWidth - chartContainerRef.current.clientWidth / 2;
      const targetY = y * chartContainerRef.current.scrollHeight - chartContainerRef.current.clientHeight / 2;
      chartContainerRef.current.scrollTo({
        left: targetX,
        top: targetY,
        behavior: 'smooth'
      });
    }
  }, []);

  if (initialLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>;

  const shouldDisableScroll = disablePortraitPdfScroll && isPortrait && (selectedChartType === 'pdf' || selectedChartType === 'leadsheet');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white relative">
      <div className={cn("fixed left-0 top-0 h-full w-[300px] z-50 transition-transform duration-300", 
        isSidebarOpen && !isBrowserFullScreen ? "translate-x-0" : "-translate-x-full")}>
        <SheetReaderSidebar songs={allSongs} currentIndex={currentIndex} onSelectSong={(idx) => { setCurrentIndex(idx); stopPlayback(); }} isFullScreen={isBrowserFullScreen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      </div>

      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", 
        isSidebarOpen && !isBrowserFullScreen && "ml-[300px]")}
      >
        <SheetReaderHeader
          currentSong={currentSong}
          onClose={() => navigate('/')} 
          onOpenRepertoireSearch={onOpenRepertoireSearch}
          onOpenCurrentSongStudio={onOpenCurrentSongStudio}
          isLoading={!currentSong}
          keyPreference={globalKeyPreference} 
          onUpdateKey={handleUpdateKey}
          isFullScreen={isBrowserFullScreen} 
          onToggleFullScreen={toggleBrowserFullScreen} 
          setIsOverlayOpen={setIsOverlayOpen}
          pitch={effectivePitch}
          setPitch={setPitch}
          readerKeyPreference={readerKeyPreference}
          isSidebarOpen={isSidebarOpen && !isBrowserFullScreen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          effectiveTargetKey={effectiveTargetKey}
          isAudioPlayerVisible={isAudioPlayerVisible}
          onToggleAudioPlayer={() => setIsAudioPlayerVisible(prev => !prev)}
          onAddLink={onAddLink} 
          onToggleLinkEditMode={() => setIsEditingLinksMode(prev => !prev)} 
          onOpenLinkSizeModal={() => setIsLinkSizeModalOpen(true)} 
          isEditingLinksMode={isEditingLinksMode} 
        />

        <div
          ref={chartContainerRef}
          className={cn(
            "flex-1 bg-black relative",
            isBrowserFullScreen ? "mt-0" : "mt-[72px]", 
            isAudioPlayerVisible && currentSong ? "pb-24" : "pb-0", 
            "overscroll-behavior-x-contain",
            shouldDisableScroll ? "overflow-hidden" : "overflow-auto"
          )}
          onClick={toggleBrowserFullScreen} 
        >
          <animated.div 
            {...bind()}  
            style={{ 
              touchAction: 'none', 
              width: '100%', 
              height: '100%',
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              padding: isBrowserFullScreen && isInfoOverlayVisible ? '80px 20px 20px 20px' : '20px',
            }} 
            className="relative"
          >
            {currentSong ? (
              selectedChartType === 'chords' ? (
                <UGChordsReader
                  chordsText={currentSong.ug_chords_text || ""}
                  config={currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
                  isMobile={false}
                  originalKey={currentSong.originalKey}
                  targetKey={effectiveTargetKey}
                  readerKeyPreference={readerKeyPreference}
                  onChartReady={() => setIsChartContentLoading(false)}
                  isFullScreen={isBrowserFullScreen && !isInfoOverlayVisible} 
                />
              ) : (
                (() => {
                  const url = currentChartDisplayUrl; 
                  if (url) {
                    return (
                      <div className="w-full h-full flex justify-center items-center relative"> 
                        <Document
                          file={url}
                          onLoadSuccess={async (pdf) => { 
                            setPdfNumPages(pdf.numPages);
                            setPdfDocument(pdf); 
                            setIsChartContentLoading(false);
                            if (chartContainerRef.current) {
                              await calculatePdfScale(pdf, chartContainerRef.current, pdfCurrentPage);
                            }
                          }}
                          onLoadError={(error) => {
                            console.error("[SheetReaderMode] Error loading PDF Document:", error); 
                            showError("Failed to load PDF document.");
                            setIsChartContentLoading(false);
                          }}
                          loading={<Loader2 className="w-12 h-12 animate-spin text-indigo-500" />}
                          className="flex items-center justify-center" 
                        >
                          <Page
                            pageNumber={pdfCurrentPage}
                            scale={pdfScale || 1} 
                            renderAnnotationLayer={true}
                            renderTextLayer={true}
                            loading={<Loader2 className="w-8 h-8 animate-spin text-indigo-400" />}
                            onRenderSuccess={(page) => {
                              setIsChartContentLoading(false);
                            }}
                            inputRef={pageRef} 
                          />
                        </Document>
                        <div className="absolute inset-0 z-30" ref={overlayWrapperRef}> 
                          <LinkDisplayOverlay
                            links={links}
                            currentPage={pdfCurrentPage}
                            onNavigateToPage={handleNavigateToPage}
                            onLinkDeleted={fetchLinks} 
                            isEditingMode={isEditingLinksMode}
                            onEditLink={(link) => showInfo(`Editing link ${link.id} is not yet implemented.`)} 
                            pageContainerRef={pageRef} 
                            pdfScale={pdfScale}
                            overlayWrapperRef={overlayWrapperRef} 
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm italic">
                      <p>No {selectedChartType} available for this track.</p>
                    </div>
                  );
                })()
              )
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm italic">
                <p>No song selected or available.</p>
              </div>
            )}
          </animated.div>
          
          {isChartContentLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>}
        </div>
      </main>

      {isBrowserFullScreen && isInfoOverlayVisible && currentSong && (
        <FullScreenSongInfo
          song={currentSong}
          onExitFullScreen={() => setIsInfoOverlayVisible(false)}
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
                  songId={currentSong.master_id || currentSong.id}
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

      <SheetReaderAudioPlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        progress={progress}
        duration={duration}
        onTogglePlayback={audioEngine.togglePlayback}
        onNext={handleNext}
        onPrevious={handlePrev}
        onSeek={audioEngine.setProgress}
        volume={volume}
        setVolume={setVolume}
        pitch={effectivePitch}
        setPitch={setPitch}
        isLoadingAudio={isLoadingAudio}
        readerKeyPreference={readerKeyPreference}
        effectiveTargetKey={effectiveTargetKey}
        isPlayerVisible={isAudioPlayerVisible && !isBrowserFullScreen}
      />

      {currentChartDisplayUrl && pdfDocument && (
        <LinkEditorOverlay
          isOpen={isLinkEditorOpen}
          onClose={() => { setIsLinkEditorOpen(false); }}
          songId={currentSong.master_id || currentSong.id}
          chartUrl={currentChartDisplayUrl}
          onLinkCreated={fetchLinks}
        />
      )}

      <LinkSizeModal
        isOpen={isLinkSizeModalOpen}
        onClose={() => setIsLinkSizeModalOpen(false)}
        onLinkSizeUpdated={fetchLinks}
      />
    </div>
  );
};

export default SheetReaderMode;
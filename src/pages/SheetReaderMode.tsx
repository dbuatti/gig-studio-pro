"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong, UGChordsConfig } from '@/components/SetlistManager'; // Now importing SetlistSong
import { Button } from '@/components/ui/button';
import { Music, Loader2, AlertCircle, X, ExternalLink, ShieldCheck, FileText, Layout, Guitar, ChevronLeft, ChevronRight, Download, Link as LinkIcon, Ruler, Edit3, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
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

// Configure PDF.js worker source
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export type ChartType = 'pdf' | 'leadsheet' | 'chords';

// Removed local SetlistSong type definition, now importing from SetlistManager


const SheetReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId, setlistId: routeSetlistId } = useParams<{ songId?: string; setlistId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { 
    keyPreference: globalKeyPreference,
    preventStageKeyOverwrite,
    disablePortraitPdfScroll,
    setKeyPreference: setGlobalKeyPreference
  } = useSettings();
  const { forceReaderResource } = useReaderSettings();

  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [fullMasterRepertoire, setFullMasterRepertoire] = useState<SetlistSong[]>([]);
  const [currentSetlistSongs, setCurrentSetlistSongs] = useState<SetlistSong[]>([]); // This will hold songs if in gig mode
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

  const [readerKeyPreference, setReaderKeyPreference] = useState<'sharps' | 'flats'>(
    globalKeyPreference === 'neutral' ? 'sharps' : globalKeyPreference
  );
  
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

  const currentSong = allSongs[currentIndex];

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
    if (currentSong?.key_preference) {
      setReaderKeyPreference(currentSong.key_preference as 'sharps' | 'flats');
    } else if (globalKeyPreference !== 'neutral') {
      setReaderKeyPreference(globalKeyPreference as 'sharps' | 'flats');
    }
  }, [currentSong?.id, globalKeyPreference]);

  useEffect(() => {
    setPdfCurrentPage(1);
    setPdfNumPages(null);
    setPdfScale(null);
    setPdfDocument(null);
    setLinks([]);
    console.log("[SheetReaderMode] Resetting PDF state for new song:", currentSong?.id);
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
          id: currentSong.master_id || currentSong.id, // Use master_id for repertoire updates
          name: currentSong.name,
          artist: currentSong.artist
        }]);
        
        if (result[0]) {
          handleLocalSongUpdate(currentSong.id, result[0]);
        }
      } catch (err) {
        // Silently handle background saves
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
  }, [currentSong]);

  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setInitialLoading(true);

    try {
      const filterApproved = searchParams.get('filterApproved');
      const targetId = routeSongId || searchParams.get('id');
      const isGigMode = routeSetlistId && routeSetlistId !== 'repertoire';

      let currentViewSongs: SetlistSong[] = [];
      let masterRepertoireList: SetlistSong[] = [];
      let activeSetlistSongsList: SetlistSong[] = [];

      // Always fetch full master repertoire for search/studio context
      const { data: masterData, error: masterError } = await supabase.from('repertoire').select('*').eq('user_id', user.id).order('title');
      if (masterError) throw masterError;

      masterRepertoireList = (masterData || []).map((d: any) => {
        const mappedSong: SetlistSong = {
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
        };
        console.log(`[SheetReaderMode] Mapped song ${mappedSong.name} (ID: ${mappedSong.id}): pdfUrl=${mappedSong.pdfUrl}, sheet_music_url=${mappedSong.sheet_music_url}`);
        return mappedSong;
      });
      setFullMasterRepertoire(masterRepertoireList);

      if (isGigMode && routeSetlistId) {
        const { data: junctionData, error: junctionError } = await supabase
          .from('setlist_songs')
          .select(`
            id, isPlayed, sort_order,
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
          .eq('setlist_id', routeSetlistId)
          .order('sort_order', { ascending: true });

        if (junctionError) throw junctionError;

        activeSetlistSongsList = (junctionData || []).map((junction: any) => {
          const masterSong = junction.repertoire;
          if (!masterSong) return null;
          return {
            ...masterSong,
            id: junction.id, // Use setlist_songs.id for unique identification within the setlist
            master_id: masterSong.id, // Keep repertoire.id as master_id
            name: masterSong.title, // Override name with repertoire title
            isPlayed: junction.isPlayed || false,
          };
        }).filter(Boolean) as SetlistSong[];
        setCurrentSetlistSongs(activeSetlistSongsList);
        currentViewSongs = activeSetlistSongsList;
      } else {
        // Filter master repertoire for readable songs
        currentViewSongs = masterRepertoireList.filter(s => 
          s.pdfUrl || s.leadsheetUrl || s.ug_chords_text || s.sheet_music_url
        );
      }

      const uniqueSongsMap = new Map<string, SetlistSong>();
      currentViewSongs.forEach(song => {
        const key = song.id; // Use the song's ID (setlist_songs.id or repertoire.id) for uniqueness in the reader
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

      const songAfterLoad = uniqueReadableSongs[initialIndex];
      if (songAfterLoad) {
        console.log("[SheetReaderMode] Loaded song details:", {
          id: songAfterLoad.id,
          name: songAfterLoad.name,
          pdfUrl: songAfterLoad.pdfUrl,
          sheet_music_url: songAfterLoad.sheet_music_url,
          leadsheetUrl: songAfterLoad.leadsheetUrl,
          ug_chords_text_present: !!songAfterLoad.ug_chords_text,
          preferred_reader: songAfterLoad.preferred_reader,
        });
      }

    } catch (err: any) {
      showError(`Failed to load songs: ${err.message}`);
      console.error("[SheetReaderMode] Error fetching songs:", err);
    } finally {
      setInitialLoading(false);
    }
  }, [user, routeSongId, routeSetlistId, searchParams]);

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
      console.log("[SheetReaderMode] Not fetching links: no user, no master_id, or chart type is chords.");
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
      console.log("[SheetReaderMode] Successfully loaded links:", data?.length);
    } catch (err: any) {
      showError("Failed to load links.");
      console.error("[SheetReaderMode] Error fetching links:", err);
    }
  }, [user, currentSong?.master_id, selectedChartType]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const getBestChartType = useCallback((song: SetlistSong): ChartType => {
    if (forceReaderResource === 'force-pdf' && (song.pdfUrl || song.sheet_music_url)) return 'pdf';
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
    let url = null;
    switch (selectedChartType) {
      case 'pdf': url = currentSong.pdfUrl || currentSong.sheet_music_url; break;
      case 'leadsheet': url = currentSong.leadsheetUrl; break;
      case 'chords': url = null; break; 
      default: url = null; break;
    }
    console.log("[SheetReaderMode] Determined currentChartDisplayUrl:", url, "for type:", selectedChartType);
    return url;
  }, [currentSong, selectedChartType]);

  useEffect(() => {
    if (currentSong) {
      console.log("[SheetReaderMode] Effect for chart type: currentSong.pdfUrl:", currentSong.pdfUrl, "currentSong.sheet_music_url:", currentSong.sheet_music_url);
      const bestType = getBestChartType(currentSong);
      if (selectedChartType !== bestType) {
        setSelectedChartType(bestType);
        setIsChartContentLoading(true);
        console.log("[SheetReaderMode] Changing chart type to:", bestType);
      }
    } else {
      setSelectedChartType('pdf');
      setIsChartContentLoading(false);
      console.log("[SheetReaderMode] No current song, defaulting chart type to pdf.");
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
        console.log("[SheetReaderMode] Navigating to next song. New index:", newIndex);
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
      setCurrentIndex((prevIndex) => {
        const newIndex = (prevIndex - 1 + allSongs.length) % allSongs.length;
        console.log("[SheetReaderMode] Navigating to previous song. New index:", newIndex);
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
      setIsInfoOverlayVisible(true); 
      setIsAudioPlayerVisible(true); 
      console.log("[SheetReaderMode] Toggling standalone full screen.");
      return;
    }

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        showError(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
        console.error("[SheetReaderMode] Fullscreen error:", err);
      });
      if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
        setIsInfoOverlayVisible(false);
      } else {
        setIsInfoOverlayVisible(true); 
      }
      setIsAudioPlayerVisible(true); 
      console.log("[SheetReaderMode] Entering browser full screen.");
    } else {
      document.exitFullscreen();
      setIsInfoOverlayVisible(false); 
      setIsAudioPlayerVisible(false); 
      console.log("[SheetReaderMode] Exiting browser full screen.");
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
          console.log("[SheetReaderMode] Fullscreen exited via event.");
        } else {
          console.log("[SheetReaderMode] Fullscreen entered via event.");
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
      console.log("[SheetReaderMode] Fullscreen state changed, adjusting info overlay visibility.");
    }
  }, [currentSong?.id, selectedChartType, isBrowserFullScreen]);


  const onOpenCurrentSongStudio = useCallback(() => {
    if (currentSong) {
      setIsStudioPanel(true);
      console.log("[SheetReaderMode] Opening Song Studio for song:", currentSong.id);
    } else {
      showInfo("No song selected to open in Studio.");
      console.warn("[SheetReaderMode] Attempted to open Studio with no song selected.");
    }
  }, [currentSong]);

  const onOpenRepertoireSearch = () => {
    setIsRepertoireSearchModalOpen(true);
    console.log("[SheetReaderMode] Opening Repertoire Search modal.");
  };

  const handleSelectSongFromRepertoireSearch = useCallback((song: SetlistSong) => {
    const idx = allSongs.findIndex(s => s.id === song.id || s.master_id === song.master_id);
    if (idx !== -1) {
      setCurrentIndex(idx);
      console.log("[SheetReaderMode] Selected song from search, setting current index:", idx);
    } else {
      // If the song is not in the current view (e.g., switching from gig to repertoire)
      // navigate to the repertoire view with the selected song
      navigate(`/sheet-reader/repertoire/${song.master_id || song.id}`);
      console.log("[SheetReaderMode] Selected song from search, navigating to new route:", song.master_id || song.id);
    }
    stopPlayback();
    setIsRepertoireSearchModalOpen(false);
  }, [allSongs, navigate, stopPlayback]);

  const handleSaveReaderPreference = useCallback((pref: 'sharps' | 'flats') => {
    setReaderKeyPreference(pref);
    showSuccess(`Reader preference saved to ${pref === 'sharps' ? 'Sharps' : 'Flats'}`);
    console.log("[SheetReaderMode] Reader key preference saved:", pref);
  }, []);

  const onAddLink = useCallback(() => {
    if (currentChartDisplayUrl && pdfDocument) {
      setIsLinkEditorOpen(true);
      console.log("[SheetReaderMode] Opening link editor.");
    } else {
      showInfo("No PDF available to add links.");
      console.warn("[SheetReaderMode] Cannot add link, no PDF available.");
    }
  }, [currentChartDisplayUrl, pdfDocument]);

  const handleChartReady = useCallback(() => {
    setIsChartContentLoading(false);
    console.log("[SheetReaderMode] Chart content is ready.");
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
            setPdfCurrentPage(prev => {
              const newPage = Math.max(1, prev - 1);
              console.log("[SheetReaderMode] Keydown: ArrowLeft, PDF page:", newPage);
              return newPage;
            }); 
          } else {
            handlePrev();
            console.log("[SheetReaderMode] Keydown: ArrowLeft, navigating to previous song.");
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
            setPdfCurrentPage(prev => {
              const newPage = Math.min(prev + 1, pdfNumPages || 999);
              console.log("[SheetReaderMode] Keydown: ArrowRight, PDF page:", newPage);
              return newPage;
            }); 
          } else {
            handleNext();
            console.log("[SheetReaderMode] Keydown: ArrowRight, navigating to next song.");
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
          setIsAudioPlayerVisible(prev => {
            console.log("[SheetReaderMode] Keydown: P, toggling audio player visibility to:", !prev);
            return !prev;
          }); 
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          navigate('/');
          console.log("[SheetReaderMode] Keydown: R, navigating to home.");
          break;
        case 'l': 
        case 'L':
          e.preventDefault();
          if (currentChartDisplayUrl && pdfDocument) { 
            setIsLinkEditorOpen(prev => {
              console.log("[SheetReaderMode] Keydown: L, toggling link editor to:", !prev);
              return !prev;
            });
          } else {
            showInfo("No PDF available to add links.");
            console.warn("[SheetReaderMode] Keydown: L, cannot open link editor, no PDF available.");
          }
          break;
        case 'e': 
        case 'E':
          e.preventDefault();
          if (currentChartDisplayUrl) { 
            setIsEditingLinksMode(prev => {
              showInfo(`Link editing mode ${prev ? 'disabled' : 'enabled'}.`);
              console.log("[SheetReaderMode] Keydown: E, toggling link editing mode to:", !prev);
              return !prev;
            });
          } else {
            showInfo("No PDF available to edit links.");
            console.warn("[SheetReaderMode] Keydown: E, cannot toggle link editing, no PDF available.");
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong, onOpenCurrentSongStudio, handlePrev, handleNext, selectedChartType, pdfNumPages, isEditingLinksMode, currentChartDisplayUrl, onAddLink, navigate, pdfDocument]);

  const calculatePdfScale = useCallback(async (pdf: PDFDocumentProxy, container: HTMLDivElement, pageNumber: number) => {
    if (!container || !pdf) {
      console.warn("[SheetReaderMode] calculatePdfScale: Missing container or PDF document.");
      return;
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    console.log("[SheetReaderMode] calculatePdfScale: container dimensions (W x H):", containerWidth, "x", containerHeight);

    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;
      console.log("[SheetReaderMode] calculatePdfScale: page dimensions (W x H):", pageWidth, "x", pageHeight);

      const scaleX = containerWidth / pageWidth;
      const scaleY = containerHeight / pageHeight;

      const newScale = Math.min(scaleX, scaleY);
      setPdfScale(newScale);
      console.log("[SheetReaderMode] calculatePdfScale: Calculated new PDF scale:", newScale);
    } catch (error) {
      console.error("[SheetReaderMode] Error calculating PDF scale:", error);
      // Silently handle scale failures during resize
    }
  }, []);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !pdfDocument) {
      console.log("[SheetReaderMode] ResizeObserver: Not observing, container or pdfDocument not ready.");
      return; 
    }

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === container) {
          console.log("[SheetReaderMode] ResizeObserver: Container resized, recalculating PDF scale.");
          calculatePdfScale(pdfDocument, container, pdfCurrentPage); 
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      console.log("[SheetReaderMode] ResizeObserver: Disconnecting observer.");
      resizeObserver.unobserve(container);
    };
  }, [pdfDocument, pdfCurrentPage, calculatePdfScale]); 


  const bind = useDrag(({ first, down, movement: [mx], direction: [dx], velocity: [vx], cancel }) => {

    if (first) {
      navigatedRef.current = false; 
      console.log("[SheetReaderMode] Drag started.");
    }

    if (!down) { 
      if (navigatedRef.current) {
        navigatedRef.current = false; 
      }
      console.log("[SheetReaderMode] Drag ended.");
      return;
    }

    if (navigatedRef.current) {
      console.log("[SheetReaderMode] Drag: Navigation already triggered, ignoring further movement.");
      return;
    }

    const isFastSwipe = Math.abs(vx) > 0.2; 
    const isLongSwipe = Math.abs(mx) > swipeThreshold;
    
    const shouldTriggerNavigation = isLongSwipe || isFastSwipe;
    
    if (shouldTriggerNavigation) {
      navigatedRef.current = true; 
      cancel(); 
      console.log("[SheetReaderMode] Drag: Swipe detected (long or fast), triggering navigation.");

      const pageStep = 1;

      if (dx < 0) { // Swiping left
        if (selectedChartType === 'chords') {
          handleNext();
          console.log("[SheetReaderMode] Drag: Swiped left, next song (chords).");
        } else if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
          if (pdfCurrentPage < (pdfNumPages || 1)) {
            setPdfCurrentPage(prev => {
              const newPage = Math.min(prev + pageStep, pdfNumPages || 999);
              console.log("[SheetReaderMode] Drag: Swiped left, next PDF page:", newPage);
              return newPage;
            });
          } else {
            handleNext(); 
            console.log("[SheetReaderMode] Drag: Swiped left, last PDF page, next song.");
          }
        }
      } else { // Swiping right
        if (selectedChartType === 'chords') {
          handlePrev();
          console.log("[SheetReaderMode] Drag: Swiped right, previous song (chords).");
        } else if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') {
          if (pdfCurrentPage > 1) {
            setPdfCurrentPage(prev => {
              const newPage = Math.max(1, prev - pageStep);
              console.log("[SheetReaderMode] Drag: Swiped right, previous PDF page:", newPage);
              return newPage;
            });
          } else {
            handlePrev(); 
            console.log("[SheetReaderMode] Drag: Swiped right, first PDF page, previous song.");
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
    console.log("[SheetReaderMode] Navigating to PDF page:", pageNumber, "with coordinates:", x, y);
    if (chartContainerRef.current && x !== undefined && y !== undefined) {
      const targetX = x * chartContainerRef.current.scrollWidth - chartContainerRef.current.clientWidth / 2;
      const targetY = y * chartContainerRef.current.scrollHeight - chartContainerRef.current.clientHeight / 2;
      chartContainerRef.current.scrollTo({
        left: targetX,
        top: targetY,
        behavior: 'smooth'
      });
      console.log("[SheetReaderMode] Scrolling PDF container to target (X, Y):", targetX, targetY);
    }
  }, []);

  if (initialLoading) return <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-4"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Initializing Reader Engine...</p></div>;

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
          currentSong={currentSong!}
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
            "flex-1 bg-black relative overflow-hidden", 
            isBrowserFullScreen ? "mt-0" : "mt-[72px]", 
            isAudioPlayerVisible && currentSong ? "pb-24" : "pb-0", 
            "overscroll-behavior-x-contain",
            shouldDisableScroll ? "overflow-y-hidden" : "overflow-y-auto"
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
              alignItems: 'flex-start', 
              paddingTop: isBrowserFullScreen && isInfoOverlayVisible ? '64px' : '0px', 
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
                  isPlaying={isPlaying}
                  progress={progress}
                  duration={duration}
                  readerKeyPreference={readerKeyPreference}
                  onChartReady={handleChartReady}
                  isFullScreen={isBrowserFullScreen && !isInfoOverlayVisible} 
                />
              ) : (
                (() => {
                  const url = currentChartDisplayUrl; 
                  if (url) {
                    console.log("[SheetReaderMode] Attempting to render PDF/Leadsheet from URL:", url);
                    return (
                      <div className="w-full h-full overflow-x-auto overflow-y-hidden flex justify-center items-center relative"> 
                        <Document
                          file={url}
                          onLoadSuccess={async (pdf) => { 
                            setPdfNumPages(pdf.numPages);
                            setPdfDocument(pdf); 
                            setIsChartContentLoading(false);
                            console.log("[SheetReaderMode] PDF Document loaded successfully. Pages:", pdf.numPages);
                            if (chartContainerRef.current) {
                              await calculatePdfScale(pdf, chartContainerRef.current, pdfCurrentPage);
                            }
                          }}
                          onLoadError={(error) => {
                            showError("Failed to load PDF document.");
                            setIsChartContentLoading(false);
                            console.error("[SheetReaderMode] PDF Document failed to load:", error);
                          }}
                          loading={<Loader2 className="w-12 h-12 animate-spin text-indigo-500" />}
                          className="flex items-center justify-center w-full h-full" 
                        >
                          <Page
                            pageNumber={pdfCurrentPage}
                            scale={pdfScale || 1} 
                            renderAnnotationLayer={true}
                            renderTextLayer={true}
                            loading={<Loader2 className="w-8 h-8 animate-spin text-indigo-400" />}
                            onRenderSuccess={(page) => {
                              setIsChartContentLoading(false);
                              console.log("[SheetReaderMode] PDF Page rendered successfully:", page.pageNumber);
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
                  console.log("[SheetReaderMode] No PDF/Leadsheet URL available for selected chart type.");
                  return (
                    <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 text-sm italic gap-4">
                      <FileText className="w-12 h-12 opacity-20" />
                      <p>No {selectedChartType} asset linked for this track.</p>
                    </div>
                  );
                })()
              )
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 text-sm italic gap-4">
                <Music className="w-12 h-12 opacity-20" />
                <p>No active song in selection pool.</p>
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
                  songId={currentSong.master_id || currentSong.id} // Pass master_id for studio
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
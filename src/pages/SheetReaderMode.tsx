"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong, UGChordsConfig, EnergyZone } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { Music, Loader2, AlertCircle, X, ExternalLink, ShieldCheck, FileText, Layout, Guitar, ChevronLeft, ChevronRight, Download, Link as LinkIcon, Ruler, Edit3, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { DEFAULT_FILTERS } from '@/components/SetlistFilters';
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
  const [isStudioPanelOpen, setIsStudioPanel] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRepertoireSearchModalOpen, setIsRepertoireSearchModalOpen] = useState(false);
  const [isInfoOverlayVisible, setIsInfoOverlayVisible] = useState(true);
  const [isAudioPlayerVisible, setIsAudioPlayerVisible] = useState(true);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [isZenMode, setIsZenMode] = useState(false); // New: Zen Mode for iPad Pro

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
    isPlaying, stopPlayback, setPitch: setAudioPitch
  } = audioEngine;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const overlayWrapperRef = useRef<HTMLDivElement>(null);
  const swipeThreshold = 40; // Reduced for iPad Pro sensitivity
  const navigatedRef = useRef(false);

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

      const savedFilters = localStorage.getItem('gig_active_filters');
      const activeFilters = savedFilters ? JSON.parse(savedFilters) : DEFAULT_FILTERS;
      const searchTerm = (localStorage.getItem('gig_search_term') || "").toLowerCase();

      let currentViewSongs: SetlistSong[] = [];
      let masterRepertoireList: SetlistSong[] = [];

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
        is_ready_to_sing: d.is_ready_to_sing,
        preferred_reader: d.preferred_reader,
        ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: d.is_ug_chords_present,
        highest_note_original: d.highest_note_original,
        audio_url: d.audio_url,
        extraction_status: d.extraction_status,
        fineTune: d.fineTune,
        tempo: d.tempo,
        volume: d.volume,
        energy_level: d.energy_level as EnergyZone,
        comfort_level: d.comfort_level ?? 0,
      }));
      setFullMasterRepertoire(masterRepertoireList);

      if (readerViewMode === 'gigs' && readerSetlistId) {
        const { data: junctionData, error: junctionError } = await supabase
          .from('setlist_songs')
          .select('song_id, id, isPlayed, sort_order')
          .eq('setlist_id', readerSetlistId)
          .order('sort_order', { ascending: true });

        if (junctionError) throw junctionError;

        const activeSetlistSongsList = (junctionData || []).map((junction: any) => {
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

      const filteredSongs = currentViewSongs.filter(s => {
        if (searchTerm && !s.name.toLowerCase().includes(searchTerm) && !s.artist?.toLowerCase().includes(searchTerm)) {
          return false;
        }
        const readiness = calculateReadiness(s);
        if (activeFilters.readiness > 0 && readiness < activeFilters.readiness) return false;
        return true;
      });

      const readableSongs = filteredSongs.filter(s => 
        s.pdfUrl || s.leadsheetUrl || s.ug_chords_text || s.sheet_music_url
      );

      setAllSongs(readableSongs);

      let initialIndex = 0;
      if (targetId) {
        const idx = readableSongs.findIndex(s => s.id === targetId || s.master_id === targetId);
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
    if (song.pdfUrl) return 'pdf';
    if (song.leadsheetUrl) return 'leadsheet';
    if (song.ug_chords_text) return 'chords';
    return 'pdf';
  }, [forceReaderResource]);

  const currentChartDisplayUrl = useMemo(() => {
    if (!currentSong) return null;
    switch (selectedChartType) {
      case 'pdf': return currentSong.pdfUrl || currentSong.sheet_music_url;
      case 'leadsheet': return currentSong.leadsheetUrl;
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
    }
  }, [currentSong, getBestChartType, selectedChartType]);

  const handleNext = useCallback(() => {
    if (allSongs.length > 0) {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % allSongs.length);
      stopPlayback();
      if (chartContainerRef.current) chartContainerRef.current.scrollLeft = 0;
    }
  }, [allSongs, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (allSongs.length > 0) {
      setCurrentIndex((prevIndex) => (prevIndex - 1 + allSongs.length) % allSongs.length);
      stopPlayback();
      if (chartContainerRef.current) chartContainerRef.current.scrollLeft = 0;
    }
  }, [allSongs, stopPlayback]);

  const toggleZenMode = useCallback(() => {
    setIsZenMode(prev => !prev);
    if (!isZenMode) {
      setIsInfoOverlayVisible(false);
      setIsAudioPlayerVisible(false);
    } else {
      setIsInfoOverlayVisible(true);
      setIsAudioPlayerVisible(true);
    }
  }, [isZenMode]);

  const onOpenCurrentSongStudio = useCallback(() => {
    if (currentSong) setIsStudioPanel(true);
  }, [currentSong]);

  const handleSelectSongFromRepertoireSearch = useCallback((song: SetlistSong) => {
    const idx = allSongs.findIndex(s => s.id === song.id || s.master_id === song.master_id);
    if (idx !== -1) setCurrentIndex(idx);
    else navigate(`/sheet-reader/${song.id}`);
    stopPlayback();
    setIsRepertoireSearchModalOpen(false);
  }, [allSongs, navigate, stopPlayback]);

  const onOpenRepertoireSearch = useCallback(() => {
    setIsRepertoireSearchModalOpen(true);
  }, []);

  const onAddLink = useCallback(() => {
    if (currentChartDisplayUrl && pdfDocument) setIsLinkEditorOpen(true);
  }, [currentChartDisplayUrl, pdfDocument]);

  const handleClose = useCallback(() => {
    const mode = sessionStorage.getItem('reader_view_mode') || 'gigs';
    navigate(`/?view=${mode}`);
  }, [navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') setPdfCurrentPage(prev => Math.max(1, prev - 1)); 
          else handlePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (selectedChartType === 'pdf' || selectedChartType === 'leadsheet') setPdfCurrentPage(prev => Math.min(prev + 1, pdfNumPages || 999)); 
          else handleNext();
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          toggleZenMode();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, selectedChartType, pdfNumPages, toggleZenMode]);

  const calculatePdfScale = useCallback(async (pdf: PDFDocumentProxy, container: HTMLDivElement, pageNumber: number) => {
    if (!container || !pdf) return;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;
      
      // iPad Pro 12.9 Optimization: Use 98% of space for maximum visibility
      const availableHeight = containerHeight * 0.98;
      const availableWidth = containerWidth * 0.98;
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
    const resizeObserver = new ResizeObserver(() => calculatePdfScale(pdfDocument, container, pdfCurrentPage));
    resizeObserver.observe(container);
    return () => resizeObserver.unobserve(container);
  }, [pdfDocument, pdfCurrentPage, calculatePdfScale]); 

  const bind = useDrag(({ first, down, movement: [mx], direction: [dx], velocity: [vx], cancel }) => {
    if (first) navigatedRef.current = false;
    if (!down || navigatedRef.current) return;
    const isFastSwipe = Math.abs(vx) > 0.15; 
    const isLongSwipe = Math.abs(mx) > swipeThreshold;
    if (isLongSwipe || isFastSwipe) {
      navigatedRef.current = true; 
      cancel(); 
      if (dx < 0) { 
        if (selectedChartType === 'chords') handleNext();
        else if (pdfCurrentPage < (pdfNumPages || 1)) setPdfCurrentPage(prev => prev + 1);
        else handleNext(); 
      } else { 
        if (selectedChartType === 'chords') handlePrev();
        else if (pdfCurrentPage > 1) setPdfCurrentPage(prev => prev - 1);
        else handlePrev(); 
      }
    }
  }, { threshold: 5, filterTaps: true, axis: 'x' });

  const handleNavigateToPage = useCallback((pageNumber: number) => {
    setPdfCurrentPage(pageNumber);
  }, []);

  if (initialLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>;

  const shouldDisableScroll = disablePortraitPdfScroll && isPortrait && (selectedChartType === 'pdf' || selectedChartType === 'leadsheet');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white relative">
      <div className={cn("fixed left-0 top-0 h-full w-[300px] z-50 transition-transform duration-300", 
        isSidebarOpen && !isZenMode ? "translate-x-0" : "-translate-x-full")}>
        <SheetReaderSidebar songs={allSongs} currentIndex={currentIndex} onSelectSong={(idx) => { setCurrentIndex(idx); stopPlayback(); }} isFullScreen={isZenMode} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      </div>

      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", 
        isSidebarOpen && !isZenMode && "ml-[300px]")}
      >
        <AnimatePresence>
          {!isZenMode && (
            <SheetReaderHeader
              currentSong={currentSong}
              onClose={handleClose} 
              onOpenRepertoireSearch={onOpenRepertoireSearch}
              onOpenCurrentSongStudio={onOpenCurrentSongStudio}
              isLoading={!currentSong}
              keyPreference={globalKeyPreference} 
              onUpdateKey={handleUpdateKey}
              isFullScreen={isZenMode} 
              onToggleFullScreen={toggleZenMode} 
              setIsOverlayOpen={() => {}}
              pitch={effectivePitch}
              setPitch={setPitch}
              readerKeyPreference={readerKeyPreference}
              isSidebarOpen={isSidebarOpen && !isZenMode}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              effectiveTargetKey={effectiveTargetKey}
              isAudioPlayerVisible={isAudioPlayerVisible}
              onToggleAudioPlayer={() => setIsAudioPlayerVisible(prev => !prev)}
              onAddLink={onAddLink} 
              onToggleLinkEditMode={() => setIsEditingLinksMode(prev => !prev)} 
              onOpenLinkSizeModal={() => setIsLinkSizeModalOpen(true)} 
              isEditingLinksMode={isEditingLinksMode} 
            />
          )}
        </AnimatePresence>

        <div
          ref={chartContainerRef}
          className={cn(
            "flex-1 bg-black relative transition-all duration-500",
            isZenMode ? "mt-0" : "mt-[72px]", 
            isAudioPlayerVisible && currentSong && !isZenMode ? "pb-24" : "pb-0", 
            shouldDisableScroll ? "overflow-hidden" : "overflow-auto"
          )}
          onClick={(e) => {
            // Only toggle Zen mode if clicking the outer edges (not the music itself)
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < 100 || x > rect.width - 100) toggleZenMode();
          }} 
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
              padding: isZenMode ? '0' : '20px',
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
                  isFullScreen={isZenMode} 
                />
              ) : (
                <div className="w-full h-full flex justify-center items-center relative"> 
                  <Document
                    file={currentChartDisplayUrl}
                    onLoadSuccess={(pdf) => { 
                      setPdfNumPages(pdf.numPages);
                      setPdfDocument(pdf); 
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
                      onRenderSuccess={() => setIsChartContentLoading(false)}
                      inputRef={pageRef} 
                    />
                  </Document>
                  <div className="absolute inset-0 z-30 pointer-events-none" ref={overlayWrapperRef}> 
                    <LinkDisplayOverlay
                      links={links}
                      currentPage={pdfCurrentPage}
                      onNavigateToPage={handleNavigateToPage}
                      onLinkDeleted={fetchLinks} 
                      isEditingMode={isEditingLinksMode}
                      onEditLink={() => {}} 
                      pageContainerRef={pageRef} 
                      pdfScale={pdfScale}
                      overlayWrapperRef={overlayWrapperRef} 
                    />
                  </div>
                </div>
              )
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm italic">
                <p>No song selected.</p>
              </div>
            )}
          </animated.div>
          
          {isChartContentLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>}
        </div>
      </main>

      {isZenMode && isInfoOverlayVisible && currentSong && (
        <FullScreenSongInfo
          song={currentSong}
          onExitFullScreen={toggleZenMode}
          readerKeyPreference={readerKeyPreference}
          onUpdateKey={handleUpdateKey}
          setIsOverlayOpen={() => {}}
          effectiveTargetKey={effectiveTargetKey}
        />
      )}

      <RepertoireSearchModal
        isOpen={isRepertoireSearchModalOpen}
        onClose={() => setIsRepertoireSearchModalOpen(false)}
        masterRepertoire={fullMasterRepertoire}
        currentSetlistSongs={currentSetlistSongs}
        onSelectSong={handleSelectSongFromRepertoireSearch}
      />

      <AnimatePresence>
        {!isZenMode && (
          <SheetReaderAudioPlayer
            currentSong={currentSong}
            isPlaying={isPlaying}
            progress={audioEngine.progress}
            duration={audioEngine.duration}
            onTogglePlayback={audioEngine.togglePlayback}
            onNext={handleNext}
            onPrevious={handlePrev}
            onSeek={audioEngine.setProgress}
            volume={audioEngine.volume}
            setVolume={audioEngine.setVolume}
            pitch={effectivePitch}
            setPitch={setPitch}
            isLoadingAudio={audioEngine.isLoadingAudio}
            readerKeyPreference={readerKeyPreference}
            effectiveTargetKey={effectiveTargetKey}
            isPlayerVisible={isAudioPlayerVisible}
          />
        )}
      </AnimatePresence>

      {currentChartDisplayUrl && pdfDocument && (
        <LinkEditorOverlay
          isOpen={isLinkEditorOpen}
          onClose={() => setIsLinkEditorOpen(false)}
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

      {/* Zen Mode Toggle Button (Floating) */}
      <Button
        variant="secondary"
        size="icon"
        onClick={toggleZenMode}
        className={cn(
          "fixed bottom-6 right-6 z-[100] h-12 w-12 rounded-full shadow-2xl transition-all duration-500",
          isZenMode ? "bg-indigo-600 text-white opacity-20 hover:opacity-100" : "bg-slate-800 text-slate-400"
        )}
      >
        {isZenMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
      </Button>
    </div>
  );
};

export default SheetReaderMode;
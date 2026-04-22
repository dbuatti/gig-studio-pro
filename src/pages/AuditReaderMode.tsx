"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong, EnergyZone, Setlist } from '@/components/SetlistManager';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { DEFAULT_FILTERS } from '@/components/SetlistFilters';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { showError, showSuccess } from '@/utils/toast';
import UGChordsReader from '@/components/UGChordsReader';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import AuditReaderHeader from '@/components/AuditReaderHeader';
import SheetReaderSidebar from '@/components/SheetReaderSidebar';
import RehearsalPanel from '@/components/RehearsalPanel';
import RepertoireSearchModal from '@/components/RepertoireSearchModal';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import SheetReaderAudioPlayer from '@/components/SheetReaderAudioPlayer';
import { sortSongsByStrategy } from '@/utils/SetlistGenerator';
import { calculateSemitones } from '@/utils/keyUtils';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

export type ChartType = 'pdf' | 'leadsheet' | 'chords';

const AuditReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId } = useParams<{ songId?: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { 
    keyPreference: globalKeyPreference,
    ugChordsFontFamily,
    ugChordsFontSize,
    ugChordsChordBold,
    ugChordsChordColor,
    ugChordsLineSpacing,
    ugChordsTextAlign,
  } = useSettings();
  const { forceReaderResource } = useReaderSettings();

  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [fullMasterRepertoire, setFullMasterRepertoire] = useState<SetlistSong[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [selectedSetlistId, setSelectedSetlistId] = useState<string | 'all'>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRepertoireSearchModalOpen, setIsRepertoireSearchModalOpen] = useState(false);
  const [isAudioPlayerVisible, setIsAudioPlayerVisible] = useState(true);

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

  const audioEngine = useToneAudio(true);
  const { isPlaying, stopPlayback } = audioEngine;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPdfCurrentPage(1);
    setPdfNumPages(null);
    setPdfScale(null);
    setPdfDocument(null);
    
    if (chartContainerRef.current) {
      chartContainerRef.current.scrollTop = 0;
    }
  }, [currentSong?.id]);

  const handleLocalSongUpdate = useCallback((songId: string, updates: Partial<SetlistSong>) => {
    setAllSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
    setFullMasterRepertoire(prev => prev.map(s => (s.master_id || s.id) === (updates.master_id || songId) ? { ...s, ...updates } : s));
  }, []);

  const handleUpdateSong = async (updates: Partial<SetlistSong>) => {
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
      console.error("Audit Mode Auto-save failed:", err);
      showError("Failed to save changes.");
    }
  };

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
      const targetId = routeSongId || searchParams.get('id');
      const savedFilters = localStorage.getItem('gig_active_filters');
      const activeFilters = savedFilters ? JSON.parse(savedFilters) : DEFAULT_FILTERS;
      const searchTerm = (localStorage.getItem('gig_search_term') || "").toLowerCase();
      const sortMode = (localStorage.getItem('gig_sort_mode') as any) || 'none';

      // 1. Fetch Master Repertoire
      const { data: masterData, error: masterError } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title');
      
      if (masterError) throw masterError;
      
      const masterRepertoireList = (masterData || []).map((d: any) => ({
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
        comfort_level: (d.comfort_level !== null && d.comfort_level <= 5) ? d.comfort_level * 20 : (d.comfort_level ?? 0),
        needs_improvement: d.needs_improvement ?? false,
      } as SetlistSong));
      setFullMasterRepertoire(masterRepertoireList);

      // 2. Fetch Setlists
      const { data: setlistsData } = await supabase
        .from('setlists')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      // Map to satisfy Setlist interface which requires 'songs'
      setSetlists((setlistsData || []).map(s => ({ ...s, songs: [] })) as Setlist[]);

      // 3. Filter by Setlist if selected
      let baseSongs = masterRepertoireList;
      let isSetlistActive = false;

      if (selectedSetlistId !== 'all') {
        const { data: junctionData } = await supabase
          .from('setlist_songs')
          .select('song_id, sort_order')
          .eq('setlist_id', selectedSetlistId)
          .order('sort_order', { ascending: true });
        
        if (junctionData && junctionData.length > 0) {
          isSetlistActive = true;
          // Map songs in the exact order they appear in the setlist
          baseSongs = junctionData.map(j => {
            const song = masterRepertoireList.find(s => s.id === j.song_id);
            return song;
          }).filter(Boolean) as SetlistSong[];
        }
      }

      let filteredSongs = baseSongs;

      // Only apply filters and sorting if we are NOT in a specific setlist
      if (!isSetlistActive) {
        filteredSongs = baseSongs.filter(s => {
          if (searchTerm && !s.name.toLowerCase().includes(searchTerm) && !s.artist?.toLowerCase().includes(searchTerm)) {
            return false;
          }
          const readiness = calculateReadiness(s);
          if (activeFilters.readiness > 0 && readiness < activeFilters.readiness) return false;
          return true;
        });

        if (sortMode === 'ready') {
          filteredSongs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
        } else if (sortMode === 'work') {
          filteredSongs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
        } else if (sortMode.startsWith('energy') || sortMode === 'zig-zag' || sortMode === 'wedding-ramp') {
          filteredSongs = sortSongsByStrategy(filteredSongs, sortMode);
        }
      }

      setAllSongs(filteredSongs);

      let initialIndex = 0;
      if (targetId) {
        const idx = filteredSongs.findIndex(s => s.id === targetId || s.master_id === targetId);
        if (idx !== -1) initialIndex = idx;
      }
      setCurrentIndex(initialIndex);
    } catch (err: any) {
      showError(`Failed to load songs: ${err.message}`);
    } finally {
      setInitialLoading(false);
    }
  }, [user, routeSongId, searchParams, selectedSetlistId]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const getBestChartType = useCallback((song: SetlistSong): ChartType => {
    if (forceReaderResource === 'force-pdf' && song.pdfUrl) return 'pdf';
    if (forceReaderResource === 'force-ug' && (song.ugUrl || song.ug_chords_text)) return 'chords';
    if (forceReaderResource === 'force-chords' && song.ug_chords_text) return 'chords';

    if (song.preferred_reader === 'ug' && (song.ugUrl || song.ug_chords_text)) return 'chords';
    if (song.preferred_reader === 'ls' && song.leadsheetUrl) return 'leadsheet';
    if (song.preferred_reader === 'fn' && (song.pdfUrl || song.sheet_music_url)) return 'pdf';

    if (song.pdfUrl || song.sheet_music_url) return 'pdf';
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
    }
  }, [allSongs, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (allSongs.length > 0) {
      setCurrentIndex((prevIndex) => (prevIndex - 1 + allSongs.length) % allSongs.length);
      stopPlayback();
    }
  }, [allSongs, stopPlayback]);

  const handleSelectSongFromRepertoireSearch = useCallback((song: SetlistSong) => {
    const idx = allSongs.findIndex(s => s.id === song.id || s.master_id === song.master_id);
    if (idx !== -1) setCurrentIndex(idx);
    stopPlayback();
    setIsRepertoireSearchModalOpen(false);
  }, [allSongs, stopPlayback]);

  const calculatePdfScale = useCallback(async (pdf: PDFDocumentProxy, container: HTMLDivElement, pageNumber: number) => {
    if (!container || !pdf) return;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;
      
      const availableHeight = containerHeight * 0.98;
      const availableWidth = containerWidth * 0.98;
      const scaleX = availableWidth / pageWidth;
      const scaleY = availableHeight / pageHeight;
      setPdfScale(Math.min(scaleX, scaleY));
    } catch (error) {
      console.error("[AuditReaderMode] Error calculating PDF scale:", error);
    }
  }, []);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !pdfDocument) return; 
    const resizeObserver = new ResizeObserver(() => calculatePdfScale(pdfDocument, container, pdfCurrentPage));
    resizeObserver.observe(container);
    return () => resizeObserver.unobserve(container);
  }, [pdfDocument, pdfCurrentPage, calculatePdfScale]); 

  const effectiveConfig = useMemo(() => {
    if (!currentSong) return DEFAULT_UG_CHORDS_CONFIG;
    
    const baseConfig = {
      fontFamily: ugChordsFontFamily,
      fontSize: ugChordsFontSize + 1, 
      chordBold: ugChordsChordBold,
      chordColor: ugChordsChordColor,
      lineSpacing: ugChordsLineSpacing,
      textAlign: ugChordsTextAlign as any,
    };

    if (currentSong.ug_chords_config) {
      return { 
        ...baseConfig, 
        ...currentSong.ug_chords_config,
        fontSize: (currentSong.ug_chords_config.fontSize || ugChordsFontSize) + 1 
      };
    }

    return baseConfig;
  }, [currentSong, ugChordsFontFamily, ugChordsFontSize, ugChordsChordBold, ugChordsChordColor, ugChordsLineSpacing, ugChordsTextAlign]);

  if (initialLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white relative">
      <div className={cn("fixed left-0 top-0 h-full w-[300px] z-50 transition-transform duration-300", 
        isSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <SheetReaderSidebar songs={allSongs} currentIndex={currentIndex} onSelectSong={(idx) => { setCurrentIndex(idx); stopPlayback(); }} isFullScreen={false} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      </div>

      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", 
        isSidebarOpen && "ml-[300px]")}
      >
        <AuditReaderHeader
          currentSong={currentSong}
          onClose={() => navigate('/')}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
          isAudioPlayerVisible={isAudioPlayerVisible}
          onToggleAudioPlayer={() => setIsAudioPlayerVisible(prev => !prev)}
          onOpenRepertoireSearch={() => setIsRepertoireSearchModalOpen(true)}
          setlists={setlists}
          selectedSetlistId={selectedSetlistId}
          onSetlistChange={setSelectedSetlistId}
        />

        <div className="flex-1 flex overflow-hidden mt-[72px]">
          <div
            ref={chartContainerRef}
            className={cn(
              "flex-1 bg-black relative overflow-auto",
              isAudioPlayerVisible && currentSong ? "pb-24" : "pb-0"
            )}
          >
            <div className="w-full h-full flex justify-center items-center p-8">
              {currentSong ? (
                selectedChartType === 'chords' ? (
                  <UGChordsReader
                    chordsText={currentSong.ug_chords_text || ""}
                    config={effectiveConfig}
                    isMobile={false}
                    originalKey={currentSong.originalKey}
                    targetKey={currentSong.targetKey || currentSong.originalKey}
                    readerKeyPreference={readerKeyPreference}
                    onChartReady={() => setIsChartContentLoading(false)}
                    isFullScreen={false} 
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
                  </div>
                )
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm italic">
                  <p>No song selected.</p>
                </div>
              )}
            </div>
            
            {isChartContentLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>}
          </div>

          {currentSong && (
            <RehearsalPanel
              song={currentSong}
              onUpdate={handleUpdateSong}
              keyPreference={readerKeyPreference}
            />
          )}
        </div>
      </main>

      <RepertoireSearchModal
        isOpen={isRepertoireSearchModalOpen}
        onClose={() => setIsRepertoireSearchModalOpen(false)}
        masterRepertoire={fullMasterRepertoire}
        currentSetlistSongs={[]}
        onSelectSong={handleSelectSongFromRepertoireSearch}
      />

      {currentSong && (
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
          pitch={currentSong.pitch || 0}
          setPitch={(p) => handleUpdateSong({ pitch: p })}
          isLoadingAudio={audioEngine.isLoadingAudio}
          readerKeyPreference={readerKeyPreference}
          effectiveTargetKey={currentSong.targetKey || currentSong.originalKey || 'C'}
          isPlayerVisible={isAudioPlayerVisible}
        />
      )}
    </div>
  );
};

export default AuditReaderMode;
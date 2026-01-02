"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { Music, Loader2, X, ExternalLink, ShieldCheck, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useSettings } from '@/hooks/use-settings';
import { syncToMasterRepertoire } from '@/utils/repertoireSync';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import UGChordsReader from '@/components/UGChordsReader';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { calculateSemitones } from '@/utils/keyUtils';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import PreferencesModal from '@/components/PreferencesModal';
import SongStudioModal from '@/components/SongStudioModal';
import SheetReaderHeader from '@/components/SheetReaderHeader';
import SheetReaderSidebar from '@/components/SheetReaderSidebar';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { extractKeyFromChords } from '@/utils/chordUtils';
import RepertoireSearchModal from '@/components/RepertoireSearchModal';
import FullScreenSongInfo from '@/components/FullScreenSongInfo';
import { motion, AnimatePresence } from 'framer-motion';

type ChartType = 'pdf' | 'leadsheet' | 'chords';

const SheetReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId } = useParams<{ songId?: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { 
    keyPreference: globalKeyPreference,
    preventStageKeyOverwrite
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
  const [chartLoading, setChartLoading] = useState(false);

  const [readerKeyPreference, setReaderKeyPreference] = useState<'sharps' | 'flats'>(
    globalKeyPreference === 'neutral' ? 'sharps' : globalKeyPreference
  );
  
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');

  const audioEngine = useToneAudio(true);
  const {
    isPlaying, progress, duration, loadFromUrl, stopPlayback,
    setPitch: setAudioPitch, setProgress: setAudioProgress,
    isLoadingAudio, tempo, volume, setVolume // FIXED: Added volume and setVolume here
  } = audioEngine;

  const currentSong = allSongs[currentIndex];

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const swipeThreshold = 50;

  // Persistence of song updates
  const handleLocalSongUpdate = useCallback((songId: string, updates: Partial<SetlistSong>) => {
    setAllSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
  }, []);

  const harmonicSync = useHarmonicSync({
    formData: {
      id: currentSong?.id,
      originalKey: currentSong?.originalKey,
      targetKey: currentSong?.targetKey || currentSong?.originalKey,
      pitch: currentSong?.pitch ?? 0,
      is_pitch_linked: currentSong?.is_pitch_linked ?? true,
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
        if (result[0]) handleLocalSongUpdate(currentSong.id, result[0]);
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

  const handleUpdateKey = useCallback((newTargetKey: string) => {
    if (!currentSong) return;
    setTargetKey(newTargetKey); 
    setAudioPitch(calculateSemitones(currentSong.originalKey || 'C', newTargetKey));
    if (isStageKeyLocked) showInfo(`Session Key: ${newTargetKey}`);
  }, [currentSong, isStageKeyLocked, setTargetKey, setAudioPitch]);

  const handlePullKey = useCallback(() => {
    if (!currentSong?.ug_chords_text) return;
    const extractedKey = extractKeyFromChords(currentSong.ug_chords_text);
    if (extractedKey) {
      setTargetKey(extractedKey);
      setPitch(0);
      setAudioPitch(0);
    }
  }, [currentSong, setTargetKey, setPitch, setAudioPitch]);

  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setInitialLoading(true);

    try {
      const filterApproved = searchParams.get('filterApproved');
      const targetId = routeSongId || searchParams.get('id');

      const { data: masterData, error: masterError } = await supabase.from('repertoire').select('*').eq('user_id', user.id).order('title');
      if (masterError) throw masterError;
      
      const masterList = (masterData || []).map((d: any) => ({
        ...d,
        id: d.id,
        name: d.title,
        originalKey: d.original_key ?? 'TBC',
        targetKey: d.target_key ?? d.original_key ?? 'TBC',
        previewUrl: d.extraction_status === 'completed' && d.audio_url ? d.audio_url : d.preview_url,
      }));
      setFullMasterRepertoire(masterList);

      let currentViewSongs = masterList;

      if (filterApproved === 'true') {
        const { data: setlists } = await supabase.from('setlists').select('id').eq('user_id', user.id).limit(1);
        if (setlists?.[0]) {
          const { data: junction } = await supabase.from('setlist_songs')
            .select('*, repertoire:song_id(*)')
            .eq('setlist_id', setlists[0].id)
            .order('sort_order', { ascending: true });
          
          currentViewSongs = (junction || []).map((j: any) => ({
            ...j.repertoire,
            id: j.id,
            master_id: j.repertoire.id,
            name: j.repertoire.title,
            originalKey: j.repertoire.original_key ?? 'TBC',
            targetKey: j.repertoire.target_key ?? j.repertoire.original_key ?? 'TBC',
            previewUrl: j.repertoire.extraction_status === 'completed' && j.repertoire.audio_url ? j.repertoire.audio_url : j.repertoire.preview_url,
          })).filter((s: any) => s.name);
          setCurrentSetlistSongs(currentViewSongs);
        }
      }

      const readable = currentViewSongs.filter((s: any) => 
        s.pdf_url || s.leadsheet_url || s.ug_chords_text || s.sheet_music_url
      );
      setAllSongs(readable);

      const startIdx = targetId ? readable.findIndex((s: any) => s.id === targetId || s.master_id === targetId) : 0;
      setCurrentIndex(startIdx === -1 ? 0 : startIdx);
    } catch (err: any) {
      showError(`Load failed: ${err.message}`);
    } finally {
      setInitialLoading(false);
    }
  }, [user, routeSongId, searchParams]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const getBestChartType = useCallback((song: SetlistSong): ChartType => {
    if (forceReaderResource === 'force-pdf' && song.pdfUrl) return 'pdf';
    if (forceReaderResource === 'force-ug' && (song.ugUrl || song.ug_chords_text)) return 'chords';
    if (song.preferred_reader === 'ug') return 'chords';
    if (song.preferred_reader === 'ls') return 'leadsheet';
    if (song.pdfUrl) return 'pdf';
    if (song.leadsheetUrl) return 'leadsheet';
    if (song.ug_chords_text) return 'chords';
    return 'pdf';
  }, [forceReaderResource]);

  useEffect(() => {
    if (currentSong) setSelectedChartType(getBestChartType(currentSong));
  }, [currentSong, getBestChartType]);

  const handleNext = useCallback(() => {
    if (allSongs.length > 0) {
      setCurrentIndex(p => (p + 1) % allSongs.length);
      stopPlayback();
    }
  }, [allSongs, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (allSongs.length > 0) {
      setCurrentIndex(p => (p - 1 + allSongs.length) % allSongs.length);
      stopPlayback();
    }
  }, [allSongs, stopPlayback]);

  const toggleBrowserFullScreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }, []);

  if (initialLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white relative">
      <motion.div
        initial={{ x: isSidebarOpen && !isBrowserFullScreen ? 0 : -300 }}
        animate={{ x: isSidebarOpen && !isBrowserFullScreen ? 0 : -300 }}
        className="fixed left-0 top-0 h-full w-[300px] z-50"
      >
        <SheetReaderSidebar songs={allSongs} currentIndex={currentIndex} onSelectSong={(idx) => { setCurrentIndex(idx); stopPlayback(); }} isFullScreen={isBrowserFullScreen} />
      </motion.div>

      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", isSidebarOpen && !isBrowserFullScreen && "ml-[300px]")}>
        <SheetReaderHeader
          currentSong={currentSong!}
          onClose={() => navigate('/')}
          onOpenRepertoireSearch={() => setIsRepertoireSearchModalOpen(true)}
          onOpenCurrentSongStudio={() => setIsStudioPanelOpen(true)}
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
          onSavePreference={setReaderKeyPreference}
          audioEngine={audioEngine}
          effectiveTargetKey={effectiveTargetKey}
          onPullKey={handlePullKey}
        />

        <div className={cn("flex-1 bg-black relative overflow-y-auto", isBrowserFullScreen ? "mt-0" : "mt-[112px]")}>
          {currentSong && (
            <div className="absolute inset-0">
              {selectedChartType === 'chords' ? (
                <UGChordsReader
                  chordsText={currentSong.ug_chords_text || ""}
                  config={currentSong.ug_chords_config}
                  isMobile={false}
                  originalKey={currentSong.originalKey}
                  targetKey={effectiveTargetKey}
                  isPlaying={isPlaying}
                  progress={progress}
                  duration={duration}
                  readerKeyPreference={readerKeyPreference}
                />
              ) : (
                <iframe
                  src={`${(selectedChartType === 'pdf' ? currentSong.pdfUrl : currentSong.leadsheetUrl) || currentSong.sheet_music_url}#toolbar=0&navpanes=0&view=FitH`}
                  className="w-full h-full bg-white"
                  title="Chart Viewer"
                  onLoad={() => setChartLoading(false)}
                />
              )}
            </div>
          )}
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
        {isStudioPanelOpen && currentSong && (
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="fixed right-0 top-0 h-full w-[480px] bg-slate-900 shadow-2xl z-50 flex flex-col">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">Song Studio</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsStudioPanelOpen(false)}><X className="w-5 h-5" /></Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SongStudioModal
                isOpen={true}
                onClose={() => setIsStudioPanelOpen(false)}
                gigId="library"
                songId={currentSong.id}
                visibleSongs={allSongs}
                handleAutoSave={(updates) => handleLocalSongUpdate(currentSong.id, updates)}
                preventStageKeyOverwrite={preventStageKeyOverwrite}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RepertoireSearchModal
        isOpen={isRepertoireSearchModalOpen}
        onClose={() => setIsRepertoireSearchModalOpen(false)}
        masterRepertoire={fullMasterRepertoire}
        currentSetlistSongs={currentSetlistSongs}
        onSelectSong={(s) => { 
          const idx = allSongs.findIndex(x => x.id === s.id || x.master_id === s.master_id);
          if (idx !== -1) setCurrentIndex(idx);
          setIsRepertoireSearchModalOpen(false);
        }}
      />

      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
    </div>
  );
};

export default SheetReaderMode;
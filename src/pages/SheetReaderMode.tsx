"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Loader2, AlertCircle, X, Settings, ExternalLink, ShieldCheck, FileText, Layout, Guitar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showError, showSuccess } from '@/utils/toast';
import UGChordsReader from '@/components/UGChordsReader';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { calculateSemitones } from '@/utils/keyUtils';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import PreferencesModal from '@/components/PreferencesModal';
import SongStudioModal from '@/components/SongStudioModal';
import SheetReaderHeader from '@/components/SheetReaderHeader';
import SheetReaderFooter from '@/components/SheetReaderFooter';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { motion } from 'framer-motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
  const { forceReaderResource, ignoreConfirmedGate } = useReaderSettings();

  // State
  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const [readerKeyPreference, setReaderKeyPreference] = useState<'sharps' | 'flats'>(globalKeyPreference);
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');

  // Audio
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
  } = audioEngine;

  const isAudioLoading = !!currentSong?.previewUrl && progress === 0 && !duration;

  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);

  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const handleAutoSave = useCallback((updates: Partial<SetlistSong>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const {
    pitch,
    setPitch,
    targetKey,
    setTargetKey,
  } = useHarmonicSync({ formData, handleAutoSave, globalKeyPreference });

  useEffect(() => {
    setAudioPitch(pitch);
  }, [pitch, setAudioPitch]);

  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setInitialLoading(true);
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title');

      if (error) throw error;

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
        is_sheet_verified: d.is_sheet_verified,
        is_ug_link_verified: d.is_ug_link_verified,
        is_pitch_linked: d.is_pitch_linked ?? true,
      }));

      const readableAndApprovedSongs = mappedSongs.filter(s => {
        const readiness = calculateReadiness(s);
        const hasChart = s.ugUrl || s.pdfUrl || s.leadsheetUrl || s.ug_chords_text;
        const meetsReadiness = readiness >= 40 || forceReaderResource === 'simulation' || ignoreConfirmedGate;
        return hasChart && meetsReadiness;
      });

      setAllSongs(readableAndApprovedSongs);

      let initialIndex = 0;
      const targetId = routeSongId || searchParams.get('id');

      if (!targetId) {
        const saved = localStorage.getItem('reader_last_index');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < readableAndApprovedSongs.length) {
            initialIndex = parsed;
          }
        }
      } else {
        const idx = readableAndApprovedSongs.findIndex(s => s.id === targetId);
        if (idx !== -1) initialIndex = idx;
      }

      setCurrentIndex(initialIndex);
    } catch (err) {
      showError('Failed to load repertoire');
    } finally {
      setInitialLoading(false);
    }
  }, [user, routeSongId, searchParams, forceReaderResource, ignoreConfirmedGate]);

  useEffect(() => { fetchSongs(); }, [fetchSongs]);

  const currentSong = allSongs[currentIndex];

  useEffect(() => {
    if (currentSong) {
      setFormData({
        originalKey: currentSong.originalKey,
        targetKey: currentSong.targetKey,
        pitch: currentSong.pitch,
        is_pitch_linked: currentSong.is_pitch_linked,
      });
    }
  }, [currentSong]);

  useEffect(() => {
    if (!currentSong?.previewUrl) {
      stopPlayback();
      return;
    }

    if (currentUrl !== currentSong.previewUrl) {
      resetEngine();
    }

    if (currentUrl !== currentSong.previewUrl || !currentBuffer) {
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

  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;

    setTargetKey(newTargetKey);
    const newPitch = calculateSemitones(currentSong.originalKey || 'C', newTargetKey);

    try {
      const { error } = await supabase
        .from('repertoire')
        .update({ target_key: newTargetKey, pitch: newPitch })
        .eq('id', currentSong.id);

      if (error) throw error;

      setAllSongs(prev => prev.map(s =>
        s.id === currentSong.id ? { ...s, targetKey: newTargetKey, pitch: newPitch } : s
      ));
      showSuccess(`Stage Key set to ${newTargetKey}`);
    } catch {
      showError('Failed to update key');
    }
  }, [currentSong, user, setTargetKey]);

  const onPullKey = useCallback(() => {
    console.log('Pull key triggered - implement if needed');
  }, []);

  const isFramable = useCallback((url: string | null | undefined) => {
    if (!url) return true;
    const blocked = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blocked.some(site => url.includes(site));
  }, []);

  const [renderedCharts, setRenderedCharts] = useState<RenderedChart[]>([]);

  const markChartLoaded = useCallback((songId: string, type: ChartType) => {
    setRenderedCharts(prev => prev.map(c =>
      c.id === songId && c.type === type ? { ...c, isLoaded: true } : c
    ));
  }, []);

  const renderChartForSong = useCallback((song: SetlistSong, chartType: ChartType) => {
    const readiness = calculateReadiness(song);
    if (readiness < 40 && forceReaderResource !== 'simulation' && !ignoreConfirmedGate) {
      setTimeout(() => markChartLoaded(song.id, chartType), 100);
      return /* missing resources UI */;
    }

    if (chartType === 'chords' && song.ug_chords_text?.trim()) {
      setTimeout(() => markChartLoaded(song.id, chartType), 100);
      return <UGChordsReader /* props */ />;
    }

    const chartUrl = chartType === 'pdf' ? song.pdfUrl : song.leadsheetUrl;
    if (!chartUrl) {
      setTimeout(() => markChartLoaded(song.id, chartType), 100);
      return /* no chart UI */;
    }

    const googleViewer = `https://docs.google.com/viewer?url=${encodeURIComponent(chartUrl)}&embedded=true`;

    if (isFramable(chartUrl)) {
      return (
        <div className="w-full h-full relative bg-black">
          <iframe
            src={googleViewer}
            className="absolute inset-0 w-full h-full"
            title="Chart Viewer"
            style={{ border: 'none' }}
            allowFullScreen
            onLoad={() => {
              // Mark loaded on success
              markChartLoaded(song.id, chartType);
            }}
          />
          {/* Fallback timeout in case onLoad doesn't fire properly */}
          {setTimeout(() => markChartLoaded(song.id, chartType), 5000)}
          {/* external link button */}
        </div>
      );
    }

    // Blocked → fallback
    setTimeout(() => markChartLoaded(song.id, chartType), 100);
    return /* protected asset UI */;
  }, [/* deps */]);

  // ... rest of useEffect for renderedCharts, available types, etc.

  const isOriginalKeyMissing = !currentSong?.originalKey;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white">
      {/* Sidebar etc. */}

      <main className="flex-1 flex flex-col overflow-hidden">
        <SheetReaderHeader /* props including onPullKey */ />

        {isOriginalKeyMissing && (
          <div className="fixed top-16 left-0 right-0 bg-red-900/80 p-4 text-center z-50">
            <AlertCircle className="inline w-6 h-6 mr-2" />
            <strong>Original Key Missing – Transposition Disabled</strong>
            <p className="text-sm">Open Studio (press I) and set the original key first.</p>
          </div>
        )}

        <div className={cn("flex-1 relative bg-black", isImmersive ? "mt-0" : "mt-16")}>
          {renderedCharts.map(rc => (
            <motion.div key={`${rc.id}-${rc.type}`} /* ... */ >
              {rc.content}
            </motion.div>
          ))}

          {currentSong && !renderedCharts.find(c => c.id === currentSong.id && c.type === selectedChartType)?.isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur z-50">
              <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
            </div>
          )}

          {/* Chart type selector */}
        </div>

        {!isImmersive && currentSong && <SheetReaderFooter /* props */ />}
      </main>

      {/* Modals */}
    </div>
  );
};

export default SheetReaderMode;
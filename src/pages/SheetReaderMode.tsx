"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Music, Loader2, AlertCircle, Settings, ExternalLink, ShieldCheck, 
  FileText, Layout, Guitar, Sparkles, ChevronLeft, ChevronRight, 
  List, X, Play, Pause, Volume2, Activity, Gauge, Maximize2, Minimize2,
  ArrowLeft, Search, Hash, ChevronDown, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import UGChordsReader from '@/components/UGChordsReader';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { calculateSemitones, formatKey, transposeKey } from '@/utils/keyUtils';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import PreferencesModal from '@/components/PreferencesModal';
import SongStudioModal from '@/components/SongStudioModal';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { extractKeyFromChords } from '@/utils/chordUtils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import SheetReaderHeader from '@/components/SheetReaderHeader';
import SheetReaderFooter from '@/components/SheetReaderFooter';

type ChartType = 'pdf' | 'leadsheet' | 'chords';

interface RenderedChart {
  id: string;
  content: React.ReactNode;
  isLoaded: boolean;
  opacity: number;
  zIndex: number;
  type: ChartType;
}

const CHART_LOAD_TIMEOUT_MS = 8000; // Increased timeout for slow connections

const SheetReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId } = useParams<{ songId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const { forceReaderResource, ignoreConfirmedGate } = useReaderSettings();

  // --- State ---
  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // UI State
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState("");

  // Reader Settings
  const [readerKeyPreference, setReaderKeyPreference] = useState<'sharps' | 'flats'>(globalKeyPreference);
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');
  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);
  const [pdfScrollSpeed, setPdfScrollSpeed] = useState(1.0);

  // Audio Engine
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

  const currentSong = allSongs[currentIndex];

  // --- Harmonic Sync Hook ---
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

      const dbUpdates: { [key: string]: any } = {};
      // Map keys
      if (updates.name !== undefined) dbUpdates.title = updates.name;
      if (updates.artist !== undefined) dbUpdates.artist = updates.artist;
      if (updates.previewUrl !== undefined) dbUpdates.preview_url = updates.previewUrl;
      if (updates.youtubeUrl !== undefined) dbUpdates.youtube_url = updates.youtubeUrl;
      if (updates.ugUrl !== undefined) dbUpdates.ug_url = updates.ugUrl;
      if (updates.appleMusicUrl !== undefined) dbUpdates.apple_music_url = updates.appleMusicUrl;
      if (updates.pdfUrl !== undefined) dbUpdates.pdf_url = updates.pdfUrl;
      if (updates.leadsheetUrl !== undefined) dbUpdates.leadsheet_url = updates.leadsheetUrl;
      if (updates.originalKey !== undefined) dbUpdates.original_key = updates.originalKey; else dbUpdates.original_key = null;
      if (updates.targetKey !== undefined) dbUpdates.target_key = updates.targetKey; else dbUpdates.target_key = null;
      if (updates.pitch !== undefined) dbUpdates.pitch = updates.pitch; else dbUpdates.pitch = 0;
      if (updates.bpm !== undefined) dbUpdates.bpm = updates.bpm; else dbUpdates.bpm = null;
      if (updates.genre !== undefined) dbUpdates.genre = updates.genre; else dbUpdates.genre = null;
      if (updates.isMetadataConfirmed !== undefined) dbUpdates.is_metadata_confirmed = updates.isMetadataConfirmed; else dbUpdates.is_metadata_confirmed = false;
      if (updates.isKeyConfirmed !== undefined) dbUpdates.is_key_confirmed = updates.isKeyConfirmed; else dbUpdates.is_key_confirmed = false;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes; else dbUpdates.notes = null;
      if (updates.lyrics !== undefined) dbUpdates.lyrics = updates.lyrics; else dbUpdates.lyrics = null;
      if (updates.resources !== undefined) dbUpdates.resources = updates.resources; else dbUpdates.resources = [];
      if (updates.user_tags !== undefined) dbUpdates.user_tags = updates.user_tags; else dbUpdates.user_tags = [];
      if (updates.is_pitch_linked !== undefined) dbUpdates.is_pitch_linked = updates.is_pitch_linked; else dbUpdates.is_pitch_linked = true;
      if (updates.duration_seconds !== undefined) dbUpdates.duration_seconds = Math.round(updates.duration_seconds || 0); else dbUpdates.duration_seconds = 0;
      if (updates.is_active !== undefined) dbUpdates.is_active = updates.is_active; else dbUpdates.is_active = true;
      if (updates.isApproved !== undefined) dbUpdates.is_approved = updates.isApproved; else dbUpdates.is_approved = false;
      if (updates.preferred_reader !== undefined) dbUpdates.preferred_reader = updates.preferred_reader; else dbUpdates.preferred_reader = null;
      if (updates.ug_chords_text !== undefined) dbUpdates.ug_chords_text = updates.ug_chords_text; else dbUpdates.ug_chords_text = null;
      if (updates.ug_chords_config !== undefined) dbUpdates.ug_chords_config = updates.ug_chords_config; else dbUpdates.ug_chords_config = null;
      if (updates.is_ug_chords_present !== undefined) dbUpdates.is_ug_chords_present = updates.is_ug_chords_present; else dbUpdates.is_ug_chords_present = false;
      if (updates.highest_note_original !== undefined) dbUpdates.highest_note_original = updates.highest_note_original; else dbUpdates.highest_note_original = null;
      if (updates.metadata_source !== undefined) dbUpdates.metadata_source = updates.metadata_source; else dbUpdates.metadata_source = null;
      if (updates.sync_status !== undefined) dbUpdates.sync_status = updates.sync_status; else dbUpdates.sync_status = 'IDLE';
      if (updates.last_sync_log !== undefined) dbUpdates.last_sync_log = updates.last_sync_log; else dbUpdates.last_sync_log = null;
      if (updates.auto_synced !== undefined) dbUpdates.auto_synced = updates.auto_synced; else dbUpdates.auto_synced = false;
      if (updates.sheet_music_url !== undefined) dbUpdates.sheet_music_url = updates.sheet_music_url; else dbUpdates.sheet_music_url = null;
      if (updates.is_sheet_verified !== undefined) dbUpdates.is_sheet_verified = updates.is_sheet_verified; else dbUpdates.is_sheet_verified = false;
      
      dbUpdates.updated_at = new Date().toISOString();

      supabase
        .from('repertoire')
        .update(dbUpdates)
        .eq('id', currentSong.id)
        .then(({ error }) => {
          if (error) {
            console.error("[SheetReaderMode] Auto-save failed:", error);
            showError('Auto-save failed');
          } else {
            setAllSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, ...updates } : s));
          }
        });
    }, [currentSong, user]),
    globalKeyPreference,
  });

  const { pitch, setPitch, targetKey: harmonicTargetKey, setTargetKey } = harmonicSync;

  // --- Data Fetching ---
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
        is_ug_link_verified: d.is_ug_link_verified,
        is_pitch_linked: d.is_pitch_linked ?? true,
        sheet_music_url: d.sheet_music_url,
        is_sheet_verified: d.is_sheet_verified,
        highest_note_original: d.highest_note_original,
        lyrics: d.lyrics,
        notes: d.notes,
      }));

      // Filter based on readiness and chart availability
      const readableSongs = mappedSongs.filter(s => {
        const readiness = calculateReadiness(s);
        const hasChart = s.ugUrl || s.pdfUrl || s.leadsheetUrl || s.ug_chords_text;
        const meetsReadiness = readiness >= 40 || forceReaderResource === 'simulation' || ignoreConfirmedGate;
        return hasChart && meetsReadiness;
      });

      setAllSongs(readableSongs);

      // Determine initial song
      let initialIndex = 0;
      const targetId = routeSongId || searchParams.get('id');

      if (targetId) {
        const idx = readableSongs.findIndex(s => s.id === targetId);
        if (idx !== -1) initialIndex = idx;
      } else {
        const saved = localStorage.getItem('reader_last_index');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < readableSongs.length) {
            initialIndex = parsed;
          }
        }
      }

      setCurrentIndex(initialIndex);
    } catch (err: any) {
      console.error("Fetch error:", err);
      showError(`Failed to load repertoire: ${err.message}`);
    } finally {
      setInitialLoading(false);
    }
  }, [user, routeSongId, searchParams, forceReaderResource, ignoreConfirmedGate]);

  // --- Effects ---

  // Check navigation guard
  useEffect(() => {
    const fromDashboard = sessionStorage.getItem('from_dashboard');
    if (!fromDashboard) {
      navigate('/', { replace: true });
      return;
    }
    sessionStorage.removeItem('from_dashboard');
    fetchSongs();
  }, [fetchSongs, navigate]);

  // Sync audio pitch
  useEffect(() => {
    setAudioPitch(pitch);
  }, [pitch, setAudioPitch]);

  // Force harmonic sync when song changes
  useEffect(() => {
    if (currentSong) {
      setTargetKey(currentSong.targetKey || currentSong.originalKey || 'C');
      setPitch(currentSong.pitch ?? 0);
      // Reset chart selection to force re-evaluation
      setSelectedChartType('pdf'); 
    }
  }, [currentSong, setTargetKey, setPitch]);

  // Load audio for current song
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

  // Persist current song
  useEffect(() => {
    if (currentSong) {
      setSearchParams({ id: currentSong.id }, { replace: true });
      localStorage.setItem('reader_last_index', currentIndex.toString());
    }
  }, [currentSong, currentIndex, setSearchParams]);

  // --- Navigation & Actions ---

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

  const handleSelectSong = useCallback((index: number) => {
    if (index >= 0 && index < allSongs.length) {
      setCurrentIndex(index);
      stopPlayback();
      setIsSidebarOpen(false);
    }
  }, [allSongs.length, stopPlayback]);

  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;

    const newPitch = calculateSemitones(currentSong.originalKey || 'C', newTargetKey);

    try {
      const { error } = await supabase
        .from('repertoire')
        .update({ target_key: newTargetKey, pitch: newPitch })
        .eq('id', currentSong.id);

      if (error) {
        console.error("[SheetReaderMode] Supabase update key error:", error);
        if (error.message.includes("new row violates row-level-security")) {
          showError("Database Security Error: You don't have permission to update this data. Check RLS policies.");
        } else {
          showError(`Failed to update key: ${error.message}`);
        }
        throw error;
      }

      setAllSongs(prev => prev.map(s =>
        s.id === currentSong.id 
          ? { ...s, targetKey: newTargetKey, pitch: newPitch } 
          : s
      ));

      setTargetKey(newTargetKey);
      setPitch(newPitch);

      showSuccess(`Stage Key set to ${newTargetKey}`);
    } catch (err) {
      // Error already logged and shown
    }
  }, [currentSong, user, setTargetKey, setPitch]);

  const handlePullKey = useCallback(async () => {
    if (!currentSong || !user || !currentSong.ug_chords_text) {
      showError("No UG Chords text found to extract key.");
      return;
    }

    const extractedKey = extractKeyFromChords(currentSong.ug_chords_text);

    if (extractedKey) {
      try {
        const { error } = await supabase
          .from('repertoire')
          .update({ 
            original_key: extractedKey,
            target_key: extractedKey,
            pitch: 0,
            is_key_confirmed: true 
          })
          .eq('id', currentSong.id);
        
        if (error) {
          console.error("[SheetReaderMode] Supabase pull key error:", error);
          if (error.message.includes("new row violates row-level-security")) {
            showError("Database Security Error: You don't have permission to update this data. Check RLS policies.");
          } else {
            showError(`Failed to update key: ${error.message}`);
          }
          throw error;
        }

        setAllSongs(prev => prev.map(s => 
          s.id === currentSong.id 
            ? { ...s, originalKey: extractedKey, targetKey: extractedKey, pitch: 0, isKeyConfirmed: true } 
            : s
        ));

        setTargetKey(extractedKey);
        setPitch(0);

        showSuccess(`Key extracted and set to: ${extractedKey}`);
      } catch (err) {
        // Error already logged and shown
      }
    } else {
      showError("Could not find a valid chord in the UG text.");
    }
  }, [currentSong, user, setTargetKey, setPitch]);

  // NEW: isFramable check
  const isFramable = useCallback((url: string | null | undefined) => {
    if (!url) return true;
    const blocked = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blocked.some(site => url.includes(site));
  }, []);

  const [renderedCharts, setRenderedCharts] = useState<RenderedChart[]>([]);

  const handleChartLoad = useCallback((id: string, type: ChartType) => {
    setRenderedCharts(prev => prev.map(rc => 
      rc.id === id && rc.type === type ? { ...rc, isLoaded: true } : rc
    ));
  }, []);

  const renderChartForSong = useCallback((song: SetlistSong, chartType: ChartType): React.ReactNode => {
    const readiness = calculateReadiness(song);
    const isReadyGatePassed = readiness >= 40 || forceReaderResource === 'simulation' || ignoreConfirmedGate;

    if (!isReadyGatePassed) {
      setTimeout(() => handleChartLoad(song.id, chartType), 50);
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <AlertCircle className="w-24 h-24 text-red-500 mb-8" />
          <h2 className="text-4xl font-black uppercase text-white mb-4">Missing Resources</h2>
          <p className="text-xl text-slate-400 mb-8">Audit this track to link charts or audio.</p>
          <Button onClick={() => navigate('/')} className="text-lg px-10 py-6 bg-indigo-600 rounded-2xl">
            Go to Dashboard
          </Button>
        </div>
      );
    }

    if (chartType === 'chords') {
      if (song.ug_chords_text?.trim()) {
        setTimeout(() => handleChartLoad(song.id, chartType), 50);
        return (
          <UGChordsReader
            key={`${song.id}-chords-${harmonicTargetKey}-${chordScrollSpeed}-${chordAutoScrollEnabled}`}
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
      return renderChartForSong(song, 'pdf');
    }

    const chartUrl = chartType === 'pdf' ? song.pdfUrl : song.leadsheetUrl;
    if (!chartUrl) {
      setTimeout(() => handleChartLoad(song.id, chartType), 50);
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <Music className="w-24 h-24 text-slate-700 mb-8" />
          <h2 className="text-4xl font-black uppercase text-white mb-4">No {chartType === 'pdf' ? 'Full Score' : 'Leadsheet'} Available</h2>
          <p className="text-xl text-slate-400 mb-8">Upload one in the Studio.</p>
          <Button onClick={() => setIsStudioModalOpen(true)} className="text-lg px-10 py-6 bg-indigo-600 rounded-2xl">
            Open Studio
          </Button>
        </div>
      );
    }

    // PDF/Leadsheet Viewer Logic
    const googleViewer = `https://docs.google.com/viewer?url=${encodeURIComponent(chartUrl)}&embedded=true`;
    
    if (isFramable(chartUrl)) {
      // We use a custom iframe wrapper that handles scroll simulation
      return (
        <div className="w-full h-full relative bg-black overflow-hidden group">
          <iframe
            key={`${song.id}-${chartType}`}
            src={googleViewer}
            className="absolute inset-0 w-full h-full"
            title="Chart Viewer"
            style={{ border: 'none' }}
            allowFullScreen
            onLoad={() => handleChartLoad(song.id, chartType)}
          />
          {/* PDF Scroll Simulation Overlay (Visual Only) */}
          {pdfScrollSpeed > 1.0 && isPlaying && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-black/60 px-4 py-2 rounded-full text-xs font-bold text-white backdrop-blur">
              Simulating Scroll: {pdfScrollSpeed.toFixed(2)}x
            </div>
          )}
          <div className="absolute bottom-6 right-6 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <a href={chartUrl} target="_blank" rel="noopener noreferrer" className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-xs font-bold shadow-lg">
              Open Externally
            </a>
          </div>
        </div>
      );
    }

    setTimeout(() => handleChartLoad(song.id, chartType), 50);
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-6 md:p-12 text-center">
        <ShieldCheck className="w-12 h-12 md:w-16 md:h-16 text-indigo-400 mb-6 md:mb-10" />
        <h4 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4 md:mb-6 text-white">Asset Protected</h4>
        <p className="text-slate-500 mb-8 md:mb-16 text-lg md:text-xl font-medium leading-relaxed">
          External security prevents in-app display. Launch in a secure window.
        </p>
        <Button onClick={() => window.open(chartUrl, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-16 md:h-20 px-10 md:px-16 font-black uppercase tracking-[0.2em] text-xs md:text-sm rounded-2xl md:rounded-3xl shadow-2xl gap-4 md:gap-6">
          <ExternalLink className="w-6 h-6 md:w-8 md:h-8" /> Launch Chart
        </Button>
      </div>
    );
  }, [forceReaderResource, ignoreConfirmedGate, navigate, harmonicTargetKey, isFramable, setIsStudioModalOpen, isPlaying, progress, duration, chordAutoScrollEnabled, chordScrollSpeed, readerKeyPreference, pdfScrollSpeed, handleChartLoad]);

  // Update rendered charts when song or chart type changes
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
          content: renderChartForSong(currentSong, selectedChartType),
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
  }, [currentSong, selectedChartType, renderChartForSong]);

  // Chart Loading Timeout
  const currentChartState = useMemo(() => 
    renderedCharts.find(c => c.id === currentSong?.id && c.type === selectedChartType),
    [renderedCharts, currentSong?.id, selectedChartType]
  );

  useEffect(() => {
    if (currentChartState && !currentChartState.isLoaded && currentSong) {
      const timeoutId = setTimeout(() => {
        if (!currentChartState.isLoaded) {
          setRenderedCharts(prev => prev.map(rc => 
            rc.id === currentSong.id && rc.type === selectedChartType ? { ...rc, isLoaded: true } : rc
          ));
          if (!ignoreConfirmedGate) {
            showInfo("Chart loading timed out. Try opening externally.", { duration: 8000 });
          }
        }
      }, CHART_LOAD_TIMEOUT_MS);
      return () => clearTimeout(timeoutId);
    }
  }, [currentChartState, currentSong, selectedChartType, ignoreConfirmedGate]);

  // --- Derived State ---
  const availableChartTypes = useMemo((): ChartType[] => {
    if (!currentSong) return [];
    const types: ChartType[] = [];
    if (currentSong.ug_chords_text?.trim()) types.push('chords');
    if (currentSong.pdfUrl) types.push('pdf');
    if (currentSong.leadsheetUrl) types.push('leadsheet');
    return types;
  }, [currentSong]);

  const isOriginalKeyMissing = useMemo(() => 
    !currentSong?.originalKey || currentSong.originalKey === 'TBC', 
    [currentSong]
  );

  const filteredSongs = useMemo(() => {
    if (!sidebarSearch.trim()) return allSongs;
    const q = sidebarSearch.toLowerCase();
    return allSongs.filter(s => s.name.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));
  }, [allSongs, sidebarSearch]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlayback();
          break;
        case 'arrowright':
          handleNext();
          break;
        case 'arrowleft':
          handlePrev();
          break;
        case 'escape':
          if (isSidebarOpen) setIsSidebarOpen(false);
          else if (isStudioModalOpen) setIsStudioModalOpen(false);
          else if (isPreferencesOpen) setIsPreferencesOpen(false);
          else if (!isImmersive) navigate('/');
          break;
        case 'i':
          if (!isSidebarOpen && !isStudioModalOpen && !isPreferencesOpen && currentSong) {
            e.preventDefault();
            setIsStudioModalOpen(true);
          }
          break;
        case 's':
          setChordAutoScrollEnabled(prev => !prev);
          showInfo(`Auto-scroll ${!chordAutoScrollEnabled ? 'Enabled' : 'Disabled'}`);
          break;
        case 'm':
          setIsImmersive(prev => !prev);
          break;
        case 'l':
          setIsSidebarOpen(prev => !prev);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayback, handleNext, handlePrev, isSidebarOpen, isStudioModalOpen, isPreferencesOpen, isImmersive, navigate, chordAutoScrollEnabled, currentSong]);

  // --- Render ---
  if (initialLoading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
      </div>
    );
  }

  const isChartLoading = !currentChartState?.isLoaded;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white font-sans selection:bg-indigo-500/30">
      {/* Sidebar for Song Selection */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-80 bg-slate-900 border-r border-white/10 flex flex-col z-50 absolute inset-y-0 left-0 shadow-2xl"
          >
            <div className="p-4 border-b border-white/10 bg-slate-800/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black uppercase tracking-widest text-sm">Song List</h3>
                <Button size="icon" variant="ghost" onClick={() => setIsSidebarOpen(false)} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Input 
                placeholder="Search..." 
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="h-9 bg-slate-950 border-white/10 text-xs"
              />
            </div>
            <ScrollArea className="flex-1">
              <div className="flex flex-col">
                {filteredSongs.map((song, idx) => {
                  const isActive = allSongs.findIndex(s => s.id === song.id) === currentIndex;
                  const globalIndex = allSongs.findIndex(s => s.id === song.id);
                  return (
                    <button
                      key={song.id}
                      onClick={() => handleSelectSong(globalIndex)}
                      className={cn(
                        "p-3 text-left border-b border-white/5 hover:bg-white/5 transition-colors flex flex-col gap-1",
                        isActive && "bg-indigo-600/20 border-indigo-500/30"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("font-bold text-sm truncate", isActive && "text-indigo-300")}>
                          {song.name}
                        </span>
                        {isActive && <Play className="w-3 h-3 text-indigo-400 fill-current" />}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{song.artist}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", isSidebarOpen && "ml-80")}>
        {/* Header */}
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
          setIsOverlayOpen={setIsStudioModalOpen}
          isOverrideActive={forceReaderResource !== 'default'}
          pitch={pitch}
          setPitch={setPitch}
          readerKeyPreference={readerKeyPreference}
          setReaderKeyPreference={setReaderKeyPreference}
          onPullKey={handlePullKey}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        {/* Missing Key Warning */}
        {isOriginalKeyMissing && (
          <div className="bg-red-950/30 border-b border-red-900/50 p-2 flex items-center justify-center gap-2 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">
              Original Key Missing. Transposition relative to 'C'. Set in Studio (I).
            </p>
          </div>
        )}

        {/* Chart Area */}
        <div className={cn("flex-1 bg-black overflow-hidden relative", isImmersive ? "mt-0" : "mt-0")}>
          {renderedCharts.map(rc => (
            <motion.div
              key={`${rc.id}-${rc.type}`}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: rc.opacity }}
              transition={{ duration: 0.3 }}
              style={{ zIndex: rc.zIndex }}
            >
              {rc.content}
            </motion.div>
          ))}

          {currentSong && isChartLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20">
              <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
            </div>
          )}
        </div>

        {/* Footer Controls */}
        {!isImmersive && currentSong && (
          <SheetReaderFooter
            currentSong={currentSong}
            isPlaying={isPlaying}
            progress={progress}
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
            pdfScrollSpeed={pdfScrollSpeed}
            setPdfScrollSpeed={setPdfScrollSpeed}
            selectedChartType={selectedChartType}
          />
        )}
      </main>

      {/* Modals */}
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      {currentSong && (
        <SongStudioModal
          isOpen={isStudioModalOpen}
          onClose={() => setIsStudioModalOpen(false)}
          gigId="library"
          songId={currentSong.id}
        />
      )}
    </div>
  );
};

export default SheetReaderMode;
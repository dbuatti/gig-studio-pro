"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  FileText, ArrowLeft, ChevronLeft, ChevronRight, Play, Pause, Shuffle, Timer, Filter, Music, Check, X, Loader2, Guitar, AlignLeft, ExternalLink, ShieldCheck, ListMusic, SortAsc, SortDesc, Search, Volume2, RotateCcw, Plus, Minus, AlertCircle, Bug
} from 'lucide-react';
import { cn } from '@/lib/utils';
import UGChordsReader from '@/components/UGChordsReader';
import { formatKey, calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useToneAudio } from '@/hooks/use-tone-audio';
import SheetReaderHeader from '@/components/SheetReaderHeader';
import SheetReaderFooter from '@/components/SheetReaderFooter';
import RepertoirePicker from '@/components/RepertoirePicker';
import ResourceAuditModal from '@/components/ResourceAuditModal';
import { AnimatePresence, motion } from 'framer-motion';
import FloatingCommandDock from '@/components/FloatingCommandDock';
import { useReaderSettings } from '@/hooks/use-reader-settings'; // NEW: Import useReaderSettings
import { useIsMobile } from '@/hooks/use-mobile'; // NEW: Import useIsMobile

interface FilterState {
  hasAudio: boolean;
  isApproved: boolean;
  hasCharts: boolean;
  hasUgChords: boolean;
}

type SortOption = 'alphabetical' | 'readiness_asc' | 'readiness_desc';

interface SheetReaderModeProps {
  // No props needed here, as it will get initialSongId from URL params
}

const SheetReaderMode: React.FC<SheetReaderModeProps> = () => {
  const navigate = useNavigate();
  const { songId: initialSongId } = useParams<{ songId?: string }>();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const {
    forceReaderResource, // NEW: Get forceReaderResource from hook
    alwaysShowAllToasts, // NEW: Get alwaysShowAllToasts from hook
    ignoreConfirmedGate, // NEW: Get ignoreConfirmedGate from hook
    forceDesktopView,    // NEW: Get forceDesktopView from hook
  } = useReaderSettings(); // NEW: Use reader settings hook

  const isMobileHook = useIsMobile(); // Use the original useIsMobile hook
  const isMobile = forceDesktopView ? false : isMobileHook; // NEW: Override isMobile if forceDesktopView is true

  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<SetlistSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    hasAudio: false,
    isApproved: false,
    hasCharts: false,
    hasUgChords: false,
  });
  const [sortOption, setSortOption] = useState<SortOption>('alphabetical');
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
  const [autoAdvanceInterval, setAutoAdvanceInterval] = useState(30); // seconds
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const audioEngine = useToneAudio(true); // Pass true to suppress toasts by default
  const { isPlaying, progress, duration, analyzer, loadFromUrl, togglePlayback, stopPlayback, setPitch: setAudioPitch, setVolume, setProgress: setAudioProgress, resetEngine } = audioEngine;

  const currentSong = filteredSongs[currentIndex];
  const currentSongKeyPreference = currentSong?.key_preference || globalKeyPreference;

  const [localPitch, setLocalPitch] = useState(0);
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [isResourceAuditOpen, setIsResourceAuditOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const mainContentRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const tapCountRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const uiHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isFramable = useCallback((url: string | null | undefined) => {
    if (!url) return true;
    const blockedSites = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blockedSites.some(site => url.includes(site));
  }, []);

  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title'); // Removed .eq('is_approved', true) to allow filtering by ignoreConfirmedGate

      if (error) throw error;

      const mappedSongs: SetlistSong[] = (data || []).map(d => ({
        id: d.id,
        master_id: d.id,
        name: d.title,
        artist: d.artist,
        bpm: d.bpm,
        lyrics: d.lyrics,
        originalKey: d.original_key,
        targetKey: d.target_key,
        pitch: d.pitch,
        ugUrl: d.ug_url,
        pdfUrl: d.pdf_url,
        leadsheetUrl: d.leadsheet_url,
        previewUrl: d.preview_url,
        youtubeUrl: d.youtube_url,
        appleMusicUrl: d.apple_music_url,
        isMetadataConfirmed: d.is_metadata_confirmed,
        isKeyConfirmed: d.is_key_confirmed,
        duration_seconds: d.duration_seconds,
        notes: d.notes,
        user_tags: d.user_tags || [],
        resources: d.resources || [],
        isApproved: d.is_approved,
        preferred_reader: d.preferred_reader,
        ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: d.is_ug_chords_present,
        highest_note_original: d.highest_note_original,
        is_sheet_verified: d.is_sheet_verified,
        sheet_music_url: d.sheet_music_url,
      }));
      setAllSongs(mappedSongs);

      if (initialSongId) {
        const initialIdx = mappedSongs.findIndex(s => s.id === initialSongId);
        if (initialIdx !== -1) {
          setCurrentIndex(initialIdx);
        }
      }

    } catch (err) {
      console.error("Failed to fetch repertoire:", err);
      showError("Failed to load your repertoire.");
    } finally {
      setLoading(false);
    }
  }, [user, initialSongId]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  useEffect(() => {
    let result = [...allSongs];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.artist?.toLowerCase().includes(q)
      );
    }

    // Apply filters
    if (filters.hasAudio) {
      result = result.filter(s => !!s.previewUrl && !(s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets')));
    }
    // NEW: Apply ignoreConfirmedGate logic
    if (!ignoreConfirmedGate && filters.isApproved) {
      result = result.filter(s => s.isApproved);
    } else if (ignoreConfirmedGate && filters.isApproved) {
      // If ignoreConfirmedGate is true, but filter is still 'isApproved', it means we want to see ALL songs,
      // but the filter state is still 'isApproved'. This is a bit contradictory.
      // For simplicity, if ignoreConfirmedGate is true, we effectively ignore the 'isApproved' filter.
      // So, no additional filtering here.
    }
    
    if (filters.hasCharts) {
      result = result.filter(s => s.pdfUrl || s.leadsheetUrl || s.ugUrl || s.ug_chords_text);
    }
    if (filters.hasUgChords) {
      result = result.filter(s => s.is_ug_chords_present);
    }

    // Apply sorting
    if (sortOption === 'alphabetical') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortOption === 'readiness_asc') {
      result.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    } else if (sortOption === 'readiness_desc') {
      result.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    }

    setFilteredSongs(result);
    setCurrentIndex(0);
  }, [allSongs, searchTerm, filters, sortOption, ignoreConfirmedGate]); // NEW: Add ignoreConfirmedGate to dependencies

  useEffect(() => {
    if (currentSong?.previewUrl) {
      loadFromUrl(currentSong.previewUrl, currentSong.pitch || 0);
      setLocalPitch(currentSong.pitch || 0);
    } else {
      resetEngine();
      setLocalPitch(0);
    }
  }, [currentSong, loadFromUrl, resetEngine]);

  useEffect(() => {
    const updateSongInDb = async () => {
      if (currentSong && user && localPitch !== currentSong.pitch) {
        const newTargetKey = transposeKey(currentSong.originalKey || "C", localPitch);
        try {
          await supabase
            .from('repertoire')
            .update({ pitch: localPitch, target_key: newTargetKey })
            .eq('id', currentSong.id)
            .eq('user_id', user.id);
          
          setAllSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, pitch: localPitch, targetKey: newTargetKey } : s));
        } catch (error) {
          console.error("Failed to update song pitch in DB:", error);
          showError("Failed to save pitch changes.");
        }
      }
    };
    updateSongInDb();
  }, [localPitch, currentSong, user]);

  const handleNext = useCallback(() => {
    if (filteredSongs.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % filteredSongs.length);
    stopPlayback();
  }, [filteredSongs, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (filteredSongs.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + filteredSongs.length) % filteredSongs.length);
    stopPlayback();
  }, [filteredSongs, stopPlayback]);

  const handleToggleAutoAdvance = useCallback(() => {
    setAutoAdvanceEnabled(prev => !prev);
  }, []);

  useEffect(() => {
    if (autoAdvanceTimerRef.current) {
      clearInterval(autoAdvanceTimerRef.current);
    }
    if (autoAdvanceEnabled && filteredSongs.length > 0) {
      autoAdvanceTimerRef.current = setInterval(handleNext, autoAdvanceInterval * 1000);
    }
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearInterval(autoAdvanceTimerRef.current);
      }
    };
  }, [autoAdvanceEnabled, autoAdvanceInterval, filteredSongs.length, handleNext]);

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.key === 'Escape') {
        navigate('/dashboard');
      }
      if (e.key === 'ArrowLeft') {
        handlePrev();
      }
      if (e.key === 'ArrowRight') {
        handleNext();
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setLocalPitch(prev => Math.min(prev + 1, 24));
      }
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setLocalPitch(prev => Math.max(prev - 1, -24));
      }
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, handlePrev, handleNext, togglePlayback, toggleFullScreen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    tapCountRef.current++;

    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    longPressTimeoutRef.current = setTimeout(() => {
      tapCountRef.current = 0;
      setIsRepertoirePickerOpen(true);
      longPressTimeoutRef.current = null;
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = Math.abs(touchStartX.current - currentX);
    const deltaY = Math.abs(touchStartY.current - currentY);

    if (deltaX > 10 || deltaY > 10) {
      tapCountRef.current = 0;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (tapCountRef.current === 1) {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = setTimeout(() => {
        setIsUiVisible(prev => !prev);
        setIsMenuOpen(prev => !prev);
        tapCountRef.current = 0;
        tapTimeoutRef.current = null;
      }, 250);
    } else if (tapCountRef.current === 2) {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      togglePlayback();
      tapCountRef.current = 0;
      tapTimeoutRef.current = null;
    }

    if (tapCountRef.current === 0) {
      const endX = e.changedTouches[0].clientX;
      const diffX = touchStartX.current - endX;
      const swipeThreshold = 50;

      if (Math.abs(diffX) > swipeThreshold) {
        if (diffX > 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    }
  }, [handleNext, handlePrev, togglePlayback]);

  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;

    const newPitch = calculateSemitones(currentSong.originalKey || "C", newTargetKey);
    setLocalPitch(newPitch);
    setAudioPitch(newPitch);

    try {
      await supabase
        .from('repertoire')
        .update({ target_key: newTargetKey, pitch: newPitch })
        .eq('id', currentSong.id)
        .eq('user_id', user.id);
      
      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, targetKey: newTargetKey, pitch: newPitch } : s));
      showSuccess(`Stage Key set to ${newTargetKey}`);
    } catch (error) {
      console.error("Failed to update song key in DB:", error);
      showError("Failed to save key changes.");
    }
  }, [currentSong, user, setAudioPitch]);

  const renderChart = useMemo(() => {
    if (!currentSong) return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-8">
        <Music className="w-16 h-16 mb-4" />
        <p className="text-lg font-black uppercase tracking-tight">No Song Selected</p>
        <p className="text-sm mt-2">Select a song from the list or add new tracks to your repertoire.</p>
      </div>
    );

    const readiness = calculateReadiness(currentSong);
    const hasChartLink = currentSong.pdfUrl || currentSong.leadsheetUrl || currentSong.ugUrl || currentSong.ug_chords_text;

    // NEW: Simulation Mode Logic
    if (forceReaderResource === 'simulation') {
      const isMissing = Math.random() > 0.5; // 50% chance to simulate missing resources
      if (isMissing) {
        return (
          <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-white p-8 text-center">
            <div className="bg-red-500/10 w-20 h-20 rounded-[2rem] flex items-center justify-center text-red-500 mx-auto mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight mb-4">SIMULATION: Missing Resources</h1>
            <p className="text-slate-500 max-w-md font-medium">
              This is a simulation. The song is currently showing as missing resources.
            </p>
            <Button 
              onClick={() => setIsResourceAuditOpen(true)} 
              className="mt-8 bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest px-8 h-14 rounded-2xl shadow-lg shadow-indigo-600/30"
            >
              <ShieldCheck className="w-5 h-5 mr-3" /> Open Resource Audit
            </Button>
          </div>
        );
      }
    }

    if (readiness < 40 || !hasChartLink) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-white p-8 text-center">
          <div className="bg-red-500/10 w-20 h-20 rounded-[2rem] flex items-center justify-center text-red-500 mx-auto mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight mb-4">Missing Resources</h1>
          <p className="text-slate-500 max-w-md font-medium">
            This song has a readiness score of {readiness}% or is missing a linked chart.
            Please audit its resources to ensure it's ready for performance.
          </p>
          <Button 
            onClick={() => setIsResourceAuditOpen(true)} 
            className="mt-8 bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest px-8 h-14 rounded-2xl shadow-lg shadow-indigo-600/30"
          >
            <ShieldCheck className="w-5 h-5 mr-3" /> Open Resource Audit
          </Button>
        </div>
      );
    }

    const preferredReader = currentSong.preferred_reader;
    const ugChordsConfig = currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG;

    let chartContent = null;
    let chartType = "None";
    let chartUrl = null;

    // NEW: Apply forceReaderResource logic
    switch (forceReaderResource) {
      case 'force-pdf':
        if (currentSong.pdfUrl) { chartUrl = currentSong.pdfUrl; chartType = "Forced PDF"; }
        break;
      case 'force-ug':
        if (currentSong.ugUrl) { chartUrl = currentSong.ugUrl; chartType = "Forced UG"; }
        break;
      case 'force-chords':
        if (currentSong.ug_chords_text) {
          chartContent = (
            <UGChordsReader
              chordsText={currentSong.ug_chords_text}
              config={ugChordsConfig}
              isMobile={isMobile}
              originalKey={currentSong.originalKey}
              targetKey={transposeKey(currentSong.originalKey || "C", localPitch)}
            />
          );
          chartType = "Forced Chords";
        }
        break;
      case 'default':
      default:
        // Existing logic for preferred reader and fallbacks
        if (preferredReader === 'ug' && currentSong.ug_chords_text) {
          chartContent = (
            <UGChordsReader
              chordsText={currentSong.ug_chords_text}
              config={ugChordsConfig}
              isMobile={isMobile}
              originalKey={currentSong.originalKey}
              targetKey={transposeKey(currentSong.originalKey || "C", localPitch)}
            />
          );
          chartType = "UG Chords";
        } else if (preferredReader === 'ls' && currentSong.leadsheetUrl) {
          chartUrl = currentSong.leadsheetUrl;
          chartType = "Lead Sheet";
        } else if (preferredReader === 'fn' && currentSong.pdfUrl) {
          chartUrl = currentSong.pdfUrl;
          chartType = "Full Notation";
        } else {
          if (currentSong.ug_chords_text) {
            chartContent = (
              <UGChordsReader
                chordsText={currentSong.ug_chords_text}
                config={ugChordsConfig}
                isMobile={isMobile}
                originalKey={currentSong.originalKey}
                targetKey={transposeKey(currentSong.originalKey || "C", localPitch)}
              />
            );
            chartType = "UG Chords (Fallback)";
          } else if (currentSong.leadsheetUrl) {
            chartUrl = currentSong.leadsheetUrl;
            chartType = "Lead Sheet (Fallback)";
          } else if (currentSong.pdfUrl) {
            chartUrl = currentSong.pdfUrl;
            chartType = "Full Notation (Fallback)";
          } else {
            chartContent = (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-8">
                <FileText className="w-16 h-16 mb-4" />
                <p className="text-lg font-black uppercase tracking-tight">No Chart Linked</p>
                <p className="text-sm mt-2">Add a PDF, Lead Sheet, or Ultimate Guitar tab in Song Studio.</p>
              </div>
            );
            chartType = "None";
          }
        }
        break;
    }

    if (chartUrl) {
      if (isFramable(chartUrl)) {
        chartContent = <iframe src={`${chartUrl}#toolbar=0&navpanes=0&view=FitH`} className="w-full h-full" title={chartType} />;
      } else {
        chartContent = (
          <div className="h-full flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
            <ShieldCheck className="w-12 h-12 text-indigo-400 mb-6" />
            <h4 className="text-3xl font-black uppercase tracking-tight mb-4 text-white">Asset Protected</h4>
            <p className="text-slate-500 max-w-xl mb-8 text-lg font-medium leading-relaxed">
              External security prevents in-app display. Use the button below to launch in a secure dedicated performance window.
            </p>
            <Button onClick={() => window.open(chartUrl, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-16 px-10 font-black uppercase tracking-[0.2em] text-sm rounded-2xl shadow-2xl shadow-indigo-600/30 gap-4">
              <ExternalLink className="w-6 h-6" /> Launch Chart Window
            </Button>
          </div>
        );
      }
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={cn(
          "flex-1 overflow-hidden bg-black shadow-2xl relative",
          isFullScreen ? "fixed inset-0 z-0" : "rounded-b-[3rem] md:rounded-b-[4rem]"
        )}>
          {chartContent}
        </div>
      </div>
    );
  }, [currentSong, filteredSongs, isFramable, currentSongKeyPreference, localPitch, isFullScreen, forceReaderResource, isMobile]); // NEW: Add forceReaderResource and isMobile to dependencies

  const handleSelectSongFromPicker = useCallback((song: SetlistSong) => {
    const newIndex = allSongs.findIndex(s => s.id === song.id);
    if (newIndex !== -1) {
      setCurrentIndex(newIndex);
      setIsRepertoirePickerOpen(false);
    }
  }, [allSongs]);

  const handleUpdateSongInRepertoire = useCallback(async (songId: string, updates: Partial<SetlistSong>) => {
    if (!user) return;
    const target = allSongs.find(s => s.id === songId);
    if (target) {
      await supabase.from('repertoire').update(updates).eq('id', songId).eq('user_id', user.id);
      setAllSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
      showSuccess("Song updated in repertoire.");
    }
  }, [allSongs, user]);

  useEffect(() => {
    if (uiHideTimeoutRef.current) {
      clearTimeout(uiHideTimeoutRef.current);
    }
    if (isUiVisible && !isOverlayOpen) {
      uiHideTimeoutRef.current = setTimeout(() => {
        setIsUiVisible(false);
        setIsMenuOpen(false);
      }, 5000);
    }
    return () => {
      if (uiHideTimeoutRef.current) {
        clearTimeout(uiHideTimeoutRef.current);
      }
    };
  }, [isUiVisible, isOverlayOpen]);

  useEffect(() => {
    const onFullScreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullScreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullScreenChange);
  }, []);

  return (
    <div
      className={cn(
        "relative flex h-screen w-screen overflow-hidden bg-slate-950 text-white",
      )}
    >
      <AnimatePresence>
        {isUiVisible && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 left-0 right-0 z-60"
          >
            <SheetReaderHeader
              currentSong={currentSong}
              onClose={() => navigate('/dashboard')}
              onSearchClick={() => setIsRepertoirePickerOpen(true)}
              onPrevSong={handlePrev}
              onNextSong={handleNext}
              currentSongIndex={currentIndex}
              totalSongs={filteredSongs.length}
              isLoading={loading}
              keyPreference={globalKeyPreference}
              onUpdateKey={handleUpdateKey}
              isFullScreen={isFullScreen}
              onToggleFullScreen={toggleFullScreen}
              setIsOverlayOpen={setIsOverlayOpen}
              isOverrideActive={forceReaderResource !== 'default' || alwaysShowAllToasts || ignoreConfirmedGate || forceDesktopView} // NEW: Pass override status
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isUiVisible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-0 left-0 right-0 z-60"
          >
            <SheetReaderFooter
              currentSong={currentSong}
              isPlaying={isPlaying}
              progress={progress}
              duration={duration}
              onTogglePlayback={togglePlayback}
              onStopPlayback={stopPlayback}
              onSetProgress={setAudioProgress}
              localPitch={localPitch}
              setLocalPitch={setLocalPitch}
              volume={audioEngine.volume}
              setVolume={audioEngine.setVolume}
              keyPreference={globalKeyPreference}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3 }}
            className="fixed left-0 top-0 z-50 h-full w-64 bg-slate-900 border-r border-white/10"
            style={{ paddingTop: isUiVisible ? '64px' : '0', paddingBottom: isUiVisible ? '96px' : '0' }}
          >
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h2 className="font-bold text-sm uppercase tracking-widest">Repertoire</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <ScrollArea className="h-[calc(100%-60px)]">
              {filteredSongs.map((song, index) => (
                <button
                  key={song.id}
                  onClick={() => {
                    setCurrentIndex(index);
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2",
                    currentIndex === index ? 'bg-indigo-600 text-white' : 'hover:bg-white/5 text-slate-400'
                  )}
                >
                  <Music className="w-4 h-4" />
                  <span className="flex-1 truncate">{index + 1}. {song.name}</span>
                </button>
              ))}
            </ScrollArea>
          </motion.aside>
        )}
      </AnimatePresence>

      <main
        ref={mainContentRef}
        onClick={() => {
          if (isMenuOpen) setIsMenuOpen(false);
          if (!isUiVisible) setIsUiVisible(true);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "relative flex-1 transition-all duration-300 flex flex-col overflow-hidden z-40",
          isMenuOpen ? 'ml-64' : 'ml-0'
        )}
        style={{ paddingTop: isUiVisible ? '64px' : '0', paddingBottom: isUiVisible ? '96px' : '0' }}
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          {renderChart}
        </div>
      </main>

      <FloatingCommandDock
        onOpenSearch={() => {}}
        onOpenPractice={() => {}}
        onOpenReader={() => {}}
        onOpenAdmin={() => {}}
        onOpenPreferences={() => {}}
        onToggleHeatmap={() => {}}
        onOpenUserGuide={() => {}}
        showHeatmap={false}
        viewMode="repertoire"
        hasPlayableSong={!!currentSong?.previewUrl}
        isReaderMode={true}
        isPlaying={isPlaying}
        onTogglePlayback={togglePlayback}
        hasReadableChart={true}
      />

      <RepertoirePicker 
        isOpen={isRepertoirePickerOpen} 
        onClose={() => { setIsRepertoirePickerOpen(false); setIsOverlayOpen(false); }} 
        repertoire={allSongs} 
        currentSetlistSongs={[]}
        onAdd={handleSelectSongFromPicker}
      />
      <ResourceAuditModal 
        isOpen={isResourceAuditOpen} 
        onClose={() => { setIsResourceAuditOpen(false); setIsOverlayOpen(false); }} 
        songs={allSongs} 
        onVerify={handleUpdateSongInRepertoire} 
      />
    </div>
  );
};

export default SheetReaderMode;
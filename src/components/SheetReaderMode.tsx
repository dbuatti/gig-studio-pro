"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Loader2, AlertCircle, X, Settings, ExternalLink, ShieldCheck, FileText, Layout, Guitar, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showError, showSuccess, showInfo } from '@/utils/toast';
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
import { extractKeyFromChords } from '@/utils/chordUtils';

type ChartType = 'pdf' | 'leadsheet' | 'chords';

interface RenderedChart {
  id: string;
  content: React.ReactNode;
  isLoaded: boolean;
  opacity: number;
  zIndex: number;
  type: ChartType;
}

const CHART_LOAD_TIMEOUT_MS = 5000;

const SheetReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId } = useParams<{ songId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const { forceReaderResource, ignoreConfirmedGate } = useReaderSettings();

  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [allSetlists, setAllSetlists] = useState<{ id: string; name: string; songs: SetlistSong[] }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const [readerKeyPreference, setReaderKeyPreference] = useState<'sharps' | 'flats'>(globalKeyPreference);

  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');

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

  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);

  const currentSong = allSongs[currentIndex];

  // === CRITICAL FIX: Pass correct initial values to useHarmonicSync ===
  const harmonicSync = useHarmonicSync({
    formData: {
      originalKey: currentSong?.originalKey,
      targetKey: currentSong?.targetKey || currentSong?.originalKey, // Fallback to original if target missing
      pitch: currentSong?.pitch ?? 0,
      is_pitch_linked: currentSong?.is_pitch_linked ?? true,
      ug_chords_text: currentSong?.ug_chords_text,
    },
    handleAutoSave: useCallback(async (updates: Partial<SetlistSong>) => {
      if (!currentSong || !user) return;

      // Filter out client-side-only properties before sending to Supabase
      const dbUpdates: { [key: string]: any } = {};
      
      // Explicitly map SetlistSong properties to repertoire table columns
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
      if (updates.pitch !== undefined) dbUpdates.pitch = updates.pitch; else dbUpdates.pitch = 0; // pitch is NOT NULL with default 0
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
      if (updates.ug_chords_config !== undefined) dbUpdates.ug_chords_config = updates.ug_chords_config; else dbUpdates.ug_chords_config = null; // Send null if not explicitly set
      if (updates.is_ug_chords_present !== undefined) dbUpdates.is_ug_chords_present = updates.is_ug_chords_present; else dbUpdates.is_ug_chords_present = false;
      if (updates.highest_note_original !== undefined) dbUpdates.highest_note_original = updates.highest_note_original; else dbUpdates.highest_note_original = null;
      if (updates.metadata_source !== undefined) dbUpdates.metadata_source = updates.metadata_source; else dbUpdates.metadata_source = null;
      if (updates.sync_status !== undefined) dbUpdates.sync_status = updates.sync_status; else dbUpdates.sync_status = 'IDLE';
      if (updates.last_sync_log !== undefined) dbUpdates.last_sync_log = updates.last_sync_log; else dbUpdates.last_sync_log = null;
      if (updates.auto_synced !== undefined) dbUpdates.auto_synced = updates.auto_synced; else dbUpdates.auto_synced = false;
      if (updates.sheet_music_url !== undefined) dbUpdates.sheet_music_url = updates.sheet_music_url; else dbUpdates.sheet_music_url = null;
      if (updates.is_sheet_verified !== undefined) dbUpdates.is_sheet_verified = updates.is_sheet_verified; else dbUpdates.is_sheet_verified = false;
      
      // Always update `updated_at`
      dbUpdates.updated_at = new Date().toISOString();

      // LOG: Key saving via Song Studio Modal (This is the only log allowed)
      if (updates.originalKey !== undefined || updates.targetKey !== undefined) {
        console.log(`[SongStudioView] Saving key data: originalKey=${dbUpdates.original_key}, targetKey=${dbUpdates.target_key}`);
      }

      supabase
        .from('repertoire')
        .update(dbUpdates)
        .eq('id', currentSong.id)
        .then(({ error }) => {
          if (error) {
            console.error("[SheetReaderMode] Supabase Auto-save failed:", error);
            if (error.message) console.error("Supabase Error Message:", error.message);
            if (error.details) console.error("Supabase Error Details:", error.details);
            showError('Auto-save failed');
          }
          else {
            setAllSongs(prev => prev.map(s =>
              s.id === currentSong.id ? { ...s, ...updates } : s
            ));
          }
        });
    }, [currentSong, user]),
    globalKeyPreference,
  });

  const { pitch, setPitch, targetKey: harmonicTargetKey, setTargetKey } = harmonicSync;

  // Sync audio pitch
  useEffect(() => {
    setAudioPitch(pitch);
  }, [pitch, setAudioPitch]);

  // === Force harmonic sync when song changes ===
  useEffect(() => {
    if (currentSong) {
      // This ensures the hook gets fresh data immediately
      // Even if formData is delayed, we force the correct key
      setTargetKey(currentSong.targetKey || currentSong.originalKey || 'C');
      setPitch(currentSong.pitch ?? 0);
    }
  }, [currentSong, setTargetKey, setPitch]);

  // === Data Fetching ===
  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setInitialLoading(true);
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title');

      // Add robust error logging for Supabase fetches
      if (error) {
        console.error("Supabase Fetch Error:", error);
        // Check for RLS specific error message
        if (error.message.includes("new row violates row-level-security")) {
          showError("Database Security Error: You don't have permission to read this data. Check RLS policies.");
        } else {
          showError(`Failed to load repertoire: ${error.message}`);
        }
        throw error;
      }

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
        // FIX: Ensure highest_note_original is mapped
        highest_note_original: d.highest_note_original,
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

      if (targetId) {
        const idx = readableAndApprovedSongs.findIndex(s => s.id === targetId);
        if (idx !== -1) initialIndex = idx;
      } else {
        const saved = localStorage.getItem('reader_last_index');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed < readableAndApprovedSongs.length) {
            initialIndex = parsed;
          }
        }
      }

      setCurrentIndex(initialIndex);
    } catch (err) {
      // Error already handled above
    } finally {
      setInitialLoading(false);
    }
  }, [user, routeSongId, searchParams, forceReaderResource, ignoreConfirmedGate]);

  // NEW: Fetch all setlists
  const fetchAllSetlists = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('setlists')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedSetlists = data.map(d => ({
          id: d.id,
          name: d.name,
          songs: (d.songs as any[]) || [],
          time_goal: d.time_goal // Assuming time_goal might be present
        }));
        setAllSetlists(mappedSetlists);
      }
    } catch (err: any) {
      console.error("[SheetReaderMode] Error fetching all setlists:", err);
      showError("Failed to load all setlists.");
    }
  }, [user]);

  useEffect(() => {
    // Check for the flag on mount
    const fromDashboard = sessionStorage.getItem('from_dashboard');
    if (!fromDashboard) {
      console.log("[SheetReaderMode] Not navigated from dashboard, redirecting to /");
      navigate('/', { replace: true });
      return; // Stop further execution of this effect
    }
    // Clear the flag regardless, so subsequent direct access (e.g., refresh) won't be fooled
    sessionStorage.removeItem('from_dashboard');

    fetchSongs();
    fetchAllSetlists();
  }, [fetchSongs, fetchAllSetlists, navigate]); // Added navigate to dependencies

  // Load audio
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

  // Navigation
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

  // Key update
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
        // Check for RLS specific error message
        if (error.message.includes("new row violates row-level-security")) {
          showError("Database Security Error: You don't have permission to update this data. Check RLS policies.");
        } else {
          showError(`Failed to update key: ${error.message}`);
        }
        throw error; // Re-throw to stop further processing
      }

      setAllSongs(prev => prev.map(s =>
        s.id === currentSong.id 
          ? { ...s, targetKey: newTargetKey, pitch: newPitch } 
          : s
      ));

      // Immediately reflect in UI
      setTargetKey(newTargetKey);
      setPitch(newPitch);

      showSuccess(`Stage Key set to ${newTargetKey}`);
    } catch (err) {
      // Error already logged and shown by the `if (error)` block
    }
  }, [currentSong, user, setTargetKey, setPitch]);

  // Pull Key Feature
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
          // Check for RLS specific error message
          if (error.message.includes("new row violates row-level-security")) {
            showError("Database Security Error: You don't have permission to update this data. Check RLS policies.");
          } else {
            showError(`Failed to update key: ${error.message}`);
          }
          throw error; // Re-throw to stop further processing
        }

        // FIX: Correctly update the state array with the new properties
        setAllSongs(prev => prev.map(s => 
          s.id === currentSong.id 
            ? { ...s, originalKey: extractedKey, targetKey: extractedKey, pitch: 0, isKeyConfirmed: true } 
            : s
        ));

        // Force immediate UI update
        setTargetKey(extractedKey);
        setPitch(0);

        showSuccess(`Key extracted and set to: ${extractedKey}`);
      } catch (err) {
        // Error already logged and shown by the `if (error)` block
      }
    } else {
      showError("Could not find a valid chord in the UG text.");
    }
  }, [currentSong, user, setTargetKey, setPitch]);

  // NEW: Callback to update setlist songs (for SetlistMultiSelector)
  const handleUpdateSetlistSongs = useCallback(async (
    setlistId: string,
    songToUpdate: SetlistSong,
    action: 'add' | 'remove'
  ) => {
    const targetSetlist = allSetlists.find(l => l.id === setlistId);
    if (!targetSetlist) {
      console.error(`[SheetReaderMode] Setlist with ID ${setlistId} not found for update.`);
      return;
    }

    let updatedSongsArray = [...targetSetlist.songs];

    if (action === 'add') {
      const isAlreadyInList = updatedSongsArray.some(s =>
        (s.master_id && s.master_id === songToUpdate.master_id) ||
        s.id === songToUpdate.id
      );
      if (!isAlreadyInList) {
        const newSetlistSong: SetlistSong = {
          ...songToUpdate,
          id: Math.random().toString(36).substr(2, 9), // Generate new ID for setlist entry
          master_id: songToUpdate.master_id || songToUpdate.id,
          isPlayed: false,
          isApproved: false,
        };
        updatedSongsArray.push(newSetlistSong);
      }
    } else if (action === 'remove') {
      updatedSongsArray = updatedSongsArray.filter(s =>
        (s.master_id && s.master_id !== songToUpdate.master_id) || // Filter by master_id if present
        (!s.master_id && s.id !== songToUpdate.id) // Fallback to local ID if no master_id
      );
    }

    try {
      const { error } = await supabase
        .from('setlists')
        .update({ songs: updatedSongsArray, updated_at: new Date().toISOString() })
        .eq('id', setlistId);

      if (error) throw error;

      // Update local state
      setAllSetlists(prev => prev.map(l =>
        l.id === setlistId ? { ...l, songs: updatedSongsArray } : l
      ));
      showSuccess(`Setlist "${targetSetlist.name}" updated.`);
    } catch (err: any) {
      console.error("[SheetReaderMode] Failed to update setlist songs:", err);
      showError(`Failed to update setlist: ${err.message}`);
    }
  }, [allSetlists]);

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

  const renderChartForSong = useCallback((song: SetlistSong, chartType: ChartType, onChartLoad: (id: string, type: ChartType) => void): React.ReactNode => {
    const readiness = calculateReadiness(song);
    const isReadyGatePassed = readiness >= 40 || forceReaderResource === 'simulation' || ignoreConfirmedGate;

    if (!isReadyGatePassed) {
      setTimeout(() => onChartLoad(song.id, chartType), 50);
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
        setTimeout(() => onChartLoad(song.id, chartType), 50);
        return (
          <UGChordsReader
            // Key includes targetKey to force re-render on change
            key={`${song.id}-chords-${harmonicTargetKey}`}
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
      return renderChartForSong(song, 'pdf', onChartLoad);
    }

    const chartUrl = chartType === 'pdf' ? song.pdfUrl : song.leadsheetUrl;
    if (!chartUrl) {
      setTimeout(() => onChartLoad(song.id, chartType), 50);
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <Music className="w-24 h-24 text-slate-700 mb-8" />
          <h2 className="text-4xl font-black uppercase text-white mb-4">
            No {chartType === 'pdf' ? 'Full Score' : 'Leadsheet'} Available
          </h2>
          <p className="text-xl text-slate-400 mb-8">Upload one in the Studio.</p>
          <Button onClick={() => setIsStudioModalOpen(true)} className="text-lg px-10 py-6 bg-indigo-600 rounded-2xl">
            Open Studio
          </Button>
        </div>
      );
    }

    const googleViewer = `https://docs.google.com/viewer?url=${encodeURIComponent(chartUrl)}&embedded=true`;

    if (isFramable(chartUrl)) {
      return (
        <div className="w-full h-full relative bg-black">
          <iframe
            key={`${song.id}-${chartType}`}
            src={googleViewer}
            className="absolute inset-0 w-full h-full"
            title="Chart Viewer"
            style={{ border: 'none' }}
            allowFullScreen
            onLoad={() => onChartLoad(song.id, chartType)}
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            <a
              href={chartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-600 hover:bg-indigo-700 px-8 py-4 rounded-2xl text-lg font-bold shadow-2xl"
            >
              Open Chart Externally →
            </a>
          </div>
        </div>
      );
    }

    setTimeout(() => onChartLoad(song.id, chartType), 50);
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-6 md:p-12 text-center">
        <ShieldCheck className="w-12 h-12 md:w-16 md:h-16 text-indigo-400 mb-6 md:mb-10" />
        <h4 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4 md:mb-6 text-white">Asset Protected</h4>
        <p className="text-slate-500 mb-8 md:mb-16 text-lg md:text-xl font-medium leading-relaxed">
          External security prevents in-app display. Use the button below to launch in a secure dedicated performance window.
        </p>
        <Button 
          onClick={() => window.open(chartUrl, '_blank')} 
          className="bg-indigo-600 hover:bg-indigo-700 h-16 md:h-20 px-10 md:px-16 font-black uppercase tracking-[0.2em] text-xs md:text-sm rounded-2xl md:rounded-3xl shadow-2xl gap-4 md:gap-6"
        >
          <ExternalLink className="w-6 h-6 md:w-8 md:h-8" /> Launch Chart Window
        </Button>
      </div>
    );
  }, [forceReaderResource, ignoreConfirmedGate, navigate, harmonicTargetKey, isFramable, setIsStudioModalOpen, isPlaying, progress, duration, chordAutoScrollEnabled, chordScrollSpeed, readerKeyPreference]);

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
          content: renderChartForSong(currentSong, selectedChartType, handleChartLoad),
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
  }, [currentSong, selectedChartType, renderChartForSong, handleChartLoad]);

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
            showInfo("Chart loading timed out. It may be blocked by security headers. Try opening externally.", { duration: 8000 });
          }
        }
      }, CHART_LOAD_TIMEOUT_MS);

      return () => clearTimeout(timeoutId);
    }
  }, [currentChartState, currentSong, selectedChartType, ignoreConfirmedGate]);

  const availableChartTypes = useMemo((): ChartType[] => {
    if (!currentSong) return [];
    const types: ChartType[] = [];
    if (currentSong.pdfUrl) types.push('pdf');
    if (currentSong.leadsheetUrl) types.push('leadsheet');
    if (currentSong.ug_chords_text?.trim()) types.push('chords');
    return types;
  }, [currentSong]);

  useEffect(() => {
    if (currentSong && availableChartTypes.length > 0 && !availableChartTypes.includes(selectedChartType)) {
      setSelectedChartType(availableChartTypes[0]);
    }
  }, [currentSong, availableChartTypes, selectedChartType]);

  const isOriginalKeyMissing = useMemo(() => 
    !currentSong?.originalKey || currentSong.originalKey === 'TBC', 
    [currentSong]
  );

  // NEW: Keyboard shortcut for 'i' to open Song Studio
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key.toLowerCase() === 'i' && currentSong) {
        e.preventDefault();
        setIsStudioModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong]);

  if (initialLoading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
      </div>
    );
  }

  const isChartLoading = !currentChartState?.isLoaded;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <main className="flex-1 flex flex-col overflow-hidden">
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
  setIsOverlayOpen={setIsOverlayOpen}
  isOverrideActive={forceReaderResource !== 'default'}
  pitch={pitch}
  setPitch={setPitch}
  readerKeyPreference={readerKeyPreference}
  setReaderKeyPreference={setReaderKeyPreference}
  onPullKey={handlePullKey}
  
  // ADD THESE TWO LINES:
  isSidebarOpen={false}
  onToggleSidebar={() => {}} // no-op, or optionally show a message
/>

        {isOriginalKeyMissing && (
          <div className="fixed top-16 left-0 right-0 bg-red-950/30 border-b border-red-900/50 p-3 flex items-center justify-center gap-3 shrink-0 z-50 h-10">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-red-400">
              CRITICAL: Original Key is missing. Transposition is currently relative to 'C'. Use the Studio (I) to set it.
            </p>
          </div>
        )}

        <div className={cn(
          "flex-1 bg-black overflow-hidden relative", 
          isImmersive ? "mt-0" : isOriginalKeyMissing ? "mt-[104px]" : "mt-16" 
        )}>
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

          {currentSong && availableChartTypes.length > 1 && !isImmersive && (
            <div className="absolute top-4 right-4 z-30">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-slate-900/80 backdrop-blur border border-white/10 text-white hover:bg-slate-800 shadow-2xl h-12 px-4 gap-2">
                    {selectedChartType === 'pdf' && <Layout className="w-4 h-4" />}
                    {selectedChartType === 'leadsheet' && <FileText className="w-4 h-4" />}
                    {selectedChartType === 'chords' && <Guitar className="w-4 h-4" />}
                    <span className="font-bold uppercase text-xs tracking-widest">
                      {selectedChartType === 'pdf' ? 'Full Score' : selectedChartType === 'leadsheet' ? 'Leadsheet' : 'Chords'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white min-w-[180px]">
                  {availableChartTypes.includes('pdf') && (
                    <DropdownMenuItem onClick={() => setSelectedChartType('pdf')} className="cursor-pointer font-bold">
                      <Layout className="w-4 h-4 mr-2" /> Full Score
                    </DropdownMenuItem>
                  )}
                  {availableChartTypes.includes('leadsheet') && (
                    <DropdownMenuItem onClick={() => setSelectedChartType('leadsheet')} className="cursor-pointer font-bold">
                      <FileText className="w-4 h-4 mr-2" /> Leadsheet
                    </DropdownMenuItem>
                  )}
                  {availableChartTypes.includes('chords') && (
                    <DropdownMenuItem onClick={() => setSelectedChartType('chords')} className="cursor-pointer font-bold">
                      <Guitar className="w-4 h-4 mr-2" /> Chords
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

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
          />
        )}
      </main>

      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      
      {currentSong && (
        <SongStudioModal
          isOpen={isStudioModalOpen}
          onClose={() => setIsStudioModalOpen(false)}
          gigId="library"
          songId={currentSong.id}
          allSetlists={allSetlists}
          masterRepertoire={allSongs}
          onUpdateSetlistSongs={handleUpdateSetlistSongs}
        />
      )}
    </div>
  );
};

export default SheetReaderMode;
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Loader2, AlertCircle, X, Settings, ExternalLink, ShieldCheck, FileText, Layout, Guitar, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
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
import SheetReaderSidebar from '@/components/SheetReaderSidebar';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [isStudioPanelOpen, setIsStudioPanelOpen] = useState(false); // Only one state now
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [readerKeyPreference, setReaderKeyPreference] = useState<'sharps' | 'flats'>(globalKeyPreference);
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('pdf');
  const [renderedCharts, setRenderedCharts] = useState<RenderedChart[]>([]); // Moved up

  const audioEngine = useToneAudio(true);
  const {
    isPlaying, progress, duration, loadFromUrl, togglePlayback, stopPlayback,
    setPitch: setAudioPitch, setProgress: setAudioProgress, volume, setVolume,
    resetEngine, currentUrl, currentBuffer, isLoadingAudio
  } = audioEngine;

  // --- Derived State (useMemo) - Level 1 (depends on simple state) ---
  const currentSong = allSongs[currentIndex]; // Depends on allSongs, currentIndex

  const isOriginalKeyMissing = useMemo(() => // Depends on currentSong
    !currentSong?.originalKey || currentSong.originalKey === 'TBC',
    [currentSong]
  );

  const isFramable = useCallback((url: string | null | undefined) => { // No complex dependencies
    if (!url) return true;
    const blocked = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blocked.some(site => url.includes(site));
  }, []);

  const handleChartLoad = useCallback((id: string, type: ChartType) => { // Depends on setRenderedCharts
    setRenderedCharts(prev => prev.map(rc => 
      rc.id === id && rc.type === type ? { ...rc, isLoaded: true } : rc
    ));
  }, []);

  // --- Callbacks (Level 1 - minimal dependencies, or dependencies already defined) ---
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
          id: crypto.randomUUID(),
          master_id: songToUpdate.master_id || songToUpdate.id,
          isPlayed: false,
          isApproved: false,
        };
        updatedSongsArray.push(newSetlistSong);
      }
    } else if (action === 'remove') {
      updatedSongsArray = updatedSongsArray.filter(s =>
        (s.master_id && s.master_id !== songToUpdate.master_id) ||
        (!s.master_id && s.id !== songToUpdate.id)
      );
    }

    try {
      const { error } = await supabase
        .from('setlists')
        .update({ songs: updatedSongsArray, updated_at: new Date().toISOString() })
        .eq('id', setlistId);

      if (error) throw error;

      setAllSetlists(prev => prev.map(l =>
        l.id === setlistId ? { ...l, songs: updatedSongsArray } : l
      ));
      showSuccess(`Setlist "${targetSetlist.name}" updated.`);
    } catch (err: any) {
      console.error("[SheetReaderMode] Failed to update setlist songs:", err);
      showError("Failed to load all setlists.");
    }
  }, [allSetlists, user]); // Added user to dependencies

  // --- Harmonic Sync (depends on currentSong, user, globalKeyPreference, and an internal handleAutoSave) ---
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
      
      if (updates.name !== undefined) dbUpdates.title = updates.name || 'Untitled Track';
      if (updates.artist !== undefined) dbUpdates.artist = updates.artist || 'Unknown Artist';
      if (updates.previewUrl !== undefined) dbUpdates.preview_url = updates.previewUrl; else if (updates.previewUrl === null) dbUpdates.preview_url = null;
      if (updates.youtubeUrl !== undefined) dbUpdates.youtube_url = updates.youtubeUrl; else if (updates.youtubeUrl === null) dbUpdates.youtube_url = null;
      if (updates.ugUrl !== undefined) dbUpdates.ug_url = updates.ugUrl; else if (updates.ugUrl === null) dbUpdates.ug_url = null;
      if (updates.appleMusicUrl !== undefined) dbUpdates.apple_music_url = updates.appleMusicUrl; else if (updates.appleMusicUrl === null) dbUpdates.apple_music_url = null;
      if (updates.pdfUrl !== undefined) dbUpdates.pdf_url = updates.pdfUrl; else if (updates.pdfUrl === null) dbUpdates.pdf_url = null;
      if (updates.leadsheetUrl !== undefined) dbUpdates.leadsheet_url = updates.leadsheetUrl; else if (updates.leadsheetUrl === null) dbUpdates.leadsheet_url = null;
      if (updates.originalKey !== undefined) dbUpdates.original_key = updates.originalKey; else if (updates.originalKey === null) dbUpdates.original_key = null;
      if (updates.targetKey !== undefined) dbUpdates.target_key = updates.targetKey; else if (updates.targetKey === null) dbUpdates.target_key = null;
      if (updates.pitch !== undefined) dbUpdates.pitch = updates.pitch; else if (updates.pitch === null) dbUpdates.pitch = 0;
      if (updates.bpm !== undefined) dbUpdates.bpm = updates.bpm; else if (updates.bpm === null) dbUpdates.bpm = null;
      if (updates.genre !== undefined) dbUpdates.genre = updates.genre; else if (updates.genre === null) dbUpdates.genre = null;
      if (updates.isMetadataConfirmed !== undefined) dbUpdates.is_metadata_confirmed = updates.isMetadataConfirmed; else if (updates.isMetadataConfirmed === null) dbUpdates.is_metadata_confirmed = false;
      if (updates.isKeyConfirmed !== undefined) dbUpdates.is_key_confirmed = updates.isKeyConfirmed; else if (updates.isKeyConfirmed === null) dbUpdates.is_key_confirmed = false;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes; else if (updates.notes === null) dbUpdates.notes = null;
      if (updates.lyrics !== undefined) dbUpdates.lyrics = updates.lyrics; else if (updates.lyrics === null) dbUpdates.lyrics = null;
      if (updates.resources !== undefined) dbUpdates.resources = updates.resources; else if (updates.resources === null) dbUpdates.resources = [];
      if (updates.user_tags !== undefined) dbUpdates.user_tags = updates.user_tags; else if (updates.user_tags === null) dbUpdates.user_tags = [];
      if (updates.is_pitch_linked !== undefined) dbUpdates.is_pitch_linked = updates.is_pitch_linked; else if (updates.is_pitch_linked === null) dbUpdates.is_pitch_linked = true;
      if (updates.duration_seconds !== undefined) dbUpdates.duration_seconds = Math.round(updates.duration_seconds || 0); else if (updates.duration_seconds === null) dbUpdates.duration_seconds = 0;
      if (updates.is_active !== undefined) dbUpdates.is_active = updates.is_active; else if (updates.is_active === null) dbUpdates.is_active = true;
      if (updates.isApproved !== undefined) dbUpdates.is_approved = updates.isApproved; else if (updates.isApproved === null) dbUpdates.is_approved = false;
      if (updates.preferred_reader !== undefined) dbUpdates.preferred_reader = updates.preferred_reader; else if (updates.preferred_reader === null) dbUpdates.preferred_reader = null;
      if (updates.ug_chords_text !== undefined) dbUpdates.ug_chords_text = updates.ug_chords_text; else if (updates.ug_chords_text === null) dbUpdates.ug_chords_text = null;
      if (updates.ug_chords_config !== undefined) dbUpdates.ug_chords_config = updates.ug_chords_config; else if (updates.ug_chords_config === null) dbUpdates.ug_chords_config = null;
      if (updates.is_ug_chords_present !== undefined) dbUpdates.is_ug_chords_present = updates.is_ug_chords_present; else if (updates.is_ug_chords_present === null) dbUpdates.is_ug_chords_present = false;
      if (updates.highest_note_original !== undefined) dbUpdates.highest_note_original = updates.highest_note_original; else if (updates.highest_note_original === null) dbUpdates.highest_note_original = null;
      if (updates.metadata_source !== undefined) dbUpdates.metadata_source = updates.metadata_source; else if (updates.metadata_source === null) dbUpdates.metadata_source = null;
      if (updates.sync_status !== undefined) dbUpdates.sync_status = updates.sync_status; else if (updates.sync_status === null) dbUpdates.sync_status = 'IDLE';
      if (updates.last_sync_log !== undefined) dbUpdates.last_sync_log = updates.last_sync_log; else if (updates.last_sync_log === null) dbUpdates.last_sync_log = null;
      if (updates.auto_synced !== undefined) dbUpdates.auto_synced = updates.auto_synced; else if (updates.auto_synced === null) dbUpdates.auto_synced = false;
      if (updates.sheet_music_url !== undefined) dbUpdates.sheet_music_url = updates.sheet_music_url; else if (updates.sheet_music_url === null) dbUpdates.sheet_music_url = null;
      if (updates.is_sheet_verified !== undefined) dbUpdates.is_sheet_verified = updates.is_sheet_verified; else if (updates.is_sheet_verified === null) dbUpdates.is_sheet_verified = false;
      if (updates.extraction_status !== undefined) dbUpdates.extraction_status = updates.extraction_status; else if (updates.extraction_status === null) dbUpdates.extraction_status = 'idle';
      
      dbUpdates.updated_at = new Date().toISOString();

      supabase
        .from('repertoire')
        .update(dbUpdates)
        .eq('id', currentSong.id)
        .then(({ error }) => {
          if (error) {
            console.error("[SheetReaderMode] Supabase Auto-save failed:", error);
            if (error.message.includes("new row violates row-level-security")) {
              showError("Database Security Error: You don't have permission to update this data. Check RLS policies.");
            } else {
              showError(`Failed to save: ${error.message}`);
            }
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
            showError(`Failed to save: ${error.message}`);
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
      }
    } else {
      showError("Could not find a valid chord in the UG text.");
    }
  }, [currentSong, user, setTargetKey, setPitch]);

  const isOriginalKeyMissing = useMemo(() => 
    !currentSong?.originalKey || currentSong.originalKey === 'TBC', 
    [currentSong]
  );

  const renderChartForSong = useCallback((song: SetlistSong, chartType: ChartType, onChartLoad: (id: string, type: ChartType) => void): React.ReactNode => {
    const readiness = calculateReadiness(song);
    const isReadyGatePassed = true || forceReaderResource === 'simulation' || ignoreConfirmedGate;

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
        console.log(`[UGChordsReader] Rendering chords for ${song.name}. Original Key: ${song.originalKey}, Target Key: ${harmonicTargetKey}, Reader Key Preference: ${readerKeyPreference}`);
        return (
          <UGChordsReader
            key={`${song.id}-chords-${harmonicTargetKey}`}
            chordsText={song.ug_chords_text}
            config={song.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
            isMobile={false}
            originalKey={song.originalKey}
            targetKey={harmonicTargetKey}
            isPlaying={isPlaying}
            progress={progress}
            duration={duration}
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
          <Button onClick={() => setIsStudioPanelOpen(true)} className="text-lg px-10 py-6 bg-indigo-600 rounded-2xl">
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
        <p className="text-slate-500 max-xl mb-8 md:mb-16 text-lg md:text-xl font-medium leading-relaxed">
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
  }, [forceReaderResource, ignoreConfirmedGate, navigate, harmonicTargetKey, isFramable, setIsStudioPanelOpen, isPlaying, progress, duration, readerKeyPreference, user]); // Added user to dependencies

  // --- Derived State (useMemo) - Level 2 (depends on other derived state or complex callbacks) ---
  const currentChartState = useMemo(() => 
    renderedCharts.find(c => c.id === currentSong?.id && c.type === selectedChartType),
    [renderedCharts, currentSong?.id, selectedChartType]
  );

  const availableChartTypes = useMemo((): ChartType[] => {
    if (!currentSong) return [];
    const types: ChartType[] = [];
    if (currentSong.pdfUrl) types.push('pdf');
    if (currentSong.leadsheetUrl) types.push('leadsheet');
    if (currentSong.ug_chords_text?.trim()) types.push('chords');
    return types;
  }, [currentSong]);

  const isChartLoading = !currentChartState?.isLoaded;
  const headerLeftOffset = isSidebarOpen ? 300 : 0;

  // --- Effects ---
  useEffect(() => {
    setAudioPitch(pitch);
  }, [pitch, setAudioPitch]);

  const fetchSongs = useCallback(async () => {
    if (!user) {
      console.log("[SheetReaderMode] fetchData: User not authenticated.");
      return;
    }
    setInitialLoading(true);
    console.log(`[SheetReaderMode] fetchData: Starting fetch for routeSongId: ${routeSongId}`);

    try {
      let query = supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title');

      const filterApproved = searchParams.get('filterApproved');
      if (filterApproved === 'true') {
        query = query.eq('is_approved', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[SheetReaderMode] Supabase Fetch Error:", error);
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
        originalKey: d.original_key !== null ? d.original_key : 'TBC',
        targetKey: d.target_key !== null ? d.target_key : (d.original_key !== null ? d.original_key : 'TBC'),
        pitch: d.pitch ?? 0,
        previewUrl: d.extraction_status === 'completed' && d.audio_url ? d.audio_url : d.preview_url,
        youtubeUrl: d.youtube_url,
        ugUrl: d.ug_url,
        appleMusicUrl: d.apple_music_url,
        pdfUrl: d.pdf_url,
        leadsheetUrl: d.leadsheet_url,
        bpm: d.bpm,
        ug_chords_text: d.ug_chords_text,
        is_ug_chords_present: d.is_ug_chords_present,
        is_ug_link_verified: d.is_ug_link_verified,
        is_pitch_linked: d.is_pitch_linked ?? true,
        sheet_music_url: d.sheet_music_url,
        is_sheet_verified: d.is_sheet_verified,
        highest_note_original: d.highest_note_original,
        extraction_status: d.extraction_status,
        last_sync_log: d.last_sync_log
      }));

      const readableAndApprovedSongs = mappedSongs.filter(s => {
        const hasChart = s.pdfUrl || s.leadsheetUrl || s.ug_chords_text || s.sheet_music_url; 
        const meetsReadiness = true || forceReaderResource === 'simulation' || ignoreConfirmedGate;

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
          time_goal: d.time_goal
        }));
        setAllSetlists(mappedSetlists);
      }
    } catch (err: any) {
      console.error("[SheetReaderMode] Error fetching all setlists:", err);
      showError("Failed to load all setlists.");
    }
  }, [user]);

  useEffect(() => {
    const fromDashboard = sessionStorage.getItem('from_dashboard');
    if (!fromDashboard) {
      navigate('/', { replace: true });
      return;
    }
    sessionStorage.removeItem('from_dashboard');

    fetchSongs();
    fetchAllSetlists();
  }, [fetchSongs, fetchAllSetlists, navigate]);

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

  useEffect(() => {
    if (currentSong && availableChartTypes.length > 0 && !availableChartTypes.includes(selectedChartType)) {
      setSelectedChartType(availableChartTypes[0]);
    }
  }, [currentSong, availableChartTypes, selectedChartType]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key.toLowerCase() === 'i' && currentSong) {
        e.preventDefault();
        setIsStudioPanelOpen(prev => !prev); // Toggle side panel with 'i'
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong]);

  const handleSelectSongByIndex = useCallback((index: number) => {
    if (index >= 0 && index < allSongs.length) {
      setCurrentIndex(index);
      stopPlayback();
    }
  }, [allSongs.length, stopPlayback]);

  if (initialLoading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white relative">
      
      {/* Left Sidebar */}
      <motion.div
        initial={{ x: isSidebarOpen ? 0 : -300 }}
        animate={{ x: isSidebarOpen ? 0 : -300 }}
        transition={{ duration: 0.3 }}
        className="h-full w-[300px] shrink-0 z-50 fixed left-0 top-0"
      >
        <SheetReaderSidebar 
          songs={allSongs} 
          currentIndex={currentIndex} 
          onSelectSong={handleSelectSongByIndex} 
        />
      </motion.div>

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col overflow-hidden relative transition-all duration-300",
        isSidebarOpen && "ml-[300px]"
      )}>
        <SheetReaderHeader
          currentSong={currentSong}
          onClose={() => navigate('/')}
          onSearchClick={() => {
            setIsStudioPanelOpen(true); // Open side panel instead of modal
            setSearchParams({ id: 'new', tab: 'library' }, { replace: true });
          }}
          onPrevSong={handlePrev}
          onNextSong={handleNext}
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
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          headerLeftOffset={headerLeftOffset}
        />

        {/* Warning Banner */}
        {isOriginalKeyMissing && (
          <div className="fixed top-16 left-0 right-0 bg-red-950/30 border-b border-red-900/50 p-3 flex items-center justify-center gap-3 shrink-0 z-50 h-10" style={{ left: `${headerLeftOffset}px` }}>
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-red-400">
              CRITICAL: Original Key is missing. Transposition is currently relative to 'C'. Use the Studio (I) to set it.
            </p>
          </div>
        )}

        {/* Chart Area */}
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
              {renderChartForSong(currentSong!, rc.type, handleChartLoad)}
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

        {/* Footer */}
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
            isLoadingAudio={isLoadingAudio}
          />
        )}
      </main>

      {/* Collapsible Studio Panel - Right Side */}
      <AnimatePresence>
        {isStudioPanelOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[480px] bg-slate-900 shadow-2xl z-50 flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">Song Studio</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsStudioPanelOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {currentSong && (
                <SongStudioModal
                  isOpen={true}
                  onClose={() => setIsStudioPanelOpen(false)}
                  gigId="library"
                  songId={currentSong.id}
                  allSetlists={allSetlists}
                  masterRepertoire={allSongs}
                  onUpdateSetlistSongs={handleUpdateSetlistSongs}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button for Studio Panel */}
      <Button
        variant="outline"
        size="icon"
        className="fixed right-4 top-1/2 -translate-y-1/2 z-40 bg-slate-800 border-slate-700 hover:bg-slate-700 rounded-full w-12 h-12 shadow-xl"
        onClick={() => setIsStudioPanelOpen(!isStudioPanelOpen)}
      >
        {isStudioPanelOpen ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
      </Button>

      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
    </div>
  );
};

export default SheetReaderMode;
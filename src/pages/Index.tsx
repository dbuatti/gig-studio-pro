"use client";
// Gig Studio Index Page
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useSettings } from '@/hooks/use-settings';
import { showSuccess, showInfo, showWarning, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { autoVibeCheck } from '@/utils/vibeUtils';
import * as Tone from 'tone';

// UI Components
import { Button } from '@/components/ui/button';
import {
  Loader2, Settings2, Hash, Library, Shuffle, LayoutDashboard, Plus, Sparkles, Command, Clock, History, Music, ShieldCheck
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Custom Components
import SetlistManager, { SetlistSong, Setlist, EnergyZone } from '@/components/SetlistManager';
import { FilterState, DEFAULT_FILTERS } from '@/components/SetlistFilters';
import SetlistStats from '@/components/SetlistStats';
import AdminPanel from '@/components/AdminPanel';
import PreferencesModal from '@/components/PreferencesModal';
import UserGuideModal from '@/components/UserGuideModal';
import SongStudioModal from '@/components/SongStudioModal';
import FloatingCommandDock from '@/components/FloatingCommandDock';
import ActiveSongBanner from '@/components/ActiveSongBanner';
import { StudioTab } from '@/components/SongStudioView';
import RepertoireView from '@/components/RepertoireView';
import KeyManagementModal from '@/components/KeyManagementModal';
import PerformanceOverlay from '@/components/PerformanceOverlay';
import GoalTracker from '@/components/GoalTracker';
import SetlistSortModal from '@/components/SetlistSortModal';
import { calculateSemitones, transposeKey } from '@/utils/keyUtils';
import RepertoirePicker from '@/components/RepertoirePicker';
import ImportSetlist from '@/components/ImportSetlist';
import ResourceAuditModal from '@/components/ResourceAuditModal';
import SetlistSettingsModal from '@/components/SetlistSettingsModal';
import SetlistSelector from '@/components/SetlistSelector';
import GlobalSearchModal from '@/components/GlobalSearchModal';
import GigPlannerModal from '@/components/GigPlannerModal';
import MDAuditModal from '@/components/MDAuditModal';
import ShortcutCheatSheet from '@/components/ShortcutCheatSheet';
import { sortSongsByStrategy } from '@/utils/SetlistGenerator';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const { 
    keyPreference: globalKeyPreference, 
    isFetchingSettings, 
    isGoalTrackerEnabled, 
    defaultDashboardView, 
    preventStageKeyOverwrite 
  } = useSettings();

  // REFS: Absolute source of truth for the Audio Engine to prevent stale closures
  const isTransitioningRef = useRef(false);
  const autoplayActiveRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);
  const currentSongsRef = useRef<SetlistSong[]>([]);
  const activeSongRef = useRef<SetlistSong | null>(null);
  const isShuffleAllRef = useRef(false);
  const masterRepertoireRef = useRef<SetlistSong[]>([]);
  
  // Callback Bridge: Breaks circular dependency between audio engine and playNext logic
  const playNextBridgeRef = useRef<() => void>(() => {});
  const audio = useToneAudio(true, useCallback(() => playNextBridgeRef.current(), []));

  const [allSetlists, setAllSetlists] = useState<Setlist[]>([]);
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [activeSongForPerformance, setActiveSongForPerformance] = useState<SetlistSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [isShuffleAllMode, setIsShuffleAllMode] = useState(false);
  const [isAutoplayActive, setIsAutoplayActive] = useState(false);
  const [floatingDockMenuOpen, setFloatingDockMenuOpen] = useState(false);
  const [isShortcutSheetOpen, setIsShortcutSheetOpen] = useState(false);

  // Centralized Autoplay Control
  const setAutoplayStatus = useCallback((active: boolean) => {
    autoplayActiveRef.current = active;
    setIsAutoplayActive(active);
  }, []);

  const activeDashboardView = (searchParams.get('view') as 'gigs' | 'repertoire') || defaultDashboardView;

  const activeSetlist = useMemo(() => 
    allSetlists.find(l => l.id === activeSetlistId), 
    [allSetlists, activeSetlistId]
  );

  // Filter/search states
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('gig_search_term') || "");
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work' | 'manual' | 'energy-asc' | 'energy-desc' | 'zig-zag' | 'wedding-ramp'>(() => 
    (localStorage.getItem('gig_sort_mode') as 'none' | 'ready' | 'work' | 'manual' | 'energy-asc' | 'energy-desc' | 'zig-zag' | 'wedding-ramp') || 'none'
  );
  const [activeFilters, setActiveFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('gig_active_filters');
    try {
      return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  const [showHeatmap, setShowHeatmap] = useState(() => 
    localStorage.getItem('gig_show_heatmap') === 'true'
  );

  const filteredAndSortedSongs = useMemo(() => {
    if (!activeSetlist) return [];
    let songs = [...activeSetlist.songs];
    const q = searchTerm.toLowerCase();
    if (q) {
      songs = songs.filter(s => s.name.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));
    }
    songs = songs.filter(s => {
      const readiness = calculateReadiness(s);
      if (activeFilters.readiness > 0 && readiness < activeFilters.readiness) return false;
      if (activeFilters.isConfirmed === 'yes' && !s.isKeyConfirmed) return false;
      if (activeFilters.isConfirmed === 'no' && s.isKeyConfirmed) return false;
      if (activeFilters.isApproved === 'yes' && !s.isApproved) return false;
      if (activeFilters.isApproved === 'no' && s.isApproved) return false;
      return true;
    });
    if (sortMode === 'ready') {
      songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    } else if (sortMode === 'work') {
      songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    } else if (sortMode.startsWith('energy') || sortMode === 'zig-zag' || sortMode === 'wedding-ramp') {
      songs = sortSongsByStrategy(songs, sortMode);
    }
    return songs;
  }, [activeSetlist, searchTerm, sortMode, activeFilters]);

  // Sync refs with state to ensure the audio engine always has the latest data
  useEffect(() => {
    currentSongsRef.current = filteredAndSortedSongs;
    activeSongRef.current = activeSongForPerformance;
    isShuffleAllRef.current = isShuffleAllMode;
    masterRepertoireRef.current = masterRepertoire;
  }, [filteredAndSortedSongs, activeSongForPerformance, isShuffleAllMode, masterRepertoire]);

  // Stable handleSelectSong that updates refs immediately
  const handleSelectSong = useCallback(async (song: SetlistSong, forceAutoplay = false) => {
    isTransitioningRef.current = true;
    if (Tone.getContext().state !== 'running') await Tone.start();

    activeSongRef.current = song;
    if (forceAutoplay) setAutoplayStatus(true);
    setActiveSongForPerformance(song);
    
    const audioUrl = song.audio_url || song.previewUrl;
    if (audioUrl) {
      const shouldPlay = forceAutoplay || autoplayActiveRef.current;
      try {
        audio.stopPlayback();
        Tone.getTransport().stop();
        Tone.getTransport().cancel();
      } catch (e) {}
      
      await new Promise(resolve => setTimeout(resolve, 200));
      lastTriggerTimeRef.current = Date.now();
      
      try {
        await audio.loadFromUrl(audioUrl, song.pitch || 0, false);
        await new Promise(resolve => setTimeout(resolve, 400));
        
        if (shouldPlay) {
            Tone.getTransport().start();
            await new Promise(resolve => setTimeout(resolve, 100));
            if (Tone.getTransport().state !== 'started' || !audio.isPlaying) {
                audio.stopPlayback();
                Tone.getTransport().stop();
                await new Promise(resolve => setTimeout(resolve, 200));
                audio.togglePlayback();
            }
        }
      } catch (err) {}
      
      setTimeout(() => { isTransitioningRef.current = false; }, 1500); 
    } else {
      isTransitioningRef.current = false;
    }
  }, [audio, setAutoplayStatus]);

  // Core logic for moving to the next song
  const playNextInList = useCallback((isManual = false) => {
    const now = Date.now();
    const timeSinceLastTrigger = now - lastTriggerTimeRef.current;
    
    if (!isManual && timeSinceLastTrigger < 4000) return;
    if (!isManual && !autoplayActiveRef.current) return;
    if (!isManual && isTransitioningRef.current) return;
    if (!isManual && audio.isLoadingAudio) return;

    const progressPercent = audio.duration > 0 ? (audio.progress / audio.duration) : 0;
    if (!isManual && audio.duration > 10 && progressPercent < 0.85) return;

    isTransitioningRef.current = true;
    lastTriggerTimeRef.current = now;

    if (isShuffleAllRef.current) {
      const pool = masterRepertoireRef.current.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) {
        const currentId = activeSongRef.current?.master_id || activeSongRef.current?.id;
        const others = pool.filter(s => (s.master_id || s.id) !== currentId);
        const next = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : pool[0];
        handleSelectSong(next, true);
        return;
      }
    }

    const songs = currentSongsRef.current;
    if (songs.length === 0) {
      isTransitioningRef.current = false;
      return;
    }

    const currentIndex = songs.findIndex(s => s.id === activeSongRef.current?.id);
    
    if (currentIndex !== -1 && currentIndex < songs.length - 1) {
      const nextSong = songs[currentIndex + 1];
      handleSelectSong(nextSong, true);
      showInfo(`Autoplay: ${nextSong.name}`);
    } else if (autoplayActiveRef.current) {
      const firstSong = songs[0];
      handleSelectSong(firstSong, true);
      showInfo(`Autoplay Loop: ${firstSong.name}`);
    } else {
      setAutoplayStatus(false);
      isTransitioningRef.current = false;
    }
  }, [handleSelectSong, setAutoplayStatus, audio.progress, audio.duration, audio.isLoadingAudio]);

  // Update the bridge ref whenever playNextInList changes
  useEffect(() => {
    playNextBridgeRef.current = () => playNextInList(false);
  }, [playNextInList]);

  const handlePlayAll = async () => {
    if (isAutoplayActive) {
      setAutoplayStatus(false);
      audio.stopPlayback();
      showInfo("Autoplay stopped");
    } else {
      if (filteredAndSortedSongs.length === 0) {
        showWarning("No songs available to play.");
        return;
      }
      try {
          await Tone.start();
      } catch (e) {}
      setAutoplayStatus(true);
      const firstSong = filteredAndSortedSongs[0];
      handleSelectSong(firstSong, true);
      showSuccess("Starting Setlist Autoplay");
    }
  };

  const recentlyEdited = useMemo(() => {
    return [...masterRepertoire]
      .sort((a, b) => {
        const dateA = new Date(a.lyrics_updated_at || a.chords_updated_at || 0).getTime();
        const dateB = new Date(b.lyrics_updated_at || b.chords_updated_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 3)
      .filter(s => s.lyrics_updated_at || s.chords_updated_at);
  }, [masterRepertoire]);

  // Modal states
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isSongStudioModalOpen, setIsSongStudioModalOpen] = useState(false);
  const [songStudioModalSongId, setSongStudioModalSongId] = useState<string | null>(null);
  const [songStudioModalGigId, setSongStudioModalGigId] = useState<string | 'library' | null>(null);
  const [songStudioDefaultTab, setSongStudioDefaultTab] = useState<StudioTab | undefined>(undefined);
  const [isKeyManagementOpen, setIsKeyManagementOpen] = useState(false);
  const [isPerformanceOverlayOpen, setIsPerformanceOverlayOpen] = useState(false);
  const [isSetlistSortModalOpen, setIsSetlistSortModalOpen] = useState(false);
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [isResourceAuditOpen, setIsResourceAuditOpen] = useState(false);
  const [isImportSetlistOpen, setIsImportSetlistOpen] = useState(false);
  const [isSetlistSettingsOpen, setIsSetlistSettingsOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isMDAuditOpen, setIsMDAuditOpen] = useState(false);
  const [isGigPlannerOpen, setIsGigPlannerOpen] = useState(false);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const isFilterDirty = useMemo(() => {
    return JSON.stringify(activeFilters) !== JSON.stringify(DEFAULT_FILTERS);
  }, [activeFilters]);

  useEffect(() => {
    if (isFilterDirty) setIsFilterOpen(true);
  }, [isFilterDirty]);

  useEffect(() => {
    localStorage.setItem('gig_active_filters', JSON.stringify(activeFilters));
  }, [activeFilters]);

  useEffect(() => {
    localStorage.setItem('gig_search_term', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('gig_sort_mode', sortMode);
  }, [sortMode]);

  useEffect(() => {
    localStorage.setItem('gig_show_heatmap', showHeatmap.toString());
  }, [showHeatmap]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      }
      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutSheetOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchSetlistsAndRepertoire = useCallback(async (isInitial = false) => {
    if (!userId) return;
    if (isInitial) setLoading(true);
    try {
      const { data: setlistsData } = await supabase
        .from('setlists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      const { data: repertoireData } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', userId)
        .order('title');
      const mappedRepertoire: SetlistSong[] = (repertoireData || []).map(d => ({
        id: d.id,
        master_id: d.id,
        name: d.title,
        artist: d.artist,
        originalKey: d.original_key || 'TBC',
        targetKey: d.target_key || d.original_key || 'TBC',
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
        fineTune: d.fineTune,
        tempo: d.tempo,
        volume: d.volume,
        isApproved: d.is_approved,
        is_ready_to_sing: d.is_ready_to_sing,
        preferred_reader: d.preferred_reader,
        ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: d.is_ug_chords_present,
        highest_note_original: d.highest_note_original,
        audio_url: d.audio_url,
        extraction_status: d.extraction_status,
        lyrics_updated_at: d.lyrics_updated_at,
        chords_updated_at: d.chords_updated_at,
        ug_link_updated_at: d.ug_link_updated_at,
        highest_note_updated_at: d.highest_note_updated_at,
        original_key_updated_at: d.original_key_updated_at,
        target_key_updated_at: d.target_key_updated_at,
        pdf_updated_at: d.pdf_updated_at,
        energy_level: d.energy_level as EnergyZone,
        comfort_level: (d.comfort_level !== null && d.comfort_level <= 5) ? d.comfort_level * 20 : (d.comfort_level ?? 0),
        needs_improvement: d.needs_improvement ?? false,
      }));
      setMasterRepertoire(mappedRepertoire);
      const setlistsWithSongs: Setlist[] = [];
      for (const setlist of setlistsData || []) {
        const { data: junctionData } = await supabase
          .from('setlist_songs')
          .select('*')
          .eq('setlist_id', setlist.id)
          .order('sort_order', { ascending: true });
        const seenSongIds = new Set<string>();
        const songs: SetlistSong[] = [];
        junctionData?.forEach(j => {
          const master = mappedRepertoire.find(r => r.id === j.song_id);
          if (!master) return;
          if (seenSongIds.has(j.song_id)) return;
          seenSongIds.add(j.song_id);
          songs.push({
            ...master,
            id: j.id,
            master_id: master.id,
            isPlayed: j.isPlayed || false,
            set_group: j.set_group || 1
          });
        });
        setlistsWithSongs.push({
          id: setlist.id,
          name: setlist.name,
          songs,
          time_goal: setlist.time_goal,
          set_names: setlist.set_names,
          stimulus_text: setlist.stimulus_text
        });
      }
      setAllSetlists(setlistsWithSongs);
      const savedId = localStorage.getItem('active_setlist_id');
      if (savedId && setlistsWithSongs.some(s => s.id === savedId)) {
        setActiveSetlistId(savedId);
      } else {
        setActiveSetlistId(setlistsWithSongs[0]?.id || null);
      }
    } catch (err: any) {
      showError(`Failed to load data: ${err.message}`);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [userId]);

  const [gigPlannerInitialStimulus, setGigPlannerInitialStimulus] = useState<string | undefined>(undefined);

  const handleCreateVariation = useCallback(() => {
    if (!activeSetlist) return;
    setGigPlannerInitialStimulus(activeSetlist.stimulus_text);
    setIsGigPlannerOpen(true);
  }, [activeSetlist]);

  useEffect(() => {
    if (!authLoading && userId) {
      fetchSetlistsAndRepertoire(true);
    } else if (!authLoading && !userId) {
      navigate('/landing');
    }
  }, [userId, authLoading, fetchSetlistsAndRepertoire, navigate]);

  useEffect(() => {
    if (activeSetlistId) {
      localStorage.setItem('active_setlist_id', activeSetlistId);
    }
  }, [activeSetlistId]);

  const handleEditSong = (song: SetlistSong, defaultTab?: StudioTab) => {
    setSongStudioModalSongId(song.master_id || song.id);
    setSongStudioModalGigId(activeDashboardView === 'gigs' ? activeSetlistId : 'library');
    setIsSongStudioModalOpen(true);
    setSongStudioDefaultTab(defaultTab || 'config');
  };

  const handleUpdateSongInSetlist = useCallback(async (songId: string, updates: Partial<SetlistSong>) => {
    const song = activeSetlist?.songs.find(s => s.id === songId);
    if (!song || !userId) return;
    try {
      const { set_group, ...repertoireUpdates } = updates;
      if (Object.keys(repertoireUpdates).length > 0) {
        await syncToMasterRepertoire(userId, [{ ...repertoireUpdates, id: song.master_id || song.id, name: song.name, artist: song.artist }]);
      }
      if (updates.comfort_level !== undefined) showSuccess(`Mastery updated for "${song.name}"`);
      await fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Update failed: ${err.message}`);
    }
  }, [activeSetlist, userId, fetchSetlistsAndRepertoire]);

  const handleRemoveSongFromSetlist = useCallback(async (songId: string) => {
    try {
      await supabase.from('setlist_songs').delete().eq('id', songId);
      await fetchSetlistsAndRepertoire();
      showSuccess("Song removed from setlist");
    } catch (err: any) {
      showError(`Failed to remove song: ${err.message}`);
    }
  }, [fetchSetlistsAndRepertoire]);

  const handleTogglePlayed = useCallback(async (songId: string) => {
    const song = activeSetlist?.songs.find(s => s.id === songId);
    if (!song) return;
    try {
      await supabase.from('setlist_songs').update({ isPlayed: !song.isPlayed }).eq('id', songId);
      await fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to update: ${err.message}`);
    }
  }, [activeSetlist, fetchSetlistsAndRepertoire]);

  const handleReorderSongs = useCallback(async (newSongs: SetlistSong[]) => {
    try {
      for (let i = 0; i < newSongs.length; i++) {
        await supabase.from('setlist_songs').update({ sort_order: i }).eq('id', newSongs[i].id);
      }
      await fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Reorder failed: ${err.message}`);
    }
  }, [fetchSetlistsAndRepertoire]);

  const handleUpdateSetlistSongs = useCallback(async (setlistId: string, song: SetlistSong, action: 'add' | 'remove', setGroup?: number) => {
    try {
      if (action === 'add') {
        const targetSetlist = allSetlists.find(s => s.id === setlistId);
        const songMasterId = song.master_id || song.id;
        const alreadyExists = targetSetlist?.songs.some(s => s.master_id === songMasterId);
        if (alreadyExists) {
          showWarning(`"${song.name}" is already in this setlist.`);
          return;
        }
        await supabase.from('setlist_songs').insert({
          setlist_id: setlistId,
          song_id: songMasterId,
          sort_order: targetSetlist?.songs.length || 0,
          set_group: setGroup || 1
        });
        showSuccess(`"${song.name}" added to setlist.`);
      } else {
        await supabase.from('setlist_songs').delete().eq('setlist_id', setlistId).eq('song_id', song.master_id || song.id);
      }
      await fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to update setlist: ${err.message}`);
    }
  }, [fetchSetlistsAndRepertoire, allSetlists]);

  const handleDeleteSong = useCallback(async (songId: string) => {
    try {
      await supabase.from('repertoire').delete().eq('id', songId);
      await fetchSetlistsAndRepertoire();
      showSuccess("Song deleted from repertoire");
    } catch (err: any) {
      showError(`Delete failed: ${err.message}`);
    }
  }, [fetchSetlistsAndRepertoire]);

  const handleAddSongToRepertoire = useCallback(async (song: SetlistSong) => {
    if (!userId) return;
    try {
      await syncToMasterRepertoire(userId, [song]);
      await fetchSetlistsAndRepertoire();
      showSuccess("Song added to repertoire");
    } catch (err: any) {
      showError(`Failed to add song: ${err.message}`);
    }
  }, [userId, fetchSetlistsAndRepertoire]);

  const handleCreateSetlist = useCallback(async () => {
    if (!userId) return;
    const name = prompt("Enter setlist name:");
    if (!name) return;
    try {
      const { data, error } = await supabase.from('setlists').insert([{ user_id: userId, name, songs: [] }]).select().single();
      if (error) throw error;
      await fetchSetlistsAndRepertoire();
      setActiveSetlistId(data.id);
      showSuccess(`Setlist "${name}" created!`);
    } catch (err: any) {
      showError(`Failed to create setlist: ${err.message}`);
    }
  }, [userId, fetchSetlistsAndRepertoire]);

  const handleDuplicateSetlist = useCallback(async (id: string) => {
    if (!userId) return;
    const source = allSetlists.find(s => s.id === id);
    if (!source) return;
    try {
      showInfo(`Cloning "${source.name}"...`);
      const { data: newList, error: listError } = await supabase.from('setlists').insert([{ user_id: userId, name: `${source.name} (Copy)`, time_goal: source.time_goal }]).select().single();
      if (listError) throw listError;
      if (source.songs.length > 0) {
        const junctions = source.songs.map((s, i) => ({ setlist_id: newList.id, song_id: s.master_id || s.id, sort_order: i, isPlayed: false }));
        const { error: jError } = await supabase.from('setlist_songs').insert(junctions);
        if (jError) throw jError;
      }
      await fetchSetlistsAndRepertoire();
      setActiveSetlistId(newList.id);
      showSuccess(`Setlist duplicated successfully!`);
    } catch (err: any) {
      showError(`Duplication failed: ${err.message}`);
    }
  }, [userId, allSetlists, fetchSetlistsAndRepertoire]);

  const handleDeleteSetlist = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this setlist?")) return;
    try {
      await supabase.from('setlists').delete().eq('id', id);
      await fetchSetlistsAndRepertoire();
      showSuccess("Setlist deleted");
    } catch (err: any) {
      showError(`Failed to delete setlist: ${err.message}`);
    }
  }, [fetchSetlistsAndRepertoire]);

  const handleRenameSetlist = useCallback(async (id: string) => {
    const currentName = allSetlists.find(s => s.id === id)?.name;
    const newName = prompt("Enter new name:", currentName);
    if (!newName || newName === currentName) return;
    try {
      await supabase.from('setlists').update({ name: newName }).eq('id', id);
      await fetchSetlistsAndRepertoire();
      showSuccess("Setlist renamed");
    } catch (err: any) {
      showError(`Failed to rename setlist: ${err.message}`);
    }
  }, [allSetlists, fetchSetlistsAndRepertoire]);

  const handleRunMDAudit = async () => {
    if (!activeSetlist || activeSetlist.songs.length === 0) {
      showWarning("Add some songs to your setlist first.");
      return;
    }
    setIsMDAuditOpen(true);
    setIsAuditLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('md-audit', {
        body: {
          setlistName: activeSetlist.name,
          songs: activeSetlist.songs.map(s => ({ name: s.name, artist: s.artist, bpm: s.bpm, energy_level: s.energy_level, readiness: calculateReadiness(s), genre: s.genre }))
        }
      });
      if (error) throw error;
      setAuditData(data);
    } catch (err: any) {
      showError("MD Audit failed. Please try again.");
      setIsMDAuditOpen(false);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const handleAutoLink = useCallback(async () => {
    const missing = masterRepertoire.filter(s => !s.youtubeUrl || s.youtubeUrl.trim() === "");
    if (missing.length === 0) {
      showSuccess("All tracks already linked.");
      return;
    }
    try {
      showInfo(`Initiating discovery for ${missing.length} tracks...`);
      const { data, error } = await supabase.functions.invoke('bulk-populate-youtube-links', { body: { songIds: missing.map(s => s.id) } });
      if (error) throw error;
      showSuccess("Discovery pipeline active in background.");
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Automation failed: ${err.message}`);
    }
  }, [masterRepertoire, fetchSetlistsAndRepertoire]);

  const handleGlobalAutoSync = useCallback(async () => {
    try {
      showInfo("Initiating global metadata sync...");
      const { data, error } = await supabase.functions.invoke('global-auto-sync', { body: { songIds: masterRepertoire.map(s => s.id) } });
      if (error) throw error;
      showSuccess("Global sync pipeline active.");
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Sync failed: ${err.message}`);
    }
  }, [masterRepertoire, fetchSetlistsAndRepertoire]);

  const handleClearAutoLinks = useCallback(async () => {
    if (!confirm("Are you sure you want to clear all auto-populated links?")) return;
    try {
      const { error } = await supabase.from('repertoire').update({ youtube_url: null, metadata_source: null }).eq('metadata_source', 'auto_populated').eq('user_id', userId);
      if (error) throw error;
      showSuccess("Auto-links cleared.");
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Clear failed: ${err.message}`);
    }
  }, [userId, fetchSetlistsAndRepertoire]);

  const handleBulkVibeCheck = useCallback(async () => {
    const songsToVibeCheck = masterRepertoire.filter(s => !s.energy_level && s.name && s.artist && s.bpm);
    if (songsToVibeCheck.length === 0) {
      showSuccess("All tracks with sufficient metadata already have an Energy Zone.");
      return;
    }
    try {
      showInfo(`Initiating Vibe Check for ${songsToVibeCheck.length} tracks...`);
      const { data, error } = await supabase.functions.invoke('bulk-vibe-check', { 
        body: { songIds: songsToVibeCheck.map(s => s.id) } 
      });
      if (error) throw error;
      showSuccess("Vibe Check pipeline active in background.");
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Vibe Check failed: ${err.message}`);
    }
  }, [masterRepertoire, userId, fetchSetlistsAndRepertoire]);

  const handleBulkRefreshAudio = useCallback(async () => {
    const missing = masterRepertoire.filter(s => !!s.youtubeUrl && (!s.audio_url || s.extraction_status !== 'completed'));
    if (missing.length === 0) {
      showSuccess("All tracks with YouTube links already have full audio or are currently processing.");
      return;
    }
    try {
      showInfo(`Initiating audio extraction queue for ${missing.length} tracks...`);
      const { data, error } = await supabase.functions.invoke('queue-audio-extraction', { body: { songIds: missing.map(s => s.id) } });
      if (error) throw error;
      showSuccess("Audio extraction queue initiated in background.");
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Audio queue failed: ${err.message}`);
    }
  }, [masterRepertoire, fetchSetlistsAndRepertoire]);

  const handleOpenReader = useCallback((initialSongId?: string) => {
    sessionStorage.setItem('from_dashboard', 'true');
    if (activeDashboardView === 'gigs' && activeSetlistId) {
      sessionStorage.setItem('reader_setlist_id', activeSetlistId);
      sessionStorage.setItem('reader_view_mode', 'gigs');
    } else {
      sessionStorage.setItem('reader_view_mode', 'repertoire');
      sessionStorage.removeItem('reader_setlist_id');
    }
    navigate(`/sheet-reader/${initialSongId || ''}`);
  }, [navigate, activeDashboardView, activeSetlistId]);

  const handleGlobalSearchAdd = async (url: string, name: string, artist: string, yt?: string, ug?: string, apple?: string, gen?: string) => {
    if (!userId) return;
    const newSong: Partial<SetlistSong> = {
      name,
      artist,
      previewUrl: url,
      youtubeUrl: yt,
      ugUrl: ug,
      appleMusicUrl: apple,
      genre: gen,
      originalKey: 'TBC',
      targetKey: 'TBC',
      pitch: 0,
      isMetadataConfirmed: true,
      is_active: true
    };
    try {
      const synced = await syncToMasterRepertoire(userId, [newSong]);
      const song = synced[0];
      autoVibeCheck(userId, song);
      if (activeDashboardView === 'gigs' && activeSetlistId) {
        await handleUpdateSetlistSongs(activeSetlistId, song, 'add');
      } else {
        await fetchSetlistsAndRepertoire();
      }
      showSuccess(`"${name}" added to repertoire!`);
      handleEditSong(song, 'details');
    } catch (err: any) {
      showError("Failed to add discovered song.");
    }
  };

  const handleToggleShuffleAll = useCallback(() => {
    setIsShuffleAllMode(prev => !prev);
    if (!isShuffleAllMode) showInfo("Shuffle All mode enabled");
    else showInfo("Shuffle All mode disabled");
  }, [isShuffleAllMode]);

  const handleGigPlannerAddLibrary = async (songId: string, setGroup?: number) => {
    if (!activeSetlistId) return;
    const song = masterRepertoire.find(s => s.id === songId);
    if (song) await handleUpdateSetlistSongs(activeSetlistId, song, 'add', setGroup);
  };

  const handleGigPlannerAddExternal = async (externalSong: any, setGroup?: number) => {
    if (!userId || !activeSetlistId) return;
    const existing = masterRepertoire.find(s => s.name.toLowerCase() === externalSong.name.toLowerCase() && s.artist?.toLowerCase() === externalSong.artist?.toLowerCase());
    if (existing) {
      await handleUpdateSetlistSongs(activeSetlistId, existing, 'add', setGroup);
      return;
    }
    const newSong: Partial<SetlistSong> = { name: externalSong.name, artist: externalSong.artist, previewUrl: externalSong.previewUrl, appleMusicUrl: externalSong.appleMusicUrl, genre: externalSong.genre, duration_seconds: externalSong.duration_seconds, originalKey: 'TBC', targetKey: 'TBC', pitch: 0, isMetadataConfirmed: true, is_active: true };
    try {
      const synced = await syncToMasterRepertoire(userId, [newSong]);
      const song = synced[0];
      autoVibeCheck(userId, song);
      await handleUpdateSetlistSongs(activeSetlistId, song, 'add', setGroup);
    } catch (err) {
      showError("Failed to add external song.");
      throw err;
    }
  };

  const handleBuildGig = async (proposedName: string, librarySongs: {id: string, setGroup: number}[], externalSongs: any[], setNames: Record<string, string>, stimulusText: string) => {
    if (!userId) return;
    try {
      showInfo(`Building gig: ${proposedName}...`);
      const { data: newList, error: listError } = await supabase.from('setlists').insert([{ user_id: userId, name: proposedName, set_names: setNames, stimulus_text: stimulusText }]).select().single();
      if (listError) throw listError;
      const processedExternal = [];
      for (const ext of externalSongs) {
        const existing = masterRepertoire.find(s => s.name.toLowerCase() === ext.name.toLowerCase() && s.artist?.toLowerCase() === ext.artist?.toLowerCase());
        if (existing) processedExternal.push({ id: existing.id, setGroup: ext.setGroup });
        else {
          const newSong: Partial<SetlistSong> = { name: ext.name, artist: ext.artist, previewUrl: ext.previewUrl, appleMusicUrl: ext.appleMusicUrl, genre: ext.genre, duration_seconds: ext.duration_seconds, originalKey: 'TBC', targetKey: 'TBC', pitch: 0, isMetadataConfirmed: true, is_active: true };
          const synced = await syncToMasterRepertoire(userId, [newSong]);
          processedExternal.push({ id: synced[0].id, setGroup: ext.setGroup });
          autoVibeCheck(userId, synced[0]);
        }
      }
      const allSongsToInsert = [ ...librarySongs.map((s, i) => ({ setlist_id: newList.id, song_id: s.id, sort_order: i, set_group: s.setGroup })), ...processedExternal.map((s, i) => ({ setlist_id: newList.id, song_id: s.id, sort_order: librarySongs.length + i, set_group: s.setGroup })) ];
      const { error: insertError } = await supabase.from('setlist_songs').insert(allSongsToInsert);
      if (insertError) throw insertError;
      await fetchSetlistsAndRepertoire();
      setActiveSetlistId(newList.id);
      showSuccess(`Gig "${proposedName}" built successfully!`);
    } catch (err: any) {
      showError(`Failed to build gig: ${err.message}`);
    }
  };

  const handleAddMultipleToSetlist = async (songs: SetlistSong[]) => {
    if (!activeSetlistId) return;
    for (const song of songs) await handleUpdateSetlistSongs(activeSetlistId, song, 'add');
  };

  const missingAudioCount = useMemo(() => masterRepertoire.filter(s => !!s.youtubeUrl && (!s.audio_url || s.extraction_status !== 'completed')).length, [masterRepertoire]);

  if (authLoading || isFetchingSettings || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-indigo-600/10 to-transparent pointer-events-none" />
      
      <div className="flex-1 flex flex-col p-6 md:p-12 lg:p-16 overflow-y-auto custom-scrollbar relative z-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-8">
            <div className="bg-indigo-600 p-4 rounded-[2rem] shadow-2xl shadow-indigo-600/30">
              <Command className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-black uppercase tracking-tighter leading-none">Gig Studio</h1>
              <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[11px] mt-3">Professional Performance Matrix</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/audit-reader')} className="h-12 px-8 rounded-2xl text-amber-500 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all font-black uppercase tracking-widest text-[11px]">
              <ShieldCheck className="w-5 h-5 mr-3" /> Audit Mode
            </Button>
            <Button variant="outline" size="sm" onClick={handleRunMDAudit} className="h-12 px-8 rounded-2xl text-indigo-400 border-white/5 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[11px]">
              <Sparkles className="w-5 h-5 mr-3" /> MD Audit
            </Button>
            <Button variant="outline" size="sm" onClick={handleToggleShuffleAll} className={cn("h-12 px-8 rounded-2xl transition-all font-black uppercase tracking-widest text-[11px]", isShuffleAllMode ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/20" : "text-indigo-400 border-white/5 bg-white/5 hover:bg-white/10")}>
              <Shuffle className={cn("w-5 h-5 mr-3", isShuffleAllMode && "animate-spin-slow")} /> Shuffle All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsKeyManagementOpen(true)} className="h-12 px-8 rounded-2xl text-indigo-400 border-white/5 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[11px]">
              <Hash className="w-5 h-5 mr-3" /> Key Matrix
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsPreferencesOpen(true)} className="h-12 px-8 rounded-2xl text-indigo-400 border-white/5 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[11px]">
              <Settings2 className="w-5 h-5 mr-3" /> Preferences
            </Button>
          </div>
        </div>

        {isGoalTrackerEnabled && (
          <div className="mb-16 animate-in fade-in slide-in-from-top-6 duration-700 delay-100">
            <GoalTracker repertoire={masterRepertoire} onFilterApply={(f) => setActiveFilters(prev => ({...prev, ...f}))} />
          </div>
        )}

        {activeDashboardView === 'gigs' && activeSongForPerformance && (
          <div className="mb-16 animate-in fade-in slide-in-from-top-8 duration-700 delay-200">
            <ActiveSongBanner 
              song={activeSongForPerformance} 
              isPlaying={audio.isPlaying} 
              onTogglePlayback={audio.togglePlayback} 
              onClear={() => { setActiveSongForPerformance(null); activeSongRef.current = null; audio.stopPlayback(); setAutoplayStatus(false); }} 
              isLoadingAudio={audio.isLoadingAudio} 
              nextSongName={filteredAndSortedSongs[filteredAndSortedSongs.findIndex(s => s.id === activeSongForPerformance.id) + 1]?.name} 
              onNext={() => { playNextInList(true); }} 
              onPrevious={() => { const idx = filteredAndSortedSongs.findIndex(s => s.id === activeSongForPerformance.id); if (idx > 0) handleSelectSong(filteredAndSortedSongs[idx - 1]); }} 
            />
          </div>
        )}

        <Tabs value={activeDashboardView} onValueChange={(v) => setSearchParams({ view: v })} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 h-16 bg-slate-900/50 p-2 rounded-[2rem] mb-12 border border-white/5 animate-in fade-in slide-in-from-left-4 duration-700 delay-300">
            <TabsTrigger value="gigs" className="text-sm font-black uppercase tracking-widest gap-3 h-12 rounded-2xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-2xl data-[state=active]:shadow-indigo-600/30">
              <LayoutDashboard className="w-5 h-5" /> Gigs
            </TabsTrigger>
            <TabsTrigger value="repertoire" className="text-sm font-black uppercase tracking-widest gap-3 h-12 rounded-2xl data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-2xl data-[state=active]:shadow-indigo-600/30">
              <Library className="w-5 h-5" /> Repertoire
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gigs" className="mt-0 space-y-12 animate-in fade-in duration-700 delay-400">
            {activeSetlistId && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
                <SetlistSelector
                  setlists={allSetlists}
                  currentId={activeSetlistId}
                  onSelect={setActiveSetlistId}
                  onCreate={handleCreateSetlist}
                  onDelete={handleDeleteSetlist}
                  onDuplicate={handleDuplicateSetlist}
                  onOpenGigPlanner={() => setIsGigPlannerOpen(true)}
                  onOpenVariation={handleCreateVariation}
                />
                <Button variant="outline" size="sm" onClick={() => setIsSetlistSettingsOpen(true)} className="h-12 px-8 rounded-2xl text-indigo-400 border-white/5 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[11px]">
                  <Settings2 className="w-5 h-5 mr-3" /> Gig Settings
                </Button>
              </div>
            )}
            {activeSetlist && (
              <>
                <SetlistStats 
                  songs={filteredAndSortedSongs} 
                  goalSeconds={activeSetlist.time_goal} 
                  onUpdateGoal={async (seconds) => { await supabase.from('setlists').update({ time_goal: seconds }).eq('id', activeSetlistId); fetchSetlistsAndRepertoire(); }} 
                  onPlayAll={handlePlayAll}
                  isAutoplayActive={isAutoplayActive}
                />
                <SetlistManager 
                  songs={filteredAndSortedSongs} 
                  onSelect={handleSelectSong} 
                  onEdit={handleEditSong} 
                  onUpdateKey={async (id, targetKey) => { const song = activeSetlist.songs.find(s => s.id === id); if (song) { const newPitch = calculateSemitones(song.originalKey || 'C', targetKey); await handleUpdateSongInSetlist(id, { targetKey, pitch: newPitch }); } }} 
                  onLinkAudio={() => {}} 
                  onSyncProData={async () => {}} 
                  currentSongId={activeSongForPerformance?.id} 
                  sortMode={sortMode} 
                  setSortMode={setSortMode} 
                  activeFilters={activeFilters} 
                  setActiveFilters={setActiveFilters} 
                  searchTerm={searchTerm} 
                  setSearchTerm={setSearchTerm} 
                  showHeatmap={showHeatmap} 
                  allSetlists={allSetlists} 
                  onRemove={handleRemoveSongFromSetlist} 
                  onUpdateSong={handleUpdateSongInSetlist} 
                  onTogglePlayed={handleTogglePlayed} 
                  onReorder={handleReorderSongs} 
                  onUpdateSetlistSongs={handleUpdateSetlistSongs} 
                  onOpenSortModal={() => setIsSetlistSortModalOpen(true)} 
                  onBulkVibeCheck={handleBulkVibeCheck} 
                  masterRepertoire={masterRepertoire} 
                  activeSetlistId={activeSetlistId}
                  isFilterOpen={isFilterOpen}
                  setIsFilterOpen={setIsFilterOpen}
                />
              </>
            )}
          </TabsContent>
          
          <TabsContent value="repertoire" className="mt-0 space-y-12 animate-in fade-in duration-700 delay-400">
            <RepertoireView
              repertoire={masterRepertoire}
              onEditSong={handleEditSong}
              allSetlists={allSetlists}
              onRefreshRepertoire={() => fetchSetlistsAndRepertoire()}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              sortMode={sortMode as any}
              setSortMode={setSortMode as any}
              activeFilters={activeFilters}
              setActiveFilters={setActiveFilters}
              onUpdateSetlistSongs={handleUpdateSetlistSongs}
              onDeleteSong={handleDeleteSong}
              onAddSong={handleAddSongToRepertoire}
              onOpenAdmin={() => setIsAdminPanelOpen(true)}
              onAutoLink={handleAutoLink}
              onGlobalAutoSync={handleGlobalAutoSync}
              onClearAutoLinks={handleClearAutoLinks}
              onBulkVibeCheck={handleBulkVibeCheck}
              onBulkRefreshAudio={handleBulkRefreshAudio}
              missingAudioCount={missingAudioCount}
              activeSetlistId={activeSetlistId}
            />
          </TabsContent>
        </Tabs>
      </div>

      <FloatingCommandDock 
        onOpenSearch={() => setIsGlobalSearchOpen(true)} 
        onOpenPractice={() => {}} 
        onOpenReader={handleOpenReader} 
        onOpenAdmin={() => setIsAdminPanelOpen(true)} 
        onOpenPreferences={() => setIsPreferencesOpen(true)} 
        onToggleHeatmap={() => setShowHeatmap(!showHeatmap)} 
        onOpenUserGuide={() => setIsUserGuideOpen(true)} 
        showHeatmap={showHeatmap} 
        viewMode={activeDashboardView} 
        hasPlayableSong={!!activeSongForPerformance} 
        isPlaying={audio.isPlaying} 
        onTogglePlayback={audio.togglePlayback} 
        activeSongId={activeSongForPerformance?.id} 
        onSetMenuOpen={setFloatingDockMenuOpen} 
        isMenuOpen={floatingDockMenuOpen} 
        onOpenPerformance={() => setIsPerformanceOverlayOpen(true)} 
        hasReadableChart={!!activeSongForPerformance} 
      />

      <SongStudioModal 
        isOpen={isSongStudioModalOpen} 
        onClose={() => setIsSongStudioModalOpen(false)} 
        gigId={songStudioModalGigId} 
        songId={songStudioModalSongId} 
        visibleSongs={activeDashboardView === 'gigs' ? filteredAndSortedSongs : masterRepertoire} 
        allSetlists={allSetlists} 
        masterRepertoire={masterRepertoire} 
        defaultTab={songStudioDefaultTab} 
        audioEngine={audio} 
        preventStageKeyOverwrite={preventStageKeyOverwrite} 
      />

      {isPerformanceOverlayOpen && activeSetlist && activeSongForPerformance && (
        <PerformanceOverlay 
          songs={activeSetlist.songs} 
          currentIndex={activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance.id)} 
          isPlaying={audio.isPlaying} 
          progress={audio.progress} 
          duration={audio.duration} 
          onTogglePlayback={audio.togglePlayback} 
          onNext={() => { playNextInList(true); }} 
          onPrevious={() => { const idx = filteredAndSortedSongs.findIndex(s => s.id === activeSongForPerformance.id); if (idx > 0) handleSelectSong(filteredAndSortedSongs[idx - 1]); }} 
          onShuffle={() => {}} 
          onClose={() => setIsPerformanceOverlayOpen(false)} 
          onUpdateSong={handleUpdateSongInSetlist} 
          onUpdateKey={async (id, targetKey) => { const song = activeSetlist.songs.find(s => s.id === id); if (song) { const newPitch = calculateSemitones(song.originalKey || 'C', targetKey); await handleUpdateSongInSetlist(id, { targetKey, pitch: newPitch }); } }} 
          analyzer={audio.analyzer} 
          gigId={activeSetlist.id} 
          isLoadingAudio={audio.isLoadingAudio} 
        />
      )}

      <AdminPanel isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} />
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      <UserGuideModal isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />
      <KeyManagementModal isOpen={isKeyManagementOpen} onClose={() => setIsKeyManagementOpen(false)} repertoire={masterRepertoire} onUpdateKey={async (songId, updates) => { if (!userId) return; await syncToMasterRepertoire(userId, [{ ...updates, id: songId }]); await fetchSetlistsAndRepertoire(); }} keyPreference={globalKeyPreference} />
      <GlobalSearchModal isOpen={isGlobalSearchOpen} onClose={() => setIsGlobalSearchOpen(false)} onAddSong={handleGlobalSearchAdd} repertoire={masterRepertoire} onAddExistingSong={handleAddSongToRepertoire} />
      
      {activeSetlist && (
        <>
          <SetlistSortModal
            isOpen={isSetlistSortModalOpen}
            onClose={() => setIsSetlistSortModalOpen(false)}
            songs={activeSetlist.songs}
            onReorder={handleReorderSongs}
            setlistName={activeSetlist.name}
            masterRepertoire={masterRepertoire}
            onAddSongs={handleAddMultipleToSetlist}
          />
          <SetlistSettingsModal isOpen={isSetlistSettingsOpen} onClose={() => setIsSetlistSettingsOpen(false)} setlistId={activeSetlist.id} setlistName={activeSetlist.name} onDelete={handleDeleteSetlist} onRename={handleRenameSetlist} onRefresh={() => fetchSetlistsAndRepertoire()} />
        </>
      )}
      <MDAuditModal isOpen={isMDAuditOpen} onClose={() => setIsMDAuditOpen(false)} auditData={auditData} isLoading={isAuditLoading} />
      <GigPlannerModal
        isOpen={isGigPlannerOpen}
        onClose={() => {
          setIsGigPlannerOpen(false);
          setGigPlannerInitialStimulus(undefined);
        }}
        repertoire={masterRepertoire}
        onAddExternalSong={handleGigPlannerAddExternal}
        onAddLibrarySong={handleGigPlannerAddLibrary}
        onBuildGig={handleBuildGig}
        activeSetlistName={activeSetlist?.name}
        initialStimulus={gigPlannerInitialStimulus}
      />
      <ShortcutCheatSheet isOpen={isShortcutSheetOpen} onClose={() => setIsShortcutSheetOpen(false)} />
    </div>
  );
};

export default Index;
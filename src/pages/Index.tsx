"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useSettings } from '@/hooks/use-settings';
import { showSuccess, showInfo, showWarning, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';

// UI Components
import { Button } from '@/components/ui/button';
import { 
  Loader2, Settings2, Hash, Library, Shuffle, LayoutDashboard, Plus, Sparkles
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Custom Components
import SetlistManager, { SetlistSong, Setlist } from '@/components/SetlistManager';
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
import MDAuditModal from '@/components/MDAuditModal';
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

  const [allSetlists, setAllSetlists] = useState<Setlist[]>([]);
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [activeSongForPerformance, setActiveSongForPerformance] = useState<SetlistSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [isShuffleAllMode, setIsShuffleAllMode] = useState(false);
  const [floatingDockMenuOpen, setFloatingDockMenuOpen] = useState(false);
  
  const activeDashboardView = (searchParams.get('view') as 'gigs' | 'repertoire') || defaultDashboardView;

  const activeSetlist = useMemo(() => 
    allSetlists.find(l => l.id === activeSetlistId), 
    [allSetlists, activeSetlistId]
  );

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
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);

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

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Cmd/Ctrl + K for Global Search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Audio engine
  const playNextInList = useCallback(() => {
    if (!activeSetlist || activeSetlist.songs.length === 0) return;
    
    if (isShuffleAllMode) {
      const pool = masterRepertoire.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) {
        const currentId = activeSongForPerformance?.master_id || activeSongForPerformance?.id;
        const others = pool.filter(s => (s.match_id || s.id) !== currentId);
        setActiveSongForPerformance(others.length > 0 ? others[Math.floor(Math.random() * others.length)] : pool[0]);
      }
      return;
    }

    const currentIndex = activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance?.id);
    if (currentIndex !== -1 && currentIndex < activeSetlist.songs.length - 1) {
      setActiveSongForPerformance(activeSetlist.songs[currentIndex + 1]);
    } else {
      setActiveSongForPerformance(activeSetlist.songs[0]);
    }
  }, [isShuffleAllMode, activeSetlist, activeSongForPerformance, masterRepertoire]);

  const audio = useToneAudio(true, playNextInList);

  const handleNextSong = useCallback(() => {
    if (!activeSetlist || activeSetlist.songs.length === 0) return;
    const idx = activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance?.id);
    const nextIdx = (idx + 1) % activeSetlist.songs.length;
    setActiveSongForPerformance(activeSetlist.songs[nextIdx]);
    showInfo(`Up Next: ${activeSetlist.songs[nextIdx].name}`);
  }, [activeSetlist, activeSongForPerformance]);

  const handlePreviousSong = useCallback(() => {
    if (!activeSetlist || activeSetlist.songs.length === 0) return;
    const idx = activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance?.id);
    const prevIdx = (idx - 1 + activeSetlist.songs.length) % activeSetlist.songs.length;
    setActiveSongForPerformance(activeSetlist.songs[prevIdx]);
    showInfo(`Back to: ${activeSetlist.songs[prevIdx].name}`);
  }, [activeSetlist, activeSongForPerformance]);

  const handleToggleShuffleAll = () => {
    const nextState = !isShuffleAllMode;
    setIsShuffleAllMode(nextState);
    if (nextState) {
      const pool = masterRepertoire.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) setActiveSongForPerformance(pool[Math.floor(Math.random() * pool.length)]);
    }
  };

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
            isPlayed: j.isPlayed || false 
          });
        });
        
        setlistsWithSongs.push({ 
          id: setlist.id, 
          name: setlist.name, 
          songs, 
          time_goal: setlist.time_goal 
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

  const handleSelectSong = useCallback(async (song: SetlistSong) => {
    setActiveSongForPerformance(song);
    const audioUrl = song.audio_url || song.previewUrl;
    if (audioUrl) {
      await audio.loadFromUrl(audioUrl, song.pitch || 0);
    }
  }, [audio]);

  const handleUpdateSongInSetlist = useCallback(async (songId: string, updates: Partial<SetlistSong>) => {
    const song = activeSetlist?.songs.find(s => s.id === songId);
    if (!song || !userId) return;
    
    try {
      await syncToMasterRepertoire(userId, [{
        ...updates,
        id: song.master_id || song.id,
        name: song.name,
        artist: song.artist
      }]);
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
      await supabase
        .from('setlist_songs')
        .update({ isPlayed: !song.isPlayed })
        .eq('id', songId);
      await fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to update: ${err.message}`);
    }
  }, [activeSetlist, fetchSetlistsAndRepertoire]);

  const handleReorderSongs = useCallback(async (newSongs: SetlistSong[]) => {
    try {
      for (let i = 0; i < newSongs.length; i++) {
        await supabase
          .from('setlist_songs')
          .update({ sort_order: i })
          .eq('id', newSongs[i].id);
      }
      await fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Reorder failed: ${err.message}`);
    }
  }, [fetchSetlistsAndRepertoire]);

  const handleUpdateSetlistSongs = useCallback(async (
    setlistId: string, 
    song: SetlistSong, 
    action: 'add' | 'remove'
  ) => {
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
          sort_order: targetSetlist?.songs.length || 0
        });
        showSuccess(`"${song.name}" added to setlist.`);
      } else {
        await supabase
          .from('setlist_songs')
          .delete()
          .eq('setlist_id', setlistId)
          .eq('song_id', song.master_id || song.id);
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
      const { data, error } = await supabase
        .from('setlists')
        .insert([{ user_id: userId, name, songs: [] }])
        .select()
        .single();
      
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
      const { data: newList, error: listError } = await supabase
        .from('setlists')
        .insert([{ user_id: userId, name: `${source.name} (Copy)`, time_goal: source.time_goal }])
        .select()
        .single();

      if (listError) throw listError;

      if (source.songs.length > 0) {
        const junctions = source.songs.map((s, i) => ({
          setlist_id: newList.id,
          song_id: s.master_id || s.id,
          sort_order: i,
          isPlayed: false
        }));

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
          songs: activeSetlist.songs.map(s => ({
            name: s.name,
            artist: s.artist,
            bpm: s.bpm,
            energy_level: s.energy_level,
            readiness: calculateReadiness(s),
            genre: s.genre
          }))
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
      const { data, error } = await supabase.functions.invoke('bulk-populate-youtube-links', {
        body: { songIds: missing.map(s => s.id) }
      });
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
      const { data, error } = await supabase.functions.invoke('global-auto-sync', {
        body: { songIds: masterRepertoire.map(s => s.id) }
      });
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
      const { error } = await supabase
        .from('repertoire')
        .update({ youtube_url: null, metadata_source: null })
        .eq('metadata_source', 'auto_populated')
        .eq('user_id', userId);
      if (error) throw error;
      showSuccess("Auto-links cleared.");
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Clear failed: ${err.message}`);
    }
  }, [userId, fetchSetlistsAndRepertoire]);

  const handleBulkVibeCheck = useCallback(async () => {
    const songsToVibeCheck = masterRepertoire.filter(s => 
      !s.energy_level && s.name && s.artist && s.bpm
    );

    if (songsToVibeCheck.length === 0) {
      showSuccess("All tracks with sufficient metadata already have an Energy Zone.");
      return;
    }

    showInfo(`Initiating Vibe Check for ${songsToVibeCheck.length} tracks...`);
    
    let successful = 0;
    let failed = 0;

    for (const song of songsToVibeCheck) {
      try {
        const { data, error } = await supabase.functions.invoke('vibe-check', {
          body: {
            title: song.name,
            artist: song.artist,
            bpm: song.bpm,
            genre: song.genre || 'Unknown',
            userTags: song.user_tags || []
          }
        });

        if (error) throw error;

        if (data?.energy_level) {
          await syncToMasterRepertoire(userId!, [{
            id: song.id,
            energy_level: data.energy_level as SetlistSong['energy_level']
          }]);
          successful++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    showSuccess(`Bulk Vibe Check Complete: ${successful} successful, ${failed} failed.`);
    fetchSetlistsAndRepertoire();

  }, [masterRepertoire, userId, fetchSetlistsAndRepertoire]);

  const handleBulkRefreshAudio = useCallback(async () => {
    const missing = masterRepertoire.filter(s =>
      !!s.youtubeUrl && (!s.audio_url || s.extraction_status !== 'completed')
    );

    if (missing.length === 0) {
      showSuccess("All tracks with YouTube links already have full audio or are currently processing.");
      return;
    }

    try {
      showInfo(`Initiating audio extraction queue for ${missing.length} tracks...`);
      const { data, error } = await supabase.functions.invoke('queue-audio-extraction', {
        body: { songIds: missing.map(s => s.id) }
      });
      if (error) throw error;
      showSuccess("Audio extraction queue initiated in background.");
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Audio queue failed: ${err.message}`);
    }
  }, [masterRepertoire, fetchSetlistsAndRepertoire]);

  const filteredAndSortedSongs = useMemo(() => {
    if (!activeSetlist) return [];
    let songs = [...activeSetlist.songs];
    const q = searchTerm.toLowerCase();
    
    if (q) {
      songs = songs.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.artist?.toLowerCase().includes(q)
      );
    }

    songs = songs.filter(s => {
      const readiness = calculateReadiness(s);
      const hasAudio = !!s.audio_url;
      const hasItunesPreview = !!s.previewUrl && (s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'));
      const hasVideo = !!s.youtubeUrl;
      const hasPdf = !!s.pdfUrl || !!s.leadsheetUrl || !!s.sheet_music_url;
      const hasUg = !!s.ugUrl;
      const hasUgChords = !!s.ug_chords_text && s.ug_chords_text.trim().length > 0;
      const hasLyrics = !!s.lyrics && s.lyrics.length > 20;

      if (activeFilters.readiness > 0 && readiness < activeFilters.readiness) return false;
      if (activeFilters.isConfirmed === 'yes' && !s.isKeyConfirmed) return false;
      if (activeFilters.isConfirmed === 'no' && s.isKeyConfirmed) return false;
      if (activeFilters.isApproved === 'yes' && !s.isApproved) return false;
      if (activeFilters.isApproved === 'no' && s.isApproved) return false;
      if (activeFilters.hasAudio === 'full' && !hasAudio) return false;
      if (activeFilters.hasAudio === 'itunes' && !hasItunesPreview) return false;
      if (activeFilters.hasAudio === 'none' && (hasAudio || hasItunesPreview)) return false;
      if (activeFilters.hasVideo === 'yes' && !hasVideo) return false;
      if (activeFilters.hasVideo === 'no' && hasVideo) return false;
      if (activeFilters.hasChart === 'yes' && !(hasPdf || hasUg || hasUgChords)) return false;
      if (activeFilters.hasChart === 'no' && (hasPdf || hasUg || hasUgChords)) return false;
      if (activeFilters.hasPdf === 'yes' && !hasPdf) return false;
      if (activeFilters.hasPdf === 'no' && hasPdf) return false;
      if (activeFilters.hasUg === 'yes' && !hasUg) return false;
      if (activeFilters.hasUg === 'no' && hasUg) return false;
      if (activeFilters.hasUgChords === 'yes' && !hasUgChords) return false;
      if (activeFilters.hasUgChords === 'no' && hasUgChords) return false;
      if (activeFilters.hasLyrics === 'yes' && !hasLyrics) return false;
      if (activeFilters.hasLyrics === 'no' && hasLyrics) return false;
      if (activeFilters.hasHighestNote === 'yes' && !s.highest_note_original) return false; 
      if (activeFilters.hasHighestNote === 'no' && s.highest_note_original) return false; 
      if (activeFilters.hasOriginalKey === 'yes' && (!s.originalKey || s.originalKey === 'TBC')) return false; 
      if (activeFilters.hasOriginalKey === 'no' && (s.originalKey && s.originalKey !== 'TBC')) return false; 
      
      return true;
    });

    if (sortMode === 'ready') {
      songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    } else if (sortMode === 'work') {
      songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    } else if (sortMode === 'none' || sortMode === 'manual') {
      if (!q) {
        songs = activeSetlist.songs.filter(s => songs.some(fs => fs.id === s.id));
      }
    } else if (sortMode.startsWith('energy') || sortMode === 'zig-zag' || sortMode === 'wedding-ramp') {
      songs = sortSongsByStrategy(songs, sortMode);
    }

    return songs;
  }, [activeSetlist, searchTerm, sortMode, activeFilters]);

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

  const missingAudioCount = useMemo(() => 
    masterRepertoire.filter(s => !!s.youtubeUrl && (!s.audio_url || s.extraction_status !== 'completed')).length,
  [masterRepertoire]);

  if (authLoading || isFetchingSettings || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-black uppercase tracking-tight">Gig Studio Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRunMDAudit}
              className="h-9 px-4 rounded-xl text-indigo-600 border-indigo-600/20 hover:bg-indigo-50"
            >
              <Sparkles className="w-3.5 h-3.5 mr-2" /> MD Audit
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleToggleShuffleAll} 
              className={cn(
                "h-9 px-4 rounded-xl", 
                isShuffleAllMode ? "bg-indigo-600 text-white" : "text-indigo-600"
              )}
            >
              <Shuffle className={cn("w-3.5 h-3.5 mr-2", isShuffleAllMode && "animate-spin-slow")} /> 
              Shuffle All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsKeyManagementOpen(true)} 
              className="h-9 px-4 rounded-xl text-indigo-600"
            >
              <Hash className="w-3.5 h-3.5 mr-2" /> Key Matrix
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsPreferencesOpen(true)} 
              className="h-9 px-4 rounded-xl text-indigo-600"
            >
              <Settings2 className="w-3.5 h-3.5 mr-2" /> Preferences
            </Button>
          </div>
        </div>

        {isGoalTrackerEnabled && (
          <GoalTracker 
            repertoire={masterRepertoire} 
            onFilterApply={(f) => setActiveFilters(prev => ({...prev, ...f}))} 
          />
        )}

        {activeDashboardView === 'gigs' && activeSongForPerformance && (
          <ActiveSongBanner 
            song={activeSongForPerformance} 
            isPlaying={audio.isPlaying} 
            onTogglePlayback={audio.togglePlayback} 
            onClear={() => { 
              setActiveSongForPerformance(null); 
              audio.stopPlayback(); 
            }} 
            isLoadingAudio={audio.isLoadingAudio}
            nextSongName={activeSetlist?.songs[
              activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance.id) + 1
            ]?.name}
            onNext={handleNextSong}
            onPrevious={handlePreviousSong}
          />
        )}

        <Tabs 
          value={activeDashboardView} 
          onValueChange={(v) => setSearchParams({ view: v })} 
          className="w-full mt-8"
        >
          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-900 p-1 rounded-xl mb-6">
            <TabsTrigger value="gigs" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg">
              Gigs
            </TabsTrigger>
            <TabsTrigger value="repertoire" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg">
              Repertoire
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gigs" className="mt-0 space-y-8">
            {activeSetlistId && (
              <div className="flex items-center justify-between">
                <SetlistSelector
                  setlists={allSetlists}
                  currentId={activeSetlistId}
                  onSelect={setActiveSetlistId}
                  onCreate={handleCreateSetlist}
                  onDelete={handleDeleteSetlist}
                  onDuplicate={handleDuplicateSetlist}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSetlistSettingsOpen(true)}
                  className="h-9 px-4 rounded-xl text-indigo-600"
                >
                  <Settings2 className="w-3.5 h-3.5 mr-2" /> Gig Settings
                </Button>
              </div>
            )}
            
            {activeSetlist && (
              <>
                <SetlistStats 
                  songs={activeSetlist.songs} 
                  goalSeconds={activeSetlist.time_goal}
                  onUpdateGoal={async (seconds) => {
                    await supabase
                      .from('setlists')
                      .update({ time_goal: seconds })
                      .eq('id', activeSetlistId);
                    fetchSetlistsAndRepertoire();
                  }}
                />
                <SetlistManager 
                  songs={filteredAndSortedSongs} 
                  onSelect={handleSelectSong} 
                  onEdit={handleEditSong} 
                  onUpdateKey={async (id, targetKey) => {
                    const song = activeSetlist.songs.find(s => s.id === id);
                    if (song) {
                      const newPitch = calculateSemitones(song.originalKey || 'C', targetKey);
                      await handleUpdateSongInSetlist(id, { targetKey, pitch: newPitch });
                    }
                  }} 
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
                />
              </>
            )}
            
            {!activeSetlistId && allSetlists.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="bg-card p-12 rounded-[3rem] border border-border space-y-6 max-md">
                  <div className="bg-indigo-600/10 w-16 h-16 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto">
                    <Library className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">No Setlists Yet</h2>
                  <p className="text-muted-foreground font-medium">Create your first setlist to start organizing your gigs.</p>
                  <Button 
                    onClick={handleCreateSetlist}
                    className="w-full bg-indigo-600 h-14 rounded-2xl font-black uppercase tracking-widest gap-2"
                  >
                    <Plus className="w-5 h-5" /> Create First Setlist
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="repertoire" className="mt-0 space-y-8">
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
          onNext={handleNextSong} 
          onPrevious={handlePreviousSong} 
          onShuffle={() => {}} 
          onClose={() => setIsPerformanceOverlayOpen(false)} 
          onUpdateSong={handleUpdateSongInSetlist} 
          onUpdateKey={async (id, targetKey) => {
            const song = activeSetlist.songs.find(s => s.id === id);
            if (song) {
              const newPitch = calculateSemitones(song.originalKey || 'C', targetKey);
              await handleUpdateSongInSetlist(id, { targetKey, pitch: newPitch });
            }
          }} 
          analyzer={audio.analyzer} 
          gigId={activeSetlist.id}
          isLoadingAudio={audio.isLoadingAudio}
        />
      )}
      
      <AdminPanel 
        isOpen={isAdminPanelOpen} 
        onClose={() => setIsAdminPanelOpen(false)} 
        onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} 
      />
      
      <PreferencesModal 
        isOpen={isPreferencesOpen} 
        onClose={() => setIsPreferencesOpen(false)} 
      />
      
      <UserGuideModal 
        isOpen={isUserGuideOpen} 
        onClose={() => setIsUserGuideOpen(false)} 
      />
      
      <KeyManagementModal
        isOpen={isKeyManagementOpen}
        onClose={() => setIsKeyManagementOpen(false)}
        repertoire={masterRepertoire}
        onUpdateKey={async (songId, updates) => {
          if (!userId) return;
          await syncToMasterRepertoire(userId, [{ ...updates, id: songId }]);
          await fetchSetlistsAndRepertoire();
        }}
        keyPreference={globalKeyPreference}
      />

      <GlobalSearchModal 
        isOpen={isGlobalSearchOpen} 
        onClose={() => setIsGlobalSearchOpen(false)} 
        onAddSong={handleGlobalSearchAdd}
        repertoire={masterRepertoire}
        onAddExistingSong={handleAddSongToRepertoire}
      />

      {activeSetlist && (
        <>
          <SetlistSortModal
            isOpen={isSetlistSortModalOpen}
            onClose={() => setIsSetlistSortModalOpen(false)}
            songs={activeSetlist.songs}
            onReorder={handleReorderSongs}
            setlistName={activeSetlist.name}
          />
          
          <SetlistSettingsModal
            isOpen={isSetlistSettingsOpen}
            onClose={() => setIsSetlistSettingsOpen(false)}
            setlistId={activeSetlist.id}
            setlistName={activeSetlist.name}
            onDelete={handleDeleteSetlist}
            onRename={handleRenameSetlist}
            onRefresh={() => fetchSetlistsAndRepertoire()}
          />
        </>
      )}

      <MDAuditModal 
        isOpen={isMDAuditOpen} 
        onClose={() => setIsMDAuditOpen(false)} 
        auditData={auditData} 
        isLoading={isAuditLoading} 
      />
    </div>
  );
};

export default Index;
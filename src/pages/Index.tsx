"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useSettings } from '@/hooks/use-settings';
import { showSuccess, showError, showInfo, showWarning } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { calculateSemitones, transposeKey } from '@/utils/keyUtils';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, ListMusic, Settings2, BookOpen, Search, LayoutDashboard, X, AlertCircle, CloudDownload, AlertTriangle, Library, Hash, Music, SortAsc } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Custom Components
import SetlistSelector from '@/components/SetlistSelector';
import SetlistManager, { SetlistSong, Setlist } from '@/components/SetlistManager';
import SetlistFilters, { FilterState, DEFAULT_FILTERS } from '@/components/SetlistFilters';
import SetlistStats from '@/components/SetlistStats';
import SetlistExporter from '@/components/SetlistExporter';
import RepertoirePicker from '@/components/RepertoirePicker';
import ImportSetlist from '@/components/ImportSetlist';
import ResourceAuditModal from '@/components/ResourceAuditModal';
import SetlistSettingsModal from '@/components/SetlistSettingsModal';
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
import AudioTransposer, { AudioTransposerRef } from '@/components/AudioTransposer';
import GoalTracker from '@/components/GoalTracker';
import SetlistSortModal from '@/components/SetlistSortModal'; // NEW: Import SetlistSortModal

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { keyPreference: globalKeyPreference, safePitchMaxNote, isSafePitchEnabled, isFetchingSettings, isGoalTrackerEnabled, defaultDashboardView, preventStageKeyOverwrite } = useSettings(); // NEW: Get preventStageKeyOverwrite
  const audio = useToneAudio();

  const [allSetlists, setAllSetlists] = useState<Setlist[]>([]);
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [activeSongForPerformance, setActiveSongForPerformance] = useState<SetlistSong | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Persist dashboard view via URL search param
  const activeDashboardView = (searchParams.get('view') as 'gigs' | 'repertoire') || defaultDashboardView;

  const [isSetlistSettingsOpen, setIsSetlistSettingsOpen] = useState(false);
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [isImportSetlistOpen, setIsImportSetlistOpen] = useState(false);
  const [isResourceAuditOpen, setIsResourceAuditOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isSongStudioModalOpen, setIsSongStudioModalOpen] = useState(false);
  const [songStudioModalSongId, setSongStudioModalSongId] = useState<string | null>(null);
  const [songStudioModalGigId, setSongStudioModalGigId] = useState<string | 'library' | null>(null);
  const [songStudioDefaultTab, setSongStudioDefaultTab] = useState<StudioTab | undefined>(undefined);
  const [isKeyManagementOpen, setIsKeyManagementOpen] = useState(false);
  const [isPerformanceOverlayOpen, setIsPerformanceOverlayOpen] = useState(false);
  const [isAudioTransposerModalOpen, setIsAudioTransposerModalOpen] = useState(false);
  const [isSetlistSortModalOpen, setIsSetlistSortModalOpen] = useState(false); // NEW: State for sort modal
  const audioTransposerRef = useRef<AudioTransposerRef>(null);

  const [newSetlistName, setNewSetlistName] = useState("");
  const [isCreatingSetlist, setIsCreatingSetlist] = useState(false);
  const [renameSetlistId, setRenameSetlistId] = useState<string | null>(null);
  const [renameSetlistName, setNewSetlistNameForRename] = useState("");
  const [deleteSetlistConfirmId, setDeleteSetlistConfirmId] = useState<string | null>(null);

  // --- PERSISTENT STATE INITIALIZATION ---
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('gig_search_term') || "");
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work' | 'manual'>(() => (localStorage.getItem('gig_sort_mode') as 'none' | 'ready' | 'work' | 'manual') || 'none'); // NEW: Add 'manual'
  const [activeFilters, setActiveFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('gig_active_filters');
    try {
      return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  const [showHeatmap, setShowHeatmap] = useState(() => localStorage.getItem('gig_show_heatmap') === 'true');
  // --- END PERSISTENT STATE INITIALIZATION ---

  // Automation States
  const [isRepertoireAutoLinking, setIsRepertoireAutoLinking] = useState(false);
  const [isRepertoireGlobalAutoSyncing, setIsRepertoireGlobalAutoSyncing] = useState(false);
  const [isRepertoireBulkQueuingAudio, setIsRepertoireBulkQueuingAudio] = useState(false);
  const [isRepertoireClearingAutoLinks, setIsRepertoireClearingAutoLinks] = useState(false);

  const [floatingDockMenuOpen, setFloatingDockMenuOpen] = useState(false);

  const userId = user?.id;

  const onOpenAdmin = () => setIsAdminPanelOpen(true);

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    localStorage.setItem('gig_search_term', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('gig_sort_mode', sortMode);
  }, [sortMode]);

  useEffect(() => {
    localStorage.setItem('gig_active_filters', JSON.stringify(activeFilters));
  }, [activeFilters]);

  useEffect(() => {
    localStorage.setItem('gig_show_heatmap', showHeatmap.toString());
  }, [showHeatmap]);
  // --- END PERSISTENCE EFFECTS ---

  const missingAudioCount = useMemo(() => {
    return masterRepertoire.filter(s => {
      const hasLink = !!s.youtubeUrl;
      const hasAudio = !!s.audio_url;
      const status = (s.extraction_status || "").toLowerCase();
      return hasLink && (!hasAudio || status !== 'completed') && status !== 'processing' && status !== 'queued';
    }).length;
  }, [masterRepertoire]);

  const activeSetlist = useMemo(() =>
    allSetlists.find(list => list.id === activeSetlistId),
  [allSetlists, activeSetlistId]);

  const isFilterActive = useMemo(() => {
    return JSON.stringify(activeFilters) !== JSON.stringify(DEFAULT_FILTERS) || searchTerm.trim().length > 0;
  }, [activeFilters, searchTerm]);

  const filteredAndSortedSongs = useMemo(() => {
    if (!activeSetlist) return [];
    let songs = [...activeSetlist.songs];
    const q = searchTerm.toLowerCase();
    if (q) {
      songs = songs.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.artist?.toLowerCase().includes(q) ||
        s.user_tags?.some(tag => tag.toLowerCase().includes(q))
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
      const hasLyrics = !!s.lyrics && s.lyrics.length > 20; // Check for lyrics presence

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
      
      // NEW: Apply Lyrics filter
      if (activeFilters.hasLyrics === 'yes' && !hasLyrics) return false;
      if (activeFilters.hasLyrics === 'no' && hasLyrics) return false;
      
      return true;
    });

    if (sortMode === 'ready') {
      songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    } else if (sortMode === 'work') {
      songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    } else if (sortMode === 'manual') {
      // Songs are already ordered by sort_order from fetchSetlistsAndRepertoire
      // No additional sorting needed here for 'manual' mode
    } else { // 'none' (alphabetical)
      songs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return songs;
  }, [activeSetlist, searchTerm, sortMode, activeFilters]);

  const fetchSetlistsAndRepertoire = useCallback(async (isInitial = false) => {
    if (!userId) return;
    if (isInitial) setLoading(true);
    
    try {
      const { data: setlistsData, error: setlistsError } = await supabase
        .from('setlists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (setlistsError) throw setlistsError;

      const { data: repertoireData, error: repertoireError } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', userId) // Corrected from 'user.id' to 'user_id'
        .order('title');

      if (repertoireError) throw repertoireError;

      const mappedRepertoire: SetlistSong[] = (repertoireData || []).map(d => ({
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
        preferred_reader: d.preferred_reader,
        ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG, // NEW: Map ug_chords_config
        is_ug_chords_present: d.is_ug_chords_present,
        highest_note_original: d.highest_note_original,
        is_ug_link_verified: d.is_ug_link_verified,
        metadata_source: d.metadata_source,
        sync_status: d.sync_status,
        last_sync_log: d.last_sync_log,
        auto_synced: d.auto_synced,
        is_sheet_verified: d.is_sheet_verified,
        sheet_music_url: d.sheet_music_url,
        extraction_status: d.extraction_status,
        extraction_error: d.extraction_error,
        audio_url: d.audio_url,
        lyrics_updated_at: d.lyrics_updated_at,
        chords_updated_at: d.chords_updated_at,
        ug_link_updated_at: d.ug_link_updated_at,
        highest_note_updated_at: d.highest_note_updated_at,
        original_key_updated_at: d.original_key_updated_at,
        target_key_updated_at: d.target_key_updated_at,
      }));
      setMasterRepertoire(mappedRepertoire);

      const setlistsWithSongs: Setlist[] = [];
      for (const setlist of setlistsData || []) {
        const { data: junctionData, error: junctionError } = await supabase
          .from('setlist_songs')
          .select('*')
          .eq('setlist_id', setlist.id)
          .order('sort_order', { ascending: true }); // IMPORTANT: Order by sort_order

        if (junctionError) continue;

        const songs: SetlistSong[] = junctionData.map(junction => {
          const masterSong = mappedRepertoire.find(r => r.id === junction.song_id);
          if (!masterSong) return null;
          return {
            ...masterSong,
            id: junction.id, // Use junction ID for setlist-specific operations
            master_id: masterSong.id, // Keep master ID for linking to repertoire
            isPlayed: junction.isPlayed || false,
          };
        }).filter(Boolean) as SetlistSong[];

        setlistsWithSongs.push({
          id: setlist.id,
          name: setlist.name,
          songs: songs,
          time_goal: setlist.time_goal
        });
      }

      setAllSetlists(setlistsWithSongs);
      let initialSetlistId = setlistsWithSongs[0]?.id || null;
      const savedSetlistId = localStorage.getItem('active_setlist_id');
      if (savedSetlistId && setlistsWithSongs.some(s => s.id === savedSetlistId)) {
        initialSetlistId = savedSetlistId;
      }
      setActiveSetlistId(initialSetlistId);
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

  // --- AUDIO LOADING EFFECT ---
  useEffect(() => {
    if (activeSongForPerformance) {
      const urlToLoad = activeSongForPerformance.audio_url || activeSongForPerformance.previewUrl;
      
      // 1. Apply settings immediately (these setters update the Tone.js engine directly)
      audio.setPitch(activeSongForPerformance.pitch || 0);
      audio.setTempo(activeSongForPerformance.tempo || 1);
      // audio.setVolume(activeSongForPerformance.volume || -6); // REMOVED: Let useToneAudio manage its own volume state
      audio.setFineTune(activeSongForPerformance.fineTune || 0);

      // 2. Load audio if URL exists
      if (urlToLoad) {
        // Pass the pitch to loadFromUrl so it can initialize the player detune correctly upon buffer load
        // IMPORTANT: Removed force: true to prevent redundant fetching if URL is the same.
        audio.loadFromUrl(urlToLoad, activeSongForPerformance.pitch || 0);
      } else {
        audio.resetEngine();
        showWarning("Selected song has no audio link.");
      }
    } else {
      audio.resetEngine();
    }
  }, [activeSongForPerformance, audio]);
  // --- END AUDIO LOADING EFFECT ---

  const handleSelectSetlist = (id: string) => {
    setActiveSetlistId(id);
    localStorage.setItem('active_setlist_id', id);
    audio.stopPlayback();
  };

  const handleCreateSetlist = async () => {
    if (!userId || !newSetlistName.trim()) return;
    setIsCreatingSetlist(true);
    try {
      const { data, error } = await supabase
        .from('setlists')
        .insert([{ user_id: userId, name: newSetlistName.trim(), songs: [] }])
        .select()
        .single();

      if (error) throw error;
      setAllSetlists(prev => [data, ...prev]);
      setActiveSetlistId(data.id);
      setNewSetlistName("");
      showSuccess("New Setlist Created!");
    } catch (err: any) {
      showError(`Failed to create setlist: ${err.message}`);
    } finally {
      setIsCreatingSetlist(false);
    }
  };

  const handleDeleteSetlist = async (id: string) => {
    if (!userId || !id) return;
    try {
      const { error } = await supabase
        .from('setlists')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      setAllSetlists(prev => prev.filter(s => s.id !== id));
      if (activeSetlistId === id) {
        setActiveSetlistId(allSetlists[0]?.id || null);
      }
      showSuccess("Setlist Deleted!");
      setDeleteSetlistConfirmId(null);
      setIsSetlistSettingsOpen(false);
    } catch (err: any) {
      showError(`Failed to delete setlist: ${err.message}`);
    }
  };

  const handleRemoveSongFromSetlist = async (songIdToRemove: string) => {
    if (!userId || !activeSetlist) return;
    try {
      const { error } = await supabase
        .from('setlist_songs')
        .delete()
        .eq('id', songIdToRemove);

      if (error) throw error;
      const updatedSongs = activeSetlist.songs.filter(s => s.id !== songIdToRemove);
      setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: updatedSongs } : s));
      if (activeSongForPerformance?.id === songIdToRemove) setActiveSongForPerformance(null);
      showSuccess("Track removed from setlist.");
    } catch (err: any) {
      showError(`Failed to remove song: ${err.message}`);
    }
  };

  const handleSelectSongForPlayback = (song: SetlistSong) => {
    setActiveSongForPerformance(song);
    audio.stopPlayback();
    if (activeSetlist) {
      localStorage.setItem(`active_song_id_${activeSetlist.id}`, song.id);
    }
  };

  const handleEditSong = (song: SetlistSong, defaultTab?: StudioTab) => {
    audio.stopPlayback();
    setSongStudioModalSongId(song.master_id || song.id);
    setSongStudioModalGigId(activeDashboardView === 'gigs' ? activeSetlistId : 'library');
    setIsSongStudioModalOpen(true);
    setSongStudioDefaultTab(defaultTab || 'audio');
  };

  const handleUpdateSongInSetlist = async (junctionIdToUpdate: string, updates: Partial<SetlistSong>) => {
    if (!userId || !activeSetlist) return;
    const junctionSong = activeSetlist.songs.find(s => s.id === junctionIdToUpdate);
    if (!junctionSong) return;
    const masterSongId = junctionSong.master_id;
    if (!masterSongId) return;
    const currentMasterSong = masterRepertoire.find(s => s.id === masterSongId);
    if (!currentMasterSong) return;

    try {
      const mergedUpdatesForMaster = { ...currentMasterSong, ...updates };
      const syncedSongs = await syncToMasterRepertoire(userId, [mergedUpdatesForMaster]);
      const fullySyncedMasterSong = syncedSongs[0];
      setMasterRepertoire(prev => prev.map(s => s.id === fullySyncedMasterSong.id ? fullySyncedMasterSong : s));
      const updatedSetlistSongs = activeSetlist.songs.map(s =>
        s.id === junctionIdToUpdate ? { ...s, ...fullySyncedMasterSong } : s
      );
      await supabase.from('setlist_songs').update({ isPlayed: updates.isPlayed !== undefined ? updates.isPlayed : junctionSong.isPlayed }).eq('id', junctionIdToUpdate);
      setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: updatedSetlistSongs } : s));
      if (activeSongForPerformance?.id === junctionIdToUpdate) {
        setActiveSongForPerformance(prev => ({ ...prev!, ...fullySyncedMasterSong }));
      }
      showSuccess("Song updated.");
    } catch (err: any) {
      showError(`Failed to update song: ${err.message}`);
    }
  };

  const handleUpdateSongKey = (id: string, targetKey: string) => {
    handleUpdateSongInSetlist(id, { targetKey });
  };

  const handleUpdateMasterKey = async (songId: string, updates: { originalKey?: string | null, targetKey?: string | null, pitch?: number }) => {
    if (!userId) return;
    const current = masterRepertoire.find(s => s.id === songId);
    if (!current) return;
    try {
      const updated = { ...current, ...updates };
      if (updates.targetKey !== undefined) { // If targetKey is being updated, mark as confirmed
        updated.isKeyConfirmed = true;
      }
      await syncToMasterRepertoire(userId, [updated as SetlistSong]);
      await fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to update master key: ${err.message}`);
    }
  };

  const handleSafePitchToggle = (active: boolean, limit: number) => {
    // Handled internally in FloatingCommandDock
  };

  const handleTogglePlayed = async (songIdToToggle: string) => {
    if (!userId || !activeSetlist) return;
    const song = activeSetlist.songs.find(s => s.id === songIdToToggle);
    if (!song) return;
    const updatedSongs = activeSetlist.songs.map(s => s.id === songIdToToggle ? { ...s, isPlayed: !s.isPlayed } : s);
    try {
      await supabase.from('setlist_songs').update({ isPlayed: !song.isPlayed }).eq('id', songIdToToggle);
      setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: updatedSongs } : s));
      if (activeSongForPerformance?.id === songIdToToggle) setActiveSongForPerformance(prev => ({ ...prev!, isPlayed: !prev?.isPlayed }));
      showSuccess("Played status updated.");
    } catch (err: any) {
      showError(`Failed to update played status: ${err.message}`);
    }
  };

  const handleAddSongToSetlist = async (songToAdd: SetlistSong) => {
    if (!userId || !activeSetlist) return;
    const isAlreadyInSetlist = activeSetlist.songs.some(s => (s.master_id && s.master_id === songToAdd.master_id) || s.id === songToAdd.id);
    if (isAlreadyInSetlist) {
      showInfo("Song already in setlist.");
      return;
    }
    const masterVersion = masterRepertoire.find(s => s.id === songToAdd.id || s.master_id === songToAdd.master_id);
    const songToUse = masterVersion || songToAdd;
    try {
      const { error } = await supabase.from('setlist_songs').insert({ setlist_id: activeSetlist.id, song_id: songToUse.master_id || songToUse.id, sort_order: activeSetlist.songs.length, isPlayed: false, is_confirmed: false });
      if (error) throw error;
      await fetchSetlistsAndRepertoire();
      showSuccess(`"${songToAdd.name}" added to setlist.`);
      setIsRepertoirePickerOpen(false);
    } catch (err: any) {
      showError(`Failed to add song: ${err.message}`);
    }
  };

  const handleReorderSongs = async (newSongs: SetlistSong[]) => {
    if (!userId || !activeSetlist) return;
    try {
      for (let i = 0; i < newSongs.length; i++) {
        await supabase.from('setlist_songs').update({ sort_order: i }).eq('id', newSongs[i].id);
      }
      setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: newSongs } : s));
      showSuccess("Setlist reordered!");
    } catch (err: any) {
      showError(`Failed to reorder songs: ${err.message}`);
    }
  };

  const handleUpdateSetlistSongs = useCallback(async (setlistId: string, songToUpdate: SetlistSong, action: 'add' | 'remove') => {
    const targetSetlist = allSetlists.find(l => l.id === setlistId);
    if (!targetSetlist || !userId) return;
    if (action === 'add') {
      const isAlreadyInList = targetSetlist.songs.some(s => (s.master_id && s.master_id === songToUpdate.master_id) || s.id === songToUpdate.id);
      if (!isAlreadyInList) {
        try {
          await supabase.from('setlist_songs').insert({ setlist_id: setlistId, song_id: songToUpdate.master_id || songToUpdate.id, sort_order: 0, isPlayed: false, is_confirmed: false });
        } catch (error: any) {
          showError(`Failed to add: ${error.message}`);
          return;
        }
      }
    } else if (action === 'remove') {
      const junctionSong = targetSetlist.songs.find(s => (s.master_id && s.master_id === songToUpdate.master_id) || (!s.master_id && s.id === songToUpdate.id));
      if (junctionSong) {
        try {
          await supabase.from('setlist_songs').delete().eq('setlist_id', setlistId).eq('id', junctionSong.id);
        } catch (error: any) {
          showError(`Failed to remove: ${error.message}`);
          return;
        }
      }
    }
    await fetchSetlistsAndRepertoire();
  }, [allSetlists, fetchSetlistsAndRepertoire, userId]);

  const handleImportNewSong = async (previewUrl: string, name: string, artist: string, youtubeUrl?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string, pitch?: number, audioUrl?: string, extractionStatus?: 'idle' | 'PENDING' | 'queued' | 'processing' | 'completed' | 'failed') => {
    if (!userId) return;
    
    try {
      const newSongData: Partial<SetlistSong> = {
        name,
        artist,
        previewUrl,
        youtubeUrl,
        ugUrl,
        appleMusicUrl,
        genre,
        pitch: pitch || 0,
        audio_url: audioUrl,
        extraction_status: extractionStatus || 'idle',
        isMetadataConfirmed: true,
        isPlayed: false,
        is_pitch_linked: true
      };
      
      const syncedSongs = await syncToMasterRepertoire(userId, [newSongData]);
      const syncedSong = syncedSongs[0];
      
      if (!syncedSong || !syncedSong.master_id) {
        throw new Error("Master sync failed to return a valid song ID.");
      }
      
      // Now, add the newly synced master song to the active setlist
      if (activeSetlist) {
        const isAlreadyInSetlist = activeSetlist.songs.some(s => s.master_id === syncedSong.master_id);
        if (!isAlreadyInSetlist) {
          await supabase.from('setlist_songs').insert({ 
            setlist_id: activeSetlist.id, 
            song_id: syncedSong.master_id, 
            sort_order: activeSetlist.songs.length, 
            isPlayed: false, 
            is_confirmed: false 
          });
          showSuccess(`"${name}" added to master repertoire and active setlist.`);
        } else {
          showSuccess(`"${name}" added to master repertoire (already in setlist).`);
        }
      } else {
        showSuccess(`"${name}" added to master repertoire.`);
      }

      await fetchSetlistsAndRepertoire(false); 
      
    } catch (err: any) {
      showError(`Import failed: ${err.message || 'Database connection error'}`);
    }
  };

  // Adapter function for onImportGlobal prop
  const handleImportGlobalAdapter = useCallback(async (songData: Partial<SetlistSong>) => {
    await handleImportNewSong(
      songData.previewUrl || '',
      songData.name || '',
      songData.artist || '',
      songData.youtubeUrl,
      songData.ugUrl,
      songData.appleMusicUrl,
      songData.genre,
      songData.pitch,
      songData.audio_url,
      songData.extraction_status
    );
  }, [handleImportNewSong]);


  const handleDeleteMasterSong = async (songId: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('repertoire')
        .delete()
        .eq('id', songId)
        .eq('user_id', userId);

      if (error) throw error;

      setMasterRepertoire(prev => prev.filter(s => s.id !== songId));
      if (activeSongForPerformance?.master_id === songId || activeSongForPerformance?.id === songId) {
        setActiveSongForPerformance(null);
      }
      
      await fetchSetlistsAndRepertoire();
      showSuccess("Track permanently removed from repertoire.");
    } catch (err: any) {
      showError(`Delete failed: ${err.message}`);
    }
  };

  const handleBulkAutoLink = async () => {
    const missing = masterRepertoire.filter(s => !s.youtubeUrl || s.youtubeUrl.trim() === '');
    if (missing.length === 0) {
      showInfo("All tracks already have YouTube links bound.");
      return;
    }

    setIsRepertoireAutoLinking(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('bulk-populate-youtube-links', {
        body: { songIds: missing.map(s => s.id) }
      });

      if (error) throw error;
      await fetchSetlistsAndRepertoire();
      showSuccess(`AI Discovery Complete: ${data.results.filter((r:any) => r.status === 'SUCCESS').length} links bound.`);
    } catch (err: any) {
      showError(`Discovery Failed: ${err.message}`);
    } finally {
      setIsRepertoireAutoLinking(false);
    }
  };

  const handleBulkGlobalAutoSync = async () => {
    if (masterRepertoire.length === 0) return;
    
    setIsRepertoireGlobalAutoSyncing(true);

    try {
      const { data, error } = await supabase.functions.invoke('global-auto-sync', {
        body: { songIds: masterRepertoire.map(s => s.id), overwrite: false }
      });

      if (error) throw error;
      await fetchSetlistsAndRepertoire();
      showSuccess("Metadata Sync Pipeline Finished.");
    } catch (err: any) {
      showError(`Sync Failed: ${err.message}`);
    } finally {
      setIsRepertoireGlobalAutoSyncing(false);
    }
  };

  const handleBulkRefreshAudio = async () => {
    if (!userId) {
      showError("User not authenticated.");
      return;
    }

    const songsToQueue = masterRepertoire.filter(s => 
      !!s.youtubeUrl && (!s.audio_url || s.extraction_status !== 'completed') && s.extraction_status !== 'processing' && s.extraction_status !== 'queued'
    );

    if (songsToQueue.length === 0) {
      showInfo("No tracks found with YouTube links but missing audio to queue for extraction.");
      return;
    }

    if (!confirm(`Are you sure you want to queue audio extraction for ${songsToQueue.length} tracks?`)) {
      return;
    }

    setIsRepertoireBulkQueuingAudio(true);
    showInfo(`Queueing ${songsToQueue.length} tracks for background audio extraction...`);

    try {
      const { error } = await supabase
        .from('repertoire')
        .update({ 
          extraction_status: 'queued', 
          last_sync_log: 'Queued for background audio extraction.' 
        })
        .in('id', songsToQueue.map(s => s.id));

      if (error) throw error;

      showSuccess(`Queued ${songsToQueue.length} audio extraction tasks successfully.`);
      await fetchSetlistsAndRepertoire(); 
      
    } catch (err: any) {
      showError(`Failed to queue audio extraction: ${err.message}`);
    } finally {
      setIsRepertoireBulkQueuingAudio(false);
    }
  };

  const handleBulkClearAutoLinks = async () => {
    const autoPopulated = masterRepertoire.filter(s => s.metadata_source === 'auto_populated');
    if (autoPopulated.length === 0) {
      showInfo("No auto-populated links found to clear.");
      return;
    }

    if (!confirm(`Are you sure you want to clear ${autoPopulated.length} auto-populated links?`)) return;

    setIsRepertoireClearingAutoLinks(true);
    try {
      const { error } = await supabase
        .from('repertoire')
        .update({ 
          youtube_url: null, 
          metadata_source: null,
          sync_status: 'IDLE' 
        })
        .eq('metadata_source', 'auto_populated')
        .eq('user_id', userId);

      if (error) throw error;
      await fetchSetlistsAndRepertoire();
      showSuccess("Auto-links cleared.");
    } catch (err: any) {
      showError(`Clear failed: ${err.message}`);
    } finally {
      setIsRepertoireClearingAutoLinks(false);
    }
  };

  if (loading || authLoading || isFetchingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className={cn(
        "w-full lg:w-[350px] xl:w-[400px] flex flex-col border-r border-border shrink-0 bg-card transition-all duration-300",
        floatingDockMenuOpen && "lg:ml-[100px]"
      )}>
        <div className="p-6 border-b border-border bg-secondary flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">Gig Studio</h1>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Performance Dashboard</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsPreferencesOpen(true)} className="rounded-full hover:bg-accent">
            <Settings2 className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-8">
            {isGoalTrackerEnabled && <GoalTracker repertoire={masterRepertoire} />}

            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {activeDashboardView === 'gigs' ? 'Active Gig Setlists' : 'Master Repertoire'}
              </h3>
              <div className="flex bg-secondary p-1 rounded-xl">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchParams({ view: 'gigs' })}
                  className={cn(
                    "text-[9px] font-black uppercase h-8 px-4 rounded-lg gap-2",
                    activeDashboardView === 'gigs' ? "bg-background dark:bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ListMusic className="w-3 h-3" /> Gigs
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchParams({ view: 'repertoire' })}
                  className={cn(
                    "text-[9px] font-black uppercase h-8 px-4 rounded-lg gap-2",
                    activeDashboardView === 'repertoire' ? "bg-background dark:bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Library className="w-3 h-3" /> Repertoire
                </Button>
              </div>
            </div>

            {activeDashboardView === 'gigs' ? (
              <>
                <div className="flex items-center gap-2">
                  <SetlistSelector
                    setlists={allSetlists.map(s => ({ id: s.id, name: s.name }))}
                    currentId={activeSetlistId || ''}
                    onSelect={handleSelectSetlist}
                    onCreate={() => setIsCreatingSetlist(true)}
                    onDelete={(id) => setDeleteSetlistConfirmId(id)}
                  />
                  {activeSetlist && (
                    <Button variant="ghost" size="icon" onClick={() => setIsSetlistSettingsOpen(true)} className="h-10 w-10 rounded-xl bg-secondary hover:bg-accent text-muted-foreground">
                      <Settings2 className="w-5 h-5" />
                    </Button>
                  )}
                </div>

                {activeSetlist ? (
                  <>
                    <SetlistStats
                      songs={activeSetlist.songs}
                      goalSeconds={activeSetlist.time_goal}
                      onUpdateGoal={async (seconds) => {
                        if (!userId) return;
                        try {
                          await supabase.from('setlists').update({ time_goal: seconds }).eq('id', activeSetlist.id);
                          setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, time_goal: seconds } : s));
                          showSuccess("Setlist goal updated!");
                        } catch (err: any) {
                          showError(`Failed to update goal: ${err.message}`);
                        }
                      }}
                    />
                    <SetlistManager
                      songs={activeSetlist.songs}
                      onRemove={handleRemoveSongFromSetlist}
                      onSelect={handleSelectSongForPlayback}
                      onEdit={handleEditSong}
                      onUpdateKey={handleUpdateSongKey}
                      onTogglePlayed={handleTogglePlayed}
                      onLinkAudio={() => setIsAudioTransposerModalOpen(true)}
                      onUpdateSong={handleUpdateSongInSetlist}
                      onSyncProData={async (song) => {
                        showError("Pro Sync not yet implemented for individual songs.");
                      }}
                      onReorder={handleReorderSongs}
                      currentSongId={activeSongForPerformance?.id}
                      onOpenAdmin={onOpenAdmin}
                      sortMode={sortMode}
                      setSortMode={setSortMode}
                      activeFilters={activeFilters}
                      setActiveFilters={setActiveFilters}
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                      showHeatmap={showHeatmap}
                      allSetlists={allSetlists}
                      onUpdateSetlistSongs={handleUpdateSetlistSongs}
                      onOpenSortModal={() => setIsSetlistSortModalOpen(true)} // NEW: Open sort modal
                    />
                    <Button
                      onClick={() => setIsRepertoirePickerOpen(true)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-600/20 gap-3"
                    >
                      <Plus className="w-4 h-4" /> Add from Repertoire
                    </Button>
                    <Button
                      onClick={() => setIsImportSetlistOpen(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-600/20 gap-3"
                    >
                      <ListMusic className="w-4 h-4" /> Smart Import
                    </Button>
                    <Button
                      onClick={() => setIsResourceAuditOpen(true)}
                      className="w-full bg-orange-600 hover:bg-orange-700 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-orange-600/20 gap-3"
                    >
                      <AlertCircle className="w-4 h-4" /> Resource Audit
                    </Button>
                  </>
                ) : (
                  <div className="py-20 text-center opacity-30">
                    <ListMusic className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">No Setlist Selected</p>
                    <Button onClick={() => setIsCreatingSetlist(true)} className="mt-6 bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-600/20 gap-3">
                      <Plus className="w-4 h-4" /> Create New Setlist
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <RepertoireView
                repertoire={masterRepertoire}
                onEditSong={handleEditSong}
                allSetlists={allSetlists}
                onUpdateSetlistSongs={handleUpdateSetlistSongs}
                onRefreshRepertoire={() => fetchSetlistsAndRepertoire()}
                onAddSong={(song) => handleAddSongToSetlist(song)}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                sortMode={sortMode}
                setSortMode={setSortMode}
                activeFilters={activeFilters}
                setActiveFilters={setActiveFilters}
                onAutoLink={handleBulkAutoLink}
                onGlobalAutoSync={handleBulkGlobalAutoSync}
                onBulkRefreshAudio={handleBulkRefreshAudio}
                onClearAutoLinks={handleBulkClearAutoLinks}
                isBulkDownloading={isRepertoireBulkQueuingAudio}
                missingAudioCount={missingAudioCount}
                onOpenAdmin={onOpenAdmin}
                onDeleteSong={handleDeleteMasterSong}
              />
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-background relative overflow-hidden">
        {activeSongForPerformance && (
          <ActiveSongBanner
            song={activeSongForPerformance}
            isPlaying={audio.isPlaying}
            onTogglePlayback={audio.togglePlayback}
            onClear={() => setActiveSongForPerformance(null)}
            isLoadingAudio={audio.isLoadingAudio}
          />
        )}

        <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-4xl bg-card rounded-[2.5rem] border-4 border-border shadow-2xl p-10 text-center space-y-8">
            <div className="bg-indigo-600/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-indigo-400 shadow-xl shadow-indigo-600/20">
              <Music className="w-10 h-10" />
            </div>
            <h2 className="text-4xl font-black uppercase tracking-tight text-foreground">Welcome to Gig Studio</h2>
            <p className="text-muted-foreground text-lg font-medium max-w-xl mx-auto">
              Select a song from your setlist or repertoire to begin, or use the search tools to discover new tracks.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => setIsAudioTransposerModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-600/30 gap-3"
              >
                <Search className="w-4 h-4" /> Discover New Music
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/sheet-reader')}
                className="h-14 px-8 rounded-2xl border-border bg-secondary hover:bg-accent font-black uppercase tracking-widest text-xs text-foreground gap-3"
              >
                <BookOpen className="w-4 h-4" /> Open Sheet Reader
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <Dialog open={isCreatingSetlist} onOpenChange={setIsCreatingSetlist}>
        <DialogContent className="bg-popover border-border text-foreground rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Create New Setlist</DialogTitle>
            <DialogDescription className="text-muted-foreground">Enter a name for your new gig setlist.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Label htmlFor="new-setlist-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Setlist Name</Label>
            <Input
              id="new-setlist-name"
              value={newSetlistName}
              onChange={(e) => setNewSetlistName(e.target.value)}
              placeholder="E.g., Wedding Reception - Oct 2024"
              className="h-11 bg-background border-border text-foreground"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsCreatingSetlist(false)} className="font-bold uppercase text-[10px] tracking-widest">Cancel</Button>
            <Button onClick={handleCreateSetlist} disabled={!newSetlistName.trim()} className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[10px] tracking-widest">Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSetlistConfirmId} onOpenChange={(open) => !open && setDeleteSetlistConfirmId(null)}>
        <AlertDialogContent className="bg-card border-border text-foreground rounded-[2rem]">
          <AlertDialogHeader>
            <div className="bg-destructive/10 w-12 h-12 rounded-2xl flex items-center justify-center text-destructive mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Delete Setlist?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete the setlist and all its associated songs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl border-border bg-secondary hover:bg-accent hover:text-foreground font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteSetlistConfirmId) handleDeleteSetlist(deleteSetlistConfirmId); }} className="rounded-xl bg-destructive hover:bg-destructive-foreground text-white font-black uppercase text-[10px] tracking-widest">Confirm Deletion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SetlistSettingsModal
        isOpen={isSetlistSettingsOpen}
        onClose={() => setIsSetlistSettingsOpen(false)}
        setlistId={activeSetlistId}
        setlistName={activeSetlist?.name || "Current Setlist"}
        onDelete={(id) => setDeleteSetlistConfirmId(id)}
        onRename={async (id) => {
          const newName = prompt("Enter new setlist name:");
          if (newName && userId) {
            try {
              await supabase.from('setlists').update({ name: newName }).eq('id', id);
              setAllSetlists(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
              showSuccess("Setlist renamed!");
            } catch (err: any) {
              showError(`Failed to rename: ${err.message}`);
            }
          }
        }}
      />

      <RepertoirePicker
        isOpen={isRepertoirePickerOpen}
        onClose={() => setIsRepertoirePickerOpen(false)}
        repertoire={masterRepertoire}
        currentSetlistSongs={activeSetlist?.songs || []}
        onAdd={handleAddSongToSetlist}
      />

      <ImportSetlist
        isOpen={isImportSetlistOpen}
        onClose={() => setIsImportSetlistOpen(false)}
        onImport={async (songs) => {
          if (!userId || !activeSetlist) {
            showError("No active setlist or user session.");
            return;
          }
          showInfo(`Importing ${songs.length} songs...`);
          for (const song of songs) {
            await handleImportNewSong(
              song.previewUrl,
              song.name,
              song.artist || "Unknown Artist",
              song.youtubeUrl,
              song.ugUrl,
              song.appleMusicUrl,
              song.genre,
              song.pitch,
              song.audio_url,
              song.extraction_status
            );
          }
          showSuccess("Import complete!");
        }}
      />

      <ResourceAuditModal
        isOpen={isResourceAuditOpen}
        onClose={() => setIsResourceAuditOpen(false)}
        songs={masterRepertoire}
        onVerify={async (songId, updates) => {
          if (!userId) return;
          const current = masterRepertoire.find(s => s.id === songId);
          if (!current) return;
          try {
            await syncToMasterRepertoire(userId, [{ ...current, ...updates } as SetlistSong]);
            await fetchSetlistsAndRepertoire();
          } catch (err: any) {
            showError(`Failed to verify: ${err.message}`);
          }
        }}
        onOpenStudio={(songId) => handleEditSong(masterRepertoire.find(s => s.id === songId)!, 'details')}
        onRefreshRepertoire={() => fetchSetlistsAndRepertoire()}
      />

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

      <SongStudioModal
        isOpen={isSongStudioModalOpen}
        onClose={() => setIsSongStudioModalOpen(false)}
        gigId={songStudioModalGigId}
        songId={songStudioModalSongId}
        visibleSongs={activeSetlist?.songs || masterRepertoire}
        onSelectSong={(id) => {
          const song = (activeSetlist?.songs || masterRepertoire).find(s => s.id === id || s.master_id === id);
          if (song) {
            setSongStudioModalSongId(song.master_id || song.id);
          }
        }}
        allSetlists={allSetlists}
        masterRepertoire={masterRepertoire}
        onUpdateSetlistSongs={handleUpdateSetlistSongs}
        defaultTab={songStudioDefaultTab}
        handleAutoSave={async (updates) => {
          if (!userId || !songStudioModalSongId) return;
          const current = masterRepertoire.find(s => s.id === songStudioModalSongId);
          if (!current) return;
          try {
            await syncToMasterRepertoire(userId, [{ ...current, ...updates } as SetlistSong]);
            await fetchSetlistsAndRepertoire();
          } catch (err: any) {
            showError(`Auto-save failed: ${err.message}`);
          }
        }}
        preventStageKeyOverwrite={preventStageKeyOverwrite}
      />

      <KeyManagementModal
        isOpen={isKeyManagementOpen}
        onClose={() => setIsKeyManagementOpen(false)}
        repertoire={masterRepertoire}
        onUpdateKey={handleUpdateMasterKey}
        keyPreference={globalKeyPreference}
      />

      <PerformanceOverlay
        songs={filteredAndSortedSongs}
        currentIndex={activeSetlist?.songs.findIndex(s => s.id === activeSongForPerformance?.id) || 0}
        isPlaying={audio.isPlaying}
        progress={audio.progress}
        duration={audio.duration}
        onTogglePlayback={audio.togglePlayback}
        onNext={() => {
          const currentIdx = filteredAndSortedSongs.findIndex(s => s.id === activeSongForPerformance?.id);
          const nextIdx = (currentIdx + 1) % filteredAndSortedSongs.length;
          handleSelectSongForPlayback(filteredAndSortedSongs[nextIdx]);
        }}
        onPrevious={() => {
          const currentIdx = filteredAndSortedSongs.findIndex(s => s.id === activeSongForPerformance?.id);
          const prevIdx = (currentIdx - 1 + filteredAndSortedSongs.length) % filteredAndSortedSongs.length;
          handleSelectSongForPlayback(filteredAndSortedSongs[prevIdx]);
        }}
        onShuffle={() => {
          if (!activeSetlist) return;
          const shuffled = [...activeSetlist.songs].sort(() => Math.random() - 0.5);
          handleReorderSongs(shuffled);
        }}
        onClose={() => setIsPerformanceOverlayOpen(false)}
        onUpdateSong={handleUpdateSongInSetlist}
        onUpdateKey={handleUpdateSongKey}
        analyzer={audio.analyzer}
        onOpenAdmin={onOpenAdmin}
        gigId={activeSetlistId}
        isLoadingAudio={audio.isLoadingAudio}
      />

      <AudioTransposer
        ref={audioTransposerRef}
        onAddToSetlist={handleImportNewSong}
        onAddExistingSong={handleAddSongToSetlist}
        // onUpdateSongKey={handleUpdateMasterKey} // Removed unused prop
        onSongEnded={() => {
          // Logic for when a song ends in the transposer preview
        }}
        onPlaybackChange={(playing) => {
          // Handle playback state changes if needed
        }}
        repertoire={masterRepertoire}
        currentList={activeSetlist}
        onImportGlobal={handleImportGlobalAdapter}
      />

      <SetlistSortModal
        isOpen={isSetlistSortModalOpen}
        onClose={() => setIsSetlistSortModalOpen(false)}
        songs={activeSetlist?.songs || []}
        onReorder={handleReorderSongs}
        setlistName={activeSetlist?.name || "Current Setlist"}
      />

      <FloatingCommandDock
        onOpenSearch={() => setIsAudioTransposerModalOpen(true)}
        onOpenPractice={() => {
          sessionStorage.setItem('from_dashboard', 'true');
          navigate('/sheet-reader');
        }}
        onOpenReader={() => {
          sessionStorage.setItem('from_dashboard', 'true');
          navigate('/sheet-reader');
        }}
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
        onToggleHeatmap={() => setShowHeatmap(prev => !prev)}
        onOpenUserGuide={() => setIsUserGuideOpen(true)}
        showHeatmap={showHeatmap}
        viewMode={activeDashboardView}
        hasPlayableSong={!!activeSongForPerformance?.previewUrl}
        hasReadableChart={!!activeSongForPerformance?.pdfUrl || !!activeSongForPerformance?.ugUrl || !!activeSongForPerformance?.ug_chords_text}
        isPlaying={audio.isPlaying}
        onTogglePlayback={audio.togglePlayback}
        currentSongHighestNote={activeSongForPerformance?.highest_note_original}
        currentSongPitch={activeSongForPerformance?.pitch}
        onSafePitchToggle={handleSafePitchToggle}
        onSetMenuOpen={setFloatingDockMenuOpen}
        isMenuOpen={floatingDockMenuOpen}
        onOpenPerformance={() => setIsPerformanceOverlayOpen(true)}
      />
    </div>
  );
};

export default Index;
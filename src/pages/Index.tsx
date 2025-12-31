"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useSettings } from '@/hooks/use-settings';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { calculateSemitones, transposeKey } from '@/utils/keyUtils';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, ListMusic, Settings2, BookOpen, Search, LayoutDashboard, X, AlertCircle, CloudDownload, AlertTriangle, Library, Hash } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { keyPreference: globalKeyPreference, safePitchMaxNote, isSafePitchEnabled } = useSettings();
  const audio = useToneAudio();

  // --- State Management ---
  const [allSetlists, setAllSetlists] = useState<Setlist[]>([]);
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [activeSongForPerformance, setActiveSongForPerformance] = useState<SetlistSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDashboardView, setActiveDashboardView] = useState<'gigs' | 'repertoire'>('gigs');

  // Modals
  const [isSetlistSettingsOpen, setIsSetlistSettingsOpen] = useState(false);
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [isImportSetlistOpen, setIsImportSetlistOpen] = useState(false);
  const [isResourceAuditOpen, setIsResourceAuditOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isSongStudioModalOpen, setIsSongStudioModalOpen] = useState(false);
  const [songStudioModalSongId, setSongStudioModalSongId] = useState<string | null>(null);
  const [songStudioDefaultTab, setSongStudioDefaultTab] = useState<StudioTab | undefined>(undefined);
  const [isKeyManagementOpen, setIsKeyManagementOpen] = useState(false);

  // Setlist Management
  const [newSetlistName, setNewSetlistName] = useState("");
  const [isCreatingSetlist, setIsCreatingSetlist] = useState(false);
  const [renameSetlistId, setRenameSetlistId] = useState<string | null>(null);
  const [renameSetlistName, setNewSetlistNameForRename] = useState("");
  const [deleteSetlistConfirmId, setDeleteSetlistConfirmId] = useState<string | null>(null);

  // SetlistManager Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work'>('none');
  const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Repertoire Exporter states
  const [isRepertoireAutoLinking, setIsRepertoireAutoLinking] = useState(false);
  const [isRepertoireGlobalAutoSyncing, setIsRepertoireGlobalAutoSyncing] = useState(false);
  const [isRepertoireBulkQueuingAudio, setIsRepertoireBulkQueuingAudio] = useState(false);
  const [isRepertoireClearingAutoLinks, setIsRepertoireClearingAutoLinks] = useState(false);

  const [floatingDockMenuOpen, setFloatingDockMenuOpen] = useState(false);

  // --- Derived State ---
  const activeSetlist = useMemo(() =>
    allSetlists.find(list => list.id === activeSetlistId),
  [allSetlists, activeSetlistId]);

  const filteredAndSortedSongs = useMemo(() => {
    if (!activeSetlist) return [];

    let songs = [...activeSetlist.songs];

    // Apply search term
    const q = searchTerm.toLowerCase();
    if (q) {
      songs = songs.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.artist?.toLowerCase().includes(q) ||
        s.user_tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }

    // Apply filters
    songs = songs.filter(s => {
      const readiness = calculateReadiness(s);
      const hasAudio = !!s.audio_url;
      const hasItunesPreview = !!s.previewUrl && (s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'));
      const hasVideo = !!s.youtubeUrl;
      const hasPdf = !!s.pdfUrl || !!s.leadsheetUrl || !!s.sheet_music_url;
      const hasUg = !!s.ugUrl;
      const hasUgChords = !!s.ug_chords_text && s.ug_chords_text.trim().length > 0;

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

      return true;
    });

    // Apply sort mode
    if (sortMode === 'ready') {
      songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    } else if (sortMode === 'work') {
      songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    }

    return songs;
  }, [activeSetlist, searchTerm, sortMode, activeFilters]);

  const missingAudioCount = useMemo(() => {
    if (!activeSetlist) return 0;
    return activeSetlist.songs.filter(s =>
      s.youtubeUrl &&
      (!s.audio_url) &&
      s.extraction_status !== 'queued' && s.extraction_status !== 'processing'
    ).length;
  }, [activeSetlist]);

  const repertoireMissingAudioCount = useMemo(() => {
    return masterRepertoire.filter(s =>
      s.youtubeUrl &&
      (!s.audio_url) &&
      s.extraction_status !== 'queued' && s.extraction_status !== 'processing'
    ).length;
  }, [masterRepertoire]);

  const currentSongHighestNote = useMemo(() => {
    if (!activeSongForPerformance?.highest_note_original) return undefined;
    return activeSongForPerformance.highest_note_original;
  }, [activeSongForPerformance]);

  // --- Data Fetching ---
  const fetchSetlistsAndRepertoire = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch Setlists (just the metadata)
      const { data: setlistsData, error: setlistsError } = await supabase
        .from('setlists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (setlistsError) {
        console.error("[Index] Supabase Setlists Fetch Error:", setlistsError);
        console.error("[Index] Full Setlists Error Object:", JSON.stringify(setlistsError, null, 2)); // Log full error
        if (setlistsError.message.includes("new row violates row-level-security")) {
          showError("Database Security Error: You don't have permission to read setlist data. Check RLS policies.");
        } else {
          showError(`Failed to load setlists: ${setlistsError.message}`);
        }
        throw setlistsError;
      }

      // 2. Fetch Master Repertoire
      const { data: repertoireData, error: repertoireError } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title');

      if (repertoireError) {
        console.error("[Index] Supabase Repertoire Fetch Error:", repertoireError);
        console.error("[Index] Full Repertoire Error Object:", JSON.stringify(repertoireError, null, 2)); // Log full error
        if (repertoireError.message.includes("new row violates row-level-security")) {
          showError("Database Security Error: You don't have permission to read repertoire data. Check RLS policies.");
        } else {
          showError(`Failed to load repertoire: ${repertoireError.message}`);
        }
        throw repertoireError;
      }

      const mappedRepertoire: SetlistSong[] = (repertoireData || []).map(d => ({
        id: d.id,
        master_id: d.id,
        name: d.title,
        artist: d.artist,
        originalKey: d.original_key,
        targetKey: d.target_key,
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
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
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
      }));
      setMasterRepertoire(mappedRepertoire);

      // 3. Fetch Setlist Songs (Junction Table) and Merge
      const setlistsWithSongs: Setlist[] = [];

      for (const setlist of setlistsData || []) {
        // Fetch songs for this setlist from the junction table
        const { data: junctionData, error: junctionError } = await supabase
          .from('setlist_songs')
          .select('*')
          .eq('setlist_id', setlist.id)
          .order('sort_order', { ascending: true });

        if (junctionError) {
          console.warn(`Failed to fetch songs for setlist ${setlist.id}:`, junctionError);
          continue; // Skip this setlist if junction fetch fails
        }

        // Map junction data to full song objects using masterRepertoire
        const songs: SetlistSong[] = junctionData.map(junction => {
          const masterSong = mappedRepertoire.find(r => r.id === junction.song_id);
          
          if (!masterSong) {
            console.warn(`Master song not found for junction entry: ${junction.song_id}`);
            return null; // Will be filtered out
          }

          // Return a merged object: properties from master, but with the junction's ID
          return {
            ...masterSong,
            id: junction.id, // Use the junction ID for the setlist entry
            master_id: masterSong.id, // Keep reference to master
            isplayed: junction.isplayed || false, // Use junction-specific data if available
            // Ensure other junction-specific fields are mapped if they exists
          };
        }).filter(Boolean) as SetlistSong[]; // Filter out nulls

        setlistsWithSongs.push({
          id: setlist.id,
          name: setlist.name,
          songs: songs,
          time_goal: setlist.time_goal
        });
      }

      setAllSetlists(setlistsWithSongs);

      // Set active setlist
      let initialSetlistId = setlistsWithSongs[0]?.id || null;
      const savedSetlistId = localStorage.getItem('active_setlist_id');
      if (savedSetlistId && setlistsWithSongs.some(s => s.id === savedSetlistId)) {
        initialSetlistId = savedSetlistId;
      }
      setActiveSetlistId(initialSetlistId);

    } catch (err: any) {
      console.error("Error fetching data:", err);
      showError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchSetlistsAndRepertoire();
    } else if (!authLoading && !user) {
      navigate('/landing');
    }
  }, [user, authLoading, fetchSetlistsAndRepertoire, navigate]);

  // NEW: Supabase Realtime Subscription for repertoire changes
  useEffect(() => {
    if (!user) return;

    const repertoireChannel = supabase
      .channel('repertoire_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'repertoire', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updatedSong = payload.new as SetlistSong;
          if (updatedSong.extraction_status && (updatedSong.extraction_status === 'completed' || updatedSong.extraction_status === 'failed')) {
            showSuccess(`Repertoire updated for "${updatedSong.name}"`);
            fetchSetlistsAndRepertoire(); // Re-fetch all data to ensure consistency
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(repertoireChannel);
    };
  }, [user, fetchSetlistsAndRepertoire]);


  // --- FIX: Clear active song for performance on setlist change or initial load ---
  useEffect(() => {
    setActiveSongForPerformance(null); // Always clear when activeSetlist changes or on initial load
  }, [activeSetlist]);

  // Load audio for active song for performance
  useEffect(() => {
    // Only load audio if a song is selected for performance AND it has a preview URL
    if (activeSongForPerformance && (activeSongForPerformance.audio_url || activeSongForPerformance.previewUrl)) {
      const urlToLoad = activeSongForPerformance.audio_url || activeSongForPerformance.previewUrl;
      audio.loadFromUrl(urlToLoad, activeSongForPerformance.pitch || 0, true);
    } else {
      audio.stopPlayback();
      audio.resetEngine();
    }
  }, [activeSongForPerformance?.audio_url, activeSongForPerformance?.previewUrl, activeSongForPerformance?.pitch]);

  // --- FIX: Remove persistence of active song for performance on refresh ---
  useEffect(() => {
    if (activeSetlistId) {
      localStorage.setItem('active_setlist_id', activeSetlistId);
    }
    // Removed: localStorage.setItem(`active_song_id_${activeSetlist.id}`, activeSongForPerformance.id);
  }, [activeSetlistId]);

  // --- Setlist Management Handlers ---
  const handleSelectSetlist = (id: string) => {
    setActiveSetlistId(id);
    audio.stopPlayback();
  };

  const handleCreateSetlist = async () => {
    if (!user || !newSetlistName.trim()) return;
    setIsCreatingSetlist(true);
    try {
      const { data, error } = await supabase
        .from('setlists')
        .insert([{ user_id: user.id, name: newSetlistName.trim(), songs: [] }])
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

  const handleRenameSetlist = async (id: string) => {
    if (!user || !renameSetlistName.trim() || !renameSetlistId) return;
    try {
      const { error } = await supabase
        .from('setlists')
        .update({ name: renameSetlistName.trim() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      setAllSetlists(prev => prev.map(s => s.id === id ? { ...s, name: renameSetlistName } : s));
      showSuccess("Setlist Renamed!");
      setRenameSetlistId(null);
      setNewSetlistNameForRename("");
      setIsSetlistSettingsOpen(false);
    } catch (err: any) {
      showError(`Failed to rename setlist: ${err.message}`);
    }
  };

  const handleDeleteSetlist = async (id: string) => {
    if (!user || !id) return;
    try {
      const { error } = await supabase
        .from('setlists')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

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

  // --- Song Management Handlers ---
  const handleRemoveSongFromSetlist = async (songIdToRemove: string) => {
    if (!user || !activeSetlist) return;
    try {
      // Delete from junction table
      const { error } = await supabase
        .from('setlist_songs')
        .delete()
        .eq('id', songIdToRemove);

      if (error) throw error;
      
      // Update local state
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
    // --- FIX: Persist active song only when explicitly selected ---
    if (activeSetlist) {
      localStorage.setItem(`active_song_id_${activeSetlist.id}`, song.id);
    }
  };

  const handleEditSong = (song: SetlistSong, defaultTab?: StudioTab) => {
    // Stop audio playback when opening the studio
    audio.stopPlayback();
    setSongStudioModalSongId(song.master_id || song.id); // Use master_id for studio
    setIsSongStudioModalOpen(true);
    setSongStudioDefaultTab(defaultTab || 'audio');
  };

  const handleUpdateSongInSetlist = async (junctionIdToUpdate: string, updates: Partial<SetlistSong>) => {
    if (!user || !activeSetlist) return;

    // 1. Find the junction song in the current active setlist
    const junctionSong = activeSetlist.songs.find(s => s.id === junctionIdToUpdate);
    if (!junctionSong) {
      console.error("[Index] handleUpdateSongInSetlist: Junction song not found for ID:", junctionIdToUpdate);
      showError("Failed to update song: Junction entry not found.");
      return;
    }

    // 2. Get the master_id from the junction song
    const masterSongId = junctionSong.master_id;
    if (!masterSongId) {
      console.error("[Index] handleUpdateSongInSetlist: Master ID missing for junction song:", junctionIdToUpdate);
      showError("Failed to update song: Master record ID is missing.");
      return;
    }

    // 3. Find the current master song from the masterRepertoire
    const currentMasterSong = masterRepertoire.find(s => s.id === masterSongId);
    if (!currentMasterSong) {
      console.error("[Index] handleUpdateSongInSetlist: Master song not found in repertoire for ID:", masterSongId);
      showError("Failed to update song: Master record not found in library.");
      return;
    }

    // 4. Merge current master song state with new updates
    const mergedUpdatesForMaster = { ...currentMasterSong, ...updates } as SetlistSong;

    try {
      // 5. Update the master repertoire and get the fully synced song back
      // This will correctly trigger an UPDATE in 'repertoire' because mergedUpdatesForMaster.master_id is present.
      const syncedMasterSongs = await syncToMasterRepertoire(user.id, [mergedUpdatesForMaster]);
      const fullySyncedMasterSong = syncedMasterSongs[0];

      // 6. Update local master repertoire state
      setMasterRepertoire(prev => prev.map(s => s.id === fullySyncedMasterSong.id ? fullySyncedMasterSong : s));

      // 7. Update the song in the active setlist using the fully synced master song's data
      const updatedSetlistSongs = activeSetlist.songs.map(s =>
        s.id === junctionIdToUpdate ? { ...s, ...fullySyncedMasterSong } : s // Update the specific junction entry
      );

      // 8. Update the setlist_songs table for any junction-specific fields (like isplayed)
      const { error: junctionUpdateError } = await supabase
        .from('setlist_songs')
        .update({ 
          isplayed: updates.isplayed !== undefined ? updates.isplayed : junctionSong.isplayed
        })
        .eq('id', junctionIdToUpdate);

      if (junctionUpdateError) throw junctionUpdateError;

      // 9. Update local allSetlists state
      setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: updatedSetlistSongs } : s));
      
      // 10. Update active song for performance if it matches
      if (activeSongForPerformance?.id === junctionIdToUpdate) {
        setActiveSongForPerformance(prev => ({ ...prev!, ...fullySyncedMasterSong }));
      }
      showSuccess("Song updated.");
    } catch (err: any) {
      console.error("[Index] Failed to update song:", err);
      showError(`Failed to update song: ${err.message}`);
    }
  };

  const handleUpdateSongKey = async (songIdToUpdate: string, newTargetKey: string) => {
    if (!user || !activeSetlist) return;

    const songToUpdate = activeSetlist.songs.find(s => s.id === songIdToUpdate);
    if (!songToUpdate) return;

    const newPitch = calculateSemitones(songToUpdate.originalKey || 'C', newTargetKey);

    // Update in master repertoire
    const updatedMasterSong = { ...masterRepertoire.find(s => s.id === songToUpdate.master_id), targetKey: newTargetKey, pitch: newPitch } as SetlistSong;
    await syncToMasterRepertoire(user.id, [updatedMasterSong]);
    setMasterRepertoire(prev => prev.map(s => s.id === songToUpdate.master_id ? updatedMasterSong : s));

    // Update in active setlist
    const updatedSetlistSongs = activeSetlist.songs.map(s =>
      s.id === songIdToUpdate ? { ...s, targetKey: newTargetKey, pitch: newPitch } : s
    );

    try {
      const { error } = await supabase
        .from('setlists')
        .update({ songs: updatedSetlistSongs, updated_at: new Date().toISOString() })
        .eq('id', activeSetlist.id)
        .eq('user.id', user.id); // Corrected to user.id

      if (error) throw error;
      setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: updatedSetlistSongs } : s));
      if (activeSongForPerformance?.id === songIdToUpdate) setActiveSongForPerformance(prev => ({ ...prev!, targetKey: newTargetKey, pitch: newPitch }));
      showSuccess(`Key updated to ${newTargetKey}`);
    } catch (err: any) {
      showError(`Failed to update key: ${err.message}`);
    }
  };

  const handleTogglePlayed = async (songIdToToggle: string) => {
    if (!user || !activeSetlist) return;
    const song = activeSetlist.songs.find(s => s.id === songIdToToggle);
    if (!song) return;

    const updatedSongs = activeSetlist.songs.map(s =>
      s.id === songIdToToggle ? { ...s, isplayed: !s.isplayed } : s
    );

    try {
      // Update junction table
      const { error } = await supabase
        .from('setlist_songs')
        .update({ isplayed: !song.isplayed })
        .eq('id', songIdToToggle);

      if (error) throw error;
      setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: updatedSongs } : s));
      if (activeSongForPerformance?.id === songIdToToggle) setActiveSongForPerformance(prev => ({ ...prev!, isplayed: !prev?.isplayed }));
      showSuccess("Played status updated.");
    } catch (err: any) {
      showError(`Failed to update played status: ${err.message}`);
    }
  };

  const handleAddSongToSetlist = async (songToAdd: SetlistSong) => {
    if (!user || !activeSetlist) return;

    const isAlreadyInSetlist = activeSetlist.songs.some(s =>
      (s.master_id && s.master_id === songToAdd.master_id) || s.id === songToAdd.id
    );
    if (isAlreadyInSetlist) {
      showInfo("Song already in setlist.");
      return;
    }

    // Ensure songToAdd is the latest from masterRepertoire
    const masterVersion = masterRepertoire.find(s => s.id === songToAdd.id || s.master_id === songToAdd.master_id);
    const songToUse = masterVersion || songToAdd;

    // Insert into junction table
    const { error } = await supabase
      .from('setlist_songs')
      .insert({
        setlist_id: activeSetlist.id,
        song_id: songToUse.master_id || songToUse.id,
        sort_order: activeSetlist.songs.length,
        isplayed: false,
        is_confirmed: false
      });

    if (error) {
      showError(`Failed to add song: ${error.message}`);
      return;
    }

    // Refetch to get the new junction ID and ensure consistency
    await fetchSetlistsAndRepertoire();
    showSuccess(`Added "${songToAdd.name}" to setlist.`);
    setIsRepertoirePickerOpen(false);
    setIsImportSetlistOpen(false);
  };

  const handleReorderSongs = async (newSongs: SetlistSong[]) => {
    if (!user || !activeSetlist) return;
    try {
      // Update sort_order for each song in the junction table
      const updates = newSongs.map((song, index) => ({
        id: song.id,
        sort_order: index
      }));

      // We can't do a bulk update easily with supabase-js for multiple rows with different IDs
      // So we'll do sequential updates or a loop
      for (const update of updates) {
        const { error } = await supabase
          .from('setlist_songs')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
        if (error) throw error;
      }

      setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: newSongs } : s));
      showSuccess("Setlist reordered.");
    } catch (err: any) {
      showError(`Failed to reorder songs: ${err.message}`);
    }
  };

  // --- Repertoire Exporter Handlers (for Repertoire tab) ---
  const handleRepertoireAutoLink = async () => {
    if (!user) return;
    setIsRepertoireAutoLinking(true);
    showInfo("Initiating AI discovery for missing YouTube links in repertoire...");

    const songsToProcess = masterRepertoire.filter(s => !s.youtubeUrl || s.youtubeUrl.trim() === '');
    if (songsToProcess.length === 0) {
      showInfo("All repertoire songs already have YouTube links.");
      setIsRepertoireAutoLinking(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('bulk-populate-youtube-links', {
        body: { songIds: songsToProcess.map(s => s.id) }
      });

      if (error) throw error;

      const updatedRepertoire = masterRepertoire.map(s => {
        const result = data.results.find((r: any) => r.song_id === s.id);
        if (result && result.status === 'SUCCESS') {
          return {
            ...s,
            youtubeUrl: result.youtube_url as string | undefined,
            metadata_source: 'auto_populated',
            sync_status: 'COMPLETED' as SetlistSong['sync_status']
          };
        }
        return s;
      });

      setMasterRepertoire(updatedRepertoire);
      showSuccess("AI Discovery Complete for Repertoire!");
    } catch (err: any) {
      showError(`AI Discovery Failed for Repertoire: ${err.message}`);
    } finally {
      setIsRepertoireAutoLinking(false);
    }
  };

  const handleRepertoireGlobalAutoSync = async () => {
    if (!user) return;
    setIsRepertoireGlobalAutoSyncing(true);
    showInfo("Initiating global metadata sync with iTunes for repertoire...");

    try {
      const { data, error } = await supabase.functions.invoke('global-auto-sync', {
        body: { songIds: masterRepertoire.map(s => s.id) }
      });

      if (error) throw error;

      const updatedRepertoire = masterRepertoire.map(s => {
        const result = data.results.find((r: any) => r.id === s.id);
        if (result && result.status === 'SUCCESS') {
          return {
            ...s,
            name: result.title as string,
            artist: result.artist as string,
            genre: result.primaryGenreName as string | undefined,
            appleMusicUrl: result.trackViewUrl as string | undefined,
            metadata_source: 'itunes_autosync',
            auto_synced: true,
            sync_status: 'COMPLETED' as SetlistSong['sync_status']
          };
        }
        return s;
      });

      setMasterRepertoire(updatedRepertoire);
      showSuccess("Global Auto-Sync Complete for Repertoire!");
    } catch (err: any) {
      showError(`Global Auto-Sync Failed for Repertoire: ${err.message}`);
    } finally {
      setIsRepertoireGlobalAutoSyncing(false);
    }
  };

  const handleRepertoireBulkRefreshAudio = async () => {
    if (!user) return;
    setIsRepertoireBulkQueuingAudio(true);
    showInfo("Queueing background audio extraction for missing repertoire tracks...");

    const songsToQueue = masterRepertoire.filter(s =>
      s.youtubeUrl &&
      (!s.audio_url) &&
      s.extraction_status !== 'queued' && s.extraction_status !== 'processing'
    );

    if (songsToQueue.length === 0) {
      showInfo("No repertoire tracks found missing master audio to queue.");
      setIsRepertoireBulkQueuingAudio(false);
      return;
    }

    try {
      const songIdsToQueue = songsToQueue.map(s => s.id);
      const { error } = await supabase
        .from('repertoire')
        .update({ extraction_status: 'queued' as SetlistSong['extraction_status'], last_sync_log: 'Queued for background audio extraction.' })
        .in('id', songIdsToQueue);

      if (error) throw error;

      // Update local repertoire state to reflect queued status
      const updatedRepertoire = masterRepertoire.map(s =>
        songIdsToQueue.includes(s.id) ? { ...s, extraction_status: 'queued' as SetlistSong['extraction_status'], last_sync_log: 'Queued for background audio extraction.' } : s
      );
      setMasterRepertoire(updatedRepertoire);

      showSuccess(`Queued ${songsToQueue.length} repertoire audio extraction tasks.`);
    } catch (err: any) {
      showError(`Failed to queue repertoire audio extraction: ${err.message}`);
    } finally {
      setIsRepertoireBulkQueuingAudio(false);
    }
  };

  const handleRepertoireClearAutoLinks = async () => {
    if (!user) return;
    setIsRepertoireClearingAutoLinks(true);
    showInfo("Clearing auto-populated YouTube links in repertoire...");

    const autoPopulatedSongs = masterRepertoire.filter(s => s.metadata_source === 'auto_populated');
    if (autoPopulatedSongs.length === 0) {
      showInfo("No auto-populated links found in repertoire.");
      setIsRepertoireClearingAutoLinks(false);
      return;
    }

    try {
      const songIdsToClear = autoPopulatedSongs.map(s => s.id);
      const { error } = await supabase
        .from('repertoire')
        .update({
          youtube_url: null,
          metadata_source: null,
          sync_status: 'IDLE' as SetlistSong['sync_status'],
          last_sync_log: 'Cleared auto-populated link'
        })
        .in('id', songIdsToClear);

      if (error) throw error;

      // Update local repertoire state
      const updatedRepertoire = masterRepertoire.map(s =>
        songIdsToClear.includes(s.id) ? { ...s, youtubeUrl: undefined, metadata_source: null, sync_status: 'IDLE' as SetlistSong['sync_status'], last_sync_log: 'Cleared auto-populated link' } : s
      );
      setMasterRepertoire(updatedRepertoire);

      showSuccess("Repertoire auto-populated links cleared!");
    } catch (err: any) {
      showError(`Failed to clear repertoire auto-links: ${err.message}`);
    } finally {
      setIsRepertoireClearingAutoLinks(false);
    }
  };

  const handleUpdateSetlistSongs = useCallback(async (
    setlistId: string,
    songToUpdate: SetlistSong,
    action: 'add' | 'remove'
  ) => {
    const targetSetlist = allSetlists.find(l => l.id === setlistId);
    if (!targetSetlist) {
      console.error(`[Index] Setlist with ID ${setlistId} not found for update.`);
      return;
    }

    if (action === 'add') {
      const isAlreadyInList = targetSetlist.songs.some(s =>
        (s.master_id && s.master_id === songToUpdate.master_id) ||
        s.id === songToUpdate.id
      );
      if (!isAlreadyInList) {
        // Insert into junction table
        const { error } = await supabase
          .from('setlist_songs')
          .insert({
            setlist_id: setlistId,
            song_id: songToUpdate.master_id || songToUpdate.id,
            sort_order: targetSetlist.songs.length,
            isplayed: false,
            is_confirmed: false
          });
        if (error) {
          console.error("Failed to add to setlist:", error);
          showError(`Failed to add to setlist: ${error.message}`);
          return;
        }
      }
    } else if (action === 'remove') {
      // Find the junction ID for this song in this setlist
      const junctionSong = targetSetlist.songs.find(s =>
        (s.master_id && s.master_id === songToUpdate.master_id) || s.id === songToUpdate.id
      );
      if (junctionSong) {
        const { error } = await supabase
          .from('setlist_songs')
          .delete()
          .eq('id', junctionSong.id);
        if (error) {
          console.error("Failed to remove from setlist:", error);
          showError(`Failed to remove from setlist: ${error.message}`);
          return;
        }
      }
    }

    // Refetch to ensure consistency
    await fetchSetlistsAndRepertoire();
    showSuccess(`Setlist "${targetSetlist.name}" updated.`);
  }, [allSetlists, fetchSetlistsAndRepertoire]);

  const handleUpdateMasterKey = useCallback(async (songId: string, updates: { originalKey?: string | null, targetKey?: string | null, pitch?: number }) => {
    if (!user) return;
    
    const currentMasterSong = masterRepertoire.find(s => s.id === songId);
    if (!currentMasterSong) {
      showError("Master song record not found.");
      return;
    }

    // Merge current master song state with new updates
    const mergedUpdatesForMaster = { ...currentMasterSong, ...updates } as SetlistSong;

    try {
      // 1. Update the master repertoire and get the fully synced song back
      const syncedSongs = await syncToMasterRepertoire(user.id, [mergedUpdatesForMaster]);
      const fullySyncedMasterSong = syncedSongs[0];

      // 2. Update local master repertoire state
      setMasterRepertoire(prev => prev.map(s => s.id === songId ? fullySyncedMasterSong : s));

      // 3. Update all setlists that contain this master song
      const masterId = fullySyncedMasterSong.master_id || fullySyncedMasterSong.id;
      
      const updatedSetlists = allSetlists.map(setlist => {
        const updatedSongs = setlist.songs.map(s =>
          (s.master_id === masterId || s.id === masterId) ? { ...s, ...fullySyncedMasterSong } : s
        );
        return { ...setlist, songs: updatedSongs };
      });
      
      setAllSetlists(updatedSetlists);
      
      // 4. Update active song for performance if it matches
      if (activeSongForPerformance?.master_id === masterId || activeSongForPerformance?.id === masterId) {
        setActiveSongForPerformance(fullySyncedMasterSong);
      }

    } catch (err: any) {
      console.error("Failed to update master key:", err);
      throw new Error(`Failed to update key: ${err.message}`);
    }
  }, [user, masterRepertoire, allSetlists, activeSongForPerformance]);

  const handleRefreshRepertoire = useCallback(() => {
    fetchSetlistsAndRepertoire();
  }, [fetchSetlistsAndRepertoire]);

  const handleOpenReader = useCallback((initialSongId?: string) => {
    sessionStorage.setItem('from_dashboard', 'true');
    if (initialSongId) {
      navigate(`/sheet-reader/${initialSongId}`);
    } else if (activeSongForPerformance) {
      navigate(`/sheet-reader/${activeSongForPerformance.id<dyad-problem-report summary="2 problems">
<problem file="src/pages/SheetReaderMode.tsx" line="258" column="9" code="1117">An object literal cannot have multiple properties with the same name.</problem>
<problem file="src/components/SheetReaderMode.tsx" line="459" column="11" code="2561">Object literal may only specify known properties, but 'isPlayed' does not exist in type 'SetlistSong'. Did you mean to write 'isplayed'?</problem>
</dyad-problem-report><think>**Pinpointing TypeScript Issues**

I'm currently focused on the double-definition of the `pitch` property within the `mappedRepertoire` object, as reported by the first TypeScript error. I need to identify the redundant instance and understand why it's there. This involves tracing the object's construction and examining the data flow.


**Analyzing Type Conflicts**

I've identified the root of the double-definition error in `SheetReaderMode.tsx`: `pitch` appears twice within the `mappedRepertoire` literal.  My next step is pinpointing the redundant instance for removal. Meanwhile, I've confirmed the "isPlayed" casing mismatch in `SetlistSong` within `SheetReaderMode.tsx`.  I'll correct the casing in the code.


</think>You're right, let's get these TypeScript errors sorted out!

1.  The "An object literal cannot have multiple properties with the same name" error for `pitch` in `src/pages/SheetReaderMode.tsx` means `pitch` was accidentally included twice in the `mappedRepertoire` object. I've removed the duplicate.
2.  The `isPlayed` error in `src/components/SheetReaderMode.tsx` is another casing issue. I've changed it to `isplayed` to match the correct property name.

<dyad-write path="src/pages/SheetReaderMode.tsx" description="Removed duplicate 'pitch' property and corrected 'isPlayed' to 'isplayed'.">
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button'; // Fixed: Corrected import syntax
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
import SheetReaderSidebar from '@/components/SheetReaderSidebar'; // NEW: Import Sidebar
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // NEW: Sidebar state

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
      if (updates.name !== undefined) dbUpdates.title = updates.name || 'Untitled Track'; // Ensure title is never null
      if (updates.artist !== undefined) dbUpdates.artist = updates.artist || 'Unknown Artist'; // Ensure artist is never null
      if (updates.previewUrl !== undefined) dbUpdates.preview_url = updates.previewUrl; else if (updates.previewUrl === null) dbUpdates.preview_url = null;
      if (updates.youtubeUrl !== undefined) dbUpdates.youtube_url = updates.youtubeUrl; else if (updates.youtubeUrl === null) dbUpdates.youtube_url = null;
      if (updates.ugUrl !== undefined) dbUpdates.ug_url = updates.ugUrl; else if (updates.ugUrl === null) dbUpdates.ug_url = null;
      if (updates.appleMusicUrl !== undefined) dbUpdates.apple_music_url = updates.appleMusicUrl; else if (updates.appleMusicUrl === null) dbUpdates.apple_music_url = null;
      if (updates.pdfUrl !== undefined) dbUpdates.pdf_url = updates.pdfUrl; else if (updates.pdfUrl === null) dbUpdates.pdf_url = null;
      if (updates.leadsheetUrl !== undefined) dbUpdates.leadsheet_url = updates.leadsheetUrl; else if (updates.leadsheetUrl === null) dbUpdates.leadsheet_url = null;
      if (updates.originalKey !== undefined) dbUpdates.original_key = updates.originalKey; else if (updates.originalKey === null) dbUpdates.original_key = null;
      if (updates.targetKey !== undefined) dbUpdates.target_key = updates.targetKey; else if (updates.targetKey === null) dbUpdates.target_key = null;
      if (updates.pitch !== undefined) dbUpdates.pitch = updates.pitch; else if (updates.pitch === null) dbUpdates.pitch = 0; // pitch is NOT NULL with default 0
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
      if (updates.ug_chords_config !== undefined) dbUpdates.ug_chords_config = updates.ug_chords_config; else if (updates.ug_chords_config === null) dbUpdates.ug_chords_config = null; // Send null if not explicitly set
      if (updates.is_ug_chords_present !== undefined) dbUpdates.is_ug_chords_present = updates.is_ug_chords_present; else if (updates.is_ug_chords_present === null) dbUpdates.is_ug_chords_present = false;
      if (updates.highest_note_original !== undefined) dbUpdates.highest_note_original = updates.highest_note_original; else if (updates.highest_note_original === null) dbUpdates.highest_note_original = null;
      if (updates.metadata_source !== undefined) dbUpdates.metadata_source = updates.metadata_source; else if (updates.metadata_source === null) dbUpdates.metadata_source = null;
      if (updates.sync_status !== undefined) dbUpdates.sync_status = updates.sync_status; else if (updates.sync_status === null) dbUpdates.sync_status = 'IDLE';
      if (updates.last_sync_log !== undefined) dbUpdates.last_sync_log = updates.last_sync_log; else if (updates.last_sync_log === null) dbUpdates.last_sync_log = null;
      if (updates.auto_synced !== undefined) dbUpdates.auto_synced = updates.auto_synced; else if (updates.auto_synced === null) dbUpdates.auto_synced = false;
      if (updates.is_sheet_verified !== undefined) dbUpdates.is_sheet_verified = updates.is_sheet_verified; else if (updates.is_sheet_verified === null) dbUpdates.is_sheet_verified = false;
      if (updates.sheet_music_url !== undefined) dbUpdates.sheet_music_url = updates.sheet_music_url; else if (updates.sheet_music_url === null) dbUpdates.sheet_music_url = null;
      if (updates.extraction_status !== undefined) dbUpdates.extraction_status = updates.extraction_status; else if (updates.extraction_status === null) dbUpdates.extraction_status = 'idle'; // NEW: Default to 'idle'
      
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
            // Check for RLS specific error message
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

      const mappedRepertoire: SetlistSong[] = (data || []).map((d) => ({
        id: d.id,
        master_id: d.id,
        name: d.title,
        artist: d.artist,
        originalKey: d.original_key,
        targetKey: d.target_key,
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
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
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
      }));

      const readableAndApprovedSongs = mappedRepertoire.filter(s => {
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
          id: crypto.randomUUID(), // Generate new ID for setlist entry
          master_id: songToUpdate.master_id || songToUpdate.id,
          isplayed: false, // <-- Fixed here
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

  // Fixed: Define handleSelectSongByIndex
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

  const isChartLoading = !currentChartState?.isLoaded;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white">
      
      {/* Sidebar */}
      <motion.div
        initial={{ x: isSidebarOpen ? 0 : -300 }}
        animate={{ x: isSidebarOpen ? 0 : -300 }}
        transition={{ duration: 0.3 }}
        className="h-full w-[300px] shrink-0 z-50"
      >
        <SheetReaderSidebar 
          songs={allSongs} 
          currentIndex={currentIndex} 
          onSelectSong={handleSelectSongByIndex} 
        />
      </motion.div>

      <main className="flex-1 flex flex-col overflow-hidden relative">
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
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
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
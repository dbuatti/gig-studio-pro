"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useSettings } from '@/hooks/use-settings';
import { showSuccess, showError, showInfo, showWarning } from '@/utils/toast'; // Added showWarning
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
import PerformanceOverlay from '@/components/PerformanceOverlay'; // Import PerformanceOverlay

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { keyPreference: globalKeyPreference, safePitchMaxNote, isSafePitchEnabled, isFetchingSettings } = useSettings(); // Use loading state from useSettings
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
  const [isPerformanceOverlayOpen, setIsPerformanceOverlayOpen] = useState(false); // NEW: State for PerformanceOverlay

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
            isPlayed: junction.isPlayed || false, // Use junction-specific data if available
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
    console.log("[Index] activeSetlist changed or initial load. Clearing activeSongForPerformance.");
    setActiveSongForPerformance(null); // Always clear when activeSetlist changes or on initial load
  }, [activeSetlist]);

  // Load audio for active song for performance
  useEffect(() => {
    console.log("[Index] activeSongForPerformance or its audio properties changed.");
    // Only load audio if a song is selected for performance AND it has a preview URL
    if (activeSongForPerformance && (activeSongForPerformance.audio_url || activeSongForPerformance.previewUrl)) {
      const urlToLoad = activeSongForPerformance.audio_url || activeSongForPerformance.previewUrl;
      console.log(`[Index] Attempting to load audio for '${activeSongForPerformance.name}' from URL:`, urlToLoad);
      audio.loadFromUrl(urlToLoad, activeSongForPerformance.pitch || 0, true);
    } else {
      console.log("[Index] No activeSongForPerformance or valid audio URL. Stopping/resetting audio engine.");
      audio.stopPlayback();
      audio.resetEngine();
    }
  }, [activeSongForPerformance?.audio_url, activeSongForPerformance?.previewUrl, activeSongForPerformance?.pitch, audio]);

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

      // 8. Update the setlist_songs table for any junction-specific fields (like isPlayed)
      const { error: junctionUpdateError } = await supabase
        .from('setlist_songs')
        .update({ 
          isPlayed: updates.isPlayed !== undefined ? updates.isPlayed : junctionSong.isPlayed
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
        .eq('user_id', user.id);

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
      s.id === songIdToToggle ? { ...s, isPlayed: !s.isPlayed } : s
    );

    try {
      // Update junction table
      const { error } = await supabase
        .from('setlist_songs')
        .update({ isPlayed: !song.isPlayed })
        .eq('id', songIdToToggle);

      if (error) throw error;
      setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: updatedSongs } : s));
      if (activeSongForPerformance?.id === songIdToToggle) setActiveSongForPerformance(prev => ({ ...prev!, isPlayed: !prev?.isPlayed }));
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
        isPlayed: false,
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
            isPlayed: false,
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
      const syncedMasterSongs = await syncToMasterRepertoire(user.id, [mergedUpdatesForMaster]);
      const fullySyncedMasterSong = syncedMasterSongs[0];

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
      navigate(`/sheet-reader/${activeSongForPerformance.id}`);
    } else if (filteredAndSortedSongs.length > 0) {
      navigate(`/sheet-reader/${filteredAndSortedSongs[0].id}`);
    } else {
      showError("No songs available to open in reader mode.");
    }
  }, [navigate, activeSongForPerformance, filteredAndSortedSongs]);

  // NEW: Handle opening Performance Overlay
  const handleOpenPerformanceOverlay = useCallback(() => {
    console.log("[Index] handleOpenPerformanceOverlay called.");
    console.log("[Index] Current activeSetlist:", activeSetlist);
    console.log("[Index] Current activeSongForPerformance:", activeSongForPerformance);

    if (!activeSetlist || activeSetlist.songs.length === 0) {
      showWarning("Please select a setlist with songs to enter performance mode.");
      console.log("[Index] No active setlist or empty setlist. Cannot open performance overlay.");
      return;
    }
    // Set the first song as active for performance if none is already selected
    if (!activeSongForPerformance) {
      const firstSong = activeSetlist.songs[0];
      setActiveSongForPerformance(firstSong);
      console.log("[Index] No active song for performance, setting first song:", firstSong);
    } else {
      console.log("[Index] activeSongForPerformance already set:", activeSongForPerformance);
    }
    setIsPerformanceOverlayOpen(true);
    console.log("[Index] Setting isPerformanceOverlayOpen to true.");
  }, [activeSetlist, activeSongForPerformance]);

  const handleSafePitchToggle = useCallback((active: boolean, safePitch: number) => {
    // NEW: Only apply safe pitch logic if the feature is enabled in preferences
    if (!isSafePitchEnabled) {
      return;
    }

    if (!activeSongForPerformance) return;
    if (active) {
      const currentPitch = activeSongForPerformance.pitch || 0;
      if (currentPitch > safePitch) {
        const newPitch = safePitch;
        const newTargetKey = activeSongForPerformance.originalKey ? transposeKey(activeSongForPerformance.originalKey, newPitch) : activeSongForPerformance.targetKey;
        handleUpdateSongInSetlist(activeSongForPerformance.id, { pitch: newPitch, targetKey: newTargetKey });
        showInfo(`Pitch adjusted to ${newPitch} ST to stay within safe range.`);
      }
    } else {
      // No toast needed for deactivation
    }
  }, [activeSongForPerformance, handleUpdateSongInSetlist, isSafePitchEnabled]);

  if (loading || authLoading || isFetchingSettings) { // Show loading if useSettings is still fetching
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
      </div>
    );
  }

  const hasPlayableSong = !!activeSongForPerformance?.audio_url || !!activeSongForPerformance?.previewUrl;
  const hasReadableChart = !!activeSongForPerformance && (!!activeSongForPerformance.pdfUrl || !!activeSongForPerformance.leadsheetUrl || !!activeSongForPerformance.ugUrl || !!activeSongForPerformance.ug_chords_text);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      {/* Main Content Area */}
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
              onClick={() => setIsKeyManagementOpen(true)}
              className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"
            >
              <Hash className="w-3.5 h-3.5" /> Key Matrix
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResourceAuditOpen(true)}
              className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"
            >
              <AlertCircle className="w-3.5 h-3.5" /> Audit Matrix
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreferencesOpen(true)}
              className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"
            >
              <Settings2 className="w-3.5 h-3.5" /> Preferences
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUserGuideOpen(true)}
              className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5" /> Guide
            </Button>
          </div>
        </div>

        {/* Active Song Banner (only for Gigs tab) */}
        {activeDashboardView === 'gigs' && activeSongForPerformance && (
          <ActiveSongBanner
            song={activeSongForPerformance}
            isPlaying={audio.isPlaying}
            onTogglePlayback={audio.togglePlayback}
            onClear={() => { setActiveSongForPerformance(null); audio.stopPlayback(); }}
            isLoadingAudio={audio.isLoadingAudio}
          />
        )}

        {/* NEW: Tabs for Gigs and Repertoire */}
        <Tabs value={activeDashboardView} onValueChange={(value) => setActiveDashboardView(value as 'gigs' | 'repertoire')} className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-900 p-1 rounded-xl mb-6">
            <TabsTrigger value="gigs" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg">
              <ListMusic className="w-4 h-4" /> Gigs
            </TabsTrigger>
            <TabsTrigger value="repertoire" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg">
              <Library className="w-4 h-4" /> Repertoire
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gigs" className="mt-0 space-y-8">
            {/* Setlist Selector & Actions */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <SetlistSelector
                setlists={allSetlists}
                currentId={activeSetlistId || ''}
                onSelect={handleSelectSetlist}
                onCreate={() => {
                  setNewSetlistName("");
                  setIsCreatingSetlist(true);
                }}
                onDelete={(id) => setDeleteSetlistConfirmId(id)}
              />
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRepertoirePickerOpen(true)}
                  className="h-10 px-6 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Add from Library
                </Button>
                <ImportSetlist
                  isOpen={isImportSetlistOpen}
                  onClose={() => setIsImportSetlistOpen(false)}
                  onImport={async (songs) => {
                    if (!user || !activeSetlist) return;
                    showInfo(`Importing ${songs.length} songs...`);
                    try {
                      const newSongsWithMasterIds = await syncToMasterRepertoire(user.id, songs);
                      
                      // Insert into junction table
                      const junctionInserts = newSongsWithMasterIds.map((s, index) => ({
                        setlist_id: activeSetlist.id,
                        song_id: s.master_id || s.id,
                        sort_order: activeSetlist.songs.length + index,
                        isPlayed: false,
                        is_confirmed: false
                      }));

                      const { error } = await supabase
                        .from('setlist_songs')
                        .insert(junctionInserts);

                      if (error) throw error;
                      
                      await fetchSetlistsAndRepertoire();
                      showSuccess("Songs imported and synced!");
                      setIsImportSetlistOpen(false);
                    } catch (err: any) {
                      showError(`Import failed: ${err.message}`);
                    }
                  }}
                />
              </div>
            </div>

            {/* Setlist Stats */}
            <SetlistStats
              songs={activeSetlist?.songs || []}
              goalSeconds={activeSetlist?.time_goal}
              onUpdateGoal={async (newGoal) => {
                if (!user || !activeSetlist) return;
                try {
                  const { error } = await supabase
                    .from('setlists')
                    .update({ time_goal: newGoal })
                    .eq('id', activeSetlist.id)
                    .eq('user_id', user.id); // Corrected to user.id
                  if (error) throw error;
                  setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, time_goal: newGoal } : s));
                  showSuccess("Performance goal updated!");
                } catch (err: any) {
                  showError(`Failed to update goal: ${err.message}`);
                }
              }}
            />

            {/* Setlist Manager */}
            <SetlistManager
              songs={filteredAndSortedSongs}
              onRemove={handleRemoveSongFromSetlist}
              onSelect={handleSelectSongForPlayback}
              onEdit={handleEditSong}
              onUpdateKey={handleUpdateSongKey}
              onTogglePlayed={handleTogglePlayed}
              onLinkAudio={() => {}} // Not directly used here, handled by StudioModal
              onUpdateSong={handleUpdateSongInSetlist}
              onSyncProData={async (song) => {
                if (!user) return;
                showInfo(`Syncing "${song.name}" with Pro Data...`);
                try {
                  const syncedSongs = await syncToMasterRepertoire(user.id, [song]);
                  const updatedSong = syncedSongs[0];
                  setMasterRepertoire(prev => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
                  // Also update in active setlist if present
                  if (activeSetlist) {
                    const updatedSetlistSongs = activeSetlist.songs.map(s =>
                      (s.master_id === updatedSong.id || s.id === updatedSong.id) ? { ...s, ...updatedSong } : s
                    );
                    setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: updatedSetlistSongs } : s));
                  }
                  showSuccess(`"${song.name}" synced with Pro Data.`);
                } catch (err: any) {
                  showError(`Failed to sync Pro Data: ${err.message}`);
                }
              }}
              onReorder={handleReorderSongs}
              currentSongId={activeSongForPerformance?.id}
              onOpenAdmin={() => setIsAdminPanelOpen(true)}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              sortMode={sortMode}
              setSortMode={setSortMode}
              activeFilters={activeFilters}
              setActiveFilters={setActiveFilters}
              showHeatmap={showHeatmap}
              allSetlists={allSetlists}
              onUpdateSetlistSongs={handleUpdateSetlistSongs}
            />
          </TabsContent>

          <TabsContent value="repertoire" className="mt-0 space-y-8">
            {/* Automation Hub (Moved here) */}
            <SetlistExporter
              songs={masterRepertoire}
              onAutoLink={handleRepertoireAutoLink}
              onGlobalAutoSync={handleRepertoireGlobalAutoSync}
              onBulkRefreshAudio={handleRepertoireBulkRefreshAudio}
              onClearAutoLinks={handleRepertoireClearAutoLinks}
              isBulkDownloading={isRepertoireBulkQueuingAudio}
              missingAudioCount={repertoireMissingAudioCount}
              onOpenAdmin={() => setIsAdminPanelOpen(true)}
            />

            <RepertoireView
              repertoire={masterRepertoire}
              onEditSong={handleEditSong}
              allSetlists={allSetlists}
              onUpdateSetlistSongs={handleUpdateSetlistSongs}
              onRefreshRepertoire={handleRefreshRepertoire}
              onAddSong={async (newSong) => {
                if (!user) return;
                try {
                  const syncedSongs = await syncToMasterRepertoire(user.id, [newSong]);
                  const addedSong = syncedSongs[0];
                  setMasterRepertoire(prev => [...prev, addedSong]);
                } catch (err: any) {
                  showError(`Failed to add new song to repertoire: ${err.message}`);
                }
              }}
              // PASS NEW PROPS HERE
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              sortMode={sortMode}
              setSortMode={setSortMode}
              activeFilters={activeFilters}
              setActiveFilters={setActiveFilters}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Command Dock */}
      <FloatingCommandDock
        onOpenSearch={() => {
          setSongStudioModalSongId(null);
          setIsSongStudioModalOpen(true);
          setSongStudioDefaultTab('library');
        }}
        onOpenPractice={() => {}} // Placeholder
        onOpenReader={handleOpenReader}
        onOpenAdmin={() => setIsAdminPanelOpen(true)}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
        onToggleHeatmap={() => setShowHeatmap(prev => !prev)}
        onOpenUserGuide={() => setIsUserGuideOpen(true)}
        showHeatmap={showHeatmap}
        viewMode={activeDashboardView}
        hasPlayableSong={hasPlayableSong}
        hasReadableChart={hasReadableChart}
        isPlaying={audio.isPlaying}
        onTogglePlayback={audio.togglePlayback}
        currentSongHighestNote={currentSongHighestNote}
        currentSongPitch={activeSongForPerformance?.pitch}
        onSafePitchToggle={handleSafePitchToggle}
        activeSongId={activeSongForPerformance?.id}
        onSetMenuOpen={setFloatingDockMenuOpen}
        isMenuOpen={floatingDockMenuOpen}
        onOpenPerformance={handleOpenPerformanceOverlay} // Pass the new handler
      />

      {/* Modals */}
      {/* ... existing AlertDialogs ... */}

      <AlertDialog open={isCreatingSetlist} onOpenChange={setIsCreatingSetlist}>
        <AlertDialogContent className="bg-slate-900 border-white/10 text-white rounded-[2rem]">
          <AlertDialogHeader>
            <div className="bg-indigo-600/10 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-500 mb-4">
              <ListMusic className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Create New Setlist</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Enter a name for your new gig setlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="new-setlist-name" className="sr-only">Setlist Name</Label>
            <Input
              id="new-setlist-name"
              placeholder="E.g., Wedding Gig - July 2024"
              value={newSetlistName}
              onChange={(e) => setNewSetlistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSetlist()}
              className="bg-white/5 border-white/10 text-white h-12 rounded-xl"
            />
          </div>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:text-white font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateSetlist} disabled={!newSetlistName.trim()} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest">Create Setlist</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSetlistConfirmId} onOpenChange={(open) => !open && setDeleteSetlistConfirmId(null)}>
        <AlertDialogContent className="bg-slate-900 border-white/10 text-white rounded-[2rem]">
          <AlertDialogHeader>
            <div className="bg-red-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-red-500 mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Delete Setlist?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This action cannot be undone. All songs in this setlist will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:text-white font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDeleteSetlist(deleteSetlistConfirmId!)} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest">Confirm Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeSetlist && (
        <SetlistSettingsModal
          isOpen={isSetlistSettingsOpen}
          onClose={() => setIsSetlistSettingsOpen(false)}
          setlistId={activeSetlist.id}
          setlistName={activeSetlist.name}
          onDelete={(id) => {
            setDeleteSetlistConfirmId(id);
            setIsSetlistSettingsOpen(false); // Close settings modal to show confirm dialog
          }}
          onRename={(id) => {
            setRenameSetlistId(id);
            setNewSetlistNameForRename(activeSetlist.name);
            // This will open another dialog, so keep settings open or manage flow
          }}
        />
      )}

      {renameSetlistId && (
        <AlertDialog open={!!renameSetlistId} onOpenChange={(open) => !open && setRenameSetlistId(null)}>
          <AlertDialogContent className="bg-slate-900 border-white/10 text-white rounded-[2rem]">
            <AlertDialogHeader>
              <div className="bg-indigo-600/10 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-500 mb-4">
                <ListMusic className="w-6 h-6" />
              </div>
              <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Rename Setlist</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                Enter a new name for your setlist.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="rename-setlist-name" className="sr-only">New Setlist Name</Label>
              <Input
                id="rename-setlist-name"
                placeholder="New Setlist Name"
                value={renameSetlistName}
                onChange={(e) => setNewSetlistNameForRename(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameSetlist(renameSetlistId)}
                className="bg-white/5 border-white/10 text-white h-12 rounded-xl"
              />
            </div>
            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:text-white font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleRenameSetlist(renameSetlistId)} disabled={!renameSetlistName.trim()} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest">Rename</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

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
          if (!user || !activeSetlist) return;
          showInfo(`Importing ${songs.length} songs...`);
          try {
            const newSongsWithMasterIds = await syncToMasterRepertoire(user.id, songs);
            
            // Insert into junction table
            const junctionInserts = newSongsWithMasterIds.map((s, index) => ({
              setlist_id: activeSetlist.id,
              song_id: s.master_id || s.id,
              sort_order: activeSetlist.songs.length + index,
              isPlayed: false,
              is_confirmed: false
            }));

            const { error } = await supabase
              .from('setlist_songs')
              .insert(junctionInserts);

            if (error) throw error;
            
            await fetchSetlistsAndRepertoire();
            showSuccess("Songs imported and synced!");
            setIsImportSetlistOpen(false);
          } catch (err: any) {
            showError(`Import failed: ${err.message}`);
          }
        }}
      />

      <ResourceAuditModal
        isOpen={isResourceAuditOpen}
        onClose={() => setIsResourceAuditOpen(false)}
        songs={masterRepertoire}
        onVerify={async (songId, updates) => {
          if (!user) return;
          const updatedMasterSong = { ...masterRepertoire.find(s => s.id === songId), ...updates } as SetlistSong;
          await syncToMasterRepertoire(user.id, [updatedMasterSong]);
          setMasterRepertoire(prev => prev.map(s => s.id === songId ? updatedMasterSong : s));
          // Also update in active setlist if present
          if (activeSetlist) {
            const updatedSetlistSongs = activeSetlist.songs.map(s =>
              (s.master_id === songId || s.id === songId) ? { ...s, ...updatedMasterSong } : s
            );
            setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: updatedSetlistSongs } : s));
          }
        }}
        onOpenStudio={(id) => {
          setSongStudioModalSongId(id);
          setIsSongStudioModalOpen(true);
          setIsResourceAuditOpen(false);
          setSongStudioDefaultTab('details');
        }}
        onRefreshRepertoire={handleRefreshRepertoire}
      />

      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        onRefreshRepertoire={handleRefreshRepertoire}
      />

      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
      />

      <UserGuideModal
        isOpen={isUserGuideOpen}
        onClose={() => setIsUserGuideOpen(false)}
      />

      {/* NEW: Key Management Modal */}
      <KeyManagementModal
        isOpen={isKeyManagementOpen}
        onClose={() => setIsKeyManagementOpen(false)}
        repertoire={masterRepertoire}
        onUpdateKey={handleUpdateMasterKey}
        keyPreference={globalKeyPreference}
      />

      {songStudioModalSongId && (
        <SongStudioModal
          isOpen={isSongStudioModalOpen}
          onClose={() => { setIsSongStudioModalOpen(false); setSongStudioDefaultTab(undefined); }}
          gigId={activeDashboardView === 'repertoire' ? 'library' : (activeSetlistId || 'library')}
          songId={songStudioModalSongId}
          visibleSongs={activeDashboardView === 'gigs' ? filteredAndSortedSongs : masterRepertoire}
          onSelectSong={(id) => {
            setSongStudioModalSongId(id);
            if (activeDashboardView === 'gigs') {
              const song = filteredAndSortedSongs.find(s => s.id === id);
              if (song) setActiveSongForPerformance(song);
            }
          }}
          allSetlists={allSetlists}
          masterRepertoire={masterRepertoire}
          onUpdateSetlistSongs={handleUpdateSetlistSongs}
          defaultTab={songStudioDefaultTab}
        />
      )}

      {/* NEW: Performance Overlay */}
      {isPerformanceOverlayOpen && activeSetlist && activeSongForPerformance && (
        <PerformanceOverlay
          songs={activeSetlist.songs}
          currentIndex={activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance.id)}
          isPlaying={audio.isPlaying}
          progress={audio.progress}
          duration={audio.duration}
          onTogglePlayback={audio.togglePlayback}
          onNext={() => {
            const nextIndex = (activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance.id) + 1) % activeSetlist.songs.length;
            setActiveSongForPerformance(activeSetlist.songs[nextIndex]);
          }}
          onPrevious={() => {
            const prevIndex = (activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance.id) - 1 + activeSetlist.songs.length) % activeSetlist.songs.length;
            setActiveSongForPerformance(activeSetlist.songs[prevIndex]);
          }}
          onShuffle={() => {
            const shuffledSongs = [...activeSetlist.songs].sort(() => Math.random() - 0.5);
            setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: shuffledSongs } : s));
            setActiveSongForPerformance(shuffledSongs[0]);
          }}
          onClose={() => {
            setIsPerformanceOverlayOpen(false);
            audio.stopPlayback();
          }}
          onUpdateSong={handleUpdateSongInSetlist}
          onUpdateKey={handleUpdateSongKey}
          analyzer={audio.analyzer}
          gigId={activeSetlist.id}
          isLoadingAudio={audio.isLoadingAudio}
        />
      )}
    </div>
  );
};

export default Index;
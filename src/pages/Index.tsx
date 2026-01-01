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
import { Loader2, Plus, ListMusic, Settings2, BookOpen, Search, LayoutDashboard, X, AlertCircle, CloudDownload, AlertTriangle, Library, Hash, Music } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { keyPreference: globalKeyPreference, safePitchMaxNote, isSafePitchEnabled, isFetchingSettings, isGoalTrackerEnabled } = useSettings();
  const audio = useToneAudio();

  const [allSetlists, setAllSetlists] = useState<Setlist[]>([]);
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [activeSongForPerformance, setActiveSongForPerformance] = useState<SetlistSong | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Persist dashboard view via URL search param
  const activeDashboardView = (searchParams.get('view') as 'gigs' | 'repertoire') || 'gigs';

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
  const audioTransposerRef = useRef<AudioTransposerRef>(null);

  const [newSetlistName, setNewSetlistName] = useState("");
  const [isCreatingSetlist, setIsCreatingSetlist] = useState(false);
  const [renameSetlistId, setRenameSetlistId] = useState<string | null>(null);
  const [renameSetlistName, setNewSetlistNameForRename] = useState("");
  const [deleteSetlistConfirmId, setDeleteSetlistConfirmId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work'>('none');
  const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Automation States
  const [isRepertoireAutoLinking, setIsRepertoireAutoLinking] = useState(false);
  const [isRepertoireGlobalAutoSyncing, setIsRepertoireGlobalAutoSyncing] = useState(false);
  const [isRepertoireBulkQueuingAudio, setIsRepertoireBulkQueuingAudio] = useState(false);
  const [isRepertoireClearingAutoLinks, setIsRepertoireClearingAutoLinks] = useState(false);

  const [floatingDockMenuOpen, setFloatingDockMenuOpen] = useState(false);

  const userId = user?.id;

  const onOpenAdmin = () => setIsAdminPanelOpen(true);

  const missingAudioCount = useMemo(() => {
    return masterRepertoire.filter(s => {
      const hasLink = !!s.youtubeUrl;
      const hasAudio = !!s.audio_url;
      const status = (s.extraction_status || "").toLowerCase();
      return hasLink && (!hasAudio || status !== 'completed');
    }).length;
  }, [masterRepertoire]);

  const activeSetlist = useMemo(() =>
    allSetlists.find(list => list.id === activeSetlistId),
  [allSetlists, activeSetlistId]);

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
        .eq('user_id', userId)
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
          .order('sort_order', { ascending: true });

        if (junctionError) continue;

        const songs: SetlistSong[] = junctionData.map(junction => {
          const masterSong = mappedRepertoire.find(r => r.id === junction.song_id);
          if (!masterSong) return null;
          return {
            ...masterSong,
            id: junction.id,
            master_id: masterSong.id,
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
      showSuccess(`Added "${songToAdd.name}" to setlist.`);
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
          await supabase.from('setlist_songs').insert({ setlist_id: setlistId, song_id: songToUpdate.master_id || songToUpdate.id, sort_order: targetSetlist.songs.length, isPlayed: false, is_confirmed: false });
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
      
      if (activeSetlist) {
        const { error: junctionError } = await supabase.from('setlist_songs').insert({
          setlist_id: activeSetlist.id,
          song_id: syncedSong.master_id,
          sort_order: activeSetlist.songs.length,
          isPlayed: false,
          is_confirmed: false
        });

        if (junctionError) throw junctionError;
        
        await fetchSetlistsAndRepertoire(false); 
        showSuccess(`"${name}" added to gig.`);
      } else {
        await fetchSetlistsAndRepertoire(false); 
        showSuccess(`"${name}" added to master repertoire.`);
      }
    } catch (err: any) {
      showError(`Import failed: ${err.message || 'Database connection error'}`);
    }
  };

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

  const handleBulkClearAutoLinks = async () => {
    const autoPopulated = masterRepertoire.filter(s => s.metadata_source === 'auto_populated');
    if (autoPopulated.length === 0) {
      showInfo("No auto-populated links found to clear.");
      return;
    }

    if (!confirm(`Clear ${autoPopulated.length} auto-populated links?`)) return;

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
      showSuccess("Auto-populated links cleared.");
    } catch (err: any) {
      showError(`Clear Failed: ${err.message}`);
    } finally {
      setIsRepertoireClearingAutoLinks(false);
    }
  };

  const handleBulkRefreshAudio = async () => {
    const songsToQueue = masterRepertoire.filter(s => {
      const hasLink = !!s.youtubeUrl;
      const hasAudio = !!s.audio_url;
      const status = (s.extraction_status || "").toLowerCase();
      return hasLink && (!hasAudio || status !== 'completed') && status !== 'processing' && status !== 'queued';
    });

    if (songsToQueue.length === 0) {
      showInfo("No eligible tracks found missing audio.");
      return;
    }

    setIsRepertoireBulkQueuingAudio(true);

    try {
      const { error } = await supabase.from('repertoire').update({ extraction_status: 'queued', last_sync_log: 'Queued via Repertoire Automation Hub.' }).in('id', songsToQueue.map(s => s.id));
      if (error) throw error;
      await fetchSetlistsAndRepertoire();
      showSuccess(`Queued ${songsToQueue.length} extractions.`);
    } catch (err: any) {
      showError(`Queueing Failed: ${err.message}`);
    } finally {
      setIsRepertoireBulkQueuingAudio(false);
    }
  };

  const handleOpenReader = useCallback((initialSongId?: string) => {
    sessionStorage.setItem('from_dashboard', 'true');
    const params = new URLSearchParams();
    if (initialSongId) params.set('id', initialSongId);
    if (activeDashboardView === 'gigs') params.set('filterApproved', 'true');
    navigate(`/sheet-reader/${initialSongId ? initialSongId : ''}?${params.toString()}`);
  }, [navigate, activeDashboardView]);

  const handleOpenPerformanceOverlay = useCallback(() => {
    if (!activeSetlist || activeSetlist.songs.length === 0) {
      showWarning("Please select a setlist with songs.");
      return;
    }
    if (!activeSongForPerformance) setActiveSongForPerformance(activeSetlist.songs[0]);
    setIsPerformanceOverlayOpen(true);
  }, [activeSetlist, activeSongForPerformance]);

  const handleViewChange = (newView: string) => {
    setSearchParams({ view: newView });
    audio.stopPlayback();
  };

  const hasPlayableSong = !!activeSongForPerformance?.audio_url || !!activeSongForPerformance?.previewUrl;
  const hasReadableChart = !!activeSongForPerformance && (!!activeSongForPerformance.pdfUrl || !!activeSongForPerformance.leadsheetUrl || !!activeSongForPerformance.ugUrl || !!activeSongForPerformance.ug_chords_text || !!activeSongForPerformance.sheet_music_url);

  if (loading || authLoading || isFetchingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
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
            <Button variant="outline" size="sm" onClick={() => setIsKeyManagementOpen(true)} className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"><Hash className="w-3.5 h-3.5" /> Key Matrix</Button>
            <Button variant="outline" size="sm" onClick={() => setIsResourceAuditOpen(true)} className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"><AlertCircle className="w-3.5 h-3.5" /> Audit Matrix</Button>
            <Button variant="outline" size="sm" onClick={() => setIsPreferencesOpen(true)} className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"><Settings2 className="w-3.5 h-3.5" /> Preferences</Button>
            <Button variant="outline" size="sm" onClick={() => setIsUserGuideOpen(true)} className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"><BookOpen className="w-3.5 h-3.5" /> Guide</Button>
          </div>
        </div>

        {isGoalTrackerEnabled && <GoalTracker repertoire={masterRepertoire} />}

        {activeDashboardView === 'gigs' && activeSongForPerformance && (
          <ActiveSongBanner song={activeSongForPerformance} isPlaying={audio.isPlaying} onTogglePlayback={audio.togglePlayback} onClear={() => { setActiveSongForPerformance(null); audio.stopPlayback(); }} isLoadingAudio={audio.isLoadingAudio} />
        )}

        <Tabs value={activeDashboardView} onValueChange={handleViewChange} className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-900 p-1 rounded-xl mb-6">
            <TabsTrigger value="gigs" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg"><ListMusic className="w-4 h-4" /> Gigs</TabsTrigger>
            <TabsTrigger value="repertoire" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg"><Library className="w-4 h-4" /> Repertoire</TabsTrigger>
          </TabsList>

          <TabsContent value="gigs" className="mt-0 space-y-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <SetlistSelector setlists={allSetlists} currentId={activeSetlistId || ''} onSelect={handleSelectSetlist} onCreate={() => { setNewSetlistName(""); setIsCreatingSetlist(true); }} onDelete={(id) => setDeleteSetlistConfirmId(id)} />
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Button variant="outline" size="sm" onClick={() => setIsRepertoirePickerOpen(true)} className="h-10 px-6 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"><Plus className="w-3.5 h-3.5" /> Add from Library</Button>
                <ImportSetlist isOpen={isImportSetlistOpen} onClose={() => setIsImportSetlistOpen(false)} onImport={async (songs) => { if (!userId || !activeSetlist) return; try { const newSongs = await syncToMasterRepertoire(userId, songs); const junctionInserts = newSongs.map((s, index) => ({ setlist_id: activeSetlist.id, song_id: s.master_id || s.id, sort_order: activeSetlist.songs.length + index, isPlayed: false, is_confirmed: false })); await supabase.from('setlist_songs').insert(junctionInserts); await fetchSetlistsAndRepertoire(); showSuccess("Imported!"); setIsImportSetlistOpen(false); } catch (err: any) { showError(`Failed: ${err.message}`); } }} />
              </div>
            </div>

            <SetlistStats songs={activeSetlist?.songs || []} goalSeconds={activeSetlist?.time_goal} onUpdateGoal={async (newGoal) => { if (!userId || !activeSetlist) return; try { await supabase.from('setlists').update({ time_goal: newGoal }).eq('id', activeSetlist.id).eq('user_id', userId); setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, time_goal: newGoal } : s)); showSuccess("Goal updated!"); } catch (err: any) { showError(`Failed: ${err.message}`); } }} />
            <SetlistManager songs={filteredAndSortedSongs} onRemove={handleRemoveSongFromSetlist} onSelect={handleSelectSongForPlayback} onEdit={handleEditSong} onUpdateKey={handleUpdateSongKey} onTogglePlayed={handleTogglePlayed} onLinkAudio={() => {}} onUpdateSong={handleUpdateSongInSetlist} onSyncProData={async (song) => { if (!userId) return; try { const synced = await syncToMasterRepertoire(userId, [song]); setMasterRepertoire(prev => prev.map(s => s.id === synced[0].id ? synced[0] : s)); await fetchSetlistsAndRepertoire(); showSuccess("Synced!"); } catch (err: any) { showError(`Failed: ${err.message}`); } }} onReorder={handleReorderSongs} currentSongId={activeSongForPerformance?.id} sortMode={sortMode} setSortMode={setSortMode} activeFilters={activeFilters} setActiveFilters={setActiveFilters} searchTerm={searchTerm} setSearchTerm={setSearchTerm} showHeatmap={showHeatmap} allSetlists={allSetlists} onUpdateSetlistSongs={handleUpdateSetlistSongs} />
          </TabsContent>

          <TabsContent value="repertoire" className="mt-0 space-y-8">
            <RepertoireView 
              repertoire={masterRepertoire} 
              onEditSong={handleEditSong} 
              allSetlists={allSetlists} 
              onUpdateSetlistSongs={handleUpdateSetlistSongs} 
              onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} 
              onAddSong={async (newSong) => { if (!userId) return; try { const synced = await syncToMasterRepertoire(userId, [newSong]); setMasterRepertoire(prev => [...prev, synced[0]]); } catch (err: any) { showError(`Failed: ${err.message}`); } }} 
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
              isBulkDownloading={isRepertoireAutoLinking || isRepertoireGlobalAutoSyncing || isRepertoireBulkQueuingAudio}
              missingAudioCount={missingAudioCount}
              onOpenAdmin={onOpenAdmin}
              onDeleteSong={handleDeleteMasterSong}
            />
          </TabsContent>
        </Tabs>
      </div>

      <FloatingCommandDock onOpenSearch={() => setIsAudioTransposerModalOpen(true)} onOpenPractice={() => {}} onOpenReader={handleOpenReader} onOpenAdmin={onOpenAdmin} onOpenPreferences={() => setIsPreferencesOpen(true)} onToggleHeatmap={() => setShowHeatmap(prev => !prev)} onOpenUserGuide={() => setIsUserGuideOpen(true)} showHeatmap={showHeatmap} viewMode={activeDashboardView} hasPlayableSong={hasPlayableSong} hasReadableChart={hasReadableChart} isPlaying={audio.isPlaying} onTogglePlayback={audio.togglePlayback} currentSongHighestNote={activeSongForPerformance?.highest_note_original || undefined} currentSongPitch={activeSongForPerformance?.pitch} onSafePitchToggle={handleSafePitchToggle} activeSongId={activeSongForPerformance?.id} onSetMenuOpen={setFloatingDockMenuOpen} isMenuOpen={floatingDockMenuOpen} onOpenPerformance={handleOpenPerformanceOverlay} />

      <AlertDialog open={isCreatingSetlist} onOpenChange={setIsCreatingSetlist}>
        <AlertDialogContent className="bg-slate-900 border-white/10 text-white rounded-[2rem]">
          <AlertDialogHeader><div className="bg-indigo-600/10 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-500 mb-4"><ListMusic className="w-6 h-6" /></div><AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Create New Setlist</AlertDialogTitle><AlertDialogDescription className="text-slate-400">Enter a name for your new gig setlist.</AlertDialogDescription></AlertDialogHeader>
          <div className="py-4"><Input placeholder="E.G. Wedding Gig" value={newSetlistName} onChange={(e) => setNewSetlistName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateSetlist()} className="bg-white/5 border-white/10 h-12 rounded-xl" /></div>
          <AlertDialogFooter className="mt-6"><AlertDialogCancel className="rounded-xl bg-white/5 font-bold uppercase text-[10px]">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleCreateSetlist} disabled={!newSetlistName.trim()} className="rounded-xl bg-indigo-600 font-black uppercase text-[10px]">Create</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSetlistConfirmId} onOpenChange={(open) => !open && setDeleteSetlistConfirmId(null)}>
        <AlertDialogContent className="bg-slate-900 border-white/10 text-white rounded-[2rem]">
          <AlertDialogHeader><div className="bg-red-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-red-500 mb-4"><AlertCircle className="w-6 h-6" /></div><AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Delete Setlist?</AlertDialogTitle><AlertDialogDescription className="text-slate-400">This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter className="mt-6"><AlertDialogCancel className="rounded-xl bg-white/5 font-bold uppercase text-[10px]">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSetlist(deleteSetlistConfirmId!)} className="rounded-xl bg-red-600 font-black uppercase text-[10px]">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeSetlist && <SetlistSettingsModal isOpen={isSetlistSettingsOpen} onClose={() => setIsSetlistSettingsOpen(false)} setlistId={activeSetlist.id} setlistName={activeSetlist.name} onDelete={(id) => { setDeleteSetlistConfirmId(id); setIsSetlistSettingsOpen(false); }} onRename={(id) => { setRenameSetlistId(id); setNewSetlistNameForRename(activeSetlist.name); }} />}

      <RepertoirePicker isOpen={isRepertoirePickerOpen} onClose={() => setIsRepertoirePickerOpen(false)} repertoire={masterRepertoire} currentSetlistSongs={activeSetlist?.songs || []} onAdd={handleAddSongToSetlist} />
      <ResourceAuditModal isOpen={isResourceAuditOpen} onClose={() => setIsResourceAuditOpen(false)} songs={masterRepertoire} onVerify={async (songId, updates) => { if (!userId) return; const current = masterRepertoire.find(s => s.id === songId); if (!current) return; const updated = { ...current, ...updates }; await syncToMasterRepertoire(userId, [updated as SetlistSong]); await fetchSetlistsAndRepertoire(); }} onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} />
      <AdminPanel isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} />
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      <UserGuideModal isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />
      <KeyManagementModal isOpen={isKeyManagementOpen} onClose={() => setIsKeyManagementOpen(false)} repertoire={masterRepertoire} onUpdateKey={handleUpdateMasterKey} keyPreference={globalKeyPreference} />

      {isSongStudioModalOpen && (
        <SongStudioModal isOpen={isSongStudioModalOpen} onClose={() => { setIsSongStudioModalOpen(false); setSongStudioDefaultTab(undefined); }} gigId={songStudioModalGigId} songId={songStudioModalSongId} visibleSongs={activeDashboardView === 'gigs' ? filteredAndSortedSongs : masterRepertoire} onSelectSong={setSongStudioModalSongId} allSetlists={allSetlists} masterRepertoire={masterRepertoire} onUpdateSetlistSongs={handleUpdateSetlistSongs} defaultTab={songStudioDefaultTab} />
      )}

      {isPerformanceOverlayOpen && activeSetlist && activeSongForPerformance && (
        <PerformanceOverlay songs={activeSetlist.songs} currentIndex={activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance.id)} isPlaying={audio.isPlaying} progress={audio.progress} duration={audio.duration} onTogglePlayback={audio.togglePlayback} onNext={() => { const idx = (activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance.id) + 1) % activeSetlist.songs.length; setActiveSongForPerformance(activeSetlist.songs[idx]); }} onPrevious={() => { const idx = (activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance.id) - 1 + activeSetlist.songs.length) % activeSetlist.songs.length; setActiveSongForPerformance(activeSetlist.songs[idx]); }} onShuffle={() => { const shuffled = [...activeSetlist.songs].sort(() => Math.random() - 0.5); setAllSetlists(prev => prev.map(s => s.id === activeSetlist.id ? { ...s, songs: shuffled } : s)); setActiveSongForPerformance(shuffled[0]); }} onClose={() => { setIsPerformanceOverlayOpen(false); audio.stopPlayback(); }} onUpdateSong={handleUpdateSongInSetlist} onUpdateKey={handleUpdateSongKey} analyzer={audio.analyzer} gigId={activeSetlist.id} isLoadingAudio={audio.isLoadingAudio} />
      )}

      {isAudioTransposerModalOpen && (
        <Dialog open={isAudioTransposerModalOpen} onOpenChange={setIsAudioTransposerModalOpen}>
          <DialogContent className="max-w-4xl w-[95vw] h-[90vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
            <DialogHeader className="p-6 bg-indigo-600 shrink-0 relative"><button onClick={() => setIsAudioTransposerModalOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/70"><X className="w-5 h-5" /></button>
                <div className="flex items-center gap-3 mb-2"><div className="bg-white/20 p-2 rounded-xl backdrop-blur-md"><Music className="w-6 h-6 text-white" /></div><DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Audio Transposer</DialogTitle></div>
                <DialogDescription className="text-indigo-100 font-medium">Load audio and adjust parameters.</DialogDescription></DialogHeader>
            <div className="flex-1 overflow-hidden">
              <AudioTransposer 
                repertoire={masterRepertoire} 
                currentSong={null} 
                onAddToSetlist={handleImportNewSong}
                onAddExistingSong={(song) => {
                   handleAddSongToSetlist(song);
                   // Modal logic handled here now
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Index;
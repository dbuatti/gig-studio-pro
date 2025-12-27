"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AudioTransposer, { AudioTransposerRef } from "@/components/AudioTransposer";
import SetlistManager, { SetlistSong } from "@/components/SetlistManager";
import SetlistSelector from "@/components/SetlistSelector";
import ImportSetlist from "@/components/ImportSetlist";
import PerformanceOverlay from "@/components/PerformanceOverlay";
import ActiveSongBanner from "@/components/ActiveSongBanner";
import SetlistStats from "@/components/SetlistStats";
import PreferencesModal from "@/components/PreferencesModal";
import AdminPanel from "@/components/AdminPanel";
import SongStudioModal from "@/components/SongStudioModal";
import SetlistSettingsModal from "@/components/SetlistSettingsModal";
import ResourceAuditModal from "@/components/ResourceAuditModal";
import RepertoirePicker from "@/components/RepertoirePicker";
import SetlistExporter from "@/components/SetlistExporter";
import FloatingCommandDock from "@/components/FloatingCommandDock";
import UserGuideModal from "@/components/UserGuideModal";
import SheetReaderMode from './SheetReaderMode';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  User as UserIcon, Loader2, Play, LayoutDashboard, 
  Search as SearchIcon, Rocket, Settings, Clock, 
  ShieldCheck, Settings2, FileText, Guitar, 
  Library, ListMusic, ClipboardCheck, Keyboard 
} from 'lucide-react'; 
import { cn } from "@/lib/utils";
import { useSettings } from '@/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { syncToMasterRepertoire, calculateReadiness } from '@/utils/repertoireSync';
import * as Tone from 'tone';
import { cleanYoutubeUrl } from '@/utils/youtubeUtils';
import { useNavigate } from 'react-router-dom';
import { FilterState } from '@/components/SetlistFilters';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync'; // NEW: Import useHarmonicSync

type ViewMode = 'repertoire' | 'setlist';

const INITIAL_FILTERS: FilterState = {
  hasAudio: 'all',
  hasVideo: 'all',
  hasChart: 'all',
  hasPdf: 'all',
  hasUg: 'all',
  isConfirmed: 'all',
  isApproved: 'all',
  readiness: 0,
  hasUgChords: 'all'
};

const Index = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { keyPreference, safePitchMaxNote } = useSettings();
  const { alwaysShowAllToasts } = useReaderSettings();
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('gig_view_mode') as ViewMode) || 'repertoire';
  });
  const [setlists, setSetlists] = useState<{ id: string; name: string; songs: SetlistSong[]; time_goal?: number }[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(() => {
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'dashboard' && pathParts[2]) {
      return pathParts[2];
    }
    return localStorage.getItem('active_gig_id');
  });
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  
  const [activeSongIdState, setActiveSongId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false); 
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const [isSheetReaderMode, setIsSheetReaderMode] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false); 
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isSetlistSettingsOpen, setIsSetlistSettingsOpen] = useState(false);
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isCommandHubOpen, setIsCommandHubOpen] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work'>(() => {
    return (localStorage.getItem('gig_sort_mode') as any) || 'none';
  });
  
  const [activeFilters, setActiveFilters] = useState<FilterState>(INITIAL_FILTERS);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [isAutoLinking, setIsAutoLinking] = useState(false);
  const [isGlobalSyncing, setIsGlobalSyncing] = useState(false);
  const [isClearingAutoLinks, setIsClearingAutoLinks] = useState(false);

  const isSyncingRef = useRef(false);
  const saveQueueRef = useRef<any[]>([]);
  const transposerRef = useRef<AudioTransposerRef>(null);
  const searchPanelRef = useRef<HTMLElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  const currentList = setlists.find(l => l.id === currentListId);
  
  const songs = useMemo(() => {
    if (viewMode === 'repertoire') return masterRepertoire;
    return currentList?.songs || [];
  }, [viewMode, masterRepertoire, currentList]);

  const processedSongs = useMemo(() => {
    console.log("[Index] [processedSongs] Recalculating processed songs. Dependencies: [songs, sortMode, searchTerm, activeFilters]");
    console.log("[Index]   Current filters:", activeFilters);
    let base = [...songs];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      base = base.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.artist?.toLowerCase().includes(q)
      );
      console.log("[Index]   Filtered by searchTerm. Count:", base.length);
    }

    base = base.filter(s => {
      const score = calculateReadiness(s);
      if (score < activeFilters.readiness) {
        return false; 
      }
      
      const hasFullAudio = !!s.previewUrl && !(s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'));
      if (activeFilters.hasAudio === 'full' && !hasFullAudio) return false;
      if (activeFilters.hasAudio === 'itunes' && !(s.previewUrl && (s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets')))) return false;
      if (activeFilters.hasAudio === 'none' && (s.previewUrl && !s.previewUrl.includes('apple.com') && !s.previewUrl.includes('itunes-assets'))) return false;

      if (activeFilters.isApproved === 'yes' && !s.isApproved) return false;
      if (activeFilters.isApproved === 'no' && s.isApproved) return false;

      if (activeFilters.isConfirmed === 'yes' && !s.isKeyConfirmed) return false;
      if (activeFilters.isConfirmed === 'no' && s.isKeyConfirmed) return false;

      if (activeFilters.hasVideo === 'yes' && !s.youtubeUrl) return false;
      if (activeFilters.hasVideo === 'no' && s.youtubeUrl) return false;

      if (activeFilters.hasPdf === 'yes' && !s.pdfUrl) return false;
      if (activeFilters.hasPdf === 'no' && s.pdfUrl) return false;

      if (activeFilters.hasUg === 'yes' && !s.ugUrl) return false;
      if (activeFilters.hasUg === 'no' && s.ugUrl) return false;
      
      if (activeFilters.hasUgChords === 'yes' && !s.is_ug_chords_present) return false;
      if (activeFilters.hasUgChords === 'no' && s.is_ug_chords_present) return false;

      return true;
    });
    console.log("[Index]   Filtered by activeFilters. Count:", base.length);

    if (sortMode === 'none') return base;
    const sortedBase = base.sort((a, b) => {
      const scoreA = calculateReadiness(a);
      const scoreB = calculateReadiness(b);
      return sortMode === 'ready' ? scoreB - scoreA : scoreA - scoreB;
    });
    console.log("[Index]   Sorted by sortMode:", sortMode);
    return sortedBase;
  }, [songs, sortMode, searchTerm, activeFilters]);

  // Moved useCallback definitions before useEffect
  const fetchMasterRepertoire = useCallback(async () => {
    console.log("[Index] [fetchMasterRepertoire] called. Dependencies: [user]");
    if (!user) {
      console.log("[Index]   No user, skipping fetchMasterRepertoire.");
      return;
    }
    try {
      const { data, error } = await supabase.from('repertoire').select('*').eq('user_id', user.id).order('title');
      if (error) throw error;
      console.log("[Index]   Raw data from Supabase (repertoire):", data);

      if (data) {
        const mappedRepertoire = data.map(d => ({
          id: d.id, master_id: d.id, name: d.title, artist: d.artist, bpm: d.bpm, lyrics: d.lyrics,
          originalKey: d.original_key, targetKey: d.target_key, pitch: d.pitch, ugUrl: d.ug_url,
          previewUrl: d.preview_url, youtubeUrl: d.youtube_url, appleMusicUrl: d.apple_music_url,
          pdfUrl: d.pdf_url, isMetadataConfirmed: d.is_metadata_confirmed, isKeyConfirmed: d.is_key_confirmed,
          duration_seconds: d.duration_seconds, notes: d.notes, user_tags: d.user_tags || [], resources: d.resources || [],
          isApproved: d.is_approved, preferred_reader: d.preferred_reader, ug_chords_text: d.ug_chords_text,
          ug_chords_config: d.ug_chords_config, is_pitch_linked: d.is_pitch_link_verified, is_ug_link_verified: d.is_ug_link_verified,
          sheet_music_url: d.sheet_music_url, is_sheet_verified: d.is_sheet_verified,
          is_ug_chords_present: d.is_ug_chords_present, highest_note_original: d.highest_note_original
        }));
        setMasterRepertoire(prevMasterRepertoire => {
          if (JSON.stringify(mappedRepertoire) !== JSON.stringify(prevMasterRepertoire)) {
            console.log("[Index]   Master repertoire updated. Count:", mappedRepertoire.length, "songs.");
            return mappedRepertoire;
          }
          console.log("[Index]   Master repertoire unchanged. Skipping state update.");
          return prevMasterRepertoire;
        });
      }
    } catch (err) {
      console.error("[Index] [fetchMasterRepertoire] Error fetching master repertoire:", err);
      showError("Failed to load master repertoire.");
    }
  }, [user]); // Dependency for fetchMasterRepertoire useCallback

  const fetchSetlists = useCallback(async () => {
    console.log("[Index] [fetchSetlists] called. Dependencies: [currentListId]");
    try {
      const { data, error } = await supabase.from('setlists').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      console.log("[Index]   Raw data from Supabase (setlists):", data);

      if (data && data.length > 0) {
        const newSetlists = data.map(d => ({ id: d.id, name: d.name, songs: (d.songs as any[]) || [], time_goal: d.time_goal }));
        setSetlists(prevSetlists => {
          if (JSON.stringify(newSetlists) !== JSON.stringify(prevSetlists)) {
            console.log("[Index]   Setlists updated. Count:", newSetlists.length, "setlists.");
            return newSetlists;
          }
          console.log("[Index]   Setlists unchanged. Skipping state update.");
          return prevSetlists;
        });
        
        let activeId = currentListId; // Use currentListId from closure
        
        if (activeId && !data.find(d => d.id === activeId)) {
          console.log("[Index]   Current activeListId (", activeId, ") not found in fetched setlists. Resetting.");
          activeId = null;
        }
        
        if (!activeId && data.length > 0) {
          activeId = data[0].id;
          console.log("[Index]   No activeListId, setting to first setlist:", activeId);
        }
        
        if (activeId && activeId !== currentListId) { // Only update if it's actually different
          console.log("[Index]   Updating currentListId from", currentListId, "to", activeId);
          setCurrentListId(activeId);
          localStorage.setItem('active_gig_id', activeId);
        }
      } else {
        console.log("[Index]   No setlists found.");
        setSetlists([]); // Clear setlists if none found
        if (currentListId !== null) { // Only update if it's not already null
          console.log("[Index]   Clearing currentListId.");
          setCurrentListId(null);
          localStorage.removeItem('active_gig_id');
        }
      }
    } catch (err) {
      console.error("[Index] [fetchSetlists] Error fetching setlists:", err);
      showError("Failed to load setlists.");
    }
  }, [currentListId]); // No dependencies for fetchSetlists useCallback

  useEffect(() => {
    console.log("[Index] Effect: Initial data fetch on mount/user change. Dependencies: [user, fetchSetlists, fetchMasterRepertoire]");
    if (user) {
      fetchSetlists();
      fetchMasterRepertoire();
    } else {
      console.log("[Index]   No user, skipping initial data fetch.");
    }
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, [user, fetchSetlists, fetchMasterRepertoire]);

  useEffect(() => {
    console.log("[Index] Effect: viewMode changed. Dependencies: [viewMode, user, fetchMasterRepertoire]");
    localStorage.setItem('gig_view_mode', viewMode);
    if (viewMode === 'repertoire' && user) {
      console.log("[Index]   View mode is 'repertoire', refetching master repertoire.");
      fetchMasterRepertoire();
    }
  }, [viewMode, user, fetchMasterRepertoire]); // Added fetchMasterRepertoire to dependencies

  useEffect(() => {
    console.log("[Index] Effect: handleClickOutside listener setup. Dependencies: [isSearchPanelOpen]");
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isSearchPanelOpen &&
        searchPanelRef.current &&
        !searchPanelRef.current.contains(event.target as Node) &&
        searchButtonRef.current &&
        !searchButtonRef.current.contains(event.target as Node)
      ) {
        console.log("[Index]   Click outside search panel detected. Closing search panel.");
        setIsSearchPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchPanelOpen]);

  const saveList = async (listId: string, updatedSongs: SetlistSong[], updates: any = {}, songsToSync?: SetlistSong[]) => {
    if (!user) {
      console.warn("[Index] [saveList] No user, skipping saveList.");
      return;
    }
    setIsSaving(true);
    console.log("[Index] [saveList] Attempting to save list:", listId, "with songs:", updatedSongs.map(s => s.name));
    try {
      let finalSongs = updatedSongs;
      if (songsToSync?.length) {
        console.log("[Index]   Syncing songs to master repertoire:", songsToSync.map(s => s.name));
        const syncedBatch = await syncToMasterRepertoire(user.id, songsToSync);
        finalSongs = updatedSongs.map(s => {
          const matched = syncedBatch.find(sb => sb.id === s.id || (sb.name === s.name && sb.artist === s.artist));
          return matched ? { ...s, master_id: matched.master_id } : s;
        });
        console.log("[Index]   Songs after master repertoire sync:", finalSongs.map(s => s.name));
      }
      
      const cleaned = finalSongs.map(({ isSyncing, ...rest }) => rest);
      console.log("[Index]   Updating Supabase 'setlists' table with cleaned songs:", cleaned.map(s => s.name), "and updates:", updates);
      await supabase.from('setlists').update({ songs: cleaned, updated_at: new Date().toISOString(), ...updates }).eq('id', listId);
      
      setSetlists(prev => {
        const newSetlists = prev.map(l => l.id === listId ? { ...l, songs: finalSongs, ...updates } : l);
        console.log("[Index]   setSetlists called. New setlists state for list", listId, ":", newSetlists.find(l => l.id === listId)?.songs.map(s => s.name));
        return newSetlists;
      });
      if (songsToSync?.length) {
        console.log("[Index]   Songs synced, refetching master repertoire.");
        fetchMasterRepertoire();
      }
      showSuccess("Setlist Saved!");
    } catch (err) {
      console.error("[Index] [saveList] Error saving setlist:", err);
      showError("Failed to save setlist.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSong = (songId: string, updates: Partial<SetlistSong>) => {
    console.log("[Index] [handleUpdateSong] called for song ID:", songId, "with updates:", updates);
    if (viewMode === 'repertoire') {
      const target = masterRepertoire.find(s => s.id === songId);
      if (target) {
        console.log("[Index]   Updating song in master repertoire.");
        syncToMasterRepertoire(user!.id, [{ ...target, ...updates }]).then(fetchMasterRepertoire);
      } else {
        console.warn("[Index]   Target song not found in master repertoire for update.");
      }
      return;
    }
    if (!currentListId) {
      console.warn("[Index]   No currentListId, skipping song update in setlist.");
      return;
    }
    const updatedSongs = currentList!.songs.map(s => s.id === songId ? { ...s, ...updates } : s);
    console.log("[Index]   Updating song in current setlist. New songs array:", updatedSongs.map(s => s.name));
    saveList(currentListId, updatedSongs, {}, [updatedSongs.find(s => s.id === songId)!]);
  };

  const handleUpdateKey = (songId: string, newTargetKey: string) => {
    console.log("[Index] [handleUpdateKey] called for song ID:", songId, "with new target key:", newTargetKey);
    handleUpdateSong(songId, { targetKey: newTargetKey });
  };

  const handleAddToGig = (song: SetlistSong) => {
    console.log("[Index] [handleAddToGig] called for song:", song.name);
    if (!currentListId) {
      showError("No active setlist selected. Please create or select one.");
      console.warn("[Index]   No active setlist selected, cannot add song.");
      return;
    }
    const newEntry = { ...song, id: Math.random().toString(36).substr(2, 9), master_id: song.master_id || song.id, isPlayed: false, isApproved: false };
    console.log("[Index]   Adding new song entry:", newEntry.name, "to list:", currentListId);
    saveList(currentListId, [...currentList!.songs, newEntry]);
    showSuccess(`Added "${song.name}" to gig`);
  };

  const handleAddNewSongToCurrentSetlist = async (previewUrl: string, name: string, artist: string, youtubeUrl?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string, pitch?: number) => {
    console.log("[Index] [handleAddNewSongToCurrentSetlist] called for new song:", name);
    if (!currentListId) {
      showError("No active setlist selected. Please create or select one.");
      console.warn("[Index]   No active setlist selected, cannot add new song.");
      return;
    }
    const newSong: SetlistSong = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      artist,
      previewUrl,
      youtubeUrl,
      ugUrl,
      appleMusicUrl,
      genre,
      pitch: pitch || 0,
      originalKey: "C",
      targetKey: "C",
      isPlayed: false,
      isSyncing: true,
      isMetadataConfirmed: false,
      isKeyConfirmed: false,
      duration_seconds: 0,
      notes: "",
      lyrics: "",
      resources: [],
      user_tags: [],
      is_pitch_linked: true,
      isApproved: false,
      preferred_reader: null,
      ug_chords_config: DEFAULT_UG_CHORDS_CONFIG,
      is_ug_chords_present: false,
      highest_note_original: null,
      is_ug_link_verified: false,
      metadata_source: null,
      sync_status: 'IDLE',
      last_sync_log: null,
      auto_synced: false,
      is_sheet_verified: false,
      sheet_music_url: null,
    };
    console.log("[Index]   Adding new song:", newSong.name, "to list:", currentListId);
    await saveList(currentListId, [...currentList!.songs, newSong], {}, [newSong]);
    showSuccess(`Added "${name}" to gig`);
    setActiveSongId(newSong.id);
    setIsSearchPanelOpen(false);
  };

  const handleUpdateSetlistSongs = useCallback(async (setlistId: string, songToUpdate: SetlistSong, action: 'add' | 'remove') => {
    console.log("[Index] [handleUpdateSetlistSongs] called for setlist ID:", setlistId, "song:", songToUpdate.name, "action:", action);
    const targetSetlist = setlists.find(l => l.id === setlistId);
    if (!targetSetlist) {
      console.error(`[Index]   Setlist with ID ${setlistId} not found.`);
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
          id: Math.random().toString(36).substr(2, 9),
          master_id: songToUpdate.master_id || songToUpdate.id,
          isPlayed: false,
          isApproved: false,
        };
        updatedSongsArray.push(newSetlistSong);
        console.log(`[Index]   Added song ${songToUpdate.name} to setlist ${setlistId}.`);
      } else {
        console.log(`[Index]   Song ${songToUpdate.name} already in setlist ${setlistId}. Skipping add.`);
      }
    } else if (action === 'remove') {
      updatedSongsArray = updatedSongsArray.filter(s => 
        (s.master_id && s.master_id !== songToUpdate.master_id) && 
        s.id !== songToUpdate.id
      );
      console.log(`[Index]   Removed song ${songToUpdate.name} from setlist ${setlistId}.`);
    }

    await saveList(setlistId, updatedSongsArray);
    fetchSetlists();
  }, [setlists, saveList, fetchSetlists]);


  const startPerformance = () => {
    console.log("[Index] [startPerformance] called.");
    const playable = songs.filter(s => s.isApproved && s.previewUrl && !(s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets')));
    if (!playable.length) { 
      showError("No approved tracks found."); 
      console.warn("[Index]   No approved tracks found for performance mode.");
      return; 
    }
    setIsPerformanceMode(true);
    handleSelectSong(playable[0]);
    console.log("[Index]   Entering performance mode with song:", playable[0].name);
  };

  const startSheetReader = (initialSongId?: string) => {
    console.log("[Index] [startSheetReader] called with initialSongId:", initialSongId);
    
    // FIX: Reset filters to ensure songs are visible in the Reader
    console.log("[Index]   Resetting filters to ensure visibility in Reader.");
    setActiveFilters(INITIAL_FILTERS);
    setSearchTerm("");
    setSortMode("none");

    // Calculate readable songs based on the full list (not filtered)
    const readable = songs.filter(s => s.ugUrl || s.pdfUrl || s.leadsheetUrl || s.ug_chords_text);
    if (!readable.length) { 
      showError("No readable charts found."); 
      console.warn("[Index]   No readable charts found for sheet reader mode.");
      return; 
    }
    
    setIsSheetReaderMode(true);
    
    // If we have an active song, pass it to the reader
    if (activeSongIdState) {
        navigate(`/sheet-reader/${activeSongIdState}`);
    } else {
        navigate('/sheet-reader');
    }
    console.log("[Index]   Entering sheet reader mode.");
  };

  const handleSelectSong = async (song: SetlistSong) => {
    console.log("[Index] [handleSelectSong] called for song:", song.name);
    setActiveSongId(song.id);
    if (song.previewUrl && transposerRef.current) {
      console.log("[Index]   Loading audio via transposerRef for song:", song.name, "from URL:", song.previewUrl);
      await transposerRef.current.loadFromUrl(song.previewUrl, song.name, song.artist || "Unknown");
      // Ensure song.pitch is a number, default to 0 if not.
      const pitchValue = typeof song.pitch === 'number' ? song.pitch : 0;
      if (transposerRef.current && transposerRef.current.setPitch) {
          console.log("[Index]   Setting initial pitch to:", pitchValue);
          transposerRef.current.setPitch(pitchValue);
      }
    } else {
      console.warn("[Index]   No previewUrl or transposerRef.current available for song:", song.name, ". Skipping audio load.");
    }
  };

  const handleSelectSongById = useCallback((songId: string) => {
    console.log("[Index] [handleSelectSongById] called for song ID:", songId);
    const song = processedSongs.find(s => s.id === songId);
    if (song) {
      console.log("[Index]   Found song by ID:", song.name, ". Calling handleSelectSong.");
      handleSelectSong(song);
    } else {
      console.warn("[Index]   Song not found by ID:", songId);
    }
  }, [processedSongs, handleSelectSong]);

  const missingAudioTracks = useMemo(() => {
    console.log("[Index] [missingAudioTracks] Recalculating. Dependencies: [masterRepertoire]");
    return masterRepertoire.filter(song => 
      song.youtubeUrl && (!song.previewUrl || (song.previewUrl.includes('apple.com') || song.previewUrl.includes('itunes-assets')))
    ).length;
  }, [masterRepertoire]);

  const handleAutoLink = async () => {
    console.log("[Index] [handleAutoLink] called.");
    setIsAutoLinking(true);
    showInfo("Initiating Smart-Link Discovery...");
    try {
      const missingLinks = masterRepertoire.filter(s => !s.youtubeUrl || s.youtubeUrl.trim() === '');
      if (missingLinks.length === 0) {
        showSuccess("All tracks already have YouTube links.");
        console.log("[Index]   No missing links found.");
        return;
      }
      console.log("[Index]   Found", missingLinks.length, "tracks with missing YouTube links.");

      const { data, error } = await supabase.functions.invoke('bulk-populate-youtube-links', {
        body: { songIds: missingLinks.map(s => s.id) }
      });

      if (error) throw error;
      showSuccess("Smart-Link Discovery Complete!");
      console.log("[Index]   Bulk populate YouTube links function returned:", data);
      fetchMasterRepertoire();
    } catch (err: any) {
      console.error("[Index] [handleAutoLink] Smart-Link Failed:", err.message);
      showError(`Smart-Link Failed: ${err.message}`);
    } finally {
      setIsAutoLinking(false);
    }
  };

  const handleGlobalAutoSync = async () => {
    console.log("[Index] [handleGlobalAutoSync] called.");
    setIsGlobalSyncing(true);
    showInfo("Initiating Global Auto-Sync Pipeline...");
    try {
      const songsToSync = masterRepertoire.filter(s => !s.isMetadataConfirmed || !s.auto_synced);
      if (songsToSync.length === 0) {
        showSuccess("All tracks are already optimized.");
        console.log("[Index]   All tracks already optimized.");
        return;
      }
      console.log("[Index]   Found", songsToSync.length, "tracks to sync.");

      const { data, error } = await supabase.functions.invoke('global-auto-sync', {
        body: { songIds: songsToSync.map(s => s.id), overwrite: false }
      });

      if (error) throw error;
      showSuccess("Global Auto-Sync Pipeline Complete!");
      console.log("[Index]   Global auto-sync function returned:", data);
      fetchMasterRepertoire();
    } catch (err: any) {
      console.error("[Index] [handleGlobalAutoSync] Global Auto-Sync Failed:", err.message);
      showError(`Global Auto-Sync Failed: ${err.message}`);
    } finally {
      setIsGlobalSyncing(false);
    }
  };

  const handleBulkRefreshAudio = async () => {
    console.log("[Index] [handleBulkRefreshAudio] called.");
    setIsBulkDownloading(true);
    showInfo("Initiating Bulk Audio Re-Extraction...");
    try {
      const songsToExtract = masterRepertoire.filter(s => s.youtubeUrl && (!s.previewUrl || (s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'))));
      if (songsToExtract.length === 0) {
        showSuccess("No YouTube links found for re-extraction.");
        console.log("[Index]   No YouTube links found for re-extraction.");
        return;
      }
      console.log("[Index]   Found", songsToExtract.length, "tracks to re-extract audio.");

      for (const song of songsToExtract) {
        showInfo(`Extracting audio for: ${song.name}`);
        const targetVideoUrl = cleanYoutubeUrl(song.youtubeUrl || '');
        if (!targetVideoUrl) {
          console.warn("[Index]   Skipping audio extraction for song", song.name, ": no valid YouTube URL.");
          continue;
        }
        console.log("[Index]   Target video URL for extraction:", targetVideoUrl);

        const API_BASE_URL = "https://yt-audio-api-1-wedr.onrender.com";
        const tokenResponse = await fetch(`${API_BASE_URL}/?url=${encodeURIComponent(targetVideoUrl)}`);
        if (!tokenResponse.ok) throw new Error("API Connection Failed");
        const { token } = await tokenResponse.json();
        console.log("[Index]   Received token for extraction:", token);

        let attempts = 0;
        let fileResponse: Response | undefined;
        let downloadReady = false;

        while (attempts < 30 && !downloadReady) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 5000));
          fileResponse = await fetch(`${API_BASE_URL}/download?token=${token}`);
          if (fileResponse.status === 200) {
            downloadReady = true;
            console.log("[Index]   Audio download ready after", attempts, "attempts.");
            break;
          } else {
            console.log("[Index]   Audio still processing (status:", fileResponse.status, ") after", attempts, "attempts.");
          }
        }

        if (!downloadReady || !fileResponse) throw new Error("Audio extraction timed out.");

        const audioArrayBuffer = await fileResponse.arrayBuffer();
        const audioBuffer = await Tone.getContext().decodeAudioData(audioArrayBuffer.slice(0));
        console.log("[Index]   Audio buffer decoded. Duration:", audioBuffer.duration, "seconds.");

        const fileName = `${user?.id}/${song.id}/${Date.now()}.mp3`;
        console.log("[Index]   Uploading audio to Supabase storage with filename:", fileName);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('public_audio')
          .upload(fileName, audioArrayBuffer, { contentType: 'audio/mpeg', upsert: true });

        if (uploadError) throw uploadError;
        console.log("[Index]   Audio uploaded to Supabase storage. Path:", uploadData.path);

        const { data: { publicUrl } } = supabase.storage.from('public_audio').getPublicUrl(uploadData.path);
        console.log("[Index]   Public URL for uploaded audio:", publicUrl);

        await supabase.from('repertoire').update({ 
          preview_url: publicUrl, 
          duration_seconds: audioBuffer.duration,
          extraction_status: 'COMPLETED'
        }).eq('id', song.id);
        showSuccess(`Audio extracted for "${song.name}"`);
        console.log("[Index]   Repertoire updated with new audio URL and duration for song:", song.name);
      }
      showSuccess("Bulk Audio Re-Extraction Complete!");
      fetchMasterRepertoire();
    } catch (err: any) {
      console.error("[Index] [handleBulkRefreshAudio] Bulk Audio Extraction Failed:", err.message);
      showError(`Bulk Audio Extraction Failed: ${err.message}`);
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const handleClearAutoLinks = async () => {
    console.log("[Index] [handleClearAutoLinks] called.");
    setIsClearingAutoLinks(true);
    showInfo("Clearing auto-populated links...");
    try {
      const autoPopulated = masterRepertoire.filter(s => s.metadata_source === 'auto_populated');
      if (autoPopulated.length === 0) {
        showSuccess("No auto-populated links found to clear.");
        console.log("[Index]   No auto-populated links found.");
        return;
      }
      console.log("[Index]   Found", autoPopulated.length, "auto-populated links to clear.");

      const { error } = await supabase
        .from('repertoire')
        .update({ 
          youtube_url: null, 
          metadata_source: null,
          sync_status: 'IDLE',
          last_sync_log: 'Cleared auto-populated link'
        })
        .in('id', autoPopulated.map(s => s.id));

      if (error) throw error;
      showSuccess("Auto-populated links cleared!");
      console.log("[Index]   Auto-populated links cleared in Supabase.");
      fetchMasterRepertoire();
    } catch (err: any) {
      console.error("[Index] [handleClearAutoLinks] Failed to clear auto-links:", err.message);
      showError(`Failed to clear auto-links: ${err.message}`);
    } finally {
      setIsClearingAutoLinks(false);
    }
  };

  const hasPlayableSong = useMemo(() => {
    console.log("[Index] [hasPlayableSong] Recalculating. Dependencies: [songs]");
    return songs.filter(s => s.isApproved && s.previewUrl && !(s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'))).length > 0;
  }, [songs]);

  const hasReadableChart = useMemo(() => {
    console.log("[Index] [hasReadableChart] Recalculating. Dependencies: [songs]");
    return songs.some(s => s.ugUrl || s.pdfUrl || s.leadsheetUrl || s.ug_chords_text);
  }, [songs]);

  const handleTogglePlayback = useCallback(() => {
    console.log("[Index] [handleTogglePlayback] called.");
    transposerRef.current?.togglePlayback();
  }, []);

  const isPlaying = useMemo(() => {
    console.log("[Index] [isPlaying] Recalculating. Dependencies: [transposerRef.current?.getIsPlaying()]");
    return transposerRef.current?.getIsPlaying() || false;
  }, [transposerRef.current?.getIsPlaying()]);

  const handleSafePitchToggle = useCallback((active: boolean, safePitch: number) => {
    console.log("[Index] [handleSafePitchToggle] called. Active:", active, "Safe Pitch:", safePitch);
    if (!transposerRef.current) {
      console.warn("[Index]   No transposerRef.current, skipping safe pitch toggle.");
      return;
    }
    if (active) {
      console.log("[Index]   Setting pitch to safePitch:", safePitch);
      transposerRef.current.setPitch(safePitch);
    } else {
      console.log("[Index]   Setting pitch to 0 (safe pitch deactivated).");
      transposerRef.current.setPitch(0);
    }
  }, []);

  const currentSongForSafePitch = useMemo(() => {
    console.log("[Index] [currentSongForSafePitch] Recalculating. Dependencies: [activeSongIdState, songs]");
    if (!activeSongIdState) {
      console.log("[Index]   No activeSongIdState, returning null for safe pitch calculation.");
      return null;
    }
    const song = songs.find(s => s.id === activeSongIdState);
    console.log("[Index]   Found song for safe pitch calculation:", song?.name);
    return song;
  }, [activeSongIdState, songs]);

  useEffect(() => {
    console.log("[Index] Effect: Global keydown listener setup. Dependencies: [handleTogglePlayback, startSheetReader, isPerformanceMode, isSheetReaderMode, isSearchPanelOpen, isPreferencesOpen, isAdminOpen, isAuditModalOpen, isStudioModalOpen, isSetlistSettingsOpen, isRepertoirePickerOpen, isCommandHubOpen, isUserGuideOpen, activeSongIdState]");
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        console.log("[Index]   Global keydown: Spacebar pressed. Toggling playback.");
        handleTogglePlayback();
      }
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        console.log("[Index]   Global keydown: 'r' pressed. Starting sheet reader.");
        startSheetReader(activeSongIdState || undefined);
      }
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        console.log("[Index]   Global keydown: 'h' pressed. Toggling heatmap.");
        setShowHeatmap(prev => !prev);
      }
      if (e.key === 'Escape') {
        console.log("[Index]   Global keydown: Escape pressed. Checking open modals/modes.");
        if (isPerformanceMode) { setIsPerformanceMode(false); console.log("[Index]     Exiting performance mode."); }
        else if (isSheetReaderMode) { setIsSheetReaderMode(false); console.log("[Index]     Exiting sheet reader mode."); }
        else if (isSearchPanelOpen) { setIsSearchPanelOpen(false); console.log("[Index]     Closing search panel."); }
        else if (isPreferencesOpen) { setIsPreferencesOpen(false); console.log("[Index]     Closing preferences."); }
        else if (isAdminOpen) { setIsAdminOpen(false); console.log("[Index]     Closing admin panel."); }
        else if (isAuditModalOpen) { setIsAuditModalOpen(false); console.log("[Index]     Closing audit modal."); }
        else if (isStudioModalOpen) { setIsStudioModalOpen(false); console.log("[Index]     Closing studio modal."); }
        else if (isSetlistSettingsOpen) { setIsSetlistSettingsOpen(false); console.log("[Index]     Closing setlist settings."); }
        else if (isRepertoirePickerOpen) { setIsRepertoirePickerOpen(false); console.log("[Index]     Closing repertoire picker."); }
        else if (isCommandHubOpen) { setIsCommandHubOpen(false); console.log("[Index]     Closing command hub."); }
        else if (isUserGuideOpen) { setIsUserGuideOpen(false); console.log("[Index]     Closing user guide."); }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    handleTogglePlayback, startSheetReader, isPerformanceMode, isSheetReaderMode,
    isSearchPanelOpen, isPreferencesOpen, isAdminOpen, isAuditModalOpen,
    isStudioModalOpen, isSetlistSettingsOpen, isRepertoirePickerOpen, isCommandHubOpen,
    isUserGuideOpen, activeSongIdState
  ]);

  if (isPerformanceMode) {
    console.log("[Index] Rendering PerformanceOverlay.");
    const activeSong = songs.find(s => s.id === activeSongIdState);
    const playableSongs = songs.filter(s => s.isApproved && s.previewUrl && !(s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets')));
    const currentPlayableIndex = playableSongs.findIndex(s => s.id === activeSongIdState);

    const onNextPerformance = () => {
      console.log("[Index]   Performance: Next song.");
      const nextIndex = (currentPlayableIndex + 1) % playableSongs.length;
      handleSelectSong(playableSongs[nextIndex]);
    };

    const onPreviousPerformance = () => {
      console.log("[Index]   Performance: Previous song.");
      const prevIndex = (currentPlayableIndex - 1 + playableSongs.length) % playableSongs.length;
      handleSelectSong(playableSongs[prevIndex]);
    };

    const onShufflePerformance = () => {
      console.log("[Index]   Performance: Shuffle songs.");
      const shuffled = [...playableSongs].sort(() => Math.random() - 0.5);
      handleSelectSong(shuffled[0]);
    };

    return (
      <PerformanceOverlay 
        songs={playableSongs} 
        currentIndex={currentPlayableIndex} 
        isPlaying={isPlaying} 
        progress={transposerRef.current?.getProgress().progress || 0} 
        duration={transposerRef.current?.getProgress().duration || 0} 
        onTogglePlayback={handleTogglePlayback} 
        onNext={onNextPerformance} 
        onPrevious={onPreviousPerformance} 
        onShuffle={onShufflePerformance} 
        onClose={() => { setIsPerformanceMode(false); console.log("[Index]     Exiting performance mode via onClose."); }} 
        onUpdateSong={handleUpdateSong} 
        onUpdateKey={handleUpdateKey} 
        analyzer={transposerRef.current?.getAnalyzer()}
        gigId={currentListId}
      />
    );
  }

  if (isSheetReaderMode) {
    console.log("[Index] Rendering SheetReaderMode.");
    return (
      <SheetReaderMode />
    );
  }

  console.log("[Index] Rendering main dashboard view.");
  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden relative">
      <nav className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b px-4 md:px-6 flex items-center justify-between z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-6 flex-1 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><LayoutDashboard className="w-5 h-5" /></div>
            <span className="font-black uppercase tracking-tighter text-lg hidden sm:block">Gig Studio <span className="text-indigo-600">Pro</span></span>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setViewMode('repertoire')}
              className={cn("h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg transition-all", viewMode === 'repertoire' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" : "text-slate-500")}
            >
              <Library className="w-3.5 h-3.5" /> <span className="hidden md:inline">Repertoire</span>
            </Button>
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setViewMode('setlist')}
              className={cn("h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg transition-all", viewMode === 'setlist' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" : "text-slate-500")}
            >
              <ListMusic className="w-3.5 h-3.5" /> <span className="hidden md:inline">Gigs</span>
            </Button>
          </div>

          {viewMode === 'setlist' && (
            <SetlistSelector setlists={setlists} currentId={currentListId || ''} onSelect={(id) => {
              setCurrentListId(id);
              localStorage.setItem('active_gig_id', id);
              console.log("[Index]   Set currentListId to:", id);
            }}
              onCreate={async () => {
                const name = prompt("Gig Name:");
                if (name) {
                  console.log("[Index]   Creating new gig with name:", name);
                  const { data } = await supabase.from('setlists').insert([{ user_id: user?.id, name, songs: [] }]).select().single();
                  if (data) { 
                    await fetchSetlists(); 
                    setCurrentListId(data[0].id); 
                    console.log("[Index]     New gig created and set as current:", data[0].id);
                  } else {
                    console.warn("[Index]     Failed to create new gig.");
                  }
                }
              }}
              onDelete={async (id) => { 
                if(confirm("Delete gig?")) { 
                  console.log("[Index]   Deleting gig with ID:", id);
                  await supabase.from('setlists').delete().eq('id', id); 
                  fetchSetlists(); 
                  console.log("[Index]     Gig deleted.");
                } else {
                  console.log("[Index]   Gig deletion cancelled.");
                }
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          
          <div className="hidden lg:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-100 dark:border-white/5">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-black font-mono text-slate-600">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button onClick={() => { setIsPreferencesOpen(true); console.log("[Index]   Opening preferences modal."); }} className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
            <UserIcon className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest hidden sm:inline">{user?.email?.split('@')[0]}</span>{isSaving && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}<Settings className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        <div className="max-w-6xl mx-auto space-y-8">
          <ActiveSongBanner song={processedSongs.find(s => s.id === activeSongIdState) || null} onClear={() => { setActiveSongId(null); console.log("[Index]   Clearing active song."); }} />
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight uppercase">{viewMode === 'repertoire' ? 'Global Repertoire' : currentList?.name}</h2>
              <p className="text-slate-500 text-xs font-medium mt-1">{songs.length} Tracks Bound to {viewMode === 'repertoire' ? 'Master Library' : 'Gig'}</p>
            </div>
            <div className="flex gap-3">
              {viewMode === 'setlist' && (
                <>
                  <Button onClick={() => { setIsRepertoirePickerOpen(true); console.log("[Index]   Opening repertoire picker."); }} className="bg-indigo-600 h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg">
                    <Library className="w-3.5 h-3.5" /> Add from Repertoire
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setIsAuditModalOpen(true); console.log("[Index]   Opening resource audit modal."); }}
                    className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                  >
                    <ClipboardCheck className="w-4 h-4" /> Resource Audit
                  </Button>
                </>
              )}
              {viewMode === 'repertoire' && (
                <>
                  <ImportSetlist onImport={(newSongs) => { 
                    console.log("[Index]   Importing new songs. Count:", newSongs.length);
                    viewMode === 'repertoire' ? syncToMasterRepertoire(user!.id, newSongs).then(fetchMasterRepertoire) : saveList(currentListId!, [...songs, ...newSongs], {}, newSongs)
                  }} />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setIsAuditModalOpen(true); console.log("[Index]   Opening resource audit modal."); }}
                    className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                  >
                    <ClipboardCheck className="w-4 h-4" /> Resource Audit
                  </Button>
                </>
              )}
            </div>
          </div>

          {viewMode === 'repertoire' && (
            <SetlistExporter 
              songs={masterRepertoire} 
              onAutoLink={handleAutoLink}
              onGlobalAutoSync={handleGlobalAutoSync}
              onBulkRefreshAudio={handleBulkRefreshAudio}
              onClearAutoLinks={handleClearAutoLinks}
              isBulkDownloading={isBulkDownloading} 
              missingAudioCount={missingAudioTracks}
            />
          )}
          {viewMode === 'setlist' && (
            <SetlistStats songs={songs} goalSeconds={currentList?.time_goal} onUpdateGoal={(s) => { console.log("[Index]   Updating setlist goal to:", s); saveList(currentListId!, songs, { time_goal: s }); }} />
          )}

          <SetlistManager 
            songs={processedSongs} 
            currentSongId={activeSongIdState || undefined}
            onSelect={handleSelectSong}
            onEdit={(s) => { 
              console.log("[Index] Editing song with ID:", s.id, "and master_id:", s.master_id);
              setEditingSongId(s.id); 
              setIsStudioModalOpen(true); 
            }}
            onRemove={(id) => { 
              console.log("[Index]   Removing song with ID:", id);
              viewMode === 'repertoire' ? supabase.from('repertoire').delete().eq('id', id).then(fetchMasterRepertoire) : saveList(currentListId!, songs.filter(s => s.id !== id))
            }}
            onUpdateKey={handleUpdateKey}
            onTogglePlayed={(id) => { 
              console.log("[Index]   Toggling played status for song ID:", id);
              viewMode === 'setlist' && saveList(currentListId!, songs.map(s => s.id === id ? { ...s, isPlayed: !s.isPlayed } : s))
            }}
            onUpdateSong={handleUpdateSong}
            onSyncProData={() => Promise.resolve()}
            onReorder={(ns) => { 
              console.log("[Index]   Reordering songs. New order:", ns.map(s => s.name));
              viewMode === 'setlist' && saveList(currentListId!, ns)
            }}
            sortMode={sortMode} setSortMode={setSortMode}
            activeFilters={activeFilters} setActiveFilters={setActiveFilters}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            onLinkAudio={(n) => { setIsSearchPanelOpen(true); transposerRef.current?.triggerSearch(n); console.log("[Index]   Opening search panel and triggering search for:", n); }}
            showHeatmap={showHeatmap}
          />
        </div>
        <MadeWithDyad />
      </main>

      <RepertoirePicker isOpen={isRepertoirePickerOpen} onClose={() => { setIsRepertoirePickerOpen(false); console.log("[Index]   Closing repertoire picker."); }} repertoire={masterRepertoire} currentSetlistSongs={currentList?.songs || []} onAdd={handleAddToGig} />
      <SongStudioModal 
        isOpen={isStudioModalOpen} 
        onClose={() => { setIsStudioModalOpen(false); console.log("[Index]   Closing studio modal."); }} 
        gigId={viewMode === 'repertoire' ? 'library' : currentListId} 
        songId={editingSongId} 
        visibleSongs={processedSongs} 
        onSelectSong={handleSelectSongById}
        allSetlists={setlists}
        masterRepertoire={masterRepertoire}
        onUpdateSetlistSongs={handleUpdateSetlistSongs}
      />
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => { setIsPreferencesOpen(false); console.log("[Index]   Closing preferences modal."); }} />
      <AdminPanel 
        isOpen={isAdminOpen} 
        onClose={() => { setIsAdminOpen(false); console.log("[Index]   Closing admin panel."); }} 
        onRefreshRepertoire={fetchMasterRepertoire}
      />
      <ResourceAuditModal isOpen={isAuditModalOpen} onClose={() => { setIsAuditModalOpen(false); console.log("[Index]   Closing resource audit modal."); }} songs={songs} onVerify={handleUpdateSong} />
      <UserGuideModal isOpen={isUserGuideOpen} onClose={() => { setIsUserGuideOpen(false); console.log("[Index]   Closing user guide modal."); }} />
      
      <aside ref={searchPanelRef} className={cn("w-full md:w-[450px] bg-white dark:bg-slate-900 border-l absolute right-0 top-20 bottom-0 z-40 transition-transform duration-500", isSearchPanelOpen ? "translate-x-0" : "translate-x-full")}>
        <AudioTransposer 
          ref={transposerRef} 
          onAddToSetlist={handleAddNewSongToCurrentSetlist} 
          onAddExistingSong={handleAddToGig}
          repertoire={masterRepertoire} 
          currentSong={processedSongs.find(s => s.id === activeSongIdState) || null}
          onUpdateSongKey={handleUpdateKey}
          onSongEnded={() => { console.log("[Index]   AudioTransposer: Song ended."); }}
          onPlaybackChange={(isPlaying) => { console.log("[Index]   AudioTransposer: Playback changed to:", isPlaying); }}
          onOpenAdmin={() => { setIsAdminOpen(true); console.log("[Index]   AudioTransposer: Opening admin panel."); }}
          currentList={currentList}
        />
      </aside>

      <FloatingCommandDock
        onOpenSearch={() => {
          setIsSearchPanelOpen(prev => {
            if (!prev) {
              setActiveSongId(null);
              transposerRef.current?.resetEngine();
              transposerRef.current?.triggerSearch("");
              console.log("[Index]   Opening search panel via FloatingCommandDock. Resetting audio engine and search.");
            }
            return !prev;
          });
        }}
        onOpenPractice={handleTogglePlayback}
        onOpenReader={() => startSheetReader(activeSongIdState || undefined)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
        onToggleHeatmap={() => setShowHeatmap(prev => !prev)}
        onOpenUserGuide={() => setIsUserGuideOpen(true)}
        showHeatmap={showHeatmap}
        viewMode={viewMode}
        hasPlayableSong={hasPlayableSong}
        hasReadableChart={hasReadableChart}
        isPlaying={isPlaying}
        onTogglePlayback={handleTogglePlayback}
        currentSongHighestNote={currentSongForSafePitch?.highest_note_original}
        currentSongPitch={currentSongForSafePitch?.pitch}
        onSafePitchToggle={handleSafePitchToggle}
        isReaderMode={isSheetReaderMode}
        activeSongId={activeSongIdState}
      />
    </div>
  );
};

export default Index;
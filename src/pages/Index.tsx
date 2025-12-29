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
import { User as UserIcon, Loader2, Play, LayoutDashboard, Search as SearchIcon, Rocket, Settings, Clock, ShieldCheck, Settings2, FileText, Guitar, Library, ListMusic, ClipboardCheck, Keyboard } from 'lucide-react';
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
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';

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
    let base = [...songs];
    
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      base = base.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.artist?.toLowerCase().includes(q)
      );
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
    
    if (sortMode === 'none') return base;
    
    const sortedBase = base.sort((a, b) => {
      const scoreA = calculateReadiness(a);
      const scoreB = calculateReadiness(b);
      return sortMode === 'ready' ? scoreB - scoreA : scoreA - scoreB;
    });
    
    return sortedBase;
  }, [songs, sortMode, searchTerm, activeFilters]);

  // Moved useCallback definitions before useEffect
  const fetchMasterRepertoire = useCallback(async () => {
    if (!user) {
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title');
      
      if (error) throw error;
      
      if (data) {
        const mappedRepertoire = data.map(d => {
          return {
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
            previewUrl: d.preview_url,
            youtubeUrl: d.youtube_url,
            appleMusicUrl: d.apple_music_url,
            pdfUrl: d.pdf_url,
            isMetadataConfirmed: d.is_metadata_confirmed,
            isKeyConfirmed: d.is_key_confirmed,
            duration_seconds: d.duration_seconds,
            notes: d.notes,
            user_tags: d.user_tags || [],
            resources: d.resources || [],
            isApproved: d.is_approved,
            preferred_reader: d.preferred_reader,
            ug_chords_text: d.ug_chords_text,
            ug_chords_config: d.ug_chords_config,
            is_pitch_linked: d.is_pitch_link_verified,
            is_ug_link_verified: d.is_ug_link_verified,
            sheet_music_url: d.sheet_music_url,
            is_sheet_verified: d.is_sheet_verified,
            is_ug_chords_present: d.is_ug_chords_present,
            highest_note_original: d.highest_note_original
          };
        });
        
        setMasterRepertoire(prevMasterRepertoire => {
          if (JSON.stringify(mappedRepertoire) !== JSON.stringify(prevMasterRepertoire)) {
            return mappedRepertoire;
          }
          return prevMasterRepertoire;
        });
      }
    } catch (err) {
      console.error("[Index] [fetchMasterRepertoire] Error fetching master repertoire:", err);
      showError("Failed to load master repertoire.");
    }
  }, [user]); // Dependency for fetchMasterRepertoire useCallback

  // Dependency for fetchSetlists useCallback
  const fetchSetlists = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('setlists')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const newSetlists = data.map(d => ({
          id: d.id,
          name: d.name,
          songs: (d.songs as any[]) || [],
          time_goal: d.time_goal
        }));
        
        setSetlists(prevSetlists => {
          if (JSON.stringify(newSetlists) !== JSON.stringify(prevSetlists)) {
            return newSetlists;
          }
          return prevSetlists;
        });
        
        let activeId = currentListId; // Use currentListId from closure
        
        if (activeId && !data.find(d => d.id === activeId)) {
          activeId = null;
        }
        
        if (!activeId && data.length > 0) {
          activeId = data[0].id;
        }
        
        if (activeId && activeId !== currentListId) { // Only update if it's actually different
          setCurrentListId(activeId);
          localStorage.setItem('active_gig_id', activeId);
        }
      } else {
        setSetlists([]); // Clear setlists if none found
        if (currentListId !== null) { // Only update if it's not already null
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
    if (user) {
      fetchSetlists();
      fetchMasterRepertoire();
    }
    
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, [user, fetchSetlists, fetchMasterRepertoire]);

  useEffect(() => {
    localStorage.setItem('gig_view_mode', viewMode);
    if (viewMode === 'repertoire' && user) {
      fetchMasterRepertoire();
    }
  }, [viewMode, user, fetchMasterRepertoire]); // Added fetchMasterRepertoire to dependencies

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isSearchPanelOpen &&
        searchPanelRef.current &&
        !searchPanelRef.current.contains(event.target as Node) &&
        searchButtonRef.current &&
        !searchButtonRef.current.contains(event.target as Node)
      ) {
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
      return;
    }
    
    setIsSaving(true);
    
    try {
      let finalSongs = updatedSongs;
      
      if (songsToSync?.length) {
        const syncedBatch = await syncToMasterRepertoire(user.id, songsToSync);
        finalSongs = updatedSongs.map(s => {
          const matched = syncedBatch.find(sb => sb.id === s.id || (sb.name === s.name && sb.artist === s.artist));
          return matched ? { ...s, master_id: matched.master_id } : s;
        });
      }
      
      const cleaned = finalSongs.map(({ isSyncing, ...rest }) => rest);
      
      await supabase
        .from('setlists')
        .update({
          songs: cleaned,
          updated_at: new Date().toISOString(),
          ...updates
        })
        .eq('id', listId);
      
      setSetlists(prev => {
        const newSetlists = prev.map(l => 
          l.id === listId 
            ? { ...l, songs: finalSongs, ...updates } 
            : l
        );
        return newSetlists;
      });
      
      if (songsToSync?.length) {
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
    if (viewMode === 'repertoire') {
      const target = masterRepertoire.find(s => s.id === songId);
      if (target) {
        syncToMasterRepertoire(user!.id, [{ ...target, ...updates }]).then(fetchMasterRepertoire);
      } else {
        console.warn("[Index] Target song not found in master repertoire for update.");
      }
      return;
    }
    
    if (!currentListId) {
      return;
    }
    
    const updatedSongs = currentList!.songs.map(s => 
      s.id === songId ? { ...s, ...updates } : s
    );
    
    saveList(currentListId, updatedSongs, {}, [updatedSongs.find(s => s.id === songId)!]);
  };

  const handleUpdateKey = (songId: string, newTargetKey: string) => {
    handleUpdateSong(songId, { targetKey: newTargetKey });
  };

  const handleAddToGig = (song: SetlistSong) => {
    if (!currentListId) {
      showError("No active setlist selected. Please create or select one.");
      return;
    }
    
    const newEntry = {
      ...song,
      id: Math.random().toString(36).substr(2, 9),
      master_id: song.master_id || song.id,
      isPlayed: false,
      isApproved: false
    };
    
    saveList(currentListId, [...currentList!.songs, newEntry]);
    showSuccess(`Added "${song.name}" to gig`);
  };

  const handleAddNewSongToCurrentSetlist = async (
    previewUrl: string,
    name: string,
    artist: string,
    youtubeUrl?: string,
    ugUrl?: string,
    appleMusicUrl?: string,
    genre?: string,
    pitch?: number
  ) => {
    if (!currentListId) {
      showError("No active setlist selected. Please create or select one.");
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
    
    await saveList(currentListId, [...currentList!.songs, newSong], {}, [newSong]);
    showSuccess(`Added "${name}" to gig`);
    setActiveSongId(newSong.id);
    setIsSearchPanelOpen(false);
  };

  const handleUpdateSetlistSongs = useCallback(async (
    setlistId: string,
    songToUpdate: SetlistSong,
    action: 'add' | 'remove'
  ) => {
    const targetSetlist = setlists.find(l => l.id === setlistId);
    if (!targetSetlist) {
      console.error(`[Index] Setlist with ID ${setlistId} not found.`);
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
          isApproved: false
        };
        updatedSongsArray.push(newSetlistSong);
      }
    } else if (action === 'remove') {
      updatedSongsArray = updatedSongsArray.filter(s => 
        (s.master_id && s.master_id !== songToUpdate.master_id) && 
        s.id !== songToUpdate.id
      );
    }
    
    await saveList(setlistId, updatedSongsArray);
    fetchSetlists();
  }, [setlists, saveList, fetchSetlists]);

  const startPerformance = () => {
    const playable = songs.filter(s => 
      s.isApproved && 
      s.previewUrl && 
      !(s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'))
    );
    
    if (!playable.length) {
      showError("No approved tracks found.");
      return;
    }
    
    setIsPerformanceMode(true);
    handleSelectSong(playable[0]);
  };

  const startSheetReader = (initialSongId?: string) => {
    // FIX: Reset filters to ensure songs are visible in the Reader
    setActiveFilters(INITIAL_FILTERS);
    setSearchTerm("");
    setSortMode("none");
    
    // Calculate readable songs based on the full list (not filtered)
    const readable = songs.filter(s => 
      s.ugUrl || 
      s.pdfUrl || 
      s.leadsheetUrl || 
      s.ug_chords_text
    );
    
    if (!readable.length) {
      showError("No readable charts found.");
      return;
    }
    
    // Set flag before navigating
    sessionStorage.setItem('from_dashboard', 'true');

    // If we have an active song, pass it to the reader
    if (activeSongIdState) {
      navigate(`/sheet-reader/${activeSongIdState}`);
    } else {
      navigate('/sheet-reader');
    }
  };

  const handleSelectSong = async (song: SetlistSong) => {
    setActiveSongId(song.id);
    
    if (song.previewUrl && transposerRef.current) {
      await transposerRef.current.loadFromUrl(song.previewUrl, song.name, song.artist || "Unknown");
      
      // Ensure song.pitch is a number, default to 0 if not.
      const pitchValue = typeof song.pitch === 'number' ? song.pitch : 0;
      if (transposerRef.current && transposerRef.current.setPitch) {
        transposerRef.current.setPitch(pitchValue);
      }
    }
  };

  const handleSelectSongById = useCallback((songId: string) => {
    const song = processedSongs.find(s => s.id === songId);
    if (song) {
      handleSelectSong(song);
    }
  }, [processedSongs, handleSelectSong]);

  const missingAudioTracks = useMemo(() => {
    return masterRepertoire.filter(song => 
      song.youtubeUrl && 
      (!song.previewUrl || (song.previewUrl.includes('apple.com') || song.previewUrl.includes('itunes-assets')))
    ).length;
  }, [masterRepertoire]);

  const handleAutoLink = async () => {
    setIsAutoLinking(true);
    showInfo("Initiating Smart-Link Discovery...");
    
    try {
      const missingLinks = masterRepertoire.filter(s => !s.youtubeUrl || s.youtubeUrl.trim() === '');
      if (missingLinks.length === 0) {
        showSuccess("All tracks already have YouTube links.");
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('bulk-populate-youtube-links', {
        body: {
          songIds: missingLinks.map(s => s.id)
        }
      });
      
      if (error) throw error;
      
      showSuccess("Smart-Link Discovery Complete!");
      fetchMasterRepertoire();
    } catch (err: any) {
      console.error("[Index] [handleAutoLink] Smart-Link Failed:", err.message);
      showError(`Smart-Link Failed: ${err.message}`);
    } finally {
      setIsAutoLinking(false);
    }
  };

  const handleGlobalAutoSync = async () => {
    setIsGlobalSyncing(true);
    showInfo("Initiating Global Auto-Sync Pipeline...");
    
    try {
      const songsToSync = masterRepertoire.filter(s => !s.isMetadataConfirmed || !s.auto_synced);
      if (songsToSync.length === 0) {
        showSuccess("All tracks are already optimized.");
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('global-auto-sync', {
        body: {
          songIds: songsToSync.map(s => s.id),
          overwrite: false
        }
      });
      
      if (error) throw error;
      
      showSuccess("Global Auto-Sync Pipeline Complete!");
      fetchMasterRepertoire();
    } catch (err: any) {
      console.error("[Index] [handleGlobalAutoSync] Global Auto-Sync Failed:", err.message);
      showError(`Global Auto-Sync Failed: ${err.message}`);
    } finally {
      setIsGlobalSyncing(false);
    }
  };

  const handleBulkRefreshAudio = async () => {
    setIsBulkDownloading(true);
    showInfo("Initiating Bulk Audio Re-Extraction...");
    
    try {
      const songsToExtract = masterRepertoire.filter(s => 
        s.youtubeUrl && 
        (!s.previewUrl || (s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets')))
      );
      
      if (songsToExtract.length === 0) {
        showSuccess("No YouTube links found for re-extraction.");
        return;
      }
      
      for (const song of songsToExtract) {
        showInfo(`Extracting audio for: ${song.name}`);
        
        const targetVideoUrl = cleanYoutubeUrl(song.youtubeUrl || '');
        if (!targetVideoUrl) {
          continue;
        }
        
        const API_BASE_URL = "https://yt-audio-api-1-wedr.onrender.com";
        const tokenResponse = await fetch(`${API_BASE_URL}/?url=${encodeURIComponent(targetVideoUrl)}`);
        
        if (!tokenResponse.ok) throw new Error("API Connection Failed");
        
        const { token } = await tokenResponse.json();
        
        let attempts = 0;
        let fileResponse: Response | undefined;
        let downloadReady = false;
        
        while (attempts < 30 && !downloadReady) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 5000));
          fileResponse = await fetch(`${API_BASE_URL}/download?token=${token}`);
          
          if (fileResponse.status === 200) {
            downloadReady = true;
            break;
          }
        }
        
        if (!downloadReady || !fileResponse) throw new Error("Audio extraction timed out.");
        
        const audioArrayBuffer = await fileResponse.arrayBuffer();
        const audioBuffer = await Tone.getContext().decodeAudioData(audioArrayBuffer.slice(0));
        
        const fileName = `${user?.id}/${song.id}/${Date.now()}.mp3`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('public_audio')
          .upload(fileName, audioArrayBuffer, {
            contentType: 'audio/mpeg',
            upsert: true
          });
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('public_audio').getPublicUrl(uploadData.path);
        
        await supabase
          .from('repertoire')
          .update({
            preview_url: publicUrl,
            duration_seconds: audioBuffer.duration,
            extraction_status: 'COMPLETED'
          })
          .eq('id', song.id);
        
        showSuccess(`Audio extracted for "${song.name}"`);
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
    setIsClearingAutoLinks(true);
    showInfo("Clearing auto-populated links...");
    
    try {
      const autoPopulated = masterRepertoire.filter(s => s.metadata_source === 'auto_populated');
      if (autoPopulated.length === 0) {
        showSuccess("No auto-populated links found to clear.");
        return;
      }
      
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
      fetchMasterRepertoire();
    } catch (err: any) {
      console.error("[Index] [handleClearAutoLinks] Failed to clear auto-links:", err.message);
      showError(`Failed to clear auto-links: ${err.message}`);
    } finally {
      setIsClearingAutoLinks(false);
    }
  };

  const hasPlayableSong = useMemo(() => {
    return songs.filter(s => 
      s.isApproved && 
      s.previewUrl && 
      !(s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'))
    ).length > 0;
  }, [songs]);

  const hasReadableChart = useMemo(() => {
    return songs.some(s => 
      s.ugUrl || 
      s.pdfUrl || 
      s.leadsheetUrl || 
      s.ug_chords_text
    );
  }, [songs]);

  const handleTogglePlayback = useCallback(() => {
    transposerRef.current?.togglePlayback();
  }, []);

  const isPlaying = useMemo(() => {
    return transposerRef.current?.getIsPlaying() || false;
  }, [transposerRef.current?.getIsPlaying()]);

  const handleSafePitchToggle = useCallback((active: boolean, safePitch: number) => {
    if (!transposerRef.current) {
      return;
    }
    
    if (active) {
      transposerRef.current.setPitch(safePitch);
    } else {
      transposerRef.current.setPitch(0);
    }
  }, []);

  const currentSongForSafePitch = useMemo(() => {
    if (!activeSongIdState) {
      return null;
    }
    
    const song = songs.find(s => s.id === activeSongIdState);
    return song;
  }, [activeSongIdState, songs]);

  useEffect(() => {
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
        handleTogglePlayback();
      }
      
      // REMOVED: R shortcut logic
      
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowHeatmap(prev => !prev);
      }
      
      if (e.key === 'Escape') {
        if (isPerformanceMode) {
          setIsPerformanceMode(false);
        } else if (isSearchPanelOpen) {
          setIsSearchPanelOpen(false);
        } else if (isPreferencesOpen) {
          setIsPreferencesOpen(false);
        } else if (isAdminOpen) {
          setIsAdminOpen(false);
        } else if (isAuditModalOpen) {
          setIsAuditModalOpen(false);
        } else if (isStudioModalOpen) {
          setIsStudioModalOpen(false);
        } else if (isSetlistSettingsOpen) {
          setIsSetlistSettingsOpen(false);
        } else if (isRepertoirePickerOpen) {
          setIsRepertoirePickerOpen(false);
        } else if (isCommandHubOpen) {
          setIsCommandHubOpen(false);
        } else if (isUserGuideOpen) {
          setIsUserGuideOpen(false);
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    handleTogglePlayback,
    isPerformanceMode,
    isSearchPanelOpen,
    isPreferencesOpen,
    isAdminOpen,
    isAuditModalOpen,
    isStudioModalOpen,
    isSetlistSettingsOpen,
    isRepertoirePickerOpen,
    isCommandHubOpen,
    isUserGuideOpen
  ]);

  if (isPerformanceMode) {
    const activeSong = songs.find(s => s.id === activeSongIdState);
    const playableSongs = songs.filter(s => 
      s.isApproved && 
      s.previewUrl && 
      !(s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'))
    );
    
    const currentPlayableIndex = playableSongs.findIndex(s => s.id === activeSongIdState);
    
    const onNextPerformance = () => {
      const nextIndex = (currentPlayableIndex + 1) % playableSongs.length;
      handleSelectSong(playableSongs[nextIndex]);
    };
    
    const onPreviousPerformance = () => {
      const prevIndex = (currentPlayableIndex - 1 + playableSongs.length) % playableSongs.length;
      handleSelectSong(playableSongs[prevIndex]);
    };
    
    const onShufflePerformance = () => {
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
        onClose={() => { setIsPerformanceMode(false); }}
        onUpdateSong={handleUpdateSong}
        onUpdateKey={handleUpdateKey}
        analyzer={transposerRef.current?.getAnalyzer()}
        gigId={currentListId}
      />
    );
  }

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
              variant="ghost" 
              size="sm" 
              onClick={() => setViewMode('repertoire')}
              className={cn(
                "h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg transition-all",
                viewMode === 'repertoire' 
                  ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" 
                  : "text-slate-500"
              )}
            >
              <Library className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Repertoire</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewMode('setlist')}
              className={cn(
                "h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg transition-all",
                viewMode === 'setlist' 
                  ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" 
                  : "text-slate-500"
              )}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Gigs</span>
            </Button>
          </div>
          
          {viewMode === 'setlist' && (
            <SetlistSelector
              setlists={setlists}
              currentId={currentListId || ''}
              onSelect={(id) => {
                setCurrentListId(id);
                localStorage.setItem('active_gig_id', id);
              }}
              onCreate={async () => {
                const name = prompt("Gig Name:");
                if (name) {
                  const { data } = await supabase
                    .from('setlists')
                    .insert([{ user_id: user?.id, name, songs: [] }])
                    .select()
                    .single();
                  
                  if (data) {
                    await fetchSetlists();
                    setCurrentListId(data[0].id);
                  } else {
                  }
                }
              }}
              onDelete={async (id) => {
                if(confirm("Delete gig?")) {
                  await supabase.from('setlists').delete().eq('id', id);
                  fetchSetlists();
                } else {
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
          
          <button 
            onClick={() => { setIsPreferencesOpen(true); }}
            className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full"
          >
            <UserIcon className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest hidden sm:inline">{user?.email?.split('@')[0]}</span>
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
            <Settings className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </nav>
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        <div className="max-w-6xl mx-auto space-y-8">
          <ActiveSongBanner 
            song={processedSongs.find(s => s.id === activeSongIdState) || null}
            onClear={() => { setActiveSongId(null); }}
          />
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight uppercase">{viewMode === 'repertoire' ? 'Global Repertoire' : currentList?.name}</h2>
              <p className="text-slate-500 text-xs font-medium mt-1">{songs.length} Tracks Bound to {viewMode === 'repertoire' ? 'Master Library' : 'Gig'}</p>
            </div>
            
            <div className="flex gap-3">
              {viewMode === 'setlist' && (
                <>
                  <Button 
                    onClick={() => { setIsRepertoirePickerOpen(true); }}
                    className="bg-indigo-600 h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg"
                  >
                    <Library className="w-3.5 h-3.5" />
                    Add from Repertoire
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setIsAuditModalOpen(true); }}
                    className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Resource Audit
                  </Button>
                </>
              )}
              
              {viewMode === 'repertoire' && (
                <>
                  <ImportSetlist 
                    onImport={(newSongs) => {
                      viewMode === 'repertoire' 
                        ? syncToMasterRepertoire(user!.id, newSongs).then(fetchMasterRepertoire) 
                        : saveList(currentListId!, [...songs, ...newSongs], {}, newSongs)
                    }} 
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setIsAuditModalOpen(true); }}
                    className="h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Resource Audit
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
            <SetlistStats 
              songs={songs}
              goalSeconds={currentList?.time_goal}
              onUpdateGoal={(s) => {
                saveList(currentListId!, songs, { time_goal: s });
              }}
            />
          )}
          
          <SetlistManager
            songs={processedSongs}
            currentSongId={activeSongIdState || undefined}
            onSelect={handleSelectSong}
            onEdit={(s) => { setEditingSongId(s.id); setIsStudioModalOpen(true); }}
            onRemove={(id) => {
              viewMode === 'repertoire' 
                ? supabase.from('repertoire').delete().eq('id', id).then(fetchMasterRepertoire) 
                : saveList(currentListId!, songs.filter(s => s.id !== id))
            }}
            onUpdateKey={handleUpdateKey}
            onTogglePlayed={(id) => {
              viewMode === 'setlist' && saveList(currentListId!, songs.map(s => 
                s.id === id ? { ...s, isPlayed: !s.isPlayed } : s
              ))
            }}
            onUpdateSong={handleUpdateSong}
            onSyncProData={() => Promise.resolve()}
            onReorder={(ns) => {
              viewMode === 'setlist' && saveList(currentListId!, ns)
            }}
            sortMode={sortMode}
            setSortMode={setSortMode}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onLinkAudio={(n) => {
              setIsSearchPanelOpen(true);
              transposerRef.current?.triggerSearch(n);
            }}
            showHeatmap={showHeatmap}
          />
        </div>
        
        <MadeWithDyad />
      </main>
      
      <RepertoirePicker
        isOpen={isRepertoirePickerOpen}
        onClose={() => { setIsRepertoirePickerOpen(false); }}
        repertoire={masterRepertoire}
        currentSetlistSongs={currentList?.songs || []}
        onAdd={handleAddToGig}
      />
      
      <SongStudioModal
        isOpen={isStudioModalOpen}
        onClose={() => { setIsStudioModalOpen(false); }}
        gigId={viewMode === 'repertoire' ? 'library' : currentListId}
        songId={editingSongId}
        visibleSongs={processedSongs}
        onSelectSong={handleSelectSongById}
        allSetlists={setlists}
        masterRepertoire={masterRepertoire}
        onUpdateSetlistSongs={handleUpdateSetlistSongs}
      />
      
      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => { setIsPreferencesOpen(false); }}
      />
      
      <AdminPanel
        isOpen={isAdminOpen}
        onClose={() => { setIsAdminOpen(false); }}
        onRefreshRepertoire={fetchMasterRepertoire}
      />
      
      <ResourceAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => { setIsAuditModalOpen(false); }}
        songs={songs}
        onVerify={handleUpdateSong}
        onRefreshRepertoire={fetchMasterRepertoire}
      />
      
      <UserGuideModal
        isOpen={isUserGuideOpen}
        onClose={() => { setIsUserGuideOpen(false); }}
      />
      
      <aside 
        ref={searchPanelRef}
        className={cn(
          "w-screen md:w-[450px] bg-white dark:bg-slate-900 border-l absolute right-0 top-20 bottom-0 z-40 transition-transform duration-500",
          isSearchPanelOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <AudioTransposer
          ref={transposerRef}
          onAddToSetlist={handleAddNewSongToCurrentSetlist}
          onAddExistingSong={handleAddToGig}
          repertoire={masterRepertoire}
          currentSong={processedSongs.find(s => s.id === activeSongIdState) || null}
          onUpdateSongKey={handleUpdateKey}
          onSongEnded={() => { }}
          onPlaybackChange={useCallback((isPlaying) => { }, [])}
          onOpenAdmin={() => { setIsAdminOpen(true); }}
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
        isReaderMode={false}
        activeSongId={activeSongIdState}
      />
    </div>
  );
};

export default Index;
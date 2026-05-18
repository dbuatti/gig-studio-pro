"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useSettings } from '@/hooks/use-settings';
import { useAutoplay } from '@/hooks/use-autoplay';
import { showSuccess, showInfo, showWarning, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { syncToMasterRepertoire, calculateReadiness } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { autoVibeCheck } from '@/utils/vibeUtils';
import * as Tone from 'tone';

// UI Components
import { Loader2, Plus, Music2, Calendar, Sparkles } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

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
import { calculateSemitones } from '@/utils/keyUtils';
import SetlistSettingsModal from '@/components/SetlistSettingsModal';
import SetlistSelector from '@/components/SetlistSelector';
import GlobalSearchModal from '@/components/GlobalSearchModal';
import GigPlannerModal from '@/components/GigPlannerModal';
import MDAuditModal from '@/components/MDAuditModal';
import ShortcutCheatSheet from '@/components/ShortcutCheatSheet';
import DashboardHeader from '@/components/DashboardHeader';
import StorageAuditModal from '@/components/StorageAuditModal';
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
  const [loading, setLoading] = useState(true);
  const [isShuffleAllMode, setIsShuffleAllMode] = useState(false);
  const [floatingDockMenuOpen, setFloatingDockMenuOpen] = useState(false);
  const [isShortcutSheetOpen, setIsShortcutSheetOpen] = useState(false);

  const audio = useToneAudio(true);

  const activeSetlist = useMemo(() => 
    allSetlists.find(l => l.id === activeSetlistId), 
    [allSetlists, activeSetlistId]
  );

  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('gig_search_term') || "");
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work' | 'manual' | 'energy-asc' | 'energy-desc' | 'zig-zag' | 'wedding-ramp'>(() => 
    (localStorage.getItem('gig_sort_mode') as any) || 'none'
  );
  const [activeFilters, setActiveFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('gig_active_filters');
    try { return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : DEFAULT_FILTERS; } catch { return DEFAULT_FILTERS; }
  });
  const [showHeatmap, setShowHeatmap] = useState(() => localStorage.getItem('gig_show_heatmap') === 'true');

  const filteredAndSortedSongs = useMemo(() => {
    if (!activeSetlist) return [];
    let songs = [...activeSetlist.songs];
    const q = searchTerm.toLowerCase();
    if (q) songs = songs.filter(s => s.name.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));
    
    if (sortMode === 'ready') songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    else if (sortMode === 'work') songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    else if (sortMode.startsWith('energy') || sortMode === 'zig-zag' || sortMode === 'wedding-ramp') {
      songs = sortSongsByStrategy(songs, sortMode);
    }
    return songs;
  }, [activeSetlist, searchTerm, sortMode]);

  const { 
    isAutoplayActive, activeSong, handleSelectSong, playNext, toggleAutoplay 
  } = useAutoplay({ 
    audio, 
    filteredSongs: filteredAndSortedSongs, 
    masterRepertoire, 
    isShuffleAll: isShuffleAllMode 
  });

  const activeDashboardView = (searchParams.get('view') as 'gigs' | 'repertoire') || defaultDashboardView;

  useEffect(() => {
    localStorage.setItem('gig_active_filters', JSON.stringify(activeFilters));
    localStorage.setItem('gig_search_term', searchTerm);
    localStorage.setItem('gig_sort_mode', sortMode);
    localStorage.setItem('gig_show_heatmap', showHeatmap.toString());
  }, [activeFilters, searchTerm, sortMode, showHeatmap]);

  const fetchSetlistsAndRepertoire = useCallback(async (isInitial = false) => {
    if (!userId) return;
    if (isInitial) setLoading(true);
    try {
      const { data: setlistsData } = await supabase.from('setlists').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      const { data: repertoireData } = await supabase.from('repertoire').select('*').eq('user_id', userId).order('title');
      
      const mappedRepertoire: SetlistSong[] = (repertoireData || []).map(d => ({
        id: d.id, master_id: d.id, name: d.title, artist: d.artist,
        originalKey: d.original_key || 'TBC', targetKey: d.target_key || d.original_key || 'TBC',
        pitch: d.pitch ?? 0, previewUrl: d.extraction_status === 'completed' && d.audio_url ? d.audio_url : d.preview_url,
        youtubeUrl: d.youtube_url, ugUrl: d.ug_url, appleMusicUrl: d.apple_music_url, 
        pdfUrl: d.pdf_url, leadsheetUrl: d.leadsheet_url, bpm: d.bpm, genre: d.genre,
        isSyncing: false, isMetadataConfirmed: d.is_metadata_confirmed, isKeyConfirmed: d.is_key_confirmed,
        notes: d.notes, lyrics: d.lyrics, resources: d.resources || [], user_tags: d.user_tags || [],
        is_pitch_linked: d.is_pitch_linked ?? true, duration_seconds: d.duration_seconds,
        key_preference: d.key_preference, is_active: d.is_active, fineTune: d.fineTune,
        tempo: d.tempo, volume: d.volume, isApproved: d.is_approved, is_ready_to_sing: d.is_ready_to_sing,
        preferred_reader: d.preferred_reader, ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: d.is_ug_chords_present, highest_note_original: d.highest_note_original,
        audio_url: d.audio_url, extraction_status: d.extraction_status,
        energy_level: d.energy_level as EnergyZone,
        comfort_level: (d.comfort_level !== null && d.comfort_level <= 5) ? d.comfort_level * 20 : (d.comfort_level ?? 0),
        needs_improvement: d.needs_improvement ?? false,
      }));
      setMasterRepertoire(mappedRepertoire);

      const setlistsWithSongs: Setlist[] = [];
      for (const setlist of setlistsData || []) {
        const { data: junctionData } = await supabase.from('setlist_songs').select('*').eq('setlist_id', setlist.id).order('sort_order', { ascending: true });
        const songs: SetlistSong[] = [];
        junctionData?.forEach(j => {
          const master = mappedRepertoire.find(r => r.id === j.song_id);
          if (master) songs.push({ ...master, id: j.id, master_id: master.id, isPlayed: j.isPlayed || false, set_group: j.set_group || 1 });
        });
        setlistsWithSongs.push({ id: setlist.id, name: setlist.name, songs, time_goal: setlist.time_goal, set_names: setlist.set_names, stimulus_text: setlist.stimulus_text });
      }
      setAllSetlists(setlistsWithSongs);
      const savedId = localStorage.getItem('active_setlist_id');
      setActiveSetlistId(savedId && setlistsWithSongs.some(s => s.id === savedId) ? savedId : (setlistsWithSongs[0]?.id || null));
    } catch (err: any) {
      showError(`Failed to load data: ${err.message}`);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!authLoading && userId) fetchSetlistsAndRepertoire(true);
    else if (!authLoading && !userId) navigate('/landing');
  }, [userId, authLoading, fetchSetlistsAndRepertoire, navigate]);

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
  const [isSetlistSettingsOpen, setIsSetlistSettingsOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isMDAuditOpen, setIsMDAuditOpen] = useState(false);
  const [isGigPlannerOpen, setIsGigPlannerOpen] = useState(false);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isStorageAuditOpen, setIsStorageAuditOpen] = useState(false);

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
      await fetchSetlistsAndRepertoire();
    } catch (err: any) { showError(`Update failed: ${err.message}`); }
  }, [activeSetlist, userId, fetchSetlistsAndRepertoire]);

  const handleTogglePlayed = async (songId: string) => {
    const song = activeSetlist?.songs.find(s => s.id === songId);
    if (!song) return;
    try {
      const { error } = await supabase
        .from('setlist_songs')
        .update({ isPlayed: !song.isPlayed })
        .eq('id', songId);
      if (error) throw error;
      await fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to update status: ${err.message}`);
    }
  };

  const handleReorderSongs = async (newSongs: SetlistSong[]) => {
    if (!activeSetlistId) return;
    try {
      const updates = newSongs.map((s, i) => ({
        id: s.id,
        sort_order: i
      }));
      
      for (const update of updates) {
        await supabase
          .from('setlist_songs')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }
      
      await fetchSetlistsAndRepertoire();
      showSuccess("Setlist order saved");
    } catch (err: any) {
      showError(`Failed to reorder: ${err.message}`);
    }
  };

  const handleRemoveSongFromSetlist = async (songId: string) => {
    try {
      const { error } = await supabase
        .from('setlist_songs')
        .delete()
        .eq('id', songId);
      if (error) throw error;
      await fetchSetlistsAndRepertoire();
      showSuccess("Song removed from setlist");
    } catch (err: any) {
      showError(`Failed to remove song: ${err.message}`);
    }
  };

  const handleDeleteSong = async (songId: string) => {
    try {
      const { error } = await supabase
        .from('repertoire')
        .delete()
        .eq('id', songId);
      if (error) throw error;
      await fetchSetlistsAndRepertoire();
      showSuccess("Song deleted from library");
    } catch (err: any) {
      showError(`Failed to delete song: ${err.message}`);
    }
  };

  const handleCreateSetlist = async () => {
    if (!userId) return;
    const name = prompt("Enter setlist name:");
    if (!name) return;
    try {
      const { data, error } = await supabase
        .from('setlists')
        .insert({ user_id: userId, name })
        .select()
        .single();
      if (error) throw error;
      await fetchSetlistsAndRepertoire();
      setActiveSetlistId(data.id);
      showSuccess("Setlist created");
    } catch (err: any) {
      showError(`Failed to create: ${err.message}`);
    }
  };

  const handleRenameSetlist = async (id: string) => {
    const newName = prompt("Enter new setlist name:");
    if (!newName) return;
    try {
      const { error } = await supabase
        .from('setlists')
        .update({ name: newName })
        .eq('id', id);
      if (error) throw error;
      await fetchSetlistsAndRepertoire();
      showSuccess("Setlist renamed");
    } catch (err: any) {
      showError(`Failed to rename: ${err.message}`);
    }
  };

  const handleDeleteSetlist = async (id: string) => {
    if (!confirm("Are you sure you want to delete this setlist?")) return;
    try {
      const { error } = await supabase
        .from('setlists')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      if (activeSetlistId === id) {
        setActiveSetlistId(null);
        localStorage.removeItem('active_setlist_id');
      }
      
      await fetchSetlistsAndRepertoire();
      showSuccess("Setlist deleted");
    } catch (err: any) {
      showError(`Failed to delete: ${err.message}`);
    }
  };

  const handleDuplicateSetlist = async (id: string) => {
    const source = allSetlists.find(s => s.id === id);
    if (!source || !userId) return;
    
    try {
      const { data: newList, error: listError } = await supabase
        .from('setlists')
        .insert({ user_id: userId, name: `${source.name} (Copy)` })
        .select()
        .single();
      
      if (listError) throw listError;
      
      const songUpdates = source.songs.map((s, i) => ({
        setlist_id: newList.id,
        song_id: s.master_id,
        sort_order: i,
        set_group: s.set_group
      }));
      
      if (songUpdates.length > 0) {
        const { error: songsError } = await supabase
          .from('setlist_songs')
          .insert(songUpdates);
        if (songsError) throw songsError;
      }
      
      await fetchSetlistsAndRepertoire();
      setActiveSetlistId(newList.id);
      showSuccess("Setlist duplicated");
    } catch (err: any) {
      showError(`Failed to duplicate: ${err.message}`);
    }
  };

  const handleGlobalSearchAdd = async (url: string, name: string, artist: string, yt?: string, ug?: string, apple?: string, gen?: string) => {
    if (!userId) return;
    const newSong: Partial<SetlistSong> = { name, artist, previewUrl: url, youtubeUrl: yt, ugUrl: ug, appleMusicUrl: apple, genre: gen, originalKey: 'TBC', targetKey: 'TBC', pitch: 0, isMetadataConfirmed: true, is_active: true };
    try {
      const synced = await syncToMasterRepertoire(userId, [newSong]);
      const song = synced[0];
      autoVibeCheck(userId, song);
      if (activeDashboardView === 'gigs' && activeSetlistId) await handleUpdateSetlistSongs(activeSetlistId, song, 'add');
      else await fetchSetlistsAndRepertoire();
      showSuccess(`"${name}" added to repertoire!`);
      handleEditSong(song, 'details');
    } catch (err: any) { showError("Failed to add discovered song."); }
  };

  const handleUpdateSetlistSongs = useCallback(async (setlistId: string, song: SetlistSong, action: 'add' | 'remove', setGroup?: number) => {
    try {
      if (action === 'add') {
        const targetSetlist = allSetlists.find(s => s.id === setlistId);
        const songMasterId = song.master_id || song.id;
        if (targetSetlist?.songs.some(s => s.master_id === songMasterId)) {
          showWarning(`"${song.name}" is already in this setlist.`);
          return;
        }
        await supabase.from('setlist_songs').insert({ setlist_id: setlistId, song_id: songMasterId, sort_order: targetSetlist?.songs.length || 0, set_group: setGroup || 1 });
        showSuccess(`"${song.name}" added to setlist.`);
      } else {
        await supabase.from('setlist_songs').delete().eq('setlist_id', setlistId).eq('song_id', song.master_id || song.id);
      }
      await fetchSetlistsAndRepertoire();
    } catch (err: any) { showError(`Failed to update setlist: ${err.message}`); }
  }, [fetchSetlistsAndRepertoire, allSetlists]);

  const handleBulkVibeCheck = async () => {
    const songsToVibeCheck = masterRepertoire.filter(s => !s.energy_level && s.name && s.artist);
    if (songsToVibeCheck.length === 0) {
      showInfo("All songs already have an Energy Zone.");
      return;
    }

    showInfo(`Initiating AI Vibe Check for ${songsToVibeCheck.length} tracks...`);
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < songsToVibeCheck.length; i++) {
      const song = songsToVibeCheck[i];
      try {
        // Rate limiting delay to prevent quota issues
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 2500));

        const { data, error } = await supabase.functions.invoke('vibe-check', {
          body: {
            title: song.name,
            artist: song.artist,
            bpm: song.bpm,
            genre: song.genre,
            userTags: song.user_tags
          }
        });

        if (error) throw error;

        if (data?.energy_level) {
          await syncToMasterRepertoire(userId!, [{
            id: song.master_id || song.id,
            energy_level: data.energy_level,
            genre: data.refined_genre || song.genre
          }]);
          successCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    await fetchSetlistsAndRepertoire();
    if (successCount > 0) {
      showSuccess(`Bulk Vibe Check Complete: ${successCount} tracks updated.`);
    } else if (failCount > 0) {
      showError(`Vibe Check failed for ${failCount} tracks.`);
    }
  };

  if (authLoading || isFetchingSettings || loading) {
    return <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-indigo-600/10 to-transparent pointer-events-none" />
      
      <div className="flex-1 flex flex-col p-4 md:p-10 lg:p-12 overflow-y-auto custom-scrollbar relative z-10">
        <Tabs value={activeDashboardView} onValueChange={(v) => setSearchParams({ view: v })} className="w-full">
          <div className="mb-10 flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">Welcome Back</h2>
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <DashboardHeader
            onOpenStorageAudit={() => setIsStorageAuditOpen(true)}
            onOpenAdmin={() => setIsAdminPanelOpen(true)}
            onOpenMDAudit={() => setIsMDAuditOpen(true)}
            onToggleShuffleAll={() => setIsShuffleAllMode(!isShuffleAllMode)}
            isShuffleAllMode={isShuffleAllMode}
            onOpenKeyMatrix={() => setIsKeyManagementOpen(true)}
            onOpenPreferences={() => setIsPreferencesOpen(true)}
            onOpenUserGuide={() => setIsUserGuideOpen(true)}
          />

          {isGoalTrackerEnabled && (
            <div className="mb-12 animate-in fade-in slide-in-from-top-6 duration-700 delay-100">
              <GoalTracker repertoire={masterRepertoire} onFilterApply={(f) => setActiveFilters(prev => ({...prev, ...f}))} />
            </div>
          )}

          {activeDashboardView === 'gigs' && !activeSetlistId && !loading && (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 animate-in fade-in zoom-in duration-700">
              <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                <Calendar className="w-16 h-16 text-indigo-500 mx-auto mb-6 opacity-50" />
                <h2 className="text-2xl font-black uppercase tracking-tight">No Gigs Found</h2>
                <p className="text-slate-400 max-w-xs mx-auto mt-2 font-medium">
                  Create your first setlist to start managing your performances.
                </p>
                <Button
                  onClick={handleCreateSetlist}
                  className="mt-8 h-14 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest gap-3 shadow-xl shadow-indigo-600/20 transition-all hover:scale-105"
                >
                  <Plus className="w-5 h-5" /> Create Setlist
                </Button>
              </div>
            </div>
          )}

          {activeDashboardView === 'repertoire' && masterRepertoire.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 animate-in fade-in zoom-in duration-700">
              <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 shadow-2xl">
                <Music2 className="w-16 h-16 text-indigo-500 mx-auto mb-6 opacity-50" />
                <h2 className="text-2xl font-black uppercase tracking-tight">Library is Empty</h2>
                <p className="text-slate-400 max-w-xs mx-auto mt-2 font-medium">
                  Add your first song to build your professional repertoire.
                </p>
                <Button
                  onClick={() => setIsGlobalSearchOpen(true)}
                  className="mt-8 h-14 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest gap-3 shadow-xl shadow-indigo-600/20 transition-all hover:scale-105"
                >
                  <Plus className="w-5 h-5" /> Add First Song
                </Button>
              </div>
            </div>
          )}

          {activeDashboardView === 'gigs' && activeSong && (
            <div className="mb-12 animate-in fade-in slide-in-from-top-8 duration-700 delay-200">
              <ActiveSongBanner 
                song={activeSong} 
                isPlaying={audio.isPlaying} 
                onTogglePlayback={audio.togglePlayback} 
                onClear={() => { audio.stopPlayback(); }} 
                isLoadingAudio={audio.isLoadingAudio} 
                nextSongName={filteredAndSortedSongs[filteredAndSortedSongs.findIndex(s => s.id === activeSong.id) + 1]?.name} 
                onNext={() => playNext(true)} 
                onPrevious={() => {}} 
              />
            </div>
          )}

          <TabsContent value="gigs" className="mt-0 space-y-10 animate-in fade-in duration-700 delay-400">
            {activeSetlistId && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <SetlistSelector 
                  setlists={allSetlists} 
                  currentId={activeSetlistId} 
                  onSelect={setActiveSetlistId} 
                  onCreate={handleCreateSetlist} 
                  onDelete={handleDeleteSetlist} 
                  onDuplicate={handleDuplicateSetlist} 
                  onOpenGigPlanner={() => setIsGigPlannerOpen(true)} 
                />
              </div>
            )}
            {activeSetlist && (
              <>
                <SetlistStats songs={filteredAndSortedSongs} goalSeconds={activeSetlist.time_goal} onPlayAll={toggleAutoplay} isAutoplayActive={isAutoplayActive} />
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
                  sortMode={sortMode} 
                  setSortMode={setSortMode} 
                  activeFilters={activeFilters} 
                  setActiveFilters={setActiveFilters} 
                  searchTerm={searchTerm} 
                  setSearchTerm={setSearchTerm} 
                  showHeatmap={showHeatmap} 
                  allSetlists={allSetlists} 
                  onRemove={handleRemoveSongFromSetlist} 
                  onLinkAudio={() => {}} 
                  onSyncProData={async () => {}} 
                />
              </>
            )}
          </TabsContent>
          
          <TabsContent value="repertoire" className="mt-0 space-y-10 animate-in fade-in duration-700 delay-400">
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
              onAddSong={() => {}} 
              onOpenAdmin={() => setIsAdminPanelOpen(true)} 
              activeSetlistId={activeSetlistId} 
              onBulkVibeCheck={handleBulkVibeCheck} 
            />
          </TabsContent>
        </Tabs>
      </div>

      <FloatingCommandDock 
        onOpenSearch={() => setIsGlobalSearchOpen(true)} 
        onOpenPractice={() => {}} 
        onOpenReader={(id) => navigate(`/sheet-reader/${id || ''}`)} 
        onOpenAdmin={() => setIsAdminPanelOpen(true)} 
        onOpenPreferences={() => setIsPreferencesOpen(true)} 
        onToggleHeatmap={() => setShowHeatmap(!showHeatmap)} 
        onOpenUserGuide={() => setIsUserGuideOpen(true)} 
        showHeatmap={showHeatmap} 
        viewMode={activeDashboardView} 
        hasPlayableSong={!!activeSong} 
        isPlaying={audio.isPlaying} 
        onTogglePlayback={audio.togglePlayback} 
        activeSongId={activeSong?.id} 
        onSetMenuOpen={setFloatingDockMenuOpen} 
        isMenuOpen={floatingDockMenuOpen} 
        onOpenPerformance={() => setIsPerformanceOverlayOpen(true)} 
        hasReadableChart={!!activeSong} 
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

      {isPerformanceOverlayOpen && activeSetlist && activeSong && (
        <PerformanceOverlay 
          songs={activeSetlist.songs} 
          currentIndex={activeSetlist.songs.findIndex(s => s.id === activeSong.id)} 
          isPlaying={audio.isPlaying} 
          progress={audio.progress} 
          duration={audio.duration} 
          onTogglePlayback={audio.togglePlayback} 
          onNext={() => playNext(true)} 
          onPrevious={() => {}} 
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

      <AdminPanel isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} repertoire={masterRepertoire} />
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      <UserGuideModal isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />
      <KeyManagementModal isOpen={isKeyManagementOpen} onClose={() => setIsKeyManagementOpen(false)} repertoire={masterRepertoire} onUpdateKey={async (songId, updates) => { if (!userId) return; await syncToMasterRepertoire(userId, [{ ...updates, id: songId }]); await fetchSetlistsAndRepertoire(); }} keyPreference={globalKeyPreference} />
      <GlobalSearchModal isOpen={isGlobalSearchOpen} onClose={() => setIsGlobalSearchOpen(false)} onAddSong={handleGlobalSearchAdd} repertoire={masterRepertoire} onAddExistingSong={async (s) => { if (userId) { await syncToMasterRepertoire(userId, [s]); await fetchSetlistsAndRepertoire(); } }} />
      
      {activeSetlist && (
        <>
          <SetlistSortModal isOpen={isSetlistSortModalOpen} onClose={() => setIsSetlistSortModalOpen(false)} songs={activeSetlist.songs} onReorder={handleReorderSongs} setlistName={activeSetlist.name} masterRepertoire={masterRepertoire} onAddSongs={async (songs) => { for (const s of songs) await handleUpdateSetlistSongs(activeSetlist.id, s, 'add'); }} />
          <SetlistSettingsModal isOpen={isSetlistSettingsOpen} onClose={() => setIsSetlistSettingsOpen(false)} setlistId={activeSetlist.id} setlistName={activeSetlist.name} onDelete={handleDeleteSetlist} onRename={handleRenameSetlist} onRefresh={() => fetchSetlistsAndRepertoire()} />
        </>
      )}
      <MDAuditModal isOpen={isMDAuditOpen} onClose={() => setIsMDAuditOpen(false)} auditData={auditData} isLoading={isAuditLoading} />
      <GigPlannerModal isOpen={isGigPlannerOpen} onClose={() => setIsGigPlannerOpen(false)} repertoire={masterRepertoire} onAddExternalSong={async () => {}} onAddLibrarySong={async () => {}} onBuildGig={async () => {}} />
      <ShortcutCheatSheet isOpen={isShortcutSheetOpen} onClose={() => setIsShortcutSheetOpen(false)} />
      <StorageAuditModal isOpen={isStorageAuditOpen} onClose={() => setIsStorageAuditOpen(false)} repertoire={masterRepertoire} />
    </div>
  );
};

export default Index;
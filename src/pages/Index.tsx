"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { 
  Loader2, ListMusic, Settings2, BookOpen, Search, LayoutDashboard, 
  X, AlertCircle, Music, Shuffle, Hash, Library, Plus 
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Custom Components
import SetlistSelector from '@/components/SetlistSelector';
import SetlistManager, { SetlistSong, Setlist } from '@/components/SetlistManager';
import { FilterState, DEFAULT_FILTERS } from '@/components/SetlistFilters';
import SetlistStats from '@/components/SetlistStats';
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
import AudioTransposerModal from '@/components/AudioTransposerModal';
import GoalTracker from '@/components/GoalTracker';
import SetlistSortModal from '@/components/SetlistSortModal';
import { calculateSemitones } from '@/utils/keyUtils';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const { keyPreference: globalKeyPreference, isFetchingSettings, isGoalTrackerEnabled, defaultDashboardView, preventStageKeyOverwrite } = useSettings();

  const [allSetlists, setAllSetlists] = useState<Setlist[]>([]);
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [activeSongForPerformance, setActiveSongForPerformance] = useState<SetlistSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [isShuffleAllMode, setIsShuffleAllMode] = useState(false);
  const [floatingDockMenuOpen, setFloatingDockMenuOpen] = useState(false);
  
  const activeDashboardView = (searchParams.get('view') as 'gigs' | 'repertoire') || defaultDashboardView;

  const activeSetlist = useMemo(() => allSetlists.find(l => l.id === activeSetlistId), [allSetlists, activeSetlistId]);

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
  const [isSetlistSortModalOpen, setIsSetlistSortModalOpen] = useState(false);
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [isResourceAuditOpen, setIsResourceAuditOpen] = useState(false);
  const [isImportSetlistOpen, setIsImportSetlistOpen] = useState(false);
  const [isSetlistSettingsOpen, setIsSetlistSettingsOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('gig_search_term') || "");
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work' | 'manual'>(() => (localStorage.getItem('gig_sort_mode') as 'none' | 'ready' | 'work' | 'manual') || 'none');
  const [activeFilters, setActiveFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('gig_active_filters');
    try {
      return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  const [showHeatmap, setShowHeatmap] = useState(() => localStorage.getItem('gig_show_heatmap') === 'true');

  const activeSetlistSongs = activeSetlist?.songs || [];

  const activeSetlistForPerformance = useMemo(() => {
    if (!activeSetlist) return null;
    let songs = [...activeSetlist.songs];
    if (isShuffleAllMode) {
      const pool = masterRepertoire.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) {
        const currentId = activeSongForPerformance?.master_id || activeSongForPerformance?.id;
        const others = pool.filter(s => (s.master_id || s.id) !== currentId);
        return { ...activeSetlist, songs: others.length > 0 ? others : pool };
      }
    }
    return activeSetlist;
  }, [activeSetlist, isShuffleAllMode, masterRepertoire, activeSongForPerformance]);

  const filteredAndSortedSongs = useMemo(() => {
    if (!activeSetlist) return [];
    let songs = [...activeSetlistSongs];
    const q = searchTerm.toLowerCase();
    if (q) songs = songs.filter(s => s.name.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));

    if (sortMode === 'ready') songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    else if (sortMode === 'work') songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    else if (sortMode === 'none') songs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return songs;
  }, [activeSetlistSongs, searchTerm, sortMode, activeSetlist]);

  // --- Setlist Management Handlers ---
  const handleCreateSetlist = async (name: string) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('setlists')
        .insert([{ user_id: userId, name: name, songs: [] }])
        .select()
        .single();
      if (error) throw error;
      setAllSetlists(prev => [data, ...prev]);
      setActiveSetlistId(data.id);
      showSuccess(`Setlist "${name}" created.`);
    } catch (err: any) {
      showError(`Failed to create setlist: ${err.message}`);
    }
  };

  const handleRenameSetlist = async (id: string, newName: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase.from('setlists').update({ name: newName }).eq('id', id).eq('user_id', userId);
      if (error) throw error;
      setAllSetlists(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
      if (activeSetlistId === id) showSuccess(`Setlist renamed to "${newName}".`);
    } catch (err: any) {
      showError(`Failed to rename setlist: ${err.message}`);
    }
  };

  const handleDeleteSetlist = async (id: string) => {
    if (!userId) return;
    if (!confirm("Are you sure you want to delete this setlist? This cannot be undone.")) return;
    try {
      await supabase.from('setlists').delete().eq('id', id).eq('user_id', userId);
      setAllSetlists(prev => prev.filter(s => s.id !== id));
      if (activeSetlistId === id) {
        setActiveSetlistId(null);
        showInfo("Active setlist deleted. Please select a new one.");
      }
      showSuccess("Setlist deleted successfully.");
    } catch (err: any) {
      showError(`Failed to delete setlist: ${err.message}`);
    }
  };
  // --- End Setlist Management Handlers ---

  const handleNextSong = useCallback(() => {
    if (!activeSetlistForPerformance || activeSetlistForPerformance.songs.length === 0) return;
    const idx = activeSetlistForPerformance.songs.findIndex(s => s.id === activeSongForPerformance?.id);
    const nextIdx = (idx + 1) % activeSetlistForPerformance.songs.length;
    setActiveSongForPerformance(activeSetlistForPerformance.songs[nextIdx]);
    showInfo(`Up Next: ${activeSetlistForPerformance.songs[nextIdx].name}`);
  }, [activeSetlistForPerformance, activeSongForPerformance]);

  const handlePreviousSong = useCallback(() => {
    if (!activeSetlistForPerformance || activeSetlistForPerformance.songs.length === 0) return;
    const idx = activeSetlistForPerformance.songs.findIndex(s => s.id === activeSongForPerformance?.id);
    const prevIdx = (idx - 1 + activeSetlistForPerformance.songs.length) % activeSetlistForPerformance.songs.length;
    setActiveSongForPerformance(activeSetlistForPerformance.songs[prevIdx]);
    showInfo(`Back to: ${activeSetlistForPerformance.songs[prevIdx].name}`);
  }, [activeSetlistForPerformance, activeSongForPerformance]);

  const handleToggleShuffleAll = () => {
    const nextState = !isShuffleAllMode;
    setIsShuffleAllMode(nextState);
    if (nextState) {
      const pool = masterRepertoire.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) setActiveSongForPerformance(pool[Math.floor(Math.random() * pool.length)]);
    }
  };

  const audio = useToneAudio(true, () => {
    if (isShuffleAllMode) {
      const pool = masterRepertoire.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) {
        const currentId = activeSongForPerformance?.master_id || activeSongForPerformance?.id;
        const others = pool.filter(s => (s.master_id || s.id) !== currentSongId);
        setActiveSongForPerformance(others.length > 0 ? others[Math.floor(Math.random() * others.length)] : pool[0]);
      }
    } else {
      handleNextSong();
    }
  });

  const fetchSetlistsAndRepertoire = useCallback(async (isInitial = false) => {
    if (!userId) return;
    if (isInitial) setLoading(true);
    
    try {
      const { data: setlistsData } = await supabase.from('setlists').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      const { data: repertoireData } = await supabase.from('repertoire').select('*').eq('user_id', userId).order('title');

      const mappedRepertoire: SetlistSong[] = (repertoireData || []).map(d => ({
        id: d.id, master_id: d.id, name: d.title, artist: d.artist, originalKey: d.original_key || 'TBC',
        targetKey: d.target_key || d.original_key || 'TBC', pitch: d.pitch ?? 0,
        previewUrl: d.extraction_status === 'completed' && d.audio_url ? d.audio_url : d.previewUrl,
        youtubeUrl: d.youtube_url, ugUrl: d.ug_url, appleMusicUrl: d.apple_music_url, pdfUrl: d.pdf_url,
        leadsheetUrl: d.leadsheet_url, bpm: d.bpm, genre: d.genre, isMetadataConfirmed: d.is_metadata_confirmed,
        isKeyConfirmed: d.is_key_confirmed, notes: d.notes, lyrics: d.lyrics, resources: d.resources || [],
        user_tags: d.user_tags || [], is_pitch_linked: d.is_pitch_linked ?? true, duration_seconds: d.duration_seconds,
        key_preference: d.key_preference, is_active: d.is_active, fineTune: d.fineTune, tempo: d.tempo, volume: d.volume,
        isApproved: d.is_approved, is_ready_to_sing: d.is_ready_to_sing, preferred_reader: d.preferred_reader, ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG, extraction_status: d.extraction_status,
        audio_url: d.audio_url,
        lyrics_updated_at: d.lyrics_updated_at,
        chords_updated_at: d.chords_updated_at,
        ug_link_updated_at: d.ug_link_updated_at,
        highest_note_updated_at: d.highest_note_updated_at,
        original_key_updated_at: d.original_key_updated_at,
        target_key_updated_at: d.target_key_updated_at,
        pdf_updated_at: d.pdf_updated_at,
      }));
      setMasterRepertoire(mappedRepertoire);

      const setlistsWithSongs: Setlist[] = [];
      for (const setlist of setlistsData || []) {
        const { data: junctionData } = await supabase.from('setlist_songs').select('*').eq('setlist_id', setlist.id).order('sort_order', { ascending: true });
        const songs: SetlistSong[] = junctionData?.map(j => {
          const master = mappedRepertoire.find(r => r.id === j.song_id);
          return master ? { ...master, id: j.id, master_id: master.id, isPlayed: j.isPlayed || false } : null;
        }).filter(Boolean) as SetlistSong[] || [];
        setlistsWithSongs.push({ id: setlist.id, name: setlist.name, songs, time_goal: setlist.time_goal });
      }

      setAllSetlists(setlistsWithSongs);
      const savedId = localStorage.getItem('active_setlist_id');
      if (savedId && setlistsWithSongs.some(s => s.id === savedId)) setActiveSetlistId(savedId);
      else setActiveSetlistId(setlistsWithSongs[0]?.id || null);
    } catch (err: any) {
      showError(`Failed to load data: ${err.message}`);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!authLoading && userId) fetchSetlistsAndRepertoire(true);
    else if (!authLoading && !userId) navigate('/landing');
  }, [userId, authLoading, fetchSetlistsAndRepertoire]);

  const handleEditSong = (song: SetlistSong, defaultTab?: StudioTab) => {
    setSongStudioModalSongId(song.master_id || song.id);
    setSongStudioModalGigId(activeDashboardView === 'gigs' ? activeSetlistId : 'library');
    setIsSongStudioModalOpen(true);
    setSongStudioDefaultTab(defaultTab || 'config');
  };

  const handleUpdateSongInSetlist = async (id: string, updates: Partial<SetlistSong>) => {
    if (!userId) return;
    try {
      const songInSetlist = activeSetlist?.songs.find(s => s.id === id);
      if (!songInSetlist) return;
      
      if (songInSetlist.master_id) {
        await syncToMasterRepertoire(userId, [{...updates, id: songInSetlist.master_id}]);
      } else {
        await supabase.from('setlist_songs').update(updates).eq('id', id);
      }
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to update song in setlist: ${err.message}`);
    }
  };

  const handleUpdateMasterSong = async (id: string, updates: Partial<SetlistSong>) => {
    if (!userId) return;
    try {
      await syncToMasterRepertoire(userId, [{...updates, id: id}]);
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to update master song: ${err.message}`);
    }
  };

  const handleRemoveSongFromSetlist = async (id: string) => {
    if (!activeSetlistId) return;
    try {
      await supabase.from('setlist_songs').delete().eq('id', id);
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to remove song: ${err.message}`);
    }
  };

  const handleTogglePlayed = async (id: string) => {
    if (!activeSetlistId) return;
    const songInSetlist = activeSetlist?.songs.find(x => x.id === id);
    if (!songInSetlist) return;
    try {
      await supabase.from('setlist_songs').update({ isPlayed: !songInSetlist.isPlayed }).eq('id', id);
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to toggle played status: ${err.message}`);
    }
  };

  const handleReorderSetlist = async (newOrder: SetlistSong[]) => {
    if (!activeSetlistId) return;
    try {
      await Promise.all(newOrder.map((song, index) => 
        supabase.from('setlist_songs').update({ sort_order: index }).eq('id', song.id)
      ));
      fetchSetlistsAndRepertoire();
      showSuccess("Setlist order saved!");
    } catch (err: any) {
      showError(`Failed to save order: ${err.message}`);
    }
  };

  const handleUpdateSetlistSongs = async (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => {
    if (!userId) return;
    if (action === 'add') {
      try {
        await supabase.from('setlist_songs').insert({ setlist_id: setlistId, song_id: song.master_id, sort_order: 0 });
        fetchSetlistsAndRepertoire();
      } catch (err: any) {
        showError(`Failed to add song to setlist: ${err.message}`);
      }
    } else if (action === 'remove') {
      try {
        await supabase.from('setlist_songs').delete().eq('setlist_id', setlistId).eq('song_id', song.master_id);
        fetchSetlistsAndRepertoire();
      } catch (err: any) {
        showError(`Failed to remove song from setlist: ${err.message}`);
      }
    }
  };

  const handleAddSongToMaster = async (song: SetlistSong) => {
    if (!userId) return;
    try {
      await syncToMasterRepertoire(userId, [song]);
      fetchSetlistsAndRepertoire();
      if (activeSetlistId) {
        await supabase.from('setlist_songs').insert({ setlist_id: activeSetlistId, song_id: song.id, sort_order: 0 });
        fetchSetlistsAndRepertoire();
      }
      showSuccess(`${song.name} added to Master Library and current setlist.`);
    } catch (err: any) {
      showError(`Failed to add song: ${err.message}`);
    }
  };

  const handleRemoveSongFromMaster = async (id: string) => {
    if (!userId) return;
    try {
      await supabase.from('setlist_songs').delete().eq('song_id', id);
      await supabase.from('repertoire').delete().eq('id', id).eq('user_id', userId);
      fetchSetlistsAndRepertoire();
      showSuccess("Track removed from library and all setlists.");
    } catch (err: any) {
      showError(`Failed to delete track: ${err.message}`);
    }
  };

  const handleUpdateGoalSeconds = async (seconds: number) => {
    if (!userId) return;
    try {
      await supabase.from('profiles').update({ time_goal: seconds }).eq('id', userId);
      fetchSetlistsAndRepertoire();
      showSuccess("Setlist time goal updated.");
    } catch (err: any) {
      showError(`Failed to update goal: ${err.message}`);
    }
  };

  // --- Derived State ---
  const currentSetlist = activeSetlistForPerformance || activeSetlist;
  const currentSetlistSongsList = currentSetlist?.songs || [];
  const currentSongId = activeSongForPerformance?.id || currentSetlistSongsList.find(s => !s.master_id)?.id || null; // Use local ID if it's a local song instance

  const handleSelectSongForPerformance = useCallback((song: SetlistSong) => {
    setActiveSongForPerformance(song);
    const urlToLoad = song.audio_url || song.previewUrl;
    if (urlToLoad) {
      audio.loadFromUrl(urlToLoad, song.pitch || 0);
    } else {
      audio.resetEngine();
      showWarning("Selected song has no audio link.");
    }
  }, [audio]);

  const handleUpdateKeyInSetlist = useCallback((id: string, newTargetKey: string) => {
    const songInSetlist = activeSetlistSongs.find(s => s.id === id);
    if (!songInSetlist) return;
    
    const originalKey = songInSetlist.originalKey || 'C';
    const newPitch = calculateSemitones(originalKey, newTargetKey);
    
    handleUpdateSongInSetlist(id, { targetKey: newTargetKey, pitch: newPitch });
    
    if (songInSetlist.master_id) {
      handleUpdateMasterSong(songInSetlist.master_id, { targetKey: newTargetKey, pitch: newPitch });
    }
    showSuccess(`Stage Key for ${songInSetlist.name} updated to ${newTargetKey}`);
  }, [activeSetlistSongs, handleUpdateSongInSetlist, handleUpdateMasterSong]);

  if (loading || authLoading || isFetchingSettings) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  // If no setlists exist, force creation flow
  useEffect(() => {
    if (allSetlists.length === 0 && !loading && userId) {
      handleCreateSetlist("My First Gig");
    }
  }, [allSetlists.length, loading, userId]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-black uppercase tracking-tight">Gig Studio Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleToggleShuffleAll} className={cn("h-9 px-4 rounded-xl", isShuffleAllMode ? "bg-indigo-600 text-white" : "text-indigo-600 border-indigo-200")}>
              <Shuffle className={cn("w-3.5 h-3.5 mr-2", isShuffleAllMode && "animate-spin-slow")} /> Shuffle All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsKeyManagementOpen(true)} className="h-9 px-4 rounded-xl text-indigo-600 border-indigo-200">
              <Hash className="w-3.5 h-3.5 mr-2" /> Key Matrix
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsPreferencesOpen(true)} className="h-9 px-4 rounded-xl text-indigo-600 border-indigo-200"><Settings2 className="w-3.5 h-3.5 mr-2" /> Preferences</Button>
          </div>
        </div>

        {isGoalTrackerEnabled && <GoalTracker repertoire={masterRepertoire} onFilterApply={(f) => setActiveFilters(prev => ({...prev, ...f}))} />}

        {activeSongForPerformance && (
          <ActiveSongBanner 
            song={activeSongForPerformance} 
            isPlaying={audio.isPlaying} 
            onTogglePlayback={audio.togglePlayback} 
            onClear={() => { setActiveSongForPerformance(null); audio.stopPlayback(); }} 
            isLoadingAudio={audio.isLoadingAudio}
            nextSongName={activeSetlistForPerformance?.songs[activeSetlistForPerformance.songs.findIndex(s => s.id === activeSongForPerformance.id) + 1]?.name}
            onNext={handleNextSong}
            onPrevious={handlePreviousSong}
          />
        )}

        <Tabs value={activeDashboardView} onValueChange={(v) => setSearchParams({ view: v })} className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-900 p-1 rounded-xl mb-6">
            <TabsTrigger value="gigs" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg">Gigs</TabsTrigger>
            <TabsTrigger value="repertoire" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg">Repertoire</TabsTrigger>
          </TabsList>

          <TabsContent value="gigs" className="mt-0 space-y-8">
            {activeSetlist && (
              <SetlistStats 
                songs={activeSetlist.songs} 
                goalSeconds={activeSetlist.time_goal} 
                onUpdateGoal={handleUpdateGoalSeconds}
              />
            )}
            <SetlistManager 
              songs={filteredAndSortedSongs} 
              onSelect={(s) => handleSelectSongForPerformance(s)}
              onEdit={handleEditSong} 
              onUpdateKey={handleUpdateKeyInSetlist}
              onTogglePlayed={handleTogglePlayed} 
              onLinkAudio={() => {}}
              onSyncProData={async () => {}}
              currentSongId={activeSongForPerformance?.id}
              sortMode={sortMode} setSortMode={setSortMode} activeFilters={activeFilters} setActiveFilters={setActiveFilters} searchTerm={searchTerm} setSearchTerm={setSearchTerm} showHeatmap={showHeatmap} allSetlists={allSetlists}
              onUpdateSetlistSongs={handleUpdateSetlistSongs}
              onOpenSortModal={() => setIsSetlistSortModalOpen(true)}
              onRemove={handleRemoveSongFromSetlist}
              onUpdateSong={handleUpdateSongInSetlist}
              onReorder={handleReorderSetlist}
            />
          </TabsContent>

          <TabsContent value="repertoire" className="mt-0 space-y-8">
            <RepertoireView 
              repertoire={masterRepertoire} 
              onEditSong={handleEditSong} 
              allSetlists={allSetlists} 
              onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} 
              searchTerm={searchTerm} 
              setSearchTerm={setSearchTerm} 
              sortMode={sortMode} 
              setSortMode={setSortMode} 
              activeFilters={activeFilters} 
              setActiveFilters={setActiveFilters}
              onUpdateSetlistSongs={handleUpdateSetlistSongs}
              onDeleteSong={handleRemoveSongFromMaster}
              onAddSong={handleAddSongToMaster}
            />
          </TabsContent>
        </Tabs>
      </div>

      <FloatingCommandDock 
        onOpenSearch={() => setIsAudioTransposerModalOpen(true)} 
        onOpenPractice={() => {}} 
        onOpenReader={(id) => navigate(`/sheet-reader/${id || ''}`)} 
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
        onUpdateSetlistSongs={handleUpdateSetlistSongs} 
        defaultTab={songStudioDefaultTab}
        handleAutoSave={handleUpdateMasterSong}
        preventStageKeyOverwrite={preventStageKeyOverwrite}
        audioEngine={audio}
      />

      {isPerformanceOverlayOpen && activeSetlistForPerformance && activeSongForPerformance && (
        <PerformanceOverlay 
          songs={activeSetlistForPerformance.songs} 
          currentIndex={activeSetlistForPerformance.songs.findIndex(s => s.id === activeSongForPerformance.id)} 
          isPlaying={audio.isPlaying} 
          progress={audio.progress} 
          duration={audio.duration} 
          onTogglePlayback={audio.togglePlayback} 
          onNext={handleNextSong} 
          onPrevious={handlePreviousSong} 
          onShuffle={handleToggleShuffleAll} 
          onClose={() => setIsPerformanceOverlayOpen(false)} 
          onUpdateSong={(id, u) => handleUpdateSongInSetlist(id, u)} 
          onUpdateKey={handleUpdateKeyInSetlist}
          analyzer={audio.analyzer} 
          gigId={activeSetlist?.id} 
        />
      )}
      
      <AdminPanel isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} />
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      <UserGuideModal isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />
      <RepertoirePicker 
        isOpen={isRepertoirePickerOpen} 
        onClose={() => setIsRepertoirePickerOpen(false)} 
        repertoire={masterRepertoire} 
        currentSetlistSongs={activeSetlist?.songs || []} 
        onAdd={handleAddSongToMaster} 
      />
      <ResourceAuditModal 
        isOpen={isResourceAuditOpen} 
        onClose={() => setIsResourceAuditOpen(false)} 
        songs={masterRepertoire} 
        onVerify={handleUpdateMasterSong} 
        onRefreshRepertoire={() => fetchSetlistsAndRepertoire()}
      />
      <SetlistSettingsModal 
        isOpen={isSetlistSettingsOpen} 
        onClose={() => setIsSetlistSettingsOpen(false)} 
        setlistId={activeSetlistId} 
        setlistName={activeSetlist?.name || "Setlist"}
        onDelete={handleDeleteSetlist}
        onRename={handleRenameSetlist}
      />
      <KeyManagementModal 
        isOpen={isKeyManagementOpen} 
        onClose={() => setIsKeyManagementOpen(false)} 
        repertoire={masterRepertoire} 
        onUpdateKey={handleUpdateMasterSong} 
        keyPreference={globalKeyPreference}
      />
      <ImportSetlist isOpen={isImportSetlistOpen} onClose={() => setIsImportSetlistOpen(false)} onImport={async (songs) => {
        if (!userId) return;
        const newMasterSongs = await syncToMasterRepertoire(userId, songs);
        fetchSetlistsAndRepertoire();
        if (activeSetlistId) {
          await Promise.all(newMasterSongs.map(s => supabase.from('setlist_songs').insert({ setlist_id: activeSetlistId, song_id: s.id, sort_order: 0 })));
          fetchSetlistsAndRepertoire();
        }
        showSuccess(`Imported ${songs.length} songs.`);
      }} />
      <AudioTransposerModal 
        isOpen={isAudioTransposerModalOpen} 
        onClose={() => setIsAudioTransposerModalOpen(false)} 
        onAddExistingSong={handleAddSongToMaster}
        repertoire={masterRepertoire}
        currentList={activeSetlist}
        onAddToSetlist={async (url, name, artist, yt, ug, apple, genre, pitch, audioUrl, status) => {
          if (!userId) return;
          const newSong: SetlistSong = {
            id: crypto.randomUUID(),
            name, artist, previewUrl: url || "", youtubeUrl: yt, ugUrl: ug, appleMusicUrl: apple,
            genre, pitch: pitch || 0, audio_url: audioUrl, extraction_status: status,
            originalKey: 'TBC', targetKey: 'TBC', isKeyConfirmed: false, isApproved: false,
            is_ready_to_sing: true,
          };
          await syncToMasterRepertoire(userId, [newSong]);
          fetchSetlistsAndRepertoire();
          if (activeSetlistId) {
            const masterSong = masterRepertoire.find(s => s.name === name && s.artist === artist);
            if (masterSong) {
              await supabase.from('setlist_songs').insert({ setlist_id: activeSetlistId, song_id: masterSong.id, sort_order: 0 });
              fetchSetlistsAndRepertoire();
            }
          }
          showSuccess(`${name} added to library and setlist.`);
        }}
      />
      <SetlistSortModal 
        isOpen={isSetlistSortModalOpen} 
        onClose={() => setIsSetlistSortModalOpen(false)} 
        songs={activeSetlist?.songs || []} 
        onReorder={async (newOrder) => {
          if (!activeSetlistId) return;
          await Promise.all(newOrder.map((song, index) => 
            supabase.from('setlist_songs').update({ sort_order: index }).eq('id', song.id)
          ));
          fetchSetlistsAndRepertoire();
        }}
        setlistName={activeSetlist?.name || "Current Setlist"}
      />
    </div>
  );
};

export default Index;
</dyad-file>

<dyad-file path="src/components/SheetReaderHeader.tsx" description="Updating SheetReaderHeader to correctly handle the new isFullScreen state from SheetReaderMode, and adding link management buttons.">
"use client";

import React, { useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils';
import { ArrowLeft, Search, ListMusic, ChevronDown, Minus, Plus, FileText, Headphones, LinkIcon, Ruler, Edit3, Trash2 } from 'lucide-react'; // NEW: Import LinkIcon, Ruler, Edit3, Trash2
import { SetlistSong } from '@/components/SetlistManager';
import { KeyPreference } from '@/hooks/use-settings';

interface SheetReaderHeaderProps {
  currentSong: SetlistSong | null;
  onClose: () => void;
  onOpenRepertoireSearch: () => void;
  onOpenCurrentSongStudio: () => void;
  isLoading: boolean;
  keyPreference: KeyPreference;
  onUpdateKey: (newTargetKey: string) => void;
  setIsOverlayOpen: (isOpen: boolean) => void;
  pitch: number;
  setPitch: (pitch: number) => void;
  readerKeyPreference: 'sharps' | 'flats';
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  effectiveTargetKey: string;
  isAudioPlayerVisible: boolean;
  onToggleAudioPlayer: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onAddLink: () => void; // NEW: Prop for adding a new link
  onToggleLinkEditMode: () => void; // NEW: Prop for toggling link edit mode
  onOpenLinkSizeModal: () => void; // NEW: Prop for opening link size modal
  isEditingLinksMode: boolean; // NEW: Prop to indicate if in link editing mode
}

const SheetReaderHeader: React.FC<SheetReaderHeaderProps> = ({
  currentSong,
  onClose,
  onOpenRepertoireSearch,
  onOpenCurrentSongStudio,
  isLoading,
  keyPreference,
  onUpdateKey,
  setIsOverlayOpen,
  pitch,
  setPitch,
  readerKeyPreference,
  isSidebarOpen,
  onToggleSidebar,
  effectiveTargetKey,
  isAudioPlayerVisible,
  onToggleAudioPlayer,
  isFullScreen,
  onToggleFullScreen,
  onAddLink, // NEW
  onToggleLinkEditMode, // NEW
  onOpenLinkSizeModal, // NEW
  isEditingLinksMode, // NEW
}) => {
  const displayKey = effectiveTargetKey ? formatKey(effectiveTargetKey, readerKeyPreference) : null;
  const keysToUse = readerKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;
  const activeKeyItemRef = useRef<HTMLDivElement>(null);

  const handleDropdownOpenChange = (open: boolean) => {
    setIsOverlayOpen(open);
    if (open && activeKeyItemRef.current) {
      setTimeout(() => {
        activeKeyItemRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 100);
    }
  };

  const hasPdf = !!currentSong?.pdfUrl || !!currentSong?.leadsheetUrl || !!currentSong?.sheet_music_url;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-60 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300 h-[72px]",
        isFullScreen && "hidden"
      )}
    >
      {/* Left: Sidebar Toggle */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className={cn(
            "h-10 w-10 rounded-xl transition-all",
            isSidebarOpen ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white/5 hover:bg-white/10 text-slate-400"
          )}
          title="Toggle Song List"
        >
          <ListMusic className="w-5 h-5" />
        </Button>
      </div>

      {/* Center: Song Title + Action Buttons */}
      <div className="absolute inset-x-0 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto max-w-full">
          {isLoading ? (
            <Skeleton className="h-7 w-64 bg-white/10 rounded-lg" />
          ) : currentSong ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 shrink-0"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>

              <h2 className="text-lg font-black uppercase tracking-tight text-white truncate max-w-md px-2 text-center">
                {currentSong.name}
              </h2>

              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenCurrentSongStudio}
                disabled={!currentSong}
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 shrink-0"
                title="Open in Studio"
              >
                <FileText className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <p className="text-sm font-bold text-slate-500">No Song Selected</p>
          )}
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {currentSong && (
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPitch(pitch - 1)}
              className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400"
              title="Transpose Down"
            >
              <Minus className="w-4 h-4" />
            </Button>

            <DropdownMenu onOpenChange={handleDropdownOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="bg-transparent text-xs font-black font-mono h-9 px-3 rounded-lg text-indigo-400 gap-1.5 hover:bg-transparent min-w-[70px]"
                  title="Change Stage Key"
                >
                  <span className="flex items-center gap-1">
                    {displayKey || <Skeleton className="h-4 w-10 bg-white/10" />}
                    <span className="text-slate-400 text-[10px]">
                      {pitch > 0 ? `+${pitch}` : pitch < 0 ? pitch : ''}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white z-[300] max-h-60 overflow-y-auto custom-scrollbar">
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    Stage Key
                  </DropdownMenuLabel>
                  {keysToUse.map((k) => (
                    <DropdownMenuItem
                      key={k}
                      onSelect={() => onUpdateKey(k)}
                      className={cn(
                        "font-mono font-bold cursor-pointer",
                        k === displayKey && "bg-indigo-600 text-white hover:bg-indigo-700"
                      )}
                      ref={k === displayKey ? activeKeyItemRef : null}
                    >
                      {k}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPitch(pitch + 1)}
              className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400"
              title="Transpose Up"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* NEW: Link Management Dropdown */}
        {hasPdf && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-xl transition-all",
                  isEditingLinksMode ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white/5 hover:bg-white/10 text-slate-400"
                )}
                title="Link Tools"
              >
                <LinkIcon className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white z-[300] p-2 rounded-xl">
              <DropdownMenuItem onClick={onAddLink} className="text-xs font-bold uppercase h-10 rounded-xl gap-2">
                <Plus className="w-4 h-4" /> Add New Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleLinkEditMode} className="text-xs font-bold uppercase h-10 rounded-xl gap-2">
                {isEditingLinksMode ? <Trash2 className="w-4 h-4 text-red-400" /> : <Edit3 className="w-4 h-4" />}
                {isEditingLinksMode ? "Exit Edit Mode" : "Edit/Delete Links"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenLinkSizeModal} className="text-xs font-bold uppercase h-10 rounded-xl gap-2">
                <Ruler className="w-4 h-4" /> Link Size Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleAudioPlayer}
          className={cn(
            "h-10 w-10 rounded-xl transition-all",
            isAudioPlayerVisible ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white/5 hover:bg-white/10 text-slate-400"
          )}
          title="Toggle Audio Player (P)"
        >
          <Headphones className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenRepertoireSearch}
          className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
          title="Search Repertoire"
        >
          <Search className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default SheetReaderHeader;
</dyad-file>

<dyad-file path="src/pages/Index.tsx" description="Simplifying Index component by removing RootRoute and KeepAliveWorker, relying on MainLayout for routing setup.">
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { 
  Loader2, ListMusic, Settings2, BookOpen, Search, LayoutDashboard, 
  X, AlertCircle, Music, Shuffle, Hash, Library, Plus 
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Custom Components
import SetlistSelector from '@/components/SetlistSelector';
import SetlistManager, { SetlistSong, Setlist } from '@/components/SetlistManager';
import { FilterState, DEFAULT_FILTERS } from '@/components/SetlistFilters';
import SetlistStats from '@/components/SetlistStats';
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
import AudioTransposerModal from '@/components/AudioTransposerModal';
import GoalTracker from '@/components/GoalTracker';
import SetlistSortModal from '@/components/SetlistSortModal';
import { calculateSemitones } from '@/utils/keyUtils';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const { keyPreference: globalKeyPreference, isFetchingSettings, isGoalTrackerEnabled, defaultDashboardView, preventStageKeyOverwrite } = useSettings();

  const [allSetlists, setAllSetlists] = useState<Setlist[]>([]);
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [activeSongForPerformance, setActiveSongForPerformance] = useState<SetlistSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [isShuffleAllMode, setIsShuffleAllMode] = useState(false);
  const [floatingDockMenuOpen, setFloatingDockMenuOpen] = useState(false);
  
  const activeDashboardView = (searchParams.get('view') as 'gigs' | 'repertoire') || defaultDashboardView;

  const activeSetlist = useMemo(() => allSetlists.find(l => l.id === activeSetlistId), [allSetlists, activeSetlistId]);

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
  const [isSetlistSortModalOpen, setIsSetlistSortModalOpen] = useState(false);
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [isResourceAuditOpen, setIsResourceAuditOpen] = useState(false);
  const [isImportSetlistOpen, setIsImportSetlistOpen] = useState(false);
  const [isSetlistSettingsOpen, setIsSetlistSettingsOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('gig_search_term') || "");
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work' | 'manual'>(() => (localStorage.getItem('gig_sort_mode') as 'none' | 'ready' | 'work' | 'manual') || 'none');
  const [activeFilters, setActiveFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('gig_active_filters');
    try {
      return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  const [showHeatmap, setShowHeatmap] = useState(() => localStorage.getItem('gig_show_heatmap') === 'true');

  const activeSetlistSongs = activeSetlist?.songs || [];

  const activeSetlistForPerformance = useMemo(() => {
    if (!activeSetlist) return null;
    let songs = [...activeSetlist.songs];
    if (isShuffleAllMode) {
      const pool = masterRepertoire.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) {
        const currentId = activeSongForPerformance?.master_id || activeSongForPerformance?.id;
        const others = pool.filter(s => (s.master_id || s.id) !== currentId);
        return { ...activeSetlist, songs: others.length > 0 ? others : pool };
      }
    }
    return activeSetlist;
  }, [activeSetlist, isShuffleAllMode, masterRepertoire, activeSongForPerformance]);

  const filteredAndSortedSongs = useMemo(() => {
    if (!activeSetlist) return [];
    let songs = [...activeSetlistSongs];
    const q = searchTerm.toLowerCase();
    if (q) songs = songs.filter(s => s.name.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));

    if (sortMode === 'ready') songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    else if (sortMode === 'work') songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    else if (sortMode === 'none') songs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return songs;
  }, [activeSetlistSongs, searchTerm, sortMode, activeSetlist]);

  // --- Setlist Management Handlers ---
  const handleCreateSetlist = async (name: string) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('setlists')
        .insert([{ user_id: userId, name: name, songs: [] }])
        .select()
        .single();
      if (error) throw error;
      setAllSetlists(prev => [data, ...prev]);
      setActiveSetlistId(data.id);
      showSuccess(`Setlist "${name}" created.`);
    } catch (err: any) {
      showError(`Failed to create setlist: ${err.message}`);
    }
  };

  const handleRenameSetlist = async (id: string, newName: string) => {
    if (!userId) return;
    try {
      const { error } = await supabase.from('setlists').update({ name: newName }).eq('id', id).eq('user_id', userId);
      if (error) throw error;
      setAllSetlists(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
      if (activeSetlistId === id) showSuccess(`Setlist renamed to "${newName}".`);
    } catch (err: any) {
      showError(`Failed to rename setlist: ${err.message}`);
    }
  };

  const handleDeleteSetlist = async (id: string) => {
    if (!userId) return;
    if (!confirm("Are you sure you want to delete this setlist? This cannot be undone.")) return;
    try {
      await supabase.from('setlists').delete().eq('id', id).eq('user_id', userId);
      setAllSetlists(prev => prev.filter(s => s.id !== id));
      if (activeSetlistId === id) {
        setActiveSetlistId(null);
        showInfo("Active setlist deleted. Please select a new one.");
      }
      showSuccess("Setlist deleted successfully.");
    } catch (err: any) {
      showError(`Failed to delete setlist: ${err.message}`);
    }
  };
  // --- End Setlist Management Handlers ---

  const handleNextSong = useCallback(() => {
    if (!activeSetlistForPerformance || activeSetlistForPerformance.songs.length === 0) return;
    const idx = activeSetlistForPerformance.songs.findIndex(s => s.id === activeSongForPerformance?.id);
    const nextIdx = (idx + 1) % activeSetlistForPerformance.songs.length;
    setActiveSongForPerformance(activeSetlistForPerformance.songs[nextIdx]);
    showInfo(`Up Next: ${activeSetlistForPerformance.songs[nextIdx].name}`);
  }, [activeSetlistForPerformance, activeSongForPerformance]);

  const handlePreviousSong = useCallback(() => {
    if (!activeSetlistForPerformance || activeSetlistForPerformance.songs.length === 0) return;
    const idx = activeSetlistForPerformance.songs.findIndex(s => s.id === activeSongForPerformance?.id);
    const prevIdx = (idx - 1 + activeSetlistForPerformance.songs.length) % activeSetlistForPerformance.songs.length;
    setActiveSongForPerformance(activeSetlistForPerformance.songs[prevIdx]);
    showInfo(`Back to: ${activeSetlistForPerformance.songs[prevIdx].name}`);
  }, [activeSetlistForPerformance, activeSongForPerformance]);

  const handleToggleShuffleAll = () => {
    const nextState = !isShuffleAllMode;
    setIsShuffleAllMode(nextState);
    if (nextState) {
      const pool = masterRepertoire.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) setActiveSongForPerformance(pool[Math.floor(Math.random() * pool.length)]);
    }
  };

  const audio = useToneAudio(true, () => {
    if (isShuffleAllMode) {
      const pool = masterRepertoire.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) {
        const currentId = activeSongForPerformance?.master_id || activeSongForPerformance?.id;
        const others = pool.filter(s => (s.master_id || s.id) !== currentId);
        setActiveSongForPerformance(others.length > 0 ? others[Math.floor(Math.random() * others.length)] : pool[0]);
      }
    } else {
      handleNextSong();
    }
  });

  const fetchSetlistsAndRepertoire = useCallback(async (isInitial = false) => {
    if (!userId) return;
    if (isInitial) setLoading(true);
    
    try {
      const { data: setlistsData } = await supabase.from('setlists').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      const { data: repertoireData } = await supabase.from('repertoire').select('*').eq('user_id', userId).order('title');

      const mappedRepertoire: SetlistSong[] = (repertoireData || []).map(d => ({
        id: d.id, master_id: d.id, name: d.title, artist: d.artist, originalKey: d.original_key || 'TBC',
        targetKey: d.target_key || d.original_key || 'TBC', pitch: d.pitch ?? 0,
        previewUrl: d.extraction_status === 'completed' && d.audio_url ? d.audio_url : d.previewUrl,
        youtubeUrl: d.youtube_url, ugUrl: d.ug_url, appleMusicUrl: d.apple_music_url, pdfUrl: d.pdf_url,
        leadsheetUrl: d.leadsheet_url, bpm: d.bpm, genre: d.genre, isMetadataConfirmed: d.is_metadata_confirmed,
        isKeyConfirmed: d.is_key_confirmed, notes: d.notes, lyrics: d.lyrics, resources: d.resources || [],
        user_tags: d.user_tags || [], is_pitch_linked: d.is_pitch_linked ?? true, duration_seconds: d.duration_seconds,
        key_preference: d.key_preference, is_active: d.is_active, fineTune: d.fineTune, tempo: d.tempo, volume: d.volume,
        isApproved: d.is_approved, is_ready_to_sing: d.is_ready_to_sing, preferred_reader: d.preferred_reader, ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG, extraction_status: d.extraction_status,
        audio_url: d.audio_url,
        lyrics_updated_at: d.lyrics_updated_at,
        chords_updated_at: d.chords_updated_at,
        ug_link_updated_at: d.ug_link_updated_at,
        highest_note_updated_at: d.highest_note_updated_at,
        original_key_updated_at: d.original_key_updated_at,
        target_key_updated_at: d.target_key_updated_at,
        pdf_updated_at: d.pdf_updated_at,
      }));
      setMasterRepertoire(mappedRepertoire);

      const setlistsWithSongs: Setlist[] = [];
      for (const setlist of setlistsData || []) {
        const { data: junctionData } = await supabase.from('setlist_songs').select('*').eq('setlist_id', setlist.id).order('sort_order', { ascending: true });
        const songs: SetlistSong[] = junctionData?.map(j => {
          const master = mappedRepertoire.find(r => r.id === j.song_id);
          return master ? { ...master, id: j.id, master_id: master.id, isPlayed: j.isPlayed || false } : null;
        }).filter(Boolean) as SetlistSong[] || [];
        setlistsWithSongs.push({ id: setlist.id, name: setlist.name, songs, time_goal: setlist.time_goal });
      }

      setAllSetlists(setlistsWithSongs);
      const savedId = localStorage.getItem('active_setlist_id');
      if (savedId && setlistsWithSongs.some(s => s.id === savedId)) setActiveSetlistId(savedId);
      else setActiveSetlistId(setlistsWithSongs[0]?.id || null);
    } catch (err: any) {
      showError(`Failed to load data: ${err.message}`);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!authLoading && userId) fetchSetlistsAndRepertoire(true);
    else if (!authLoading && !userId) navigate('/landing');
  }, [userId, authLoading, fetchSetlistsAndRepertoire]);

  const handleEditSong = (song: SetlistSong, defaultTab?: StudioTab) => {
    setSongStudioModalSongId(song.master_id || song.id);
    setSongStudioModalGigId(activeDashboardView === 'gigs' ? activeSetlistId : 'library');
    setIsSongStudioModalOpen(true);
    setSongStudioDefaultTab(defaultTab || 'config');
  };

  const handleUpdateSongInSetlist = async (id: string, updates: Partial<SetlistSong>) => {
    if (!userId) return;
    try {
      const songInSetlist = activeSetlist?.songs.find(s => s.id === id);
      if (!songInSetlist) return;
      
      if (songInSetlist.master_id) {
        await syncToMasterRepertoire(userId, [{...updates, id: songInSetlist.master_id}]);
      } else {
        await supabase.from('setlist_songs').update(updates).eq('id', id);
      }
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to update song in setlist: ${err.message}`);
    }
  };

  const handleUpdateMasterSong = async (id: string, updates: Partial<SetlistSong>) => {
    if (!userId) return;
    try {
      await syncToMasterRepertoire(userId, [{...updates, id: id}]);
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to update master song: ${err.message}`);
    }
  };

  const handleRemoveSongFromSetlist = async (id: string) => {
    if (!activeSetlistId) return;
    try {
      await supabase.from('setlist_songs').delete().eq('id', id);
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to remove song: ${err.message}`);
    }
  };

  const handleTogglePlayed = async (id: string) => {
    if (!activeSetlistId) return;
    const songInSetlist = activeSetlist?.songs.find(x => x.id === id);
    if (!songInSetlist) return;
    try {
      await supabase.from('setlist_songs').update({ isPlayed: !songInSetlist.isPlayed }).eq('id', id);
      fetchSetlistsAndRepertoire();
    } catch (err: any) {
      showError(`Failed to toggle played status: ${err.message}`);
    }
  };

  const handleReorderSetlist = async (newOrder: SetlistSong[]) => {
    if (!activeSetlistId) return;
    try {
      await Promise.all(newOrder.map((song, index) => 
        supabase.from('setlist_songs').update({ sort_order: index }).eq('id', song.id)
      ));
      fetchSetlistsAndRepertoire();
      showSuccess("Setlist order saved!");
    } catch (err: any) {
      showError(`Failed to save order: ${err.message}`);
    }
  };

  const handleUpdateSetlistSongs = async (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => {
    if (!userId) return;
    if (action === 'add') {
      try {
        await supabase.from('setlist_songs').insert({ setlist_id: setlistId, song_id: song.master_id, sort_order: 0 });
        fetchSetlistsAndRepertoire();
      } catch (err: any) {
        showError(`Failed to add song to setlist: ${err.message}`);
      }
    } else if (action === 'remove') {
      try {
        await supabase.from('setlist_songs').delete().eq('setlist_id', setlistId).eq('song_id', song.master_id);
        fetchSetlistsAndRepertoire();
      } catch (err: any) {
        showError(`Failed to remove song from setlist: ${err.message}`);
      }
    }
  };

  const handleAddSongToMaster = async (song: SetlistSong) => {
    if (!userId) return;
    try {
      await syncToMasterRepertoire(userId, [song]);
      fetchSetlistsAndRepertoire();
      if (activeSetlistId) {
        await supabase.from('setlist_songs').insert({ setlist_id: activeSetlistId, song_id: song.id, sort_order: 0 });
        fetchSetlistsAndRepertoire();
      }
      showSuccess(`${song.name} added to Master Library and current setlist.`);
    } catch (err: any) {
      showError(`Failed to add song: ${err.message}`);
    }
  };

  const handleRemoveSongFromMaster = async (id: string) => {
    if (!userId) return;
    try {
      await supabase.from('setlist_songs').delete().eq('song_id', id);
      await supabase.from('repertoire').delete().eq('id', id).eq('user_id', userId);
      fetchSetlistsAndRepertoire();
      showSuccess("Track removed from library and all setlists.");
    } catch (err: any) {
      showError(`Failed to delete track: ${err.message}`);
    }
  };

  const handleUpdateGoalSeconds = async (seconds: number) => {
    if (!userId) return;
    try {
      await supabase.from('profiles').update({ time_goal: seconds }).eq('id', userId);
      fetchSetlistsAndRepertoire();
      showSuccess("Setlist time goal updated.");
    } catch (err: any) {
      showError(`Failed to update goal: ${err.message}`);
    }
  };

  // --- Derived State ---
  const currentSetlist = activeSetlistForPerformance || activeSetlist;
  const currentSetlistSongsList = currentSetlist?.songs || [];
  const currentSongId = activeSongForPerformance?.id || currentSetlistSongsList.find(s => !s.master_id)?.id || null; // Use local ID if it's a local song instance

  const handleSelectSongForPerformance = useCallback((song: SetlistSong) => {
    setActiveSongForPerformance(song);
    const urlToLoad = song.audio_url || song.previewUrl;
    if (urlToLoad) {
      audio.loadFromUrl(urlToLoad, song.pitch || 0);
    } else {
      audio.resetEngine();
      showWarning("Selected song has no audio link.");
    }
  }, [audio]);

  const handleUpdateKeyInSetlist = useCallback((id: string, newTargetKey: string) => {
    const songInSetlist = activeSetlistSongs.find(s => s.id === id);
    if (!songInSetlist) return;
    
    const originalKey = songInSetlist.originalKey || 'C';
    const newPitch = calculateSemitones(originalKey, newTargetKey);
    
    handleUpdateSongInSetlist(id, { targetKey: newTargetKey, pitch: newPitch });
    
    if (songInSetlist.master_id) {
      handleUpdateMasterSong(songInSetlist.master_id, { targetKey: newTargetKey, pitch: newPitch });
    }
    showSuccess(`Stage Key for ${songInSetlist.name} updated to ${newTargetKey}`);
  }, [activeSetlistSongs, handleUpdateSongInSetlist, handleUpdateMasterSong]);

  if (loading || authLoading || isFetchingSettings) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  // If no setlists exist, force creation flow
  useEffect(() => {
    if (allSetlists.length === 0 && !loading && userId) {
      handleCreateSetlist("My First Gig");
    }
  }, [allSetlists.length, loading, userId]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-black uppercase tracking-tight">Gig Studio Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleToggleShuffleAll} className={cn("h-9 px-4 rounded-xl", isShuffleAllMode ? "bg-indigo-600 text-white" : "text-indigo-600 border-indigo-200")}>
              <Shuffle className={cn("w-3.5 h-3.5 mr-2", isShuffleAllMode && "animate-spin-slow")} /> Shuffle All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsKeyManagementOpen(true)} className="h-9 px-4 rounded-xl text-indigo-600 border-indigo-200">
              <Hash className="w-3.5 h-3.5 mr-2" /> Key Matrix
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsPreferencesOpen(true)} className="h-9 px-4 rounded-xl text-indigo-600 border-indigo-200"><Settings2 className="w-3.5 h-3.5 mr-2" /> Preferences</Button>
          </div>
        </div>

        {isGoalTrackerEnabled && <GoalTracker repertoire={masterRepertoire} onFilterApply={(f) => setActiveFilters(prev => ({...prev, ...f}))} />}

        {activeSongForPerformance && (
          <ActiveSongBanner 
            song={activeSongForPerformance} 
            isPlaying={audio.isPlaying} 
            onTogglePlayback={audio.togglePlayback} 
            onClear={() => { setActiveSongForPerformance(null); audio.stopPlayback(); }} 
            isLoadingAudio={audio.isLoadingAudio}
            nextSongName={activeSetlistForPerformance?.songs[activeSetlistForPerformance.songs.findIndex(s => s.id === activeSongForPerformance.id) + 1]?.name}
            onNext={handleNextSong}
            onPrevious={handlePreviousSong}
          />
        )}

        <Tabs value={activeDashboardView} onValueChange={(v) => setSearchParams({ view: v })} className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-900 p-1 rounded-xl mb-6">
            <TabsTrigger value="gigs" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg">Gigs</TabsTrigger>
            <TabsTrigger value="repertoire" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg">Repertoire</TabsTrigger>
          </TabsList>

          <TabsContent value="gigs" className="mt-0 space-y-8">
            {activeSetlist && (
              <SetlistStats 
                songs={activeSetlist.songs} 
                goalSeconds={activeSetlist.time_goal} 
                onUpdateGoal={handleUpdateGoalSeconds}
              />
            )}
            <SetlistManager 
              songs={filteredAndSortedSongs} 
              onSelect={(s) => handleSelectSongForPerformance(s)}
              onEdit={handleEditSong} 
              onUpdateKey={handleUpdateKeyInSetlist}
              onTogglePlayed={handleTogglePlayed} 
              onLinkAudio={() => {}}
              onSyncProData={async () => {}}
              currentSongId={activeSongForPerformance?.id}
              sortMode={sortMode} setSortMode={setSortMode} activeFilters={activeFilters} setActiveFilters={setActiveFilters} searchTerm={searchTerm} setSearchTerm={setSearchTerm} showHeatmap={showHeatmap} allSetlists={allSetlists}
              onUpdateSetlistSongs={handleUpdateSetlistSongs}
              onOpenSortModal={() => setIsSetlistSortModalOpen(true)}
              onRemove={handleRemoveSongFromSetlist}
              onUpdateSong={handleUpdateSongInSetlist}
              onReorder={handleReorderSetlist}
            />
          </TabsContent>

          <TabsContent value="repertoire" className="mt-0 space-y-8">
            <RepertoireView 
              repertoire={masterRepertoire} 
              onEditSong={handleEditSong} 
              allSetlists={allSetlists} 
              onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} 
              searchTerm={searchTerm} 
              setSearchTerm={setSearchTerm} 
              sortMode={sortMode} 
              setSortMode={setSortMode} 
              activeFilters={activeFilters} 
              setActiveFilters={setActiveFilters}
              onUpdateSetlistSongs={handleUpdateSetlistSongs}
              onDeleteSong={handleRemoveSongFromMaster}
              onAddSong={handleAddSongToMaster}
            />
          </TabsContent>
        </Tabs>
      </div>

      <FloatingCommandDock 
        onOpenSearch={() => setIsAudioTransposerModalOpen(true)} 
        onOpenPractice={() => {}} 
        onOpenReader={(id) => navigate(`/sheet-reader/${id || ''}`)} 
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
        onUpdateSetlistSongs={handleUpdateSetlistSongs} 
        defaultTab={songStudioDefaultTab}
        handleAutoSave={handleUpdateMasterSong}
        preventStageKeyOverwrite={preventStageKeyOverwrite}
        audioEngine={audio}
      />

      {isPerformanceOverlayOpen && activeSetlistForPerformance && activeSongForPerformance && (
        <PerformanceOverlay 
          songs={activeSetlistForPerformance.songs} 
          currentIndex={activeSetlistForPerformance.songs.findIndex(s => s.id === activeSongForPerformance.id)} 
          isPlaying={audio.isPlaying} 
          progress={audio.progress} 
          duration={audio.duration} 
          onTogglePlayback={audio.togglePlayback} 
          onNext={handleNextSong} 
          onPrevious={handlePreviousSong} 
          onShuffle={handleToggleShuffleAll} 
          onClose={() => setIsPerformanceOverlayOpen(false)} 
          onUpdateSong={(id, u) => handleUpdateSongInSetlist(id, u)} 
          onUpdateKey={handleUpdateKeyInSetlist}
          analyzer={audio.analyzer} 
          gigId={activeSetlist?.id} 
        />
      )}
      
      <AdminPanel isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} />
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      <UserGuideModal isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />
      <RepertoirePicker 
        isOpen={isRepertoirePickerOpen} 
        onClose={() => setIsRepertoirePickerOpen(false)} 
        repertoire={masterRepertoire} 
        currentSetlistSongs={activeSetlist?.songs || []} 
        onAdd={handleAddSongToMaster} 
      />
      <ResourceAuditModal 
        isOpen={isResourceAuditOpen} 
        onClose={() => setIsResourceAuditOpen(false)} 
        songs={masterRepertoire} 
        onVerify={handleUpdateMasterSong} 
        onRefreshRepertoire={() => fetchSetlistsAndRepertoire()}
      />
      <SetlistSettingsModal 
        isOpen={isSetlistSettingsOpen} 
        onClose={() => setIsSetlistSettingsOpen(false)} 
        setlistId={activeSetlistId} 
        setlistName={activeSetlist?.name || "Setlist"}
        onDelete={handleDeleteSetlist}
        onRename={handleRenameSetlist}
      />
      <KeyManagementModal 
        isOpen={isKeyManagementOpen} 
        onClose={() => setIsKeyManagementOpen(false)} 
        repertoire={masterRepertoire} 
        onUpdateKey={handleUpdateMasterSong} 
        keyPreference={globalKeyPreference}
      />
      <ImportSetlist isOpen={isImportSetlistOpen} onClose={() => setIsImportSetlistOpen(false)} onImport={async (songs) => {
        if (!userId) return;
        const newMasterSongs = await syncToMasterRepertoire(userId, songs);
        fetchSetlistsAndRepertoire();
        if (activeSetlistId) {
          await Promise.all(newMasterSongs.map(s => supabase.from('setlist_songs').insert({ setlist_id: activeSetlistId, song_id: s.id, sort_order: 0 })));
          fetchSetlistsAndRepertoire();
        }
        showSuccess(`Imported ${songs.length} songs.`);
      }} />
      <AudioTransposerModal 
        isOpen={isAudioTransposerModalOpen} 
        onClose={() => setIsAudioTransposerModalOpen(false)} 
        onAddExistingSong={handleAddSongToMaster}
        repertoire={masterRepertoire}
        currentList={activeSetlist}
        onAddToSetlist={async (url, name, artist, yt, ug, apple, genre, pitch, audioUrl, status) => {
          if (!userId) return;
          const newSong: SetlistSong = {
            id: crypto.randomUUID(),
            name, artist, previewUrl: url || "", youtubeUrl: yt, ugUrl: ug, appleMusicUrl: apple,
            genre, pitch: pitch || 0, audio_url: audioUrl, extraction_status: status,
            originalKey: 'TBC', targetKey: 'TBC', isKeyConfirmed: false, isApproved: false,
            is_ready_to_sing: true,
          };
          await syncToMasterRepertoire(userId, [newSong]);
          fetchSetlistsAndRepertoire();
          if (activeSetlistId) {
            const masterSong = masterRepertoire.find(s => s.name === name && s.artist === artist);
            if (masterSong) {
              await supabase.from('setlist_songs').insert({ setlist_id: activeSetlistId, song_id: masterSong.id, sort_order: 0 });
              fetchSetlistsAndRepertoire();
            }
          }
          showSuccess(`${name} added to library and setlist.`);
        }}
      />
      <SetlistSortModal 
        isOpen={isSetlistSortModalOpen} 
        onClose={() => setIsSetlistSortModalOpen(false)} 
        songs={activeSetlist?.songs || []} 
        onReorder={async (newOrder) => {
          if (!activeSetlistId) return;
          await Promise.all(newOrder.map((song, index) => 
            supabase.from('setlist_songs').update({ sort_order: index }).eq('id', song.id)
          ));
          fetchSetlistsAndRepertoire();
        }}
        setlistName={activeSetlist?.name || "Current Setlist"}
      />
    </div>
  );
};

export default Index;
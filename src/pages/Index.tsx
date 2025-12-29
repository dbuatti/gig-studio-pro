"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AudioTransposer, { AudioTransposerRef } from "@/components/AudioTransposer";
import SetlistManager, { SetlistSong } from "@/components/SetlistManager";
import SetlistSelector from "@/components/SetlistSelector";
import ImportSetlist from "@/components/ImportSetlist";
import ActiveSongBanner from "@/components/ActiveSongBanner";
import SetlistStats from "@/components/SetlistStats";
import PreferencesModal from "@/components/PreferencesModal";
import AdminPanel from "@/components/AdminPanel";
import SongStudioModal from "@/components/SongStudioModal";
import ResourceAuditModal from "@/components/ResourceAuditModal";
import RepertoirePicker from "@/components/RepertoirePicker";
import SetlistExporter from "@/components/SetlistExporter";
import FloatingCommandDock from "@/components/FloatingCommandDock";
import UserGuideModal from "@/components/UserGuideModal";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { User as UserIcon, Loader2, LayoutDashboard, Clock, Settings, Library, ListMusic, ClipboardCheck } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useSettings } from '@/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { syncToMasterRepertoire, calculateReadiness } from '@/utils/repertoireSync';
import { cleanYoutubeUrl } from '@/utils/youtubeUtils';
import { useNavigate } from 'react-router-dom';
import { FilterState } from '@/components/SetlistFilters';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';

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
  const { keyPreference } = useSettings();
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('gig_view_mode') as ViewMode) || 'repertoire');
  const [setlists, setSetlists] = useState<{ id: string; name: string; songs: SetlistSong[]; time_goal?: number }[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(() => localStorage.getItem('active_gig_id'));
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  const [activeSongIdState, setActiveSongId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work'>(() => (localStorage.getItem('gig_sort_mode') as any) || 'none');
  const [activeFilters, setActiveFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [searchTerm, setSearchTerm] = useState("");

  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const transposerRef = useRef<AudioTransposerRef>(null);
  const currentList = useMemo(() => setlists.find(l => l.id === currentListId), [setlists, currentListId]);
  const songs = useMemo(() => (viewMode === 'repertoire' ? masterRepertoire : currentList?.songs || []), [viewMode, masterRepertoire, currentList]);

  const fetchMasterRepertoire = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('repertoire').select('*').eq('user_id', user.id).order('title');
      if (error) throw error;
      if (data) {
        const mapped = data.map(d => ({
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
          is_pitch_linked: d.is_pitch_linked,
          is_ug_link_verified: d.is_ug_link_verified,
          sheet_music_url: d.sheet_music_url,
          is_sheet_verified: d.is_sheet_verified,
          is_ug_chords_present: d.is_ug_chords_present,
          highest_note_original: d.highest_note_original,
          extraction_status: d.extraction_status
        }));
        setMasterRepertoire(mapped);
        return mapped;
      }
    } catch (err) {
      console.error("[Index] Master Repertoire Fetch Error:", err);
    }
    return [];
  }, [user]);

  const fetchSetlists = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('setlists').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        const mapped = data.map(d => ({
          id: d.id,
          name: d.name,
          songs: (d.songs as any[]) || [],
          time_goal: d.time_goal
        }));
        setSetlists(mapped);
        if (!currentListId) {
          const listId = mapped[0].id;
          setCurrentListId(listId);
          localStorage.setItem('active_gig_id', listId);
        }
      }
    } catch (err) {
      console.error("[Index] Setlist Fetch Error:", err);
    }
  }, [user, currentListId]);

  useEffect(() => {
    if (user) {
      fetchSetlists();
      fetchMasterRepertoire();
    }
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, [user, fetchSetlists, fetchMasterRepertoire]);

  const processedSongs = useMemo(() => {
    let base = [...songs];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      base = base.filter(s => s.name.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));
    }
    base = base.filter(s => {
      const score = calculateReadiness(s);
      if (score < activeFilters.readiness) return false;

      const hasAudio = !!s.previewUrl;
      const isItunes = hasAudio && (s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'));
      const hasFullAudio = hasAudio && !isItunes;

      if (activeFilters.hasAudio === 'full' && !hasFullAudio) return false;
      if (activeFilters.hasAudio === 'itunes' && !isItunes) return false;
      if (activeFilters.hasAudio === 'none' && hasAudio) return false;

      if (activeFilters.isApproved === 'yes' && !s.isApproved) return false;
      if (activeFilters.isConfirmed === 'yes' && !s.isKeyConfirmed) return false;
      if (activeFilters.hasVideo === 'yes' && !s.youtubeUrl) return false;
      if (activeFilters.hasPdf === 'yes' && !s.pdfUrl) return false;
      if (activeFilters.hasUg === 'yes' && !s.ugUrl) return false;
      return true;
    });
    if (sortMode === 'none') return base;
    return base.sort((a, b) => {
      const scoreA = calculateReadiness(a);
      const scoreB = calculateReadiness(b);
      return sortMode === 'ready' ? scoreB - scoreA : scoreA - scoreB;
    });
  }, [songs, sortMode, searchTerm, activeFilters]);

  const saveList = async (listId: string, updatedSongs: SetlistSong[], updates: any = {}, songsToSync?: SetlistSong[]) => {
    if (!user) return;
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
      await supabase.from('setlists').update({ songs: cleaned, updated_at: new Date().toISOString(), ...updates }).eq('id', listId);
      setSetlists(prev => prev.map(l => l.id === listId ? { ...l, songs: finalSongs, ...updates } : l));
      if (songsToSync?.length) fetchMasterRepertoire();
      showSuccess("Gig Cloud Updated");
    } catch (err) {
      showError("Cloud Save Failed");
    } finally {
      setIsSaving(false);
    }
  };

  const propagateMasterUpdates = useCallback(async (freshMaster: SetlistSong[]) => {
    if (!currentListId || !currentList) return;

    const masterMap = new Map(freshMaster.map(s => [s.id, s]));
    const updatedSongs = currentList.songs.map(song => {
      const masterRecord = masterMap.get(song.master_id || '');
      if (masterRecord) {
        return {
          ...song,
          youtubeUrl: masterRecord.youtubeUrl || song.youtubeUrl,
          previewUrl: masterRecord.previewUrl || song.previewUrl,
          appleMusicUrl: masterRecord.appleMusicUrl || song.appleMusicUrl,
          genre: masterRecord.genre || song.genre,
          bpm: masterRecord.bpm || song.bpm,
          duration_seconds: masterRecord.duration_seconds || song.duration_seconds,
          isMetadataConfirmed: masterRecord.isMetadataConfirmed || song.isMetadataConfirmed,
          originalKey: masterRecord.originalKey || song.originalKey,
          extraction_status: masterRecord.extraction_status
        };
      }
      return song;
    });

    await saveList(currentListId, updatedSongs);
  }, [currentListId, currentList]);

  const handleUpdateSong = useCallback((songId: string, updates: Partial<SetlistSong>) => {
    if (viewMode === 'repertoire') {
      const target = masterRepertoire.find(s => s.id === songId);
      if (target) syncToMasterRepertoire(user!.id, [{ ...target, ...updates }]).then(fetchMasterRepertoire);
      return;
    }
    if (!currentListId || !currentList) return;
    const updatedSongs = currentList.songs.map(s => s.id === songId ? { ...s, ...updates } : s);
    saveList(currentListId, updatedSongs, {}, [updatedSongs.find(s => s.id === songId)!]);
  }, [viewMode, masterRepertoire, user, currentListId, currentList, fetchMasterRepertoire]);

  const handleAddToGig = useCallback((song: SetlistSong) => {
    if (!currentListId || !currentList) return;
    const isAlreadyInList = currentList.songs.some(s => (s.master_id && s.master_id === song.master_id) || s.id === song.id);
    if (isAlreadyInList) {
      showInfo("Song already in current gig.");
      return;
    }
    const newSetlistSong: SetlistSong = {
      ...song,
      id: Math.random().toString(36).substr(2, 9),
      isPlayed: false,
      isApproved: false
    };
    saveList(currentListId, [...currentList.songs, newSetlistSong]);
  }, [currentListId, currentList]);

  const handleUpdateSetlistSongs = useCallback(async (setlistId: string, songToUpdate: SetlistSong, action: 'add' | 'remove') => {
    const targetSetlist = setlists.find(l => l.id === setlistId);
    if (!targetSetlist) return;

    let updated = [...targetSetlist.songs];
    if (action === 'add') {
      const exists = updated.some(s => (s.master_id === songToUpdate.master_id) || s.id === songToUpdate.id);
      if (!exists) {
        updated.push({
          ...songToUpdate,
          id: Math.random().toString(36).substr(2, 9),
          master_id: songToUpdate.master_id || songToUpdate.id,
          isPlayed: false,
          isApproved: false,
        });
      }
    } else {
      updated = updated.filter(s => (s.master_id !== songToUpdate.master_id) && s.id !== songToUpdate.id);
    }

    await saveList(setlistId, updated);
  }, [setlists]);

  const handleAddNewSongToCurrentSetlist = useCallback(async (previewUrl: string, name: string, artist: string, youtubeUrl?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string, pitch?: number) => {
    if (!user || !currentListId || !currentList) return;
    
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
      ug_chords_config: DEFAULT_UG_CHORDS_CONFIG,
    };

    saveList(currentListId, [...currentList.songs, newSong], {}, [newSong]);
  }, [user, currentListId, currentList]);

  const handleSelectSong = async (song: SetlistSong) => {
    setActiveSongId(song.id);
    if (song.previewUrl && transposerRef.current) {
      await transposerRef.current.loadFromUrl(song.previewUrl, song.name, song.artist || "Unknown");
      transposerRef.current.setPitch(song.pitch || 0);
    }
  };

  const handleTogglePlayback = useCallback(() => transposerRef.current?.togglePlayback(), []);

  const handleGlobalAutoSync = async () => {
    if (!user) return;
    const songIds = songs.map(s => s.master_id || s.id);
    await supabase.functions.invoke('global-auto-sync', { body: { songIds } });
    fetchMasterRepertoire();
  };

  const handleAutoLink = async () => {
    if (!user) return;
    const missing = songs.filter(s => !s.youtubeUrl).map(s => s.master_id || s.id);
    await supabase.functions.invoke('bulk-populate-youtube-links', { body: { songIds: missing } });
    fetchMasterRepertoire();
  };

  const handleBulkRefreshAudio = async () => {
    const isMissingMasterAudio = (s: SetlistSong) => 
      !s.previewUrl || s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets');

    const songsToProcess = songs.filter(s => s.youtubeUrl && isMissingMasterAudio(s));
    
    if (songsToProcess.length === 0) {
      showInfo("All selected tracks already have master audio linked.");
      return;
    }

    if (!confirm(`Trigger audio extraction for ${songsToProcess.length} tracks missing audio?`)) {
      return;
    }

    setIsBulkDownloading(true);
    showInfo(`Initiating background extraction for ${songsToProcess.length} tracks...`);

    for (let i = 0; i < songsToProcess.length; i++) {
      const song = songsToProcess[i];
      try {
        const targetVideoUrl = cleanYoutubeUrl(song.youtubeUrl || '');
        
        await supabase.functions.invoke('download-audio', {
          body: { 
            videoUrl: targetVideoUrl,
            songId: song.master_id || song.id,
            userId: user?.id
          }
        });
      } catch (err: any) {
        console.error(`[Index] Initialization failed for ${song.name}:`, err);
      }
      // Small rate limit buffer for the queue
      await new Promise(r => setTimeout(r, 500));
    }

    setIsBulkDownloading(false);
    showSuccess("Bulk extraction pipeline initialized successfully.");
    fetchMasterRepertoire();
  };

  const handleClearAutoLinks = async () => {
    if (!user) return;
    await supabase.from('repertoire').update({ youtube_url: null, metadata_source: null }).eq('metadata_source', 'auto_populated').eq('user_id', user.id);
    fetchMasterRepertoire();
  };

  const missingAudioCount = useMemo(() => songs.filter(s => !s.previewUrl || s.previewUrl.includes('apple.com')).length, [songs]);

  const activeSong = useMemo(() => processedSongs.find(s => s.id === activeSongIdState), [processedSongs, activeSongIdState]);
  const hasPlayableSong = !!activeSong?.previewUrl && !(activeSong.previewUrl.includes('apple.com') || activeSong.previewUrl.includes('itunes-assets'));

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden relative">
      <nav className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b px-4 md:px-6 flex items-center justify-between z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-6 flex-1 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><LayoutDashboard className="w-5 h-5" /></div>
            <span className="font-black uppercase tracking-tighter text-lg hidden sm:block">Gig Studio <span className="text-indigo-600">Pro</span></span>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setViewMode('repertoire')} className={cn("h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg", viewMode === 'repertoire' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" : "text-slate-500")}><Library className="w-3.5 h-3.5" /> Repertoire</Button>
            <Button variant="ghost" size="sm" onClick={() => setViewMode('setlist')} className={cn("h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg", viewMode === 'setlist' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" : "text-slate-500")}><ListMusic className="w-3.5 h-3.5" /> Gigs</Button>
          </div>
          {viewMode === 'setlist' && (
            <SetlistSelector setlists={setlists} currentId={currentListId || ''} onSelect={(id) => { setCurrentListId(id); localStorage.setItem('active_gig_id', id); }} onCreate={async () => { const name = prompt("Gig Name:"); if (name) { const { data } = await supabase.from('setlists').insert([{ user_id: user?.id, name, songs: [] }]).select().single(); if (data) { fetchSetlists(); setCurrentListId(data.id); } } }} onDelete={async (id) => { if(confirm("Delete gig?")) { await supabase.from('setlists').delete().eq('id', id); fetchSetlists(); } }} />
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden lg:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-100 dark:border-white/5">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-black font-mono text-slate-600">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button onClick={() => setIsPreferencesOpen(true)} className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
            <UserIcon className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-bold text-slate-600 uppercase hidden sm:inline">{user?.email?.split('@')[0]}</span>
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
            <Settings className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </nav>
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <ActiveSongBanner song={processedSongs.find(s => s.id === activeSongIdState) || null} onClear={() => setActiveSongId(null)} />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight uppercase">{viewMode === 'repertoire' ? 'Master Repertoire' : currentList?.name}</h2>
              <p className="text-slate-500 text-xs font-medium mt-1">{songs.length} Tracks In Context</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setIsRepertoirePickerOpen(true)} className="bg-indigo-600 h-10 px-6 rounded-xl font-black uppercase text-[10px] gap-2 shadow-lg"><Library className="w-3.5 h-3.5" /> Pull From Master</Button>
              <Button variant="ghost" size="sm" onClick={() => setIsAuditModalOpen(true)} className="h-10 px-4 rounded-xl font-black uppercase text-[10px] gap-2 text-indigo-600 bg-indigo-50"><ClipboardCheck className="w-4 h-4" /> Resource Audit</Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              {viewMode === 'setlist' && <SetlistStats songs={songs} goalSeconds={currentList?.time_goal} onUpdateGoal={(s) => saveList(currentListId!, songs, { time_goal: s })} />}
            </div>
            <div>
              <SetlistExporter 
                songs={songs} 
                onAutoLink={handleAutoLink} 
                onGlobalAutoSync={handleGlobalAutoSync} 
                onBulkRefreshAudio={handleBulkRefreshAudio}
                onClearAutoLinks={handleClearAutoLinks}
                isBulkDownloading={isBulkDownloading}
                missingAudioCount={missingAudioCount}
              />
            </div>
          </div>
          
          <SetlistManager
            songs={processedSongs}
            currentSongId={activeSongIdState || undefined}
            onSelect={handleSelectSong}
            onEdit={(s) => { setEditingSongId(s.id); setIsStudioModalOpen(true); }}
            onRemove={(id) => viewMode === 'repertoire' ? supabase.from('repertoire').delete().eq('id', id).then(fetchMasterRepertoire) : saveList(currentListId!, songs.filter(s => s.id !== id))}
            onUpdateKey={(id, k) => handleUpdateSong(id, { targetKey: k })}
            onTogglePlayed={(id) => viewMode === 'setlist' && saveList(currentListId!, songs.map(s => s.id === id ? { ...s, isPlayed: !s.isPlayed } : s))}
            onUpdateSong={handleUpdateSong}
            onSyncProData={() => Promise.resolve()}
            onReorder={(ns) => viewMode === 'setlist' && saveList(currentListId!, ns)}
            sortMode={sortMode}
            setSortMode={setSortMode}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            showHeatmap={showHeatmap}
            onLinkAudio={(n) => { setIsSearchPanelOpen(true); transposerRef.current?.triggerSearch(n); }}
          />
        </div>
        <MadeWithDyad />
      </main>
      
      <RepertoirePicker isOpen={isRepertoirePickerOpen} onClose={() => setIsRepertoirePickerOpen(false)} repertoire={masterRepertoire} currentSetlistSongs={currentList?.songs || []} onAdd={handleAddToGig} />
      <SongStudioModal isOpen={isStudioModalOpen} onClose={() => setIsStudioModalOpen(false)} gigId={viewMode === 'repertoire' ? 'library' : currentListId} songId={editingSongId} allSetlists={setlists} masterRepertoire={masterRepertoire} onUpdateSetlistSongs={handleUpdateSetlistSongs} />
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      <AdminPanel isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} onRefreshRepertoire={fetchMasterRepertoire} />
      <ResourceAuditModal isOpen={isAuditModalOpen} onClose={() => setIsAuditModalOpen(false)} songs={songs} onVerify={handleUpdateSong} onRefreshRepertoire={fetchMasterRepertoire} />
      <UserGuideModal isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />
      <aside className={cn("w-screen md:w-[450px] bg-white dark:bg-slate-900 border-l fixed right-0 top-20 bottom-0 z-40 transition-transform duration-500", isSearchPanelOpen ? "translate-x-0" : "translate-x-full")}><AudioTransposer ref={transposerRef} onAddToSetlist={handleAddNewSongToCurrentSetlist} onAddExistingSong={handleAddToGig} repertoire={masterRepertoire} currentSong={processedSongs.find(s => s.id === activeSongIdState) || null} onUpdateSongKey={(id, k) => handleUpdateSong(id, { targetKey: k })} onOpenAdmin={() => setIsAdminOpen(true)} currentList={currentList} /></aside>
      <FloatingCommandDock onOpenSearch={() => setIsSearchPanelOpen(!isSearchPanelOpen)} onOpenPractice={handleTogglePlayback} onOpenReader={() => { sessionStorage.setItem('from_dashboard', 'true'); navigate(activeSongIdState ? `/sheet-reader/${activeSongIdState}` : '/sheet-reader'); }} onOpenAdmin={() => setIsAdminOpen(true)} onOpenPreferences={() => setIsPreferencesOpen(true)} onToggleHeatmap={() => setShowHeatmap(!showHeatmap)} onOpenUserGuide={() => setIsUserGuideOpen(true)} showHeatmap={showHeatmap} viewMode={viewMode} hasPlayableSong={true} hasReadableChart={true} isPlaying={false} onTogglePlayback={handleTogglePlayback} />
    </div>
  );
};

export default Index;
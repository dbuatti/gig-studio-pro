"use client";

import React, { useState, useEffect, useRef } from 'react';
import AudioTransposer, { AudioTransposerRef } from "@/components/AudioTransposer";
import SetlistManager, { SetlistSong } from "@/components/SetlistManager";
import SetlistSelector from "@/components/SetlistSelector";
import ImportSetlist from "@/components/ImportSetlist";
import PerformanceOverlay from "@/components/PerformanceOverlay";
import ActiveSongBanner from "@/components/ActiveSongBanner";
import SetlistStats from "@/components/SetlistStats";
import PreferencesModal from "@/components/PreferencesModal";
import AdminPanel from "@/components/AdminPanel";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { showSuccess, showError } from '@/utils/toast';
import { calculateSemitones } from '@/utils/keyUtils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { User as UserIcon, Loader2, Play, LayoutDashboard, Search as SearchIcon, Rocket, Settings, Clock, ShieldCheck, Music } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useSettings } from '@/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { syncToMasterRepertoire } from '@/utils/repertoireSync';
import SongStudioModal from '@/components/SongStudioModal';

const Index = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { keyPreference } = useSettings();
  const [setlists, setSetlists] = useState<{ id: string; name: string; songs: SetlistSong[]; time_goal?: number }[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false); 
  const [performanceState, setPerformanceState] = useState({ progress: 0, duration: 0 });
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  const [syncQueue, setSyncQueue] = useState<string[]>([]);

  const isSyncingRef = useRef(false);
  const saveQueueRef = useRef<{ listId: string; songs: SetlistSong[]; updates: any; songsToSync?: SetlistSong[] }[]>([]);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const transposerRef = useRef<AudioTransposerRef>(null);

  const currentList = setlists.find(l => l.id === currentListId);
  const songs = currentList?.songs || [];
  const activeSongIndex = songs.findIndex(s => s.id === activeSongId);
  const activeSong = songs[activeSongIndex] || null;

  useEffect(() => {
    if (user) {
      fetchSetlists();
      fetchMasterRepertoire();
    }
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, [user]);

  const handleLogoMouseDown = () => {
    longPressTimerRef.current = setTimeout(() => {
      setIsAdminOpen(true);
      showSuccess("Admin Privileges Granted");
    }, 3000);
  };

  const handleLogoMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const fetchMasterRepertoire = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('repertoire').select('*').eq('user_id', user.id);
      const mapped = (data || []).map(d => ({
        id: d.id, master_id: d.id, name: d.title, artist: d.artist, bpm: d.bpm, lyrics: d.lyrics,
        originalKey: d.original_key, targetKey: d.target_key, pitch: d.pitch, ugUrl: d.ug_url,
        previewUrl: d.preview_url, youtubeUrl: d.youtube_url, appleMusicUrl: d.apple_music_url,
        pdfUrl: d.pdf_url, isMetadataConfirmed: d.is_metadata_confirmed, isKeyConfirmed: d.is_key_confirmed,
        duration_seconds: d.duration_seconds, notes: d.notes, user_tags: d.user_tags || [], resources: d.resources || []
      }));
      setMasterRepertoire(mapped);
    } catch (err) {}
  };

  const fetchSetlists = async () => {
    try {
      const { data, error } = await supabase.from('setlists').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        setSetlists(data.map(d => ({ id: d.id, name: d.name, songs: d.songs as SetlistSong[], time_goal: d.time_goal })));
        setCurrentListId(data[0].id);
      }
    } catch (err) {}
  };

  const saveList = async (listId: string, updatedSongs: SetlistSong[], updates: Partial<any> = {}, songsToSync?: SetlistSong[]) => {
    if (!user) return;
    if (isSyncingRef.current) {
      saveQueueRef.current.push({ listId, songs: updatedSongs, updates, songsToSync });
      return;
    }
    isSyncingRef.current = true;
    setIsSaving(true);
    try {
      let finalSongs = updatedSongs;
      if (songsToSync && songsToSync.length > 0) {
        const syncedBatch = await syncToMasterRepertoire(user.id, songsToSync);
        finalSongs = updatedSongs.map(s => {
          const synced = syncedBatch.find(sb => sb.id === s.id);
          return synced || s;
        });
      }
      setSetlists(prev => prev.map(l => l.id === listId ? { ...l, songs: finalSongs, ...updates } : l));
      const cleanedSongsForJson = finalSongs.map(({ isSyncing, ...rest }) => rest);
      await supabase.from('setlists').update({ 
        songs: cleanedSongsForJson, 
        updated_at: new Date().toISOString(), 
        ...updates 
      }).eq('id', listId);
      if (songsToSync && songsToSync.length > 0) fetchMasterRepertoire();
    } catch (err) {
      console.error("[Gig Studio] Save failure:", err);
    } finally {
      setIsSaving(false);
      isSyncingRef.current = false;
      if (saveQueueRef.current.length > 0) {
        const next = saveQueueRef.current.shift()!;
        saveList(next.listId, next.songs, next.updates, next.songsToSync);
      }
    }
  };

  const handleUpdateSong = (songId: string, updates: Partial<SetlistSong>) => {
    if (!currentListId) return;
    setSetlists(prev => {
      const list = prev.find(l => l.id === currentListId);
      if (!list) return prev;
      const updatedSongs = list.songs.map(s => s.id === songId ? { ...s, ...updates } : s);
      const updatedSong = updatedSongs.find(s => s.id === songId);
      const masterFields = ['name', 'artist', 'previewUrl', 'youtubeUrl', 'originalKey', 'targetKey', 'pitch', 'bpm', 'lyrics', 'pdfUrl', 'ugUrl', 'isMetadataConfirmed', 'isKeyConfirmed'];
      const needsMasterSync = Object.keys(updates).some(key => masterFields.includes(key));
      saveList(currentListId, updatedSongs, {}, needsMasterSync && updatedSong ? [updatedSong] : undefined);
      return prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l);
    });
  };

  const handleAddToSetlist = async (previewUrl: string, name: string, artist: string, youtubeUrl?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string, pitch: number = 0) => {
    if (!currentListId || !user) return;
    const existing = masterRepertoire.find(s => s.name.toLowerCase() === name.toLowerCase() && s.artist?.toLowerCase() === artist.toLowerCase());
    const newSongId = Math.random().toString(36).substr(2, 9);
    const newSong: SetlistSong = existing 
      ? { ...existing, id: newSongId, master_id: existing.master_id, isPlayed: false, isSyncing: false } 
      : { 
          id: newSongId, name, artist, previewUrl, youtubeUrl, ugUrl, appleMusicUrl, genre, pitch, 
          originalKey: "TBC", targetKey: "TBC", isPlayed: false, isSyncing: true, isMetadataConfirmed: false,
          user_tags: genre ? [genre] : []
        };
    const list = setlists.find(l => l.id === currentListId);
    if (!list) return;
    const updatedSongs = [...list.songs, newSong];
    await saveList(currentListId, updatedSongs, {}, [newSong]);
  };

  const handleAddExistingSong = (song: SetlistSong) => {
    if (!currentListId) return;
    const newSongId = Math.random().toString(36).substr(2, 9);
    const list = setlists.find(l => l.id === currentListId);
    if (!list) return;
    const newEntry = { ...song, id: newSongId, master_id: song.master_id || song.id, isPlayed: false };
    const updatedSongs = [...list.songs, newEntry];
    saveList(currentListId, updatedSongs, {}, [newEntry]);
    showSuccess(`Imported "${song.name}"`);
  };

  const handleUpdateKey = (songId: string, targetKey: string) => {
    if (!currentListId) return;
    const list = setlists.find(l => l.id === currentListId);
    if (!list) return;
    const updatedSongs = list.songs.map(s => {
      if (s.id === songId) {
        const pitch = calculateSemitones(s.originalKey || "C", targetKey);
        if (activeSongId === songId && transposerRef.current) transposerRef.current.setPitch(pitch);
        return { ...s, targetKey, pitch };
      }
      return s;
    });
    const updatedSong = updatedSongs.find(s => s.id === songId);
    saveList(currentListId, updatedSongs, {}, updatedSong ? [updatedSong] : undefined);
  };

  const handleTogglePlayed = (songId: string) => {
    if (!currentListId) return;
    const list = setlists.find(l => l.id === currentListId);
    if (!list) return;
    const updatedSongs = list.songs.map(s => s.id === songId ? { ...s, isPlayed: !s.isPlayed } : s);
    saveList(currentListId, updatedSongs, {}, undefined);
  };

  const handleSelectSong = async (song: SetlistSong) => {
    setActiveSongId(song.id);
    setIsStudioOpen(true);
    if (song.previewUrl && transposerRef.current) {
      await transposerRef.current.loadFromUrl(song.previewUrl, song.name, song.artist || "Unknown", song.youtubeUrl, song.originalKey, song.ugUrl);
      transposerRef.current.setPitch(song.pitch);
    }
  };

  const handleNextSong = async () => {
    const playable = songs.filter(isPlayableMaster);
    const currIdx = playable.findIndex(s => s.id === activeSongId);
    if (currIdx !== -1 && currIdx < playable.length - 1) {
      handleSelectSong(playable[currIdx + 1]);
      if (isPerformanceMode) setTimeout(() => transposerRef.current?.togglePlayback(), 1000);
    } else {
      setIsPerformanceMode(false);
      setActiveSongId(null);
      transposerRef.current?.stopPlayback();
      showSuccess("Gig Finished!");
    }
  };

  const handlePreviousSong = () => {
    const playable = songs.filter(isPlayableMaster);
    const currIdx = playable.findIndex(s => s.id === activeSongId);
    if (currIdx > 0) handleSelectSong(playable[currIdx - 1]);
  };

  const handleShuffle = () => {
    if (!currentListId || songs.length < 2) return;
    const shuffled = [...songs];
    const currentIndex = shuffled.findIndex(s => s.id === activeSongId);
    for (let i = shuffled.length - 1; i > 0; i--) {
      if (i === currentIndex) continue;
      let j = Math.floor(Math.random() * (i + 1));
      while (j === currentIndex) j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    saveList(currentListId, shuffled);
    showSuccess("Setlist Shuffled");
  };

  const startPerformance = async () => {
    const first = songs.find(isPlayableMaster);
    if (!first) { showError("No full audio tracks found."); return; }
    setIsPerformanceMode(true);
    handleSelectSong(first);
    setTimeout(() => transposerRef.current?.togglePlayback(), 1000);
  };

  const isPlayableMaster = (song: SetlistSong) => {
    if (!song.previewUrl) return false;
    return !song.previewUrl.includes('apple.com') && !song.previewUrl.includes('itunes-assets');
  };

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden relative">
      <nav className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b px-4 md:px-6 flex items-center justify-between z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-3 md:gap-6 flex-1 min-w-0">
          <div 
            className="flex items-center gap-2 shrink-0 cursor-default select-none"
            onMouseDown={handleLogoMouseDown}
            onMouseUp={handleLogoMouseUp}
            onMouseLeave={handleLogoMouseUp}
            onTouchStart={handleLogoMouseDown}
            onTouchEnd={handleLogoMouseUp}
          >
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="font-black uppercase tracking-tighter text-lg text-slate-900 dark:text-white hidden sm:block">Gig Studio <span className="text-indigo-600">Pro</span></span>
          </div>
          <SetlistSelector setlists={setlists} currentId={currentListId || ''} onSelect={setCurrentListId}
            onCreate={async () => {
              const name = prompt("Enter Gig Name:");
              if (name) {
                const { data } = await supabase.from('setlists').insert([{ user_id: user?.id, name, songs: [], time_goal: 7200 }]).select().single();
                if (data) fetchSetlists();
              }
            }}
            onDelete={async (id) => {
              if (confirm("Delete gig?")) {
                await supabase.from('setlists').delete().eq('id', id);
                fetchSetlists();
              }
            }}
          />
        </div>
        <div className="flex items-center gap-2 md:gap-6 shrink-0 ml-2">
          <div className="hidden lg:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-100 dark:border-white/5">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-black font-mono text-slate-600 dark:text-slate-300">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="default" size="sm" onClick={startPerformance} className="h-9 md:h-10 gap-2 bg-indigo-600 font-bold uppercase tracking-tight shadow-lg shadow-indigo-600/20 px-3 md:px-4"><Rocket className="w-4 h-4" /><span className="hidden md:inline">Start Show</span></Button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <Button variant="ghost" size="icon" onClick={() => setIsStudioOpen(!isStudioOpen)} className={cn("h-9 w-9 md:h-10 md:w-10 rounded-lg shrink-0", isStudioOpen && "text-indigo-600 bg-indigo-50")}><SearchIcon className="w-4 h-4" /></Button>
            <button onClick={() => setIsPreferencesOpen(true)} className="flex items-center gap-2 px-2 md:px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <UserIcon className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest hidden sm:inline">{user?.email?.split('@')[0]}</span>{isSaving && <Loader2 className="w-3 h-3 animate-spin text-indigo-500 ml-1" />}<Settings className="w-3 h-3 text-slate-400 ml-1" />
            </button>
          </div>
        </div>
      </nav>
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth cursor-default">
          <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
            <ActiveSongBanner song={activeSong} isPlaying={isPlayerActive} onTogglePlayback={() => transposerRef.current?.togglePlayback()} onClear={() => { setActiveSongId(null); transposerRef.current?.stopPlayback(); }} />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase truncate max-w-full">{currentList?.name}</h2>
                <div className="flex items-center gap-3 md:gap-4 mt-1 overflow-x-auto no-scrollbar pb-1">
                  <p className="text-slate-500 text-xs font-medium whitespace-nowrap">{songs.length} Tracks</p>
                  <div className="h-1 w-1 rounded-full bg-slate-300 shrink-0" />
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full"><ShieldCheck className="w-3 h-3 text-emerald-500" /><span className="text-[9px] font-black uppercase text-emerald-600 tracking-widest">Headless Sync Active</span></div>
                </div>
              </div>
              <ImportSetlist onImport={(newSongs) => {
                if (!currentListId) return;
                saveList(currentListId, [...songs, ...newSongs.map(s => ({ ...s, isSyncing: true }))], {}, newSongs);
              }} />
            </div>
            <SetlistStats songs={songs} goalSeconds={currentList?.time_goal} onUpdateGoal={(s) => currentListId && saveList(currentListId, songs, { time_goal: s }, undefined)} />
            <SetlistManager songs={songs} onRemove={(id) => currentListId && saveList(currentListId, songs.filter(s => s.id !== id), {}, undefined)} onSelect={handleSelectSong} onUpdateKey={handleUpdateKey} onTogglePlayed={handleTogglePlayed} onSyncProData={async (s) => {}} onLinkAudio={(n) => { setIsStudioOpen(true); transposerRef.current?.triggerSearch(n); }} onUpdateSong={handleUpdateSong} onReorder={(ns) => currentListId && saveList(currentListId, ns, {}, undefined)} currentSongId={activeSongId || undefined} onOpenAdmin={() => setIsAdminOpen(true)} />
          </div>
          <MadeWithDyad />
        </main>
        <aside className={cn("w-full md:w-[450px] bg-white dark:bg-slate-900 border-l shadow-2xl transition-all duration-500 shrink-0 relative z-40", isStudioOpen ? "translate-x-0" : "translate-x-full absolute right-0 top-16 bottom-0 md:top-20")}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-full text-white animate-pulse">{activeSongId ? <Play className="w-4 h-4 fill-current" /> : <SearchIcon className="w-4 h-4" />}</div>
                <div><h3 className="text-xs font-black uppercase tracking-widest text-indigo-600">{activeSongId ? "Performing" : "Studio Engine"}</h3><p className="text-sm font-bold truncate max-w-[200px]">{activeSongId ? activeSong?.name : "Link Assets"}</p></div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsStudioOpen(false)} className="text-[10px] font-bold uppercase">Hide</Button>
            </div>
            <div className="flex-1 overflow-y-auto"><AudioTransposer ref={transposerRef} onAddToSetlist={handleAddToSetlist} onAddExistingSong={handleAddExistingSong} onUpdateSongKey={handleUpdateKey} onSongEnded={handleNextSong} onPlaybackChange={setIsPlayerActive} repertoire={masterRepertoire} currentSong={activeSong} onOpenAdmin={() => setIsAdminOpen(true)} /></div>
          </div>
        </aside>
      </div>
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      <AdminPanel isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
      {isPerformanceMode && (
        <PerformanceOverlay songs={songs.filter(isPlayableMaster)} currentIndex={songs.filter(isPlayableMaster).findIndex(s => s.id === activeSongId)} isPlaying={isPlayerActive} progress={performanceState.progress} duration={performanceState.duration} onTogglePlayback={() => transposerRef.current?.togglePlayback()} onNext={handleNextSong} onPrevious={handlePreviousSong} onShuffle={handleShuffle} onClose={() => { setIsPerformanceMode(false); setActiveSongId(null); transposerRef.current?.stopPlayback(); }} onUpdateKey={handleUpdateKey} onUpdateSong={handleUpdateSong} analyzer={transposerRef.current?.getAnalyzer()} onOpenAdmin={() => setIsAdminOpen(true)} />
      )}
      
      {/* Ensure SongStudioModal in Aside also has onOpenAdmin connected */}
      <SongStudioModal 
        song={activeSong} 
        isOpen={isStudioOpen && !!activeSongId} 
        onClose={() => setIsStudioOpen(false)} 
        onSave={handleUpdateSong} 
        onUpdateKey={handleUpdateKey}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />
    </div>
  );
};

export default Index;
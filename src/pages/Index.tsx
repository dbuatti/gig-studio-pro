"use client";

import React, { useState, useEffect, useRef } from 'react';
import AudioTransposer, { AudioTransposerRef } from "@/components/AudioTransposer";
import SetlistManager, { SetlistSong } from "@/components/SetlistManager";
import SetlistSelector from "@/components/SetlistSelector";
import ImportSetlist from "@/components/ImportSetlist";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { showSuccess, showError } from '@/utils/toast';
import { calculateSemitones } from '@/utils/keyUtils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, User as UserIcon, Loader2, Play, Music, LayoutDashboard, Search as SearchIcon } from 'lucide-react';
import { cn } from "@/lib/utils";

const Index = () => {
  const { user, signOut } = useAuth();
  const [setlists, setSetlists] = useState<{ id: string; name: string; songs: SetlistSong[] }[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(true);
  const transposerRef = useRef<AudioTransposerRef>(null);

  const currentList = setlists.find(l => l.id === currentListId);
  const songs = currentList?.songs || [];
  const activeSong = songs.find(s => s.id === activeSongId);

  useEffect(() => {
    if (user) fetchSetlists();
  }, [user]);

  const fetchSetlists = async () => {
    try {
      const { data, error } = await supabase
        .from('setlists')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setSetlists(data.map(d => ({ id: d.id, name: d.name, songs: d.songs as SetlistSong[] })));
        setCurrentListId(data[0].id);
      } else {
        const newList = { name: "My First Gig", songs: [] };
        const { data: created, error: createError } = await supabase
          .from('setlists')
          .insert([{ user_id: user?.id, ...newList }])
          .select()
          .single();
        
        if (createError) throw createError;
        if (created) {
          setSetlists([{ id: created.id, name: created.name, songs: created.songs as SetlistSong[] }]);
          setCurrentListId(created.id);
        }
      }
    } catch (err) {
      console.error("Fetch error", err);
    }
  };

  const saveList = async (listId: string, updatedSongs: SetlistSong[]) => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Clean temporary UI states like isSyncing before saving
      const cleanedSongs = updatedSongs.map(({ isSyncing, ...rest }) => rest);
      const { error } = await supabase
        .from('setlists')
        .update({ songs: cleanedSongs, updated_at: new Date().toISOString() })
        .eq('id', listId);
      if (error) throw error;
    } catch (err) {
      showError("Sync failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncProData = async (song: SetlistSong) => {
    if (!currentListId) return;
    
    // Update UI to show syncing state
    setSetlists(prev => prev.map(l => l.id === currentListId ? {
      ...l,
      songs: l.songs.map(s => s.id === song.id ? { ...s, isSyncing: true } : s)
    } : l));

    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { query: song.name }
      });
      if (error) throw error;
      
      const updates = {
        originalKey: data.originalKey,
        targetKey: data.originalKey,
        bpm: data.bpm?.toString(),
        genre: data.genre,
        pitch: 0,
        isSyncing: false
      };

      const updatedSongs = songs.map(s => s.id === song.id ? { ...s, ...updates } : s);
      setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l));
      saveList(currentListId, updatedSongs);
    } catch (err) {
      // Fail silently but clear syncing state
      setSetlists(prev => prev.map(l => l.id === currentListId ? {
        ...l,
        songs: l.songs.map(s => s.id === song.id ? { ...s, isSyncing: false } : s)
      } : l));
    }
  };

  const handleUpdateSong = (songId: string, updates: Partial<SetlistSong>) => {
    if (!currentListId) return;
    const updatedSongs = songs.map(s => s.id === songId ? { ...s, ...updates } : s);
    setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l));
    saveList(currentListId, updatedSongs);
  };

  const handleAddToSetlist = async (previewUrl: string, name: string, youtubeUrl?: string, pitch: number = 0) => {
    if (!currentListId) return;
    const newSongId = Math.random().toString(36).substr(2, 9);
    const newSong: SetlistSong = {
      id: newSongId,
      name,
      previewUrl,
      youtubeUrl,
      pitch,
      originalKey: "TBC",
      targetKey: "TBC",
      isPlayed: false,
      isSyncing: true
    };
    
    const updatedSongs = [...songs, newSong];
    setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l));
    
    // Fire and forget enrichment
    handleSyncProData(newSong);
  };

  const handleUpdateKey = (songId: string, targetKey: string) => {
    if (!currentListId) return;
    const updatedSongs = songs.map(s => {
      if (s.id === songId) {
        const pitch = calculateSemitones(s.originalKey || "C", targetKey);
        if (activeSongId === songId && transposerRef.current) transposerRef.current.setPitch(pitch);
        return { ...s, targetKey, pitch };
      }
      return s;
    });
    setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l));
    saveList(currentListId, updatedSongs);
  };

  const handleTogglePlayed = (songId: string) => {
    if (!currentListId) return;
    const updatedSongs = songs.map(s => s.id === songId ? { ...s, isPlayed: !s.isPlayed } : s);
    setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l));
    saveList(currentListId, updatedSongs);
  };

  const handleSelectSong = async (song: SetlistSong) => {
    setActiveSongId(song.id);
    setIsStudioOpen(true);
    if (song.previewUrl && transposerRef.current) {
      await transposerRef.current.loadFromUrl(song.previewUrl, song.name, song.youtubeUrl);
      transposerRef.current.setPitch(song.pitch);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <nav className="h-16 bg-white dark:bg-slate-900 border-b px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="font-black uppercase tracking-tighter text-lg">Gig Studio <span className="text-indigo-600">Pro</span></span>
          </div>
          <SetlistSelector 
            setlists={setlists} 
            currentId={currentListId || ''} 
            onSelect={setCurrentListId}
            onCreate={async () => {
              const name = prompt("Enter Gig Name:");
              if (!name) return;
              const { data } = await supabase.from('setlists').insert([{ user_id: user?.id, name, songs: [] }]).select().single();
              if (data) fetchSetlists();
            }}
            onDelete={async (id) => {
              if (confirm("Delete this gig?")) {
                await supabase.from('setlists').delete().eq('id', id);
                fetchSetlists();
              }
            }}
          />
        </div>

        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsStudioOpen(!isStudioOpen)}
            className={cn("gap-2 font-bold uppercase tracking-tight", isStudioOpen && "text-indigo-600")}
          >
            <SearchIcon className="w-4 h-4" /> Song Studio
          </Button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
            <UserIcon className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{user?.email?.split('@')[0]}</span>
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="rounded-full">
            <LogOut className="w-4 h-4 text-slate-400 hover:text-red-500" />
          </Button>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">{currentList?.name}</h2>
                <p className="text-slate-500 text-sm font-medium">{songs.length} Songs Loaded</p>
              </div>
              <div className="flex gap-2">
                <ImportSetlist onImport={(newSongs) => {
                  if (!currentListId) return;
                  const songsToSync = newSongs.map(s => ({ ...s, isSyncing: true }));
                  const updated = [...songs, ...songsToSync];
                  setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updated } : l));
                  
                  // Trigger bulk sync for new imports
                  songsToSync.forEach(s => handleSyncProData(s));
                }} />
              </div>
            </div>

            <SetlistManager 
              songs={songs} 
              onRemove={(id) => {
                const updated = songs.filter(s => s.id !== id);
                setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updated } : l));
                saveList(currentListId!, updated);
              }}
              onSelect={handleSelectSong}
              onUpdateKey={handleUpdateKey}
              onTogglePlayed={handleTogglePlayed}
              onSyncProData={handleSyncProData}
              onLinkAudio={(name) => {
                setIsStudioOpen(true);
                transposerRef.current?.triggerSearch(name);
              }}
              onUpdateSong={handleUpdateSong}
              currentSongId={activeSongId || undefined}
            />
          </div>
          <MadeWithDyad />
        </main>

        <aside className={cn(
          "w-[450px] bg-white dark:bg-slate-900 border-l shadow-2xl transition-all duration-500 ease-in-out transform",
          isStudioOpen ? "translate-x-0" : "translate-x-full opacity-0 pointer-events-none"
        )}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-full text-white animate-pulse">
                  {activeSongId ? <Play className="w-4 h-4 fill-current" /> : <SearchIcon className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600">{activeSongId ? "Performing Now" : "Inspiration Studio"}</h3>
                  <p className="text-sm font-bold truncate max-w-[200px]">{activeSongId ? activeSong?.name : "Find & Add Songs"}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsStudioOpen(false)} className="text-[10px] font-bold uppercase tracking-tighter">Close Studio</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <AudioTransposer ref={transposerRef} onAddToSetlist={handleAddToSetlist} />
            </div>
          </div>
        </aside>
      </div>

      {!isStudioOpen && (
        <button 
          onClick={() => setIsStudioOpen(true)}
          className="fixed bottom-8 right-8 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all z-50 group"
        >
          <SearchIcon className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Index;
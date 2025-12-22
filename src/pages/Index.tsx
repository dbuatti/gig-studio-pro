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
import { LogOut, User as UserIcon, Loader2, Play, Music, LayoutDashboard } from 'lucide-react';
import { cn } from "@/lib/utils";

const Index = () => {
  const { user, signOut } = useAuth();
  const [setlists, setSetlists] = useState<{ id: string; name: string; songs: SetlistSong[] }[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
      const { error } = await supabase
        .from('setlists')
        .update({ songs: updatedSongs, updated_at: new Date().toISOString() })
        .eq('id', listId);
      if (error) throw error;
    } catch (err) {
      showError("Sync failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSong = (songId: string, updates: Partial<SetlistSong>) => {
    if (!currentListId) return;
    const updatedSongs = songs.map(s => s.id === songId ? { ...s, ...updates } : s);
    setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l));
    saveList(currentListId, updatedSongs);
  };

  const handleCreateList = async () => {
    const name = prompt("Enter Gig Name:", `Gig ${setlists.length + 1}`);
    if (!name) return;
    const { data, error } = await supabase.from('setlists').insert([{ user_id: user?.id, name, songs: [] }]).select().single();
    if (data) {
      setSetlists(prev => [{ id: data.id, name: data.name, songs: [] }, ...prev]);
      setCurrentListId(data.id);
      showSuccess(`Gig "${name}" Created`);
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    await supabase.from('setlists').delete().eq('id', id);
    const updated = setlists.filter(l => l.id !== id);
    setSetlists(updated);
    if (updated.length > 0) setCurrentListId(updated[0].id);
  };

  const handleAddToSetlist = (previewUrl: string, name: string, youtubeUrl?: string, pitch: number = 0) => {
    if (!currentListId) return;
    const newSong: SetlistSong = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      previewUrl,
      youtubeUrl,
      pitch,
      originalKey: "C",
      targetKey: "C",
      isPlayed: false
    };
    const updatedSongs = [...songs, newSong];
    setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l));
    saveList(currentListId, updatedSongs);
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
            onCreate={handleCreateList}
            onDelete={handleDeleteList}
          />
        </div>

        <div className="flex items-center gap-4">
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
                <p className="text-slate-500 text-sm font-medium">Gig Date: February 2026 • {songs.length} Songs Loaded</p>
              </div>
              <div className="flex gap-2">
                <ImportSetlist onImport={(newSongs) => {
                  if (!currentListId) return;
                  const updated = [...songs, ...newSongs];
                  setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updated } : l));
                  saveList(currentListId, updated);
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
              onLinkAudio={(name) => transposerRef.current?.triggerSearch(name)}
              onUpdateSong={handleUpdateSong}
              currentSongId={activeSongId || undefined}
            />
          </div>
          <MadeWithDyad />
        </main>

        <aside className={cn(
          "w-[450px] bg-white dark:bg-slate-900 border-l shadow-2xl transition-all duration-500 ease-in-out transform",
          activeSongId ? "translate-x-0" : "translate-x-full opacity-0 pointer-events-none"
        )}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-full text-white animate-pulse">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600">Performing Now</h3>
                  <p className="text-sm font-bold truncate max-w-[200px]">{activeSong?.name}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveSongId(null)} className="text-[10px] font-bold uppercase tracking-tighter">Close Engine</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <AudioTransposer ref={transposerRef} onAddToSetlist={handleAddToSetlist} />
            </div>
          </div>
        </aside>
      </div>

      {!activeSongId && songs.length > 0 && (
        <button 
          onClick={() => { if(songs[0]) handleSelectSong(songs[0]); }}
          className="fixed bottom-8 right-8 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all z-50 group"
        >
          <Music className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Index;
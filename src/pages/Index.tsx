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
import { LogOut, User as UserIcon, Loader2 } from 'lucide-react';

const Index = () => {
  const { user, signOut } = useAuth();
  const [setlists, setSetlists] = useState<{ id: string; name: string; songs: SetlistSong[] }[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const transposerRef = useRef<AudioTransposerRef>(null);

  const currentList = setlists.find(l => l.id === currentListId);
  const songs = currentList?.songs || [];

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
        // Create initial list if none exist
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

  const handleCreateList = async () => {
    const name = prompt("Enter Gig Name:", `Gig ${setlists.length + 1}`);
    if (!name) return;

    try {
      const { data, error } = await supabase
        .from('setlists')
        .insert([{ user_id: user?.id, name, songs: [] }])
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        setSetlists(prev => [{ id: data.id, name: data.name, songs: [] }, ...prev]);
        setCurrentListId(data.id);
        showSuccess(`Gig "${name}" Created`);
      }
    } catch (err) {
      showError("Could not create gig list.");
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm("Are you sure? This will delete all songs in this setlist.")) return;
    
    try {
      const { error } = await supabase.from('setlists').delete().eq('id', id);
      if (error) throw error;
      
      const updated = setlists.filter(l => l.id !== id);
      setSetlists(updated);
      if (updated.length > 0) setCurrentListId(updated[0].id);
      showSuccess("Gig Deleted");
    } catch (err) {
      showError("Delete failed.");
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

  const handleTogglePlayed = (songId: string) => {
    if (!currentListId) return;
    const updatedSongs = songs.map(s => s.id === songId ? { ...s, isPlayed: !s.isPlayed } : s);
    setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l));
    saveList(currentListId, updatedSongs);
  };

  const handleUpdateKey = (songId: string, targetKey: string) => {
    if (!currentListId) return;
    const updatedSongs = songs.map(s => {
      if (s.id === songId) {
        const pitch = calculateSemitones(s.originalKey || "C", targetKey);
        return { ...s, targetKey, pitch };
      }
      return s;
    });
    setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l));
    saveList(currentListId, updatedSongs);
  };

  const handleRemoveSong = (songId: string) => {
    if (!currentListId) return;
    const updatedSongs = songs.filter(s => s.id !== songId);
    setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l));
    saveList(currentListId, updatedSongs);
  };

  const handleSelectSong = async (song: SetlistSong) => {
    if (song.previewUrl && transposerRef.current) {
      await transposerRef.current.loadFromUrl(song.previewUrl, song.name, song.youtubeUrl);
      transposerRef.current.setPitch(song.pitch);
    } else {
      showError("Link audio engine first.");
    }
  };

  const handleLinkAudio = (name: string) => {
    if (transposerRef.current) {
      transposerRef.current.triggerSearch(name);
      showSuccess(`Searching for "${name}"...`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <UserIcon className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">{user?.email}</span>
              {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
              Gig Studio Pro
            </h1>
          </div>
          <div className="flex flex-col items-end gap-3">
            <SetlistSelector 
              setlists={setlists} 
              currentId={currentListId || ''} 
              onSelect={setCurrentListId}
              onCreate={handleCreateList}
              onDelete={handleDeleteList}
            />
            <div className="flex items-center gap-2">
              <ImportSetlist onImport={(newSongs) => {
                if (!currentListId) return;
                const updated = [...songs, ...newSongs];
                setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: updated } : l));
                saveList(currentListId, updated);
              }} />
              <Button variant="ghost" size="sm" onClick={signOut} className="text-slate-500 hover:text-red-600">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <AudioTransposer ref={transposerRef} onAddToSetlist={handleAddToSetlist} />
          </div>
          
          <div className="lg:col-span-1">
            <SetlistManager 
              songs={songs} 
              onRemove={handleRemoveSong}
              onSelect={handleSelectSong}
              onUpdateKey={handleUpdateKey}
              onTogglePlayed={handleTogglePlayed}
              onLinkAudio={handleLinkAudio}
              currentSongId={undefined} // Controlled via selection
            />
          </div>
        </main>

        <footer className="pt-8">
          <MadeWithDyad />
        </footer>
      </div>
    </div>
  );
};

export default Index;
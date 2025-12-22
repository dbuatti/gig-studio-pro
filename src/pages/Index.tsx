"use client";

import React, { useState, useEffect, useRef } from 'react';
import AudioTransposer, { AudioTransposerRef } from "@/components/AudioTransposer";
import SetlistManager, { SetlistSong } from "@/components/SetlistManager";
import ImportSetlist from "@/components/ImportSetlist";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { showSuccess, showError } from '@/utils/toast';
import { calculateSemitones } from '@/utils/keyUtils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, User as UserIcon, Save, Loader2 } from 'lucide-react';

const Index = () => {
  const { user, signOut } = useAuth();
  const [setlist, setSetlist] = useState<SetlistSong[]>([]);
  const [currentSongId, setCurrentSongId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [setlistId, setSetlistId] = useState<string | null>(null);
  const transposerRef = useRef<AudioTransposerRef>(null);

  // Load setlist from Supabase on mount
  useEffect(() => {
    if (user) {
      fetchSetlist();
    }
  }, [user]);

  const fetchSetlist = async () => {
    try {
      const { data, error } = await supabase
        .from('setlists')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSetlist(data.songs as SetlistSong[]);
        setSetlistId(data.id);
      }
    } catch (err) {
      console.error("Failed to fetch setlist", err);
    }
  };

  const saveToSupabase = async (newSetlist: SetlistSong[]) => {
    if (!user) return;
    setIsSaving(true);
    try {
      if (setlistId) {
        const { error } = await supabase
          .from('setlists')
          .update({ songs: newSetlist, updated_at: new Date().toISOString() })
          .eq('id', setlistId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('setlists')
          .insert([{ user_id: user.id, songs: newSetlist }])
          .select()
          .single();
        if (error) throw error;
        if (data) setSetlistId(data.id);
      }
    } catch (err) {
      console.error("Failed to save setlist", err);
      showError("Cloud sync failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToSetlist = (previewUrl: string, name: string, youtubeUrl?: string, pitch: number = 0) => {
    const newSong: SetlistSong = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      previewUrl,
      youtubeUrl,
      pitch,
      originalKey: "C",
      targetKey: "C"
    };
    const updated = [...setlist, newSong];
    setSetlist(updated);
    saveToSupabase(updated);
    showSuccess(`Added "${name}" to setlist`);
  };

  const handleImportSongs = (songs: SetlistSong[]) => {
    const updated = [...setlist, ...songs];
    setSetlist(updated);
    saveToSupabase(updated);
    showSuccess(`Imported ${songs.length} songs from Markdown`);
  };

  const handleUpdateKey = (id: string, targetKey: string) => {
    const updated = setlist.map(s => {
      if (s.id === id) {
        const pitch = calculateSemitones(s.originalKey || "C", targetKey);
        if (currentSongId === id && transposerRef.current) {
          transposerRef.current.setPitch(pitch);
        }
        return { ...s, targetKey, pitch };
      }
      return s;
    });
    setSetlist(updated);
    saveToSupabase(updated);
  };

  const handleRemoveFromSetlist = (id: string) => {
    const updated = setlist.filter(s => s.id !== id);
    setSetlist(updated);
    saveToSupabase(updated);
    if (currentSongId === id) setCurrentSongId(undefined);
  };

  const handleSelectFromSetlist = async (song: SetlistSong) => {
    setCurrentSongId(song.id);
    if (song.previewUrl) {
      if (transposerRef.current) {
        await transposerRef.current.loadFromUrl(song.previewUrl, song.name, song.youtubeUrl);
        transposerRef.current.setPitch(song.pitch);
      }
    } else {
      showError(`"${song.name}" is metadata only. Search for it to link audio.`);
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
              {isSaving ? (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> SYNCING...
                </span>
              ) : (
                <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest">● CLOUD SYNCED</span>
              )}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
              Gig Studio Pro
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Performance-ready setlist management and real-time transposition.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ImportSetlist onImport={handleImportSongs} />
            <Button variant="ghost" size="sm" onClick={signOut} className="text-slate-500 hover:text-red-600">
              <LogOut className="w-4 h-4 mr-2" /> Exit
            </Button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <AudioTransposer 
              ref={transposerRef} 
              onAddToSetlist={handleAddToSetlist} 
            />
          </div>
          
          <div className="lg:col-span-1">
            <SetlistManager 
              songs={setlist} 
              onRemove={handleRemoveFromSetlist}
              onSelect={handleSelectFromSetlist}
              onUpdateKey={handleUpdateKey}
              currentSongId={currentSongId}
            />
          </div>
        </main>

        <footer className="pt-8">
          <div className="max-w-xl mx-auto p-4 bg-white dark:bg-slate-900 rounded-lg border text-sm text-slate-500 text-center">
            <h3 className="font-semibold mb-2">Supabase Cloud Active</h3>
            <p>
              Your setlists are now stored securely in the database. Changes are saved automatically as you work.
            </p>
          </div>
          <MadeWithDyad />
        </footer>
      </div>
    </div>
  );
};

export default Index;
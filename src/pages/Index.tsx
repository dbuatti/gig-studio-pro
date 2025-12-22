"use client";

import React, { useState, useEffect, useRef } from 'react';
import AudioTransposer, { AudioTransposerRef } from "@/components/AudioTransposer";
import SetlistManager, { SetlistSong } from "@/components/SetlistManager";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { showSuccess } from '@/utils/toast';

const Index = () => {
  const [setlist, setSetlist] = useState<SetlistSong[]>([]);
  const [currentSongId, setCurrentSongId] = useState<string | undefined>();
  const transposerRef = useRef<AudioTransposerRef>(null);

  // Load setlist from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('gig-setlist');
    if (saved) {
      try {
        setSetlist(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse setlist", e);
      }
    }
  }, []);

  // Save setlist to localStorage on change
  useEffect(() => {
    localStorage.setItem('gig-setlist', JSON.stringify(setlist));
  }, [setlist]);

  const handleAddToSetlist = (previewUrl: string, name: string, youtubeUrl?: string, pitch: number = 0) => {
    const newSong: SetlistSong = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      previewUrl,
      youtubeUrl,
      pitch
    };
    setSetlist(prev => [...prev, newSong]);
    showSuccess(`Added "${name}" to setlist`);
  };

  const handleRemoveFromSetlist = (id: string) => {
    setSetlist(prev => prev.filter(s => s.id !== id));
  };

  const handleSelectFromSetlist = async (song: SetlistSong) => {
    if (transposerRef.current) {
      setCurrentSongId(song.id);
      // First load the audio
      await transposerRef.current.loadFromUrl(song.previewUrl, song.name, song.youtubeUrl);
      // Then apply the saved pitch
      transposerRef.current.setPitch(song.pitch);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
            Gig Studio Pro
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Performance-ready setlist management and real-time transposition.
          </p>
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
              currentSongId={currentSongId}
            />
          </div>
        </main>

        <footer className="pt-8">
          <div className="max-w-xl mx-auto p-4 bg-white dark:bg-slate-900 rounded-lg border text-sm text-slate-500 text-center">
            <h3 className="font-semibold mb-2">Setlist Intelligence</h3>
            <p>
              Your setlist is saved automatically in your browser. Load any song to adjust its semitones, 
              then hit "Save to Setlist" to update its persistent state for your live performance.
            </p>
          </div>
          <MadeWithDyad />
        </footer>
      </div>
    </div>
  );
};

export default Index;
"use client";

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, Music, ArrowUpDown, Clock, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublicRepertoireViewProps {
  profile: any;
  songs: any[];
  isPreview?: boolean;
}

const PublicRepertoireView: React.FC<PublicRepertoireViewProps> = ({ profile, songs, isPreview }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<'artist' | 'alphabetical'>('artist');

  const filteredSongs = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return songs.filter(s => 
      (s.title || s.name || "").toLowerCase().includes(q) || 
      (s.artist || "").toLowerCase().includes(q) ||
      (s.genre || "").toLowerCase().includes(q)
    );
  }, [songs, searchTerm]);

  const groupedSongs = useMemo(() => {
    if (sortMode === 'alphabetical') {
      return [...filteredSongs].sort((a, b) => {
        const titleA = (a.title || a.name || "").replace(/^(the |a |an )/i, '');
        const titleB = (b.title || b.name || "").replace(/^(the |a |an )/i, '');
        return titleA.localeCompare(titleB);
      });
    }

    const groups: Record<string, any[]> = {};
    filteredSongs.forEach(s => {
      const artist = s.artist || 'Unknown Artist';
      if (!groups[artist]) groups[artist] = [];
      groups[artist].push(s);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([artist, artistSongs]) => ({
        artist,
        songs: artistSongs.sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""))
      }));
  }, [filteredSongs, sortMode]);

  if (!profile) return null;

  const colors = profile.custom_colors || { primary: '#4f46e5', background: '#020617', text: '#ffffff', border: '#4f46e5' };

  return (
    <div 
      className={cn(
        "font-sans selection:bg-indigo-500/30 overflow-y-auto h-full w-full",
        isPreview ? "rounded-3xl border shadow-2xl" : "min-h-screen"
      )} 
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      <header className={cn("px-4 text-center border-b border-white/5 bg-gradient-to-b from-black/20 to-transparent", isPreview ? "py-8" : "py-20")}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div 
            className={cn(
              "rounded-full mx-auto border-4 bg-slate-800 flex items-center justify-center overflow-hidden shadow-2xl transition-all",
              isPreview ? "w-24 h-24" : "w-32 h-32 md:w-40 md:h-40"
            )}
            style={{ borderColor: colors.border }}
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.first_name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-slate-700" />
            )}
          </div>
          <div className="space-y-2">
            <h1 className={cn("font-black uppercase tracking-tighter", isPreview ? "text-2xl" : "text-4xl md:text-6xl")} style={{ color: colors.text }}>
              {profile.first_name} {profile.last_name || 'Artist'}
            </h1>
            <p className={cn("font-medium opacity-60 tracking-tight max-w-2xl mx-auto", isPreview ? "text-sm" : "text-xl md:text-2xl")}>
              {profile.repertoire_bio}
            </p>
          </div>
        </div>
      </header>

      <main className={cn("max-w-4xl mx-auto px-6 pb-20", isPreview ? "py-6" : "py-12")}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-12">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
            <Input 
              placeholder="Filter list..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border-white/10 h-10 pl-10 rounded-xl focus-visible:ring-indigo-500 text-sm"
              style={{ color: colors.text }}
            />
          </div>
          
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 w-full md:w-auto">
            <Button 
              variant="ghost" 
              onClick={() => setSortMode('artist')}
              className={cn(
                "flex-1 md:flex-none h-8 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest gap-2 transition-all",
                sortMode === 'artist' ? "bg-white/10 shadow-lg" : "opacity-40"
              )}
              style={{ color: sortMode === 'artist' ? colors.primary : colors.text }}
            >
              <User className="w-3 h-3" /> Group by Artist
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setSortMode('alphabetical')}
              className={cn(
                "flex-1 md:flex-none h-8 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest gap-2 transition-all",
                sortMode === 'alphabetical' ? "bg-white/10 shadow-lg" : "opacity-40"
              )}
              style={{ color: sortMode === 'alphabetical' ? colors.primary : colors.text }}
            >
              <ArrowUpDown className="w-3 h-3" /> A-Z Title
            </Button>
          </div>
        </div>

        <div className="space-y-12">
          {songs.length === 0 ? (
            <div className="text-center py-20 opacity-30 border border-dashed border-white/10 rounded-[2.5rem]">
              <Music className="w-12 h-12 mx-auto mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Repertoire Matrix Empty</p>
            </div>
          ) : (
            sortMode === 'artist' ? (
              (groupedSongs as any[]).map((group) => (
                <section key={group.artist} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.25em] whitespace-nowrap" style={{ color: colors.primary }}>
                      {group.artist}
                    </h3>
                    <div className="h-px w-full bg-white/5" />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {group.songs.map((song: any) => (
                      <div key={song.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/5 transition-all group border border-transparent hover:border-white/5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold tracking-tight">{song.title || song.name}</span>
                          {song.genre && (
                            <span className="text-[9px] font-black uppercase opacity-20 tracking-widest mt-0.5">{song.genre}</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-6 opacity-40 group-hover:opacity-100 transition-opacity">
                          {song.original_key && song.original_key !== 'TBC' && (
                            <div className="flex flex-col items-end">
                              <span className="text-[7px] font-black uppercase tracking-tighter opacity-40">Key</span>
                              <span className="text-[10px] font-mono font-bold">{song.original_key}</span>
                            </div>
                          )}
                          {song.bpm && (
                            <div className="flex flex-col items-end">
                              <span className="text-[7px] font-black uppercase tracking-tighter opacity-40">BPM</span>
                              <span className="text-[10px] font-mono font-bold">{song.bpm}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {(groupedSongs as any[]).map((song) => (
                  <div key={song.id} className="flex items-center justify-between py-4 px-6 border-b border-white/5 hover:bg-white/5 transition-all group">
                    <div className="flex flex-col">
                      <span className="text-base font-bold tracking-tight">{song.title || song.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: colors.primary }}>{song.artist}</span>
                        {song.genre && (
                          <>
                            <span className="text-[8px] opacity-20">•</span>
                            <span className="text-[10px] font-black uppercase opacity-30 tracking-widest">{song.genre}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8">
                       {song.original_key && song.original_key !== 'TBC' && (
                         <span className="text-xs font-mono font-black opacity-30 group-hover:opacity-100 transition-opacity">{song.original_key}</span>
                       )}
                       {song.bpm && (
                         <span className="text-xs font-mono font-black opacity-30 group-hover:opacity-100 transition-opacity">{song.bpm} BPM</span>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
};

export default PublicRepertoireView;
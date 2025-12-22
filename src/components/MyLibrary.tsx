"use client";

import React, { useState, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Library, Plus, Music, User as UserIcon, ShieldCheck } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { SetlistSong } from './SetlistManager';
import { cn } from "@/lib/utils";

interface MyLibraryProps {
  repertoire: SetlistSong[];
  onAddSong: (song: SetlistSong) => void;
}

const MyLibrary: React.FC<MyLibraryProps> = ({ repertoire, onAddSong }) => {
  const [query, setQuery] = useState("");

  const filteredRepertoire = useMemo(() => {
    if (!query.trim()) return repertoire.slice(0, 20); // Show recent 20 if no query
    
    const search = query.toLowerCase();
    return repertoire.filter(song => 
      song.name.toLowerCase().includes(search) || 
      song.artist?.toLowerCase().includes(search)
    ).slice(0, 50);
  }, [query, repertoire]);

  // Group by name+artist to avoid redundant exact duplicates in the search view
  const uniqueSongs = useMemo(() => {
    const seen = new Set();
    return filteredRepertoire.filter(song => {
      const key = `${song.name}-${song.artist}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [filteredRepertoire]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search your repertoire..." 
          className="pl-9 h-11 border-indigo-100 focus-visible:ring-indigo-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {uniqueSongs.length > 0 ? (
        <ScrollArea className="h-[450px] pr-4">
          <div className="space-y-2">
            {uniqueSongs.map((song) => (
              <div 
                key={song.id} 
                className="group flex flex-col p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950 rounded-lg flex items-center justify-center shrink-0">
                      <Music className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate">{song.name}</p>
                        {song.isMetadataConfirmed && <ShieldCheck className="w-3 h-3 text-indigo-500" />}
                      </div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest truncate">
                        {song.artist || "Unknown Artist"}
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => onAddSong(song)}
                    className="bg-indigo-600 hover:bg-indigo-700 h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-2"
                  >
                    <Plus className="w-3 h-3" /> Use This
                  </Button>
                </div>

                {/* Mini Preview of the "Modified" state */}
                <div className="mt-3 flex items-center gap-4 pt-2 border-t border-slate-50 dark:border-slate-800">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Key</span>
                    <span className="text-[10px] font-mono font-bold text-indigo-600">{song.targetKey || song.originalKey}</span>
                  </div>
                  {song.bpm && (
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase">BPM</span>
                      <span className="text-[10px] font-mono font-bold">{song.bpm}</span>
                    </div>
                  )}
                  {song.resources && song.resources.length > 0 && (
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Resources</span>
                      <div className="flex gap-0.5">
                        {song.resources.map(r => (
                          <span key={r} className="text-[7px] font-black text-indigo-500">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
          <Library className="w-12 h-12 mb-2" />
          <p className="text-xs font-black uppercase tracking-[0.2em]">No Matches in Library</p>
          <p className="text-[10px] mt-1">Start adding songs to build your repertoire.</p>
        </div>
      )}
    </div>
  );
};

export default MyLibrary;
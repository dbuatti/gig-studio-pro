"use client";

import React, { useState, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Search, Library, Music } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { SetlistSong } from './SetlistManager';
import { cn } from "@/lib/utils";
import { formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';

interface MyLibraryProps {
  repertoire: SetlistSong[];
  onAddSong: (song: SetlistSong) => void;
}

const MyLibrary: React.FC<MyLibraryProps> = ({ repertoire, onAddSong }) => {
  const { keyPreference } = useSettings();
  const [query, setQuery] = useState("");

  const filteredRepertoire = useMemo(() => {
    if (!query.trim()) return repertoire.slice(0, 30);
    
    const search = query.toLowerCase();
    return repertoire.filter(song => 
      song.name.toLowerCase().includes(search) || 
      song.artist?.toLowerCase().includes(search)
    ).slice(0, 50);
  }, [query, repertoire]);

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
      <div className="relative px-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input 
          placeholder="Search repertoire..." 
          className="pl-9 h-10 border-slate-200 dark:border-slate-800 bg-transparent text-xs focus-visible:ring-indigo-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {uniqueSongs.length > 0 ? (
        <ScrollArea className="h-[550px]">
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {uniqueSongs.map((song) => {
              const displayKey = formatKey(song.targetKey || song.originalKey, keyPreference);
              return (
                <button 
                  key={song.id} 
                  onClick={() => onAddSong(song)}
                  className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Music className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <span className="text-[11px] font-black uppercase tracking-tight truncate">{song.name}</span>
                      <span className="text-slate-300 dark:text-slate-700 text-[10px]">|</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                        {song.artist || "Unknown Artist"}
                      </span>
                    </div>
                  </div>
                  
                  {displayKey !== "TBC" && (
                    <div className="ml-3 shrink-0">
                      <span className="text-[9px] font-mono font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                        {displayKey}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
          <Library className="w-10 h-10 mb-2" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Matches</p>
        </div>
      )}
    </div>
  );
};

export default MyLibrary;
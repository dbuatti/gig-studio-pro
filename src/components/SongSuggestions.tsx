"use client";

import React, { useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Music, Plus, ExternalLink, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SuggestedSong {
  trackName: string;
  artistName: string;
  previewUrl: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  trackViewUrl?: string;
  key?: string;
}

interface SongSuggestionsProps {
  suggestions: SuggestedSong[];
  onAdd: (song: SuggestedSong) => void;
  isLoading?: boolean;
}

const SongSuggestions: React.FC<SongSuggestionsProps> = ({ suggestions, onAdd, isLoading }) => {
  
  // Safety check for the key property to prevent the trim() error
  const getSongKey = (song: SuggestedSong) => {
    if (!song || !song.key) return "";
    return song.key.trim();
  };

  const processedSuggestions = useMemo(() => {
    return suggestions.map(song => ({
      ...song,
      displayKey: getSongKey(song)
    }));
  }, [suggestions]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Scanning Global Repertoire...</p>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {processedSuggestions.map((song, idx) => (
        <div 
          key={`${song.trackName}-${idx}`}
          className="bg-slate-900/40 border border-white/5 p-4 rounded-[1.5rem] flex items-center gap-4 group hover:border-indigo-500/30 transition-all"
        >
          <div className="relative shrink-0">
            {song.artworkUrl100 ? (
              <img src={song.artworkUrl100} alt={song.trackName} className="w-12 h-12 rounded-xl object-cover shadow-lg" />
            ) : (
              <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400">
                <Music className="w-6 h-6" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black uppercase tracking-tight text-white truncate">{song.trackName}</h4>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate mt-0.5">{song.artistName}</p>
            {song.primaryGenreName && (
              <span className="inline-block mt-1 text-[8px] font-black uppercase tracking-widest text-indigo-400/60">
                {song.primaryGenreName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {song.trackViewUrl && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => window.open(song.trackViewUrl, '_blank')}
                className="h-8 w-8 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button 
              onClick={() => onAdd(song)}
              className="h-8 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-black uppercase tracking-widest text-[8px] gap-1.5"
            >
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SongSuggestions;
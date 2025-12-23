"use client";

import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, Music, Search, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { SetlistSong } from './SetlistManager';

interface SongSuggestionsProps {
  repertoire: SetlistSong[];
  onSelectSuggestion: (query: string) => void;
}

const SongSuggestions: React.FC<SongSuggestionsProps> = ({ repertoire, onSelectSuggestion }) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuggestions = async () => {
    if (repertoire.length === 0) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-songs', {
        body: { repertoire: repertoire.slice(0, 20) } 
      });

      if (error) throw error;
      
      // Secondary filter to remove any hallunicated duplicates that AI might have missed
      const existingKeys = new Set(repertoire.map(s => `${s.name.toLowerCase()}-${(s.artist || "").toLowerCase()}`));
      const filtered = (data || []).filter((s: any) => {
        const key = `${s.name.toLowerCase()}-${s.artist.toLowerCase()}`;
        return !existingKeys.has(key);
      });

      setSuggestions(filtered);
    } catch (err) {
      console.error("Failed to fetch suggestions", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (repertoire.length > 0 && suggestions.length === 0) {
      fetchSuggestions();
    }
  }, [repertoire]);

  if (repertoire.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 px-6">
        <Music className="w-10 h-10 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Add songs to your library to get AI recommendations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">AI Discover Engine</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={fetchSuggestions} 
          disabled={isLoading}
          className="h-7 text-[9px] font-black uppercase hover:bg-indigo-50 text-indigo-600"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "Refresh"}
        </Button>
      </div>

      <ScrollArea className="h-[550px]">
        <div className="space-y-2 pr-4">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center gap-4 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analyzing your sonic profile...</p>
            </div>
          ) : (
            suggestions.length > 0 ? (
              suggestions.map((song, i) => (
                <div 
                  key={i}
                  className="group p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-indigo-200 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="text-sm font-black uppercase tracking-tight truncate">{song.name}</h4>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-0.5">{song.artist}</p>
                      {song.reason && (
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">
                          {song.reason}
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onSelectSuggestion(`${song.artist} ${song.name}`)}
                      className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white shrink-0"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center opacity-30">
                <Sparkles className="w-10 h-10 mb-4 mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Discovery engine complete.</p>
              </div>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SongSuggestions;
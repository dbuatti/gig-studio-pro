"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Loader2, Music, Search, Target, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { SetlistSong } from './SetlistManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { showError } from '@/utils/toast'; // Import showError

interface SongSuggestionsProps {
  repertoire: SetlistSong[];
  onSelectSuggestion: (query: string) => void;
}

// Global session cache to persist raw suggestions
let sessionSuggestionsCache: any[] | null = null;
let sessionInitialLoadAttempted = false;

const SongSuggestions: React.FC<SongSuggestionsProps> = ({ repertoire, onSelectSuggestion }) => {
  const [rawSuggestions, setRawSuggestions] = useState<any[]>(sessionSuggestionsCache || []);
  const [isLoading, setIsLoading] = useState(false);
  const [seedSongId, setSeedSongId] = useState<string | null>(null);

  // Robust matching logic for duplicates
  const existingKeys = useMemo(() => {
    return new Set(repertoire.map(s => 
      `${s.name.trim().toLowerCase()}-${(s.artist || "").trim().toLowerCase()}`
    ));
  }, [repertoire]);

  // Reactive filtering/marking of suggestions
  const suggestions = useMemo(() => {
    return rawSuggestions.map(s => ({
      ...s,
      isDuplicate: existingKeys.has(`${s.name.trim().toLowerCase()}-${s.artist.trim().toLowerCase()}`)
    }));
  }, [rawSuggestions, existingKeys]);

  const seedSong = useMemo(() => 
    repertoire.find(s => s.id === seedSongId), 
  [seedSongId, repertoire]);

  const fetchSuggestions = async () => {
    if (repertoire.length === 0) return;
    
    setIsLoading(true);
    let lastError = null;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('suggest-songs', {
          body: { 
            repertoire: repertoire.slice(0, 50),
            seedSong: seedSong ? { name: seedSong.name, artist: seedSong.artist } : null
          } 
        });

        if (error) {
          lastError = error;
          if (attempt < MAX_RETRIES) {
            console.warn(`[SongSuggestions] Attempt ${attempt} failed. Retrying in ${attempt * 2}s...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            continue;
          }
          throw error;
        }
        
        setRawSuggestions(data || []);
        sessionSuggestionsCache = data || [];
        sessionInitialLoadAttempted = true;
        setIsLoading(false);
        return; // Success
        
      } catch (err: any) {
        lastError = err;
        if (attempt === MAX_RETRIES) {
          console.error("[SongSuggestions] All retry attempts failed.", lastError);
          showError("Song suggestions temporarily unavailable.");
        } else {
          // Retry logic handled inside the loop
        }
      }
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    if (repertoire.length > 0 && !sessionInitialLoadAttempted && rawSuggestions.length === 0) {
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
      <div className="space-y-3 px-1">
        <div className="flex items-center justify-between">
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
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : "Refresh Suggestions"}
          </Button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
              <Target className="w-3 h-3" /> Search Mode
            </Label>
            {seedSongId && (
              <button 
                onClick={() => { setSeedSongId(null); }}
                className="text-[8px] font-black text-indigo-500 uppercase hover:text-indigo-600"
              >
                Clear Seed
              </button>
            )}
          </div>
          <Select value={seedSongId || "profile"} onValueChange={(val) => setSeedSongId(val === "profile" ? null : val)}>
            <SelectTrigger className="h-8 text-[10px] font-bold bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <SelectValue placeholder="Suggest based on entire profile" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="profile" className="text-[10px] font-bold">Entire Profile Vibe</SelectItem>
              {repertoire.map(s => (
                <SelectItem key={s.id} value={s.id} className="text-[10px] font-medium">
                  {s.name} - {s.artist}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-2 pr-4">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center gap-4 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {seedSong ? `Finding tracks like "${seedSong.name}"...` : "Analyzing your sonic profile..."}
              </p>
            </div>
          ) : (
            suggestions.length > 0 ? (
              suggestions.map((song, i) => (
                <div 
                  key={i}
                  className={cn(
                    "group p-4 border rounded-2xl transition-all shadow-sm",
                    song.isDuplicate 
                      ? "bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 opacity-60"
                      : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black uppercase tracking-tight truncate">{song.name}</h4>
                        {song.isDuplicate && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      </div>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-0.5">{song.artist}</p>
                      {song.isDuplicate ? (
                        <span className="inline-block mt-2 text-[8px] font-black bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                          Already in Set
                        </span>
                      ) : song.reason && (
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 leading-relaxed">
                          {song.reason}
                        </p>
                      )}
                    </div>
                    
                    {!song.isDuplicate && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onSelectSuggestion(`${song.artist} ${song.name}`)}
                        className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white shrink-0"
                      >
                        <Search className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center opacity-30">
                <Sparkles className="w-10 h-10 mb-4 mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Discovery engine ready.</p>
              </div>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SongSuggestions;
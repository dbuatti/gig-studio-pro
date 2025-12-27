"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Loader2, Music, Search, PlusCircle, Filter, Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { SetlistSong } from './SetlistManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { AddToGigButton } from './AddToGigButton';
import { useIsMobile } from '@/hooks/use-mobile';

interface SongSuggestionsProps {
  repertoire: SetlistSong[];
  onSelectSuggestion: (query: string) => void;
}

// Global session cache to persist suggestions and "first load" status across tab remounts
let sessionSuggestionsCache: any[] | null = null;
let sessionInitialLoadAttempted = false;

const SongSuggestions: React.FC<SongSuggestionsProps> = ({ repertoire, onSelectSuggestion }) => {
  const [suggestions, setSuggestions] = useState<any[]>(sessionSuggestionsCache || []);
  const [isLoading, setIsLoading] = useState(false);
  const [seedSongId, setSeedSongId] = useState<string | null>(null);
  const isMobileDevice = useIsMobile();

  const seedSong = useMemo(() => 
    repertoire.find(s => s.id === seedSongId), 
  [seedSongId, repertoire]);

  const fetchSuggestions = async () => {
    if (repertoire.length === 0) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-songs', {
        body: { 
          repertoire: repertoire.slice(0, 20),
          seedSong: seedSong ? { name: seedSong.name, artist: seedSong.artist } : null
        } 
      });

      if (error) throw error;
      
      const existingKeys = new Set(repertoire.map(s => `${s.name.toLowerCase()}-${(s.artist || "").toLowerCase()}`));
      const filtered = (data || []).filter((s: any) => {
        const key = `${s.name.toLowerCase()}-${(s.artist || "").toLowerCase()}`;
        return !existingKeys.has(key);
      });

      setSuggestions(filtered);
      sessionSuggestionsCache = filtered;
      sessionInitialLoadAttempted = true;
    } catch (err) {
      console.error("Failed to fetch suggestions", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Automated load trigger: Only executes if we have never loaded suggestions this session
  useEffect(() => {
    if (repertoire.length > 0 && !sessionInitialLoadAttempted && suggestions.length === 0) {
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
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : "Refresh Suggestions"}
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
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onSelectSuggestion(`${song.artist} ${song.name}`)}
                        className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white shrink-0"
                      >
                        <Search className="w-4 h-4" />
                      </Button>
                      {/* NEW: Add to Gig Button */}
                      <AddToGigButton
                        songData={{
                          name: song.name,
                          artist: song.artist,
                          user_tags: ['suggestion']
                        }}
                        onAdded={() => {}}
                        className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white shrink-0 p-0"
                        size="icon"
                        variant="ghost"
                      />
                    </div>
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

      {/* NEW: Add to Gig Button for Mobile */}
      {isMobileDevice && suggestions.length > 0 && (
        <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 p-4 pb-safe -mx-4">
          <AddToGigButton
            songData={{
              name: suggestions[0]?.name || '',
              artist: suggestions[0]?.artist || '',
              user_tags: ['suggestion']
            }}
            onAdded={() => {}}
            className="w-full h-14 text-base font-black uppercase tracking-widest gap-3"
            size="lg"
            variant="default"
          />
        </div>
      )}
    </div>
  );
};

export default SongSuggestions;
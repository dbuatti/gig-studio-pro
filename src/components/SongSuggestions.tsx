"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sparkles, Loader2, Music, Search, Target, CheckCircle2, ListPlus, Trash2, RotateCcw, X } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { SetlistSong } from './SetlistManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';

// Global session caches
let sessionSuggestionsCache: any[] | null = null;
let sessionIgnoredCache: any[] = [];
let sessionInitialLoadAttempted = false;

interface SongSuggestionsProps {
  repertoire: SetlistSong[];
  onSelectSuggestion: (query: string) => void;
  onAddExistingSong?: (song: SetlistSong) => void;
}

const SongSuggestions: React.FC<SongSuggestionsProps> = ({ repertoire, onSelectSuggestion, onAddExistingSong }) => {
  const [rawSuggestions, setRawSuggestions] = useState<any[]>(sessionSuggestionsCache || []);
  const [ignoredSuggestions, setIgnoredSuggestions] = useState<any[]>(sessionIgnoredCache);
  const [isLoading, setIsLoading] = useState(false);
  const [seedSongId, setSeedSongId] = useState<string | null>(null);

  // Normalize string for comparisons
  const getSongKey = (s: { name: string; artist?: string }) => 
    `${s.name.trim().toLowerCase()}-${(s.artist || "").trim().toLowerCase()}`;

  const existingKeys = useMemo(() => {
    return new Set(repertoire.map(s => getSongKey(s)));
  }, [repertoire]);

  const suggestions = useMemo(() => {
    return rawSuggestions.map(s => ({
      ...s,
      isDuplicate: existingKeys.has(getSongKey(s))
    }));
  }, [rawSuggestions, existingKeys]);

  const duplicateCount = useMemo(() => 
    suggestions.filter(s => s.isDuplicate).length, 
  [suggestions]);

  const seedSong = useMemo(() => 
    repertoire.find(s => s.id === seedSongId), 
  [seedSongId, repertoire]);

  const fetchSuggestions = useCallback(async (isRefresh = false, preserveExisting = false) => {
    if (repertoire.length === 0) return;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('suggest-songs', {
        body: { 
          repertoire: repertoire.slice(0, 50),
          seedSong: seedSong ? { name: seedSong.name, artist: seedSong.artist } : null,
          ignored: sessionIgnoredCache
        } 
      });

      if (error) throw error;
      
      const newBatch = data || [];

      if (preserveExisting) {
        setRawSuggestions(prev => {
          const combined = [...prev, ...newBatch];
          const uniqueMap = new Map();
          
          combined.forEach(s => {
            const key = getSongKey(s);
            const isIgnored = sessionIgnoredCache.some(i => getSongKey(i) === key);
            if (!existingKeys.has(key) && !isIgnored && !uniqueMap.has(key)) {
              uniqueMap.set(key, s);
            }
          });

          const final = Array.from(uniqueMap.values()).slice(0, 10);
          sessionSuggestionsCache = final;
          return final;
        });
      } else {
        setRawSuggestions(newBatch);
        sessionSuggestionsCache = newBatch;
      }
      
      sessionInitialLoadAttempted = true;
    } catch (err: any) {
      showError("Song suggestions temporarily unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, [repertoire, seedSong, existingKeys]);

  useEffect(() => {
    if (repertoire.length > 0 && !sessionInitialLoadAttempted && rawSuggestions.length === 0) {
      fetchSuggestions();
    }
  }, [repertoire, fetchSuggestions, rawSuggestions.length]);

  const handleDismissSuggestion = async (song: any) => {
    const key = getSongKey(song);
    
    const newIgnored = [...ignoredSuggestions, song];
    setIgnoredSuggestions(newIgnored);
    sessionIgnoredCache = newIgnored;
    
    const filtered = rawSuggestions.filter(s => getSongKey(s) !== key);
    setRawSuggestions(filtered);
    sessionSuggestionsCache = filtered;
    
    showSuccess(`Removed "${song.name}"`);
    
    if (filtered.length < 7) {
      fetchSuggestions(true, true);
    }
  };

  const handleClearDuplicates = () => {
    const duplicates = rawSuggestions.filter(s => existingKeys.has(getSongKey(s)));
    const filtered = rawSuggestions.filter(s => !existingKeys.has(getSongKey(s)));
    
    const newIgnored = [...ignoredSuggestions, ...duplicates];
    setIgnoredSuggestions(newIgnored);
    sessionIgnoredCache = newIgnored;

    setRawSuggestions(filtered);
    sessionSuggestionsCache = filtered;
    
    showInfo(`Cleaned duplicates. Replenishing list...`);
    fetchSuggestions(true, true);
  };

  if (repertoire.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 px-6">
        <Music className="w-10 h-10 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Add songs to your library to get AI recommendations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AI Discover Engine</span>
          </div>
          <div className="flex gap-2">
            {duplicateCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearDuplicates}
                disabled={isLoading}
                className="h-7 text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              >
                Clear Duplicates ({duplicateCount})
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => fetchSuggestions(true, false)} 
              disabled={isLoading}
              className="h-7 text-[9px] font-black uppercase hover:bg-primary/10 text-primary flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />} 
              {isLoading ? "Fetching..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="bg-card p-3 rounded-xl border border-border space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
              <Target className="w-3 h-3" /> Search Mode
            </Label>
            {seedSongId && (
              <button 
                onClick={() => { setSeedSongId(null); fetchSuggestions(true, false); }}
                className="text-[8px] font-black text-primary uppercase hover:text-primary/80"
              >
                Clear Seed
              </button>
            )}
          </div>
          <Select value={seedSongId || "profile"} onValueChange={(val) => { setSeedSongId(val === "profile" ? null : val); fetchSuggestions(true, false); }}>
            <SelectTrigger className="h-8 text-[10px] font-bold bg-background border-border text-foreground">
              <SelectValue placeholder="Suggest based on entire profile" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] bg-popover border-border text-foreground">
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
        <div className="space-y-2 pr-4 pl-4">
          {isLoading && rawSuggestions.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-4 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {seedSong ? `Finding tracks like "${seedSong.name}"...` : "Analyzing your sonic profile..."}
              </p>
            </div>
          ) : (
            suggestions.length > 0 ? (
              suggestions.map((song, i) => (
                <div 
                  key={i}
                  className={cn(
                    "group p-4 border rounded-2xl transition-all shadow-sm relative overflow-hidden",
                    song.isDuplicate 
                      ? "bg-secondary/50 border-border opacity-60"
                      : "bg-card border-border hover:border-primary/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black uppercase tracking-tight truncate text-foreground">{song.name}</h4>
                        {song.isDuplicate && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      </div>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-0.5">{song.artist}</p>
                      {song.isDuplicate ? (
                        <span className="inline-block mt-2 text-[8px] font-black bg-emerald-50/20 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                          Already in Set
                        </span>
                      ) : song.reason && (
                        <p className="text-[9px] text-muted-foreground font-bold uppercase mt-2 leading-relaxed">
                          {song.reason}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDismissSuggestion(song)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Dismiss suggestion"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      
                      {!song.isDuplicate && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => onSelectSuggestion(`${song.artist} ${song.name}`)}
                            className="h-8 w-8 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                            title="Preview track"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </Button>
                          {onAddExistingSong && (
                            <Button
                              onClick={() => onAddExistingSong({
                                id: crypto.randomUUID(),
                                name: song.name,
                                artist: song.artist,
                                previewUrl: "",
                                pitch: 0,
                                originalKey: "C",
                                targetKey: "C",
                                isPlayed: false,
                                isSyncing: true,
                                isMetadataConfirmed: false,
                                isKeyConfirmed: false,
                                duration_seconds: 0,
                                notes: "",
                                lyrics: "",
                                resources: [],
                                user_tags: [],
                                is_pitch_linked: true,
                                isApproved: false,
                                preferred_reader: null,
                                ug_chords_config: DEFAULT_UG_CHORDS_CONFIG,
                                is_ug_chords_present: false,
                                highest_note_original: null,
                                is_ug_link_verified: false,
                                metadata_source: null,
                                sync_status: 'IDLE',
                                last_sync_log: null,
                                auto_synced: false,
                                is_sheet_verified: false,
                                sheet_music_url: null,
                                extraction_status: 'idle', 
                              })}
                              className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] rounded-lg gap-2 shadow-sm"
                            >
                              <ListPlus className="w-3.5 h-3.5" /> Add
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/5 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-20 text-center opacity-30">
                <Sparkles className="w-10 h-10 mb-4 mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Discovery pool empty. Refresh to get new tracks.</p>
              </div>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SongSuggestions;
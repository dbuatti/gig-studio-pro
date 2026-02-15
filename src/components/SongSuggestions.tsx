"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sparkles, Loader2, Music, Search, Target, CheckCircle2, ListPlus, XCircle, RotateCcw, X, Info, Lightbulb } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { SetlistSong } from './SetlistManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

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
  const [isLoadingInitial, setIsLoadingInitial] = useState(true); 
  const [isRefreshingSuggestions, setIsRefreshingSuggestions] = useState(false); 
  const [seedSongId, setSeedSongId] = useState<string | null>(null);

  // Robust normalization for comparisons to prevent crashes on null/undefined data
  const getSongKey = useCallback((s: any) => {
    if (!s) return "unknown-unknown";
    
    // Try to find a name/title from any common key or pattern
    const keys = Object.keys(s);
    const titleKey = keys.find(k => /title|name|song|track/i.test(k));
    const artistKey = keys.find(k => /artist|band|group|performer/i.test(k));

    const name = (s[titleKey || ''] || s.name || s.title || "").toString().trim().toLowerCase();
    const artist = (s[artistKey || ''] || s.artist || s.artistName || "").toString().trim().toLowerCase();
    
    if (!name && !artist) return "unknown-unknown";
    return `${name}-${artist}`;
  }, []);

  const existingKeys = useMemo(() => {
    return new Set(repertoire.map(s => getSongKey(s)));
  }, [repertoire, getSongKey]);

  const suggestions = useMemo(() => {
    console.log("[SongSuggestions] Processing raw suggestions for display. Count:", rawSuggestions.length);
    
    const mapped = rawSuggestions
      .map(s => {
        let displayName = "";
        let displayArtist = "";
        let isDuplicate = false;

        // 1. Handle ID-based suggestions (Lookup in repertoire)
        if (s.id) {
          const existingSong = repertoire.find(r => r.id === s.id || r.master_id === s.id);
          if (existingSong) {
            displayName = existingSong.name;
            displayArtist = existingSong.artist || "Unknown Artist";
            isDuplicate = true;
          }
        }

        // 2. Handle string-only suggestions
        if (typeof s === 'string' && !displayName) {
          const parts = s.split(/ by | - /i);
          displayName = parts[0]?.trim() || s;
          displayArtist = parts[1]?.trim() || "Unknown Artist";
          isDuplicate = existingKeys.has(getSongKey({ name: displayName, artist: displayArtist }));
        }

        // 3. Handle object-based suggestions with pattern matching
        if (!displayName) {
          const keys = Object.keys(s);
          const titleKey = keys.find(k => /title|name|song|track/i.test(k));
          const artistKey = keys.find(k => /artist|band|group|performer/i.test(k));
          
          if (titleKey) displayName = s[titleKey];
          if (artistKey) displayArtist = s[artistKey];
          
          isDuplicate = existingKeys.has(getSongKey(s));
        }

        // Final fallback if still empty
        if (!displayName) {
          console.warn("[SongSuggestions] Failed to map suggestion object. Data:", JSON.stringify(s));
          displayName = "Unknown Track";
          displayArtist = "Unknown Artist";
        }

        return {
          ...s,
          displayName,
          displayArtist: displayArtist || "Unknown Artist",
          isDuplicate
        };
      })
      .filter(s => {
        // Filter out if it's already in the library
        if (s.isDuplicate) return false;
        
        // Filter out if it's in the ignored list
        const isIgnored = ignoredSuggestions.some(i => 
          (i.id && i.id === s.id) || getSongKey(i) === getSongKey(s)
        );
        if (isIgnored) return false;

        return true;
      });

    console.log("[SongSuggestions] Final display suggestions count:", mapped.length);
    return mapped;
  }, [rawSuggestions, repertoire, existingKeys, getSongKey, ignoredSuggestions]);

  const seedSong = useMemo(() => 
    repertoire.find(s => s.id === seedSongId), 
  [seedSongId, repertoire]);

  const fetchSuggestions = useCallback(async (isRefresh = false, preserveExisting = false) => {
    if (repertoire.length === 0) {
      console.warn("[SongSuggestions] Repertoire is empty, skipping fetch.");
      setIsLoadingInitial(false);
      return;
    }
    
    console.log("[SongSuggestions] Initiating fetch. isRefresh:", isRefresh, "preserveExisting:", preserveExisting);
    
    if (isRefresh) {
      setIsRefreshingSuggestions(true);
    } else {
      setIsLoadingInitial(true);
    }
    
    try {
      const combinedIgnored = [
        ...repertoire.map(s => ({ name: s.name, artist: s.artist })),
        ...ignoredSuggestions
      ];

      const payload = { 
        repertoire: repertoire.slice(0, 50).map(s => ({ name: s.name, artist: s.artist, genre: s.genre })),
        seedSong: seedSong ? { name: seedSong.name, artist: seedSong.artist } : null,
        ignored: combinedIgnored 
      };

      console.log("[SongSuggestions] Calling edge function 'suggest-songs' with payload:", payload);
      
      const { data, error } = await supabase.functions.invoke('suggest-songs', {
        body: payload 
      });

      if (error) {
        console.error("[SongSuggestions] Edge function error:", error);
        throw error;
      }
      
      console.log("[SongSuggestions] Edge function response data:", data);
      
      let newBatch = Array.isArray(data) ? data : (data?.suggestions || data?.songs || []);
      
      if (!Array.isArray(newBatch)) {
        console.error("[SongSuggestions] AI response is not an array format:", newBatch);
        newBatch = [];
      }

      console.log("[SongSuggestions] Received new batch of suggestions. Count:", newBatch.length);

      if (preserveExisting) {
        setRawSuggestions(prev => {
          const combined = [...prev, ...newBatch];
          const uniqueMap = new Map();
          
          combined.forEach(s => {
            const key = s.id ? `id-${s.id}` : getSongKey(s);
            const isIgnored = sessionIgnoredCache.some(i => (i.id && i.id === s.id) || getSongKey(i) === getSongKey(s));
            const isDuplicate = existingKeys.has(getSongKey(s));
            
            if (!uniqueMap.has(key) && !isIgnored && !isDuplicate) {
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
      console.error("[SongSuggestions] Final catch block error:", err);
      showError("Song suggestions temporarily unavailable.");
    } finally {
      console.log("[SongSuggestions] Fetch cycle complete.");
      if (isRefresh) {
        setIsRefreshingSuggestions(false);
      } else {
        setIsLoadingInitial(false);
      }
    }
  }, [repertoire, seedSong, ignoredSuggestions, getSongKey, existingKeys]);

  useEffect(() => {
    console.log("[SongSuggestions] useEffect triggered. Repertoire length:", repertoire.length, "Initial load attempted:", sessionInitialLoadAttempted);
    if (repertoire.length > 0 && !sessionInitialLoadAttempted && rawSuggestions.length === 0) {
      fetchSuggestions();
    } else if (repertoire.length > 0) {
      setIsLoadingInitial(false);
    }
  }, [repertoire.length, fetchSuggestions, rawSuggestions.length]);

  const handleDismissSuggestion = (song: any) => {
    const targetId = song.id;
    const targetKey = getSongKey(song);
    
    console.log("[SongSuggestions] Dismissing suggestion:", song.displayName);
    
    const newIgnored = [...ignoredSuggestions, song];
    setIgnoredSuggestions(newIgnored);
    sessionIgnoredCache = newIgnored;
    
    const filtered = rawSuggestions.filter(s => {
      if (targetId && s.id) return s.id !== targetId;
      return getSongKey(s) !== targetKey;
    });

    setRawSuggestions(filtered);
    sessionSuggestionsCache = filtered;
    
    showSuccess(`Removed suggestion`);
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
    <TooltipProvider>
      <div className="space-y-4">
        <div className="space-y-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AI Discover Engine</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => fetchSuggestions(true, false)} 
              disabled={isRefreshingSuggestions}
              className="h-7 text-[9px] font-black uppercase hover:bg-indigo-500/10 text-indigo-500 flex-shrink-0"
            >
              {isRefreshingSuggestions ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />} 
              {isRefreshingSuggestions ? "Fetching..." : "Refresh"}
            </Button>
          </div>

          <div className="bg-card p-3 rounded-xl border border-border space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
                <Target className="w-3 h-3" /> Search Mode
              </Label>
              {seedSongId && (
                <button 
                  onClick={() => { setSeedSongId(null); fetchSuggestions(true, false); }}
                  className="text-[8px] font-black text-indigo-500 uppercase hover:text-indigo-600"
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

        <ScrollArea className="h-[500px] px-4">
          <div className="space-y-4">
            {isLoadingInitial && rawSuggestions.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-4 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {seedSong ? `Finding tracks like "${seedSong.name}"...` : "Analyzing your sonic profile..."}
                </p>
              </div>
            ) : (
              suggestions.length > 0 ? (
                suggestions.map((song, i) => (
                  <div 
                    key={i}
                    className="group p-6 border rounded-[2rem] transition-all shadow-sm relative overflow-hidden flex flex-col gap-5 bg-card border-border hover:border-indigo-500/30 hover:shadow-md"
                  >
                    {/* Header: Title & Artist */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xl font-black tracking-tight text-slate-900 dark:text-white truncate">
                          {song.displayName}
                        </h4>
                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-1">
                          {song.displayArtist}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={() => handleDismissSuggestion(song)}
                              className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px] font-black uppercase">Don't Suggest Again</TooltipContent>
                        </Tooltip>
                        
                        <button 
                          onClick={() => onSelectSuggestion(`${song.displayArtist} ${song.displayName}`)}
                          className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all"
                          title="Preview track"
                        >
                          <Search className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Content: Reason / Insight */}
                    <div className="space-y-3">
                      {song.reason && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-border relative group-hover:border-indigo-500/20 transition-colors">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                              <Lightbulb className="w-3 h-3 text-indigo-600" />
                            </div>
                            <span className="text-[9px] font-black text-indigo-600/70 uppercase tracking-[0.15em]">AI Insight</span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300 font-bold leading-relaxed">
                            {song.reason}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Footer: Actions */}
                    {onAddExistingSong && (
                      <Button
                        onClick={() => onAddExistingSong({
                          id: crypto.randomUUID(),
                          name: song.displayName,
                          artist: song.displayArtist,
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
                        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-widest rounded-2xl gap-3 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
                      >
                        <ListPlus className="w-5 h-5" /> Add to Repertoire
                      </Button>
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
    </TooltipProvider>
  );
};

export default SongSuggestions;
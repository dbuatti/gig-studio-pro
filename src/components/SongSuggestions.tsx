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

  const fetchSuggestions = useCallback(async (isRefresh = false) => {
    if (repertoire.length === 0) return;
    
    setIsLoading(true);
    if (isRefresh) console.log("[Discover] Refreshing suggestion pool with current context...");
    
    try {
      const { data, error } = await supabase.functions.invoke('suggest-songs', {
        body: { 
          repertoire: repertoire.slice(0, 50),
          seedSong: seedSong ? { name: seedSong.name, artist: seedSong.artist } : null,
          ignored: sessionIgnoredCache
        } 
      });

      if (error) throw error;
      
      console.log("[Discover] AI returned 10 fresh suggestions.");
      setRawSuggestions(data || []);
      sessionSuggestionsCache = data || [];
      sessionInitialLoadAttempted = true;
    } catch (err: any) {
      console.error("[Discover] Failed to fetch suggestions:", err);
      showError("Song suggestions temporarily unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, [repertoire, seedSong]);

  useEffect(() => {
    if (repertoire.length > 0 && !sessionInitialLoadAttempted && rawSuggestions.length === 0) {
      fetchSuggestions();
    }
  }, [repertoire, fetchSuggestions, rawSuggestions.length]);

  const handleDismissSuggestion = async (song: any) => {
    console.log(`[Discover] Dismissing: ${song.name} - Adding to blacklist.`);
    const newIgnored = [...ignoredSuggestions, song];
    setIgnoredSuggestions(newIgnored);
    sessionIgnoredCache = newIgnored;
    
    // Remove from UI immediately
    const filtered = rawSuggestions.filter(s => getSongKey(s) !== getSongKey(song));
    setRawSuggestions(filtered);
    sessionSuggestionsCache = filtered;
    
    showSuccess(`Removed "${song.name}"`);
    
    // Auto-replenish if list gets small
    if (filtered.length < 5) {
      fetchSuggestions(true);
    }
  };

  const handleClearDuplicates = () => {
    console.log(`[Discover] Clearing ${duplicateCount} songs already in your repertoire.`);
    const filtered = rawSuggestions.filter(s => !existingKeys.has(getSongKey(s)));
    
    // Add these duplicates to ignored list so they don't come back on the next refresh
    const newDuplicates = rawSuggestions.filter(s => existingKeys.has(getSongKey(s)));
    const newIgnored = [...ignoredSuggestions, ...newDuplicates];
    setIgnoredSuggestions(newIgnored);
    sessionIgnoredCache = newIgnored;

    setRawSuggestions(filtered);
    sessionSuggestionsCache = filtered;
    
    showInfo(`Removed ${duplicateCount} duplicates. Refreshing...`);
    fetchSuggestions(true);
  };

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
      <div className="space-y-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">AI Discover Engine</span>
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
              onClick={() => fetchSuggestions(true)} 
              disabled={isLoading}
              className="h-7 text-[9px] font-black uppercase hover:bg-indigo-50 text-indigo-600 flex-shrink-0"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />} 
              {isLoading ? "Fetching..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
              <Target className="w-3 h-3" /> Search Mode
            </Label>
            {seedSongId && (
              <button 
                onClick={() => { setSeedSongId(null); fetchSuggestions(true); }}
                className="text-[8px] font-black text-indigo-500 uppercase hover:text-indigo-600"
              >
                Clear Seed
              </button>
            )}
          </div>
          <Select value={seedSongId || "profile"} onValueChange={(val) => { setSeedSongId(val === "profile" ? null : val); fetchSuggestions(true); }}>
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
        <div className="space-y-2 pr-4 pl-4">
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
                    "group p-4 border rounded-2xl transition-all shadow-sm relative overflow-hidden",
                    song.isDuplicate 
                      ? "bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 opacity-60"
                      : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-indigo-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
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
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDismissSuggestion(song)}
                        className="h-8 w-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
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
                            className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white"
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
                </div>
              ))
            ) : (
              <div className="py-20 text-center opacity-30">
                <Sparkles className="w-10 h-10 mb-4 mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Discovery pool empty. Refresh to get new tracks.</p>
              </div>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SongSuggestions;
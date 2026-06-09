"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Plus, Play, Pause, ExternalLink, Music, Check, AlertCircle, Clock, Zap, Ban, RotateCcw, Eye, EyeOff, X } from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { supabase } from '@/integrations/supabase/client';
import { syncToMasterRepertoire } from '@/utils/repertoireSync';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface SuggestedSong {
  name: string;
  artist: string;
  reason: string;
  previewUrl?: string;
  appleMusicUrl?: string;
  artworkUrl?: string;
  genre?: string;
  duration_seconds?: number;
  energy_level?: string;
  isAdded?: boolean;
  isAdding?: boolean;
  isDuplicate?: boolean;
  isIgnored?: boolean;
}

interface SubsetSongSuggesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  subsetName: string;
  subsetSongs: SetlistSong[];
  repertoire: SetlistSong[];
  setlistId: string;
  setGroup: number;
  onSongAdded: () => Promise<void>;
}

export const SubsetSongSuggesterModal: React.FC<SubsetSongSuggesterModalProps> = ({
  isOpen,
  onClose,
  subsetName,
  subsetSongs,
  repertoire,
  setlistId,
  setGroup,
  onSongAdded,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedSong[]>([]);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [batchAdding, setBatchAdding] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [ignoredSuggestions, setIgnoredSuggestions] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSuggestions();
    } else {
      stopPreview();
    }
  }, [isOpen]);

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setActivePreviewUrl(null);
    setIsPlaying(false);
  };

  const handleTogglePreview = (url: string) => {
    if (activePreviewUrl === url) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      stopPreview();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      setActivePreviewUrl(url);
      setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        setActivePreviewUrl(null);
      };
    }
  };

    const fetchSuggestions = async () => {
    if (subsetSongs.length === 0) {
      showInfo("Add some songs to this subset first to get tailored suggestions!");
      onClose();
      return;
    }

    setIsLoading(true);
    setSuggestions([]);
    setQuotaError(null);
    try {
      // 1. Call suggest-songs edge function with subset songs as context
      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const payload = {
        repertoire: subsetSongs.map(s => ({ 
          name: s.name, 
          artist: s.artist,
          energy_level: s.energy_level,
          genre: s.genre 
        })),
        subsetName: subsetName,
        seedSong: null,
        ignored: Array.from(ignoredSuggestions).map(key => {
          const parts = key.split('-');
          return { name: parts[0], artist: parts[1] || '' };
        })
      };

      const { data, error: fetchError } = await supabase.functions.invoke('suggest-songs', {
        body: payload
      });

      if (fetchError) {
        if (fetchError.status === 429) {
          setQuotaError("AI Discovery is resting (Quota Limit). Please try again in a few minutes.");
          return;
        }
        throw fetchError;
      }

      if (data?.error) {
        if (data.isQuotaError) {
          setQuotaError("AI Discovery is resting (Quota Limit). Please try again in a few minutes.");
        } else {
          showError(data.error);
        }
        return;
      }

      const rawSuggestions = Array.isArray(data) ? data : (data?.suggestions || []);
      
      // 2. Check for duplicates across all songs in the setlist
      const existingKeys = new Set(subsetSongs.map(s => normalize(s.name)));
      const repertoireKeys = new Set(repertoire.map(s => normalize(s.name)));
      
      // Also deduplicate within the AI suggestions themselves
      const seenSuggestionKeys = new Set<string>();

      const enriched: SuggestedSong[] = [];
      for (const s of rawSuggestions) {
        const query = `${s.artist} ${s.name}`;
        const suggestionKey = normalize(s.name);
        
        // Skip if this exact song was already suggested in this batch
        if (seenSuggestionKeys.has(suggestionKey)) {
          continue;
        }
        seenSuggestionKeys.add(suggestionKey);
        
        // Check if this song already exists in the set or repertoire
        const isDup = existingKeys.has(suggestionKey) || repertoireKeys.has(suggestionKey);
        
        // Check if user has already dismissed this suggestion
        const isIgnored = ignoredSuggestions.has(suggestionKey);
        
        try {
          const targetUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
          const res = await fetch(proxyUrl);
          if (res.ok) {
            const proxyData = await res.json();
            const itunesData = JSON.parse(proxyData.contents);
            const track = itunesData.results?.[0];
            if (track) {
              enriched.push({
                name: track.trackName,
                artist: track.artistName,
                reason: s.reason || "Fits the subset vibe perfectly.",
                previewUrl: track.previewUrl,
                appleMusicUrl: track.trackViewUrl,
                artworkUrl: track.artworkUrl100,
                genre: track.primaryGenreName,
                duration_seconds: Math.floor(track.trackTimeMillis / 1000),
                energy_level: s.energy_level || 'Pulse',
                isDuplicate: isDup,
                isIgnored: isIgnored,
              });
              continue;
            }
          }
        } catch (e) {
          console.error("iTunes enrichment failed for:", query, e);
        }

        // Fallback if iTunes search fails
        enriched.push({
          name: s.name,
          artist: s.artist,
          reason: s.reason || "Fits the subset vibe perfectly.",
          energy_level: s.energy_level || 'Pulse',
          isDuplicate: isDup,
          isIgnored: isIgnored,
        });
      }

      setSuggestions(enriched);
    } catch (err: unknown) {
      console.error("Failed to fetch subset suggestions:", err);
      showError("Failed to load suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSong = async (index: number, song: SuggestedSong) => {
    if (song.isDuplicate) {
      showInfo(`"${song.name}" is already in your set. Skipping duplicate.`);
      return;
    }
    if (song.isIgnored) {
      showInfo(`"${song.name}" was dismissed. Refresh to see it again.`);
      return;
    }
    
    setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, isAdding: true } : s));
    try {
      // 1. Sync to master repertoire
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Normalize strings to check if the song already exists in the master repertoire
      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const existingSong = repertoire.find(r => 
        normalize(r.name) === normalize(song.name) && 
        normalize(r.artist || '') === normalize(song.artist)
      );

      let songIdToInsert = "";

      if (existingSong) {
        // Use the existing song from master repertoire
        songIdToInsert = existingSong.master_id || existingSong.id;
        showInfo(`Found "${song.name}" in your library. Adding with all saved assets!`);
      } else {
        // Create a new song in master repertoire
        const newSong: Partial<SetlistSong> = {
          name: song.name,
          artist: song.artist,
          previewUrl: song.previewUrl,
          appleMusicUrl: song.appleMusicUrl,
          genre: song.genre,
          duration_seconds: song.duration_seconds,
          isMetadataConfirmed: true,
        };

        const synced = await syncToMasterRepertoire(user.id, [newSong]);
        if (synced.length === 0) throw new Error("Failed to sync to master repertoire");
        songIdToInsert = synced[0].master_id || synced[0].id;
      }

      // 2. Add to setlist under the specific subset
      const { error: insertError } = await supabase.from('setlist_songs').insert({
        setlist_id: setlistId,
        song_id: songIdToInsert,
        sort_order: subsetSongs.length,
        set_group: setGroup,
      });

      if (insertError) throw insertError;

      showSuccess(`"${song.name}" added to ${subsetName}!`);
      setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, isAdding: false, isAdded: true } : s));
      await onSongAdded();
    } catch (err: unknown) {
      console.error("Failed to add suggested song:", err);
      showError(`Failed to add song: ${err instanceof Error ? err.message : String(err)}`);
      setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, isAdding: false } : s));
    }
  };

  const handleDismiss = (index: number, song: SuggestedSong) => {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    setIgnoredSuggestions(prev => new Set(prev).add(normalize(song.name)));
    setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, isIgnored: true } : s));
    showInfo(`"${song.name}" dismissed. Won't be suggested again.`);
  };

  const handleRefresh = () => {
    // Add all current duplicates to ignored list so AI suggests new ones
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const newIgnored = new Set(ignoredSuggestions);
    suggestions.filter(s => s.isDuplicate || s.isIgnored).forEach(s => {
      newIgnored.add(normalize(s.name));
    });
    setIgnoredSuggestions(newIgnored);
    setShowDuplicates(false);
    fetchSuggestions();
  };

  const handleBatchAdd = async () => {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const validSuggestions = suggestions.filter(s => !s.isDuplicate && !s.isAdded && !s.isIgnored);
    if (validSuggestions.length === 0) {
      showInfo("No new suggestions to add.");
      return;
    }

    setBatchAdding(true);
    let added = 0;
    let failed = 0;

    for (const song of validSuggestions) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) continue;

        const existingSong = repertoire.find(r => 
          normalize(r.name) === normalize(song.name) && 
          normalize(r.artist || '') === normalize(song.artist)
        );

        let songIdToInsert = "";

        if (existingSong) {
          songIdToInsert = existingSong.master_id || existingSong.id;
        } else {
          const newSong: Partial<SetlistSong> = {
            name: song.name,
            artist: song.artist,
            previewUrl: song.previewUrl,
            appleMusicUrl: song.appleMusicUrl,
            genre: song.genre,
            duration_seconds: song.duration_seconds,
            isMetadataConfirmed: true,
          };

          const synced = await syncToMasterRepertoire(user.id, [newSong]);
          if (synced.length === 0) continue;
          songIdToInsert = synced[0].master_id || synced[0].id;
        }

        const { error: insertError } = await supabase.from('setlist_songs').insert({
          setlist_id: setlistId,
          song_id: songIdToInsert,
          sort_order: subsetSongs.length,
          set_group: setGroup,
        });

        if (insertError) {
          failed++;
          continue;
        }

        added++;
        setSuggestions(prev => prev.map(s => 
          normalize(s.name) === normalize(song.name) ? { ...s, isAdded: true } : s
        ));
      } catch {
        failed++;
      }
    }

    setBatchAdding(false);
    if (added > 0) {
      showSuccess(`Added ${added} songs to ${subsetName}!${failed > 0 ? ` (${failed} failed)` : ''}`);
      await onSongAdded();
    } else {
      showError("Failed to add any songs.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] w-[650px] h-[80vh] p-0 bg-slate-950 border-white/10 overflow-hidden rounded-[2rem] shadow-2xl flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600/10 rounded-xl border border-indigo-500/20">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight text-white">
                  Subset Discover
                </DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                  AI Suggestions matching "{subsetName}"
                  {suggestions.length > 0 && (
                    <span className="ml-2 text-slate-600">
                      ({suggestions.filter(s => !s.isDuplicate && !s.isIgnored).length} new, {suggestions.filter(s => s.isDuplicate).length} dupes, {suggestions.filter(s => s.isIgnored).length} dismissed)
                    </span>
                  )}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isLoading && suggestions.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-400 border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDuplicates(!showDuplicates)}
                    className="h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 border-white/10 hover:bg-white/5 gap-1.5"
                  >
                    {showDuplicates ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showDuplicates ? "Hide Dupes" : "Show Dupes"}
                  </Button>
                  <Button
                    onClick={handleBatchAdd}
                    disabled={batchAdding || suggestions.filter(s => !s.isDuplicate && !s.isAdded && !s.isIgnored).length === 0}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl gap-2"
                  >
                    {batchAdding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Add All {suggestions.filter(s => !s.isDuplicate && !s.isAdded && !s.isIgnored).length > 0 && `(${suggestions.filter(s => !s.isDuplicate && !s.isAdded && !s.isIgnored).length})`}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">
                Analyzing subset vibe & searching iTunes...
              </p>
            </div>
          ) : quotaError ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4 text-center p-6">
              <Clock className="w-12 h-12 text-amber-500 animate-pulse" />
              <p className="text-sm font-black uppercase tracking-tight text-amber-500">Quota Limit Reached</p>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                {quotaError}
              </p>
              <Button 
                onClick={fetchSuggestions}
                className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest h-10 px-6 rounded-xl"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-full p-6">
              <div className="space-y-4 pb-6">
                {(() => {
                  const filtered = showDuplicates 
                    ? suggestions 
                    : suggestions.filter(s => !s.isDuplicate && !s.isIgnored);
                  
                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center space-y-3 text-center py-12">
                        <AlertCircle className="w-12 h-12 text-slate-600" />
                        <p className="text-sm font-black uppercase tracking-tight text-slate-400">
                          {suggestions.every(s => s.isDuplicate) 
                            ? "All suggestions are duplicates" 
                            : "No suggestions available"}
                        </p>
                        <p className="text-xs text-slate-500 max-w-xs">
                          {suggestions.every(s => s.isDuplicate)
                            ? "Click 'Refresh' to get new suggestions, or toggle 'Show Dupes' to view them."
                            : "Make sure this subset has some songs so the AI can analyze its style."}
                        </p>
                        <Button
                          onClick={handleRefresh}
                          className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest h-10 px-6 rounded-xl gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Refresh Suggestions
                        </Button>
                      </div>
                    );
                  }
                  
                  return filtered.map((song, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-2xl border transition-all group",
                        song.isDuplicate 
                          ? "bg-amber-500/5 border-amber-500/10 opacity-60" 
                          : song.isIgnored
                            ? "bg-slate-900/50 border-white/5 opacity-40"
                            : "bg-white/5 border-white/5 hover:border-white/10"
                      )}
                    >
                      {/* Artwork / Icon */}
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-white/10 shrink-0 flex items-center justify-center">
                        {song.artworkUrl ? (
                          <img src={song.artworkUrl} alt={song.name} className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-6 h-6 text-slate-600" />
                        )}
                        {song.previewUrl && !song.isDuplicate && (
                          <button
                            onClick={() => handleTogglePreview(song.previewUrl!)}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {activePreviewUrl === song.previewUrl && isPlaying ? (
                              <Pause className="w-5 h-5 text-white fill-current" />
                            ) : (
                              <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-white truncate leading-tight">
                                {song.name}
                              </h4>
                              {song.isDuplicate && (
                                <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                                  <Ban className="w-3 h-3" />
                                  Duplicate
                                </span>
                              )}
                              {song.isIgnored && (
                                <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-700 border border-slate-600 text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                  <EyeOff className="w-3 h-3" />
                                  Dismissed
                                </span>
                              )}
                              {song.energy_level && !song.isDuplicate && !song.isIgnored && (
                                <span className={cn(
                                  "shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1",
                                  song.energy_level === 'Ambient' && "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                                  song.energy_level === 'Pulse' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                                  song.energy_level === 'Groove' && "bg-orange-500/10 text-orange-400 border border-orange-500/20",
                                  song.energy_level === 'Peak' && "bg-red-500/10 text-red-400 border border-red-500/20",
                                )}>
                                  <Zap className="w-3 h-3" />
                                  {song.energy_level}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-slate-400 mt-0.5 truncate">
                              {song.artist}
                              {song.genre && (
                                <span className="text-slate-600 ml-2">• {song.genre}</span>
                              )}
                            </p>
                          </div>
                          {song.appleMusicUrl && (
                            <a
                              href={song.appleMusicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-500 hover:text-indigo-400 transition-colors shrink-0"
                              title="View on Apple Music"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-2 bg-white/5 p-2.5 rounded-xl border border-white/5 leading-relaxed">
                          {song.reason}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="shrink-0 self-center flex flex-col gap-1.5">
                        {song.isDuplicate ? (
                          <div className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500" title="Already in set">
                            <Ban className="w-4 h-4" />
                          </div>
                        ) : song.isIgnored ? (
                          <div className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500" title="Dismissed">
                            <EyeOff className="w-4 h-4" />
                          </div>
                        ) : song.isAdded ? (
                          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Check className="w-4 h-4" />
                          </div>
                        ) : (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={song.isAdding}
                              onClick={() => handleAddSong(index, song)}
                              className="h-9 w-9 rounded-xl bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border-indigo-500/20 transition-all"
                            >
                              {song.isAdding ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Plus className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDismiss(index, song)}
                              className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-all"
                              title="Dismiss suggestion"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
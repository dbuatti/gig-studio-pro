"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Plus, Play, Pause, ExternalLink, Music, Check, AlertCircle, Clock, Zap, Ban, RotateCcw, Eye, EyeOff, X, Search } from 'lucide-react';
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

interface RawSuggestion {
  name: string;
  artist: string;
  reason?: string;
  energy_level?: string;
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
  const [repoQuery, setRepoQuery] = useState('');
  const [repoAdding, setRepoAdding] = useState<string | null>(null);
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
      
      // 2. Check for duplicates across songs already IN THIS SUBSET
      const existingKeys = new Set(subsetSongs.map(s => normalize(s.name)));
      
      // Also deduplicate within the AI suggestions themselves
      const seenSuggestionKeys = new Set<string>();

      // Deduplicate raw suggestions
      const uniqueSuggestions = rawSuggestions.filter((s: RawSuggestion) => {
        const key = normalize(s.name);
        if (seenSuggestionKeys.has(key)) return false;
        seenSuggestionKeys.add(key);
        return true;
      });

      // Partition: songs already in repertoire vs songs needing iTunes lookup
      const needsItunes: { idx: number; query: string }[] = [];
      const enriched: SuggestedSong[] = uniqueSuggestions.map((s: RawSuggestion, i: number) => {
        const suggestionKey = normalize(s.name);
        const isDup = existingKeys.has(suggestionKey);
        const isIgnored = ignoredSuggestions.has(suggestionKey);
        const existingRepSong = repertoire.find(r => normalize(r.name) === suggestionKey);

        if (existingRepSong) {
          return {
            name: existingRepSong.name,
            artist: existingRepSong.artist,
            reason: s.reason || "Already in your library.",
            previewUrl: existingRepSong.previewUrl,
            appleMusicUrl: existingRepSong.appleMusicUrl,
            artworkUrl: existingRepSong.artworkUrl,
            genre: existingRepSong.genre,
            duration_seconds: existingRepSong.duration_seconds,
            energy_level: s.energy_level || existingRepSong.energy_level || 'Pulse',
            isDuplicate: isDup,
            isIgnored: isIgnored,
          };
        }
        needsItunes.push({ idx: i, query: `${s.artist} ${s.name}` });
        return {
          name: s.name,
          artist: s.artist,
          reason: s.reason || "Fits the subset vibe perfectly.",
          energy_level: s.energy_level || 'Pulse',
          isDuplicate: isDup,
          isIgnored: isIgnored,
        };
      });

      // Batch-enrich all remaining songs via edge function in ONE call
      if (needsItunes.length > 0) {
        try {
          const { data: itunesResults, error: itunesErr } = await supabase.functions.invoke('itunes-search', {
            body: { queries: needsItunes.map(n => n.query) }
          });
          if (!itunesErr && Array.isArray(itunesResults)) {
            needsItunes.forEach((n, i) => {
              const track = itunesResults[i];
              if (track) {
                enriched[n.idx] = {
                  ...enriched[n.idx],
                  name: track.trackName,
                  artist: track.artistName,
                  previewUrl: track.previewUrl,
                  appleMusicUrl: track.trackViewUrl,
                  artworkUrl: track.artworkUrl100,
                  genre: track.primaryGenreName,
                  duration_seconds: Math.floor(track.trackTimeMillis / 1000),
                };
              }
            });
          }
        } catch (e) {
          console.error("iTunes batch enrichment failed:", e);
        }
      }

      setSuggestions(enriched);
    } catch {
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

  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const subsetKeys = new Set(subsetSongs.map(s => normalize(s.name)));
  const repoResults = repoQuery.trim().length >= 1
    ? repertoire.filter(r => {
        const q = normalize(repoQuery);
        const nameMatch = normalize(r.name).includes(q);
        const artistMatch = normalize(r.artist || '').includes(q);
        return (nameMatch || artistMatch) && !subsetKeys.has(normalize(r.name));
      }).slice(0, 8)
    : [];

  const handleAddFromRepo = async (song: SetlistSong) => {
    setRepoAdding(song.id);
    try {
      const songIdToInsert = song.master_id || song.id;
      const { error: insertError } = await supabase.from('setlist_songs').insert({
        setlist_id: setlistId,
        song_id: songIdToInsert,
        sort_order: subsetSongs.length,
        set_group: setGroup,
      });
      if (insertError) throw insertError;
      showSuccess(`"${song.name}" added to ${subsetName}!`);
      setRepoQuery('');
      await onSongAdded();
    } catch (err: unknown) {
      showError(`Failed to add: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRepoAdding(null);
    }
  };

  const handleBatchAdd = async (limit: number | null = null) => {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const validSuggestions = suggestions.filter(s => !s.isDuplicate && !s.isAdded && !s.isIgnored);
    const toAdd = limit ? validSuggestions.slice(0, limit) : validSuggestions;
    if (toAdd.length === 0) {
      showInfo("No new suggestions to add.");
      return;
    }

    setBatchAdding(true);
    let added = 0;
    let failed = 0;

    for (const song of toAdd) {
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
      <DialogContent className="max-w-[95vw] w-[900px] h-[85vh] p-0 bg-slate-950 border-white/10 overflow-hidden rounded-[2rem] shadow-2xl flex flex-col">
        <DialogHeader className="p-6 pb-3 border-b border-white/5 shrink-0 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/10 rounded-xl border border-indigo-500/20">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
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
          {!isLoading && suggestions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-400 border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDuplicates(!showDuplicates)}
                className="h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 border-white/10 hover:bg-white/5 gap-1.5"
              >
                {showDuplicates ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showDuplicates ? "Hide Dupes" : "Show Dupes"}
              </Button>
              <div className="w-px h-5 bg-white/10 mx-1" />
              {[5, 10, 15, 20].map(n => {
                const avail = suggestions.filter(s => !s.isDuplicate && !s.isAdded && !s.isIgnored).length;
                const count = Math.min(n, avail);
                return (
                  <Button
                    key={n}
                    onClick={() => handleBatchAdd(n)}
                    disabled={batchAdding || count === 0}
                    className="h-8 min-w-[2rem] px-2 bg-white/5 hover:bg-indigo-600/20 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-300 border border-white/10 hover:border-indigo-500/30 rounded-lg transition-all"
                  >
                    +{n}
                  </Button>
                );
              })}
              <div className="w-px h-5 bg-white/10 mx-1" />
              <Button
                onClick={() => handleBatchAdd(null)}
                disabled={batchAdding || suggestions.filter(s => !s.isDuplicate && !s.isAdded && !s.isIgnored).length === 0}
                className="h-8 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest rounded-lg gap-1.5"
              >
                {batchAdding ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                All ({suggestions.filter(s => !s.isDuplicate && !s.isAdded && !s.isIgnored).length})
              </Button>
            </div>
          )}
        </DialogHeader>

        {/* Repertoire quick-add — always visible */}
        <div className="px-6 pb-3 shrink-0">
          <div className="relative">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-indigo-500/30 transition-colors">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Quick add from repertoire — type to search..."
                value={repoQuery}
                onChange={(e) => setRepoQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
              />
              {repoAdding && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
            </div>
            {repoResults.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                {repoResults.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleAddFromRepo(song)}
                    disabled={repoAdding !== null}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 shrink-0 flex items-center justify-center overflow-hidden">
                      {song.artworkUrl ? (
                        <img src={song.artworkUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{song.name}</p>
                      <p className="text-xs text-slate-500 truncate">{song.artist}</p>
                    </div>
                    <Plus className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">
                Analyzing subset vibe & enriching suggestions...
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
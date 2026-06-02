"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Plus, Play, Pause, ExternalLink, Music, Check, AlertCircle } from 'lucide-react';
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
  isAdded?: boolean;
  isAdding?: boolean;
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
    try {
      // 1. Call suggest-songs edge function with subset songs as context
      const payload = {
        repertoire: subsetSongs.map(s => ({ name: s.name, artist: s.artist })),
        seedSong: null,
        ignored: []
      };

      const { data, error: fetchError } = await supabase.functions.invoke('suggest-songs', {
        body: payload
      });

      if (fetchError) throw fetchError;

      const rawSuggestions = Array.isArray(data) ? data : (data?.suggestions || []);
      
      // 2. Enrich suggestions with iTunes metadata
      const enriched: SuggestedSong[] = [];
      for (const s of rawSuggestions) {
        const query = `${s.artist} ${s.name}`;
        try {
          const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`);
          if (res.ok) {
            const itunesData = await res.json();
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
        });
      }

      setSuggestions(enriched);
    } catch (err: any) {
      console.error("Failed to fetch subset suggestions:", err);
      showError("Failed to load suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSong = async (index: number, song: SuggestedSong) => {
    setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, isAdding: true } : s));
    try {
      // 1. Sync to master repertoire
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

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

      const syncedSong = synced[0];

      // 2. Add to setlist under the specific subset
      const { error: insertError } = await supabase.from('setlist_songs').insert({
        setlist_id: setlistId,
        song_id: syncedSong.master_id || syncedSong.id,
        sort_order: subsetSongs.length,
        set_group: setGroup,
      });

      if (insertError) throw insertError;

      showSuccess(`"${song.name}" added to ${subsetName}!`);
      setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, isAdding: false, isAdded: true } : s));
      await onSongAdded();
    } catch (err: any) {
      console.error("Failed to add suggested song:", err);
      showError(`Failed to add song: ${err.message}`);
      setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, isAdding: false } : s));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] w-[650px] h-[80vh] p-0 bg-slate-950 border-white/10 overflow-hidden rounded-[2rem] shadow-2xl flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b border-white/5 shrink-0">
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
              </DialogDescription>
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
          ) : suggestions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3 text-center p-6">
              <AlertCircle className="w-12 h-12 text-slate-600" />
              <p className="text-sm font-black uppercase tracking-tight text-slate-400">No suggestions found</p>
              <p className="text-xs text-slate-500 max-w-xs">
                Make sure this subset has some songs so the AI can analyze its musical style and energy.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full p-6">
              <div className="space-y-4 pb-6">
                {suggestions.map((song, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all group"
                  >
                    {/* Artwork / Icon */}
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-white/10 shrink-0 flex items-center justify-center">
                      {song.artworkUrl ? (
                        <img src={song.artworkUrl} alt={song.name} className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-6 h-6 text-slate-600" />
                      )}
                      {song.previewUrl && (
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
                        <div>
                          <h4 className="text-sm font-black text-white truncate leading-tight">
                            {song.name}
                          </h4>
                          <p className="text-xs font-bold text-slate-400 mt-0.5 truncate">
                            {song.artist}
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

                    {/* Add Button */}
                    <div className="shrink-0 self-center">
                      {song.isAdded ? (
                        <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={song.isAdding}
                          onClick={() => handleAddSong(index, song)}
                          className="h-9 w-9 rounded-xl bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 transition-all"
                        >
                          {song.isAdding ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
"use client";

import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SetlistSong } from '@/components/SetlistManager';
import { showError } from '@/utils/toast';

interface UseSongSuggestionsProps {
  repertoire: SetlistSong[];
  limit?: number;
}

export function useSongSuggestions({ repertoire, limit = 10 }: UseSongSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [ignoredKeys, setIgnored] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);

  const normalize = (str: string = "") => {
    return str
      .toLowerCase()
      .replace(/\(.*\)/g, '') 
      .replace(/\[.*\]/g, '')
      .replace(/[^a-z0-9]/g, '') 
      .trim();
  };

  const getNormalizedKey = (name: string, artist: string) => {
    return `${normalize(name)}-${normalize(artist)}`;
  };

  const existingKeys = useMemo(() => {
    return new Set(repertoire.map(s => getNormalizedKey(s.name, s.artist || "")));
  }, [repertoire]);

  const fetchSuggestions = useCallback(async (seedSong?: SetlistSong) => {
    if (repertoire.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    setIsQuotaError(false);

    const payload = { 
      repertoire: repertoire.slice(0, 50).map(s => ({ name: s.name, artist: s.artist })),
      seedSong: seedSong ? { name: seedSong.name, artist: seedSong.artist } : null,
      ignored: Array.from(ignoredKeys).map(key => ({ name: key.split('-')[0], artist: key.split('-')[1] }))
    };

    try {
      const { data, error: fetchError } = await supabase.functions.invoke('suggest-songs', {
        body: payload
      });

      if (fetchError) {
        if (fetchError.status === 429) {
          setIsQuotaError(true);
          setError("AI Discovery is resting (Quota Limit).");
        } else {
          throw fetchError;
        }
        return;
      }

      if (data?.error) {
        if (data.isQuotaError) {
          setIsQuotaError(true);
          setError("AI Discovery is resting (Quota Limit).");
        } else {
          setError(data.error);
        }
        return;
      }

      const rawBatch = Array.isArray(data) ? data : (data?.suggestions || []);
      
      const filtered = rawBatch.filter((s: any) => {
        const songName = s.name || s.title || "";
        const songArtist = s.artist || s.artistName || "";
        const key = getNormalizedKey(songName, songArtist);
        return !existingKeys.has(key) && !ignoredKeys.has(key) && key !== "-";
      }).slice(0, limit);

      setSuggestions(filtered);
    } catch (err: any) {
      console.error("[useSongSuggestions] Fetch error:", err);
      setError("Discovery engine temporarily unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, [repertoire, ignoredKeys, existingKeys, limit]);

  const dismissSuggestion = useCallback((song: any) => {
    const key = getNormalizedKey(song.name || song.title, song.artist || song.artistName || "");
    setIgnored(prev => new Set(prev).add(key));
    setSuggestions(prev => prev.filter(s => getNormalizedKey(s.name || s.title, s.artist || s.artistName || "") !== key));
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    isQuotaError,
    fetchSuggestions,
    dismissSuggestion
  };
}
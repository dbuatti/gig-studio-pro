"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sparkles, Plus, X, RotateCcw, Loader2, Music, Lightbulb, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';

interface RepertoireSuggestionsProps {
  repertoire: SetlistSong[];
  onAddSong: (song: SetlistSong) => void;
}

const RepertoireSuggestions: React.FC<RepertoireSuggestionsProps> = ({ repertoire, onAddSong }) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Helper to normalize song titles and artists for robust comparison
  const normalize = (str: string = "") => {
    return str
      .toLowerCase()
      // Remove common suffixes in parentheses or brackets
      .replace(/\(.*\)/g, '') 
      .replace(/\[.*\]/g, '')
      // Remove common "noise" words that AI or iTunes might add
      .replace(/\b(remastered|remaster|original|master|recording|live|version|radio edit|feat|ft)\b/g, '')
      // Remove all non-alphanumeric characters
      .replace(/[^a-z0-9]/g, '') 
      .trim();
  };

  const getNormalizedKey = (name: string, artist: string) => {
    const n = normalize(name);
    const a = normalize(artist);
    return `${n}-${a}`;
  };

  const existingKeys = useMemo(() => {
    const keys = new Set(repertoire.map(s => getNormalizedKey(s.name, s.artist || "")));
    console.log("[RepertoireDiscovery] Current Library Keys (Normalized):", Array.from(keys));
    return keys;
  }, [repertoire]);

  const fetchSuggestions = useCallback(async () => {
    if (repertoire.length === 0) return;
    
    setIsLoading(true);
    // Send up to 100 songs for better context, but only name/artist to save tokens
    const payload = { 
      repertoire: repertoire.slice(0, 100).map(s => ({ name: s.name, artist: s.artist })),
      ignored: Array.from(ignored).map(key => ({ name: key.split('-')[0], artist: key.split('-')[1] }))
    };

    console.log("[RepertoireDiscovery] Fetching suggestions with payload:", payload);

    try {
      const { data, error } = await supabase.functions.invoke('suggest-songs', {
        body: payload
      });

      if (error) throw error;

      const rawBatch = Array.isArray(data) ? data : (data?.suggestions || []);
      console.log("[RepertoireDiscovery] Raw AI Response:", rawBatch);
      
      const filtered = rawBatch.filter((s: any) => {
        const songName = s.name || s.title || "";
        const songArtist = s.artist || s.artistName || "";
        
        const key = getNormalizedKey(songName, songArtist);
        const isDuplicate = existingKeys.has(key);
        const isIgnored = ignored.has(key);
        
        console.log(`[RepertoireDiscovery] Checking: "\${songName}" by "\${songArtist}" | Key: \${key} | Duplicate: \${isDuplicate} | Ignored: \${isIgnored}`);
        
        return !isDuplicate && !isIgnored && key !== "-";
      }).slice(0, 3);

      console.log("[RepertoireDiscovery] Final Display Suggestions:", filtered);
      setSuggestions(filtered);
    } catch (err) {
      console.error("[RepertoireDiscovery] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [repertoire, ignored, existingKeys]);

  useEffect(() => {
    if (repertoire.length > 0 && suggestions.length === 0 && !isLoading) {
      fetchSuggestions();
    }
  }, [repertoire.length, fetchSuggestions, suggestions.length, isLoading]);

  const handleDismiss = (song: any) => {
    const key = getNormalizedKey(song.name || song.title, song.artist || song.artistName || "");
    console.log(`[RepertoireDiscovery] Dismissing: \${song.name || song.title}`);
    setIgnored(prev => new Set(prev).add(key));
    setSuggestions(prev => prev.filter(s => getNormalizedKey(s.name || s.title, s.artist || s.artistName || "") !== key));
  };

  const mapToSong = (s: any): SetlistSong => ({
    id: crypto.randomUUID(),
    name: s.name || s.title,
    artist: s.artist || s.artistName || "Unknown Artist",
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
    metadata_source: 'ai_suggestion',
    sync_status: 'IDLE',
    last_sync_log: null,
    auto_synced: false,
    is_sheet_verified: false,
    sheet_music_url: null,
    extraction_status: 'idle',
  });

  const handleAdd = (s: any) => {
    console.log(`[RepertoireDiscovery] Adding to library: \${s.name || s.title}`);
    onAddSong(mapToSong(s));
    setSuggestions(prev => prev.filter(item => item !== s));
    showSuccess(`Added "\${s.name || s.title}" to library`);
  };

  const handleAddAll = () => {
    console.log(`[RepertoireDiscovery] Adding all \${suggestions.length} suggestions to library`);
    suggestions.forEach(s => onAddSong(mapToSong(s)));
    setSuggestions([]);
    showSuccess(`Added \${suggestions.length} songs to library`);
  };

  if (repertoire.length === 0) return null;
  if (!isLoading && suggestions.length === 0) return null;

  return (
    <div className="space-y-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-indigo-400">Repertoire Discovery</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AI-Curated for your sonic profile</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchSuggestions}
            disabled={isLoading}
            className="h-8 px-3 text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/10 rounded-lg"
          >
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RotateCcw className="w-3 h-3 mr-2" />}
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAddAll}
            disabled={isLoading || suggestions.length === 0}
            className="h-8 px-4 text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white border-none hover:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-600/20"
          >
            Add All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading && suggestions.length === 0 ? (
          [1, 2, 3].map(i => (
            <Card key={i} className="h-32 bg-slate-900/40 border-white/5 animate-pulse rounded-[1.5rem]" />
          ))
        ) : (
          suggestions.map((song, i) => (
            <Card 
              key={i} 
              className="group relative p-5 bg-slate-900/40 border-white/5 hover:border-indigo-500/30 transition-all rounded-[1.5rem] overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-black uppercase tracking-tight text-white truncate">{song.name || song.title}</h4>
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5 truncate">{song.artist || song.artistName}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button 
                    onClick={() => handleDismiss(song)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleAdd(song)}
                    className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all active:scale-90"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 p-2.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                <Lightbulb className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-[9px] font-medium text-slate-400 leading-relaxed line-clamp-2 italic">
                  "{song.reason}"
                </p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default RepertoireSuggestions;
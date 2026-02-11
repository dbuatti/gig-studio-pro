"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Loader2, Music, Zap, CheckCircle2, Info } from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showSuccess, showError } from '@/utils/toast';

interface Recommendation {
  id: string;
  reason: string;
}

interface SongRecommenderProps {
  currentSongs: SetlistSong[];
  repertoire: SetlistSong[];
  onAddSong: (song: SetlistSong) => Promise<void>;
}

const SongRecommender: React.FC<SongRecommenderProps> = ({ currentSongs, repertoire, onAddSong }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<(Recommendation & { song: SetlistSong })[]>([]);

  const getRecommendations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-song-recommender', {
        body: {
          currentSetlist: currentSongs.map(s => ({
            id: s.master_id || s.id,
            name: s.name,
            artist: s.artist,
            bpm: s.bpm,
            energy_level: s.energy_level
          })),
          repertoire: repertoire.map(s => ({
            id: s.id,
            name: s.name,
            artist: s.artist,
            bpm: s.bpm,
            energy_level: s.energy_level,
            readiness: calculateReadiness(s),
            genre: s.genre
          }))
        }
      });

      if (error) throw error;

      const recs = (data || [])
        .map((rec: Recommendation) => {
          const song = repertoire.find(s => s.id === rec.id);
          return song ? { ...rec, song } : null;
        })
        .filter(Boolean) as (Recommendation & { song: SetlistSong })[];

      setRecommendations(recs);
    } catch (err: any) {
      showError("Failed to get recommendations.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (song: SetlistSong) => {
    await onAddSong(song);
    setRecommendations(prev => prev.filter(r => r.song.id !== song.id));
  };

  return (
    <div className="mt-8 p-6 bg-indigo-600/5 border border-indigo-500/20 rounded-[2.5rem] space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-indigo-400">Smart Recommendations</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AI-Powered Setlist Expansion</p>
          </div>
        </div>
        <Button 
          onClick={getRecommendations} 
          disabled={isLoading}
          variant="outline"
          className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Zap className="w-3.5 h-3.5 mr-2" />}
          {recommendations.length > 0 ? "Refresh Suggestions" : "Get Suggestions"}
        </Button>
      </div>

      {recommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {recommendations.map((rec) => {
            const readiness = calculateReadiness(rec.song);
            return (
              <div 
                key={rec.song.id}
                className="bg-card border border-border p-4 rounded-3xl flex flex-col gap-3 hover:border-indigo-500/30 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black uppercase tracking-tight truncate text-foreground">{rec.song.name}</h4>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">{rec.song.artist}</p>
                  </div>
                  <div className={cn(
                    "text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg",
                    readiness >= 90 ? "bg-emerald-600/20 text-emerald-400" : "bg-amber-600/20 text-amber-400"
                  )}>
                    {readiness}%
                  </div>
                </div>
                
                <div className="flex items-start gap-2 p-2.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                  <Info className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-medium text-slate-400 leading-relaxed italic">
                    "{rec.reason}"
                  </p>
                </div>

                <Button 
                  onClick={() => handleAdd(rec.song)}
                  className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest text-[9px] gap-2"
                >
                  <Plus className="w-3 h-3" /> Add to Set
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && recommendations.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Click "Get Suggestions" to find the perfect tracks for this set.
          </p>
        </div>
      )}
    </div>
  );
};

export default SongRecommender;
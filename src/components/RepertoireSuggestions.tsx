"use client";

import React, { useEffect } from 'react';
import { Sparkles, Plus, X, RotateCcw, Loader2, Clock, AlertCircle, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SetlistSong } from './SetlistManager';
import { showSuccess } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useSongSuggestions } from '@/hooks/use-song-suggestions';

interface RepertoireSuggestionsProps {
  repertoire: SetlistSong[];
  onAddSong: (song: SetlistSong) => void;
}

const RepertoireSuggestions: React.FC<RepertoireSuggestionsProps> = ({ repertoire, onAddSong }) => {
  const {
    suggestions,
    isLoading,
    error,
    isQuotaError,
    fetchSuggestions,
    dismissSuggestion
  } = useSongSuggestions({ repertoire, limit: 3 });

  useEffect(() => {
    if (repertoire.length > 0 && suggestions.length === 0 && !isLoading && !error) {
      fetchSuggestions();
    }
  }, [repertoire.length, fetchSuggestions, suggestions.length, isLoading, error]);

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
    onAddSong(mapToSong(s));
    dismissSuggestion(s);
    showSuccess(`Added "${s.name || s.title}" to library`);
  };

  const handleAddAll = () => {
    suggestions.forEach(s => onAddSong(mapToSong(s)));
    suggestions.forEach(s => dismissSuggestion(s));
    showSuccess(`Added ${suggestions.length} songs to library`);
  };

  if (repertoire.length === 0) return null;

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
          {error && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg mr-2">
              {isQuotaError ? <Clock className="w-3 h-3 text-amber-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />}
              <span className="text-[9px] font-black uppercase text-amber-500">{error}</span>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => fetchSuggestions()}
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

      {suggestions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {suggestions.map((song, i) => (
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
                    onClick={() => dismissSuggestion(song)}
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
          ))}
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-32 bg-slate-900/40 border-white/5 animate-pulse rounded-[1.5rem]" />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default RepertoireSuggestions;
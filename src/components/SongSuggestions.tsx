"use client";

import React, { useEffect, useMemo } from 'react';
import { Sparkles, Loader2, Music, Search, Target, ListPlus, XCircle, RotateCcw, Lightbulb, Clock, AlertCircle } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SetlistSong } from './SetlistManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { showSuccess } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useSongSuggestions } from '@/hooks/use-song-suggestions';

interface SongSuggestionsProps {
  repertoire: SetlistSong[];
  onSelectSuggestion: (query: string) => void;
  onAddExistingSong?: (song: SetlistSong) => void;
}

const SongSuggestions: React.FC<SongSuggestionsProps> = ({ repertoire, onSelectSuggestion, onAddExistingSong }) => {
  const [seedSongId, setSeedSongId] = React.useState<string | null>(null);

  const seedSong = useMemo(() => 
    repertoire.find(s => s.id === seedSongId), 
  [seedSongId, repertoire]);

  const {
    suggestions,
    isLoading,
    error,
    isQuotaError,
    fetchSuggestions,
    dismissSuggestion
  } = useSongSuggestions({ repertoire, limit: 10 });

  useEffect(() => {
    if (repertoire.length > 0 && suggestions.length === 0 && !isLoading && !error) {
      fetchSuggestions(seedSong || undefined);
    }
  }, [repertoire.length, fetchSuggestions, suggestions.length, isLoading, error, seedSong]);

  const handleAdd = (song: Record<string, unknown>) => {
    if (onAddExistingSong) {
      onAddExistingSong({
        id: crypto.randomUUID(),
        name: song.name || song.title,
        artist: song.artist || song.artistName || "Unknown Artist",
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
      dismissSuggestion(song);
      showSuccess(`Added "${song.name || song.title}" to library`);
    }
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
            <div className="flex items-center gap-2">
              {error && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  {isQuotaError ? <Clock className="w-3 h-3 text-amber-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />}
                  <span className="text-[8px] font-black uppercase text-amber-500">{isQuotaError ? "Quota Limit" : "Error"}</span>
                </div>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => fetchSuggestions(seedSong || undefined)} 
                disabled={isLoading}
                className="h-7 text-[9px] font-black uppercase hover:bg-indigo-500/10 text-indigo-500 flex-shrink-0"
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
                  onClick={() => { setSeedSongId(null); fetchSuggestions(); }}
                  className="text-[8px] font-black text-indigo-500 uppercase hover:text-indigo-600"
                >
                  Clear Seed
                </button>
              )}
            </div>
            <Select value={seedSongId || "profile"} onValueChange={(val) => { setSeedSongId(val === "profile" ? null : val); fetchSuggestions(repertoire.find(s => s.id === val)); }}>
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
            {isLoading && suggestions.length === 0 ? (
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
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xl font-black tracking-tight text-slate-900 dark:text-white truncate">
                          {song.name || song.title}
                        </h4>
                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-1">
                          {song.artist || song.artistName || "Unknown Artist"}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={() => dismissSuggestion(song)}
                              className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px] font-black uppercase">Don't Suggest Again</TooltipContent>
                        </Tooltip>
                        
                        <button 
                          onClick={() => onSelectSuggestion(`${song.artist || song.artistName} ${song.name || song.title}`)}
                          className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all"
                          title="Preview track"
                        >
                          <Search className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

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

                    <Button
                      onClick={() => handleAdd(song)}
                      className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-widest rounded-2xl gap-3 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
                    >
                      <ListPlus className="w-5 h-5" /> Add to Repertoire
                    </Button>
                  </div>
                ))
              ) : (
                !isLoading && (
                  <div className="py-20 text-center opacity-30">
                    <Sparkles className="w-10 h-10 mb-4 mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Discovery pool empty. Refresh to get new tracks.</p>
                  </div>
                )
              )
            )}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};

export default SongSuggestions;
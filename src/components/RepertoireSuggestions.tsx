"use client";

import React, { useEffect, useState } from 'react';
import { Sparkles, Plus, X, RotateCcw, Loader2, Clock, AlertCircle, Lightbulb, Target, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { SetlistSong } from './SetlistManager';
import { showSuccess } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useSongSuggestions } from '@/hooks/use-song-suggestions';
import { cn } from '@/lib/utils';

interface RepertoireSuggestionsProps {
  repertoire: SetlistSong[];
  onAddSong: (song: SetlistSong) => void;
  activeSetlistSongs?: SetlistSong[];
}

const RepertoireSuggestions: React.FC<RepertoireSuggestionsProps> = ({ repertoire, onAddSong, activeSetlistSongs = [] }) => {
  const [seedSong, setSeedSong] = useState<SetlistSong | null>(null);
  const [seedSearch, setSeedSearch] = useState("");
  const [seedMenuOpen, setSeedMenuOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const {
    suggestions,
    isLoading,
    error,
    isQuotaError,
    fetchSuggestions,
    dismissSuggestion
  } = useSongSuggestions({ repertoire, limit: 3, activeSetlistSongs });

  useEffect(() => {
    if (repertoire.length > 0 && suggestions.length === 0 && !isLoading && !error && !hasFetched) {
      setHasFetched(true);
      fetchSuggestions();
    }
  }, [repertoire.length, fetchSuggestions, suggestions.length, isLoading, error, hasFetched]);

  const filteredRepertoire = repertoire.filter(s =>
    !seedSearch.trim() ||
    s.name.toLowerCase().includes(seedSearch.toLowerCase()) ||
    (s.artist || "").toLowerCase().includes(seedSearch.toLowerCase())
  );

  const handleSelectSeed = (song: SetlistSong | null) => {
    setSeedSong(song);
    setSeedSearch("");
    setSeedMenuOpen(false);
    setHasFetched(true);
    fetchSuggestions(song ?? undefined);
  };

  const handleRefresh = () => {
    setHasFetched(true);
    fetchSuggestions(seedSong ?? undefined);
  };

  const mapToSong = (s: Record<string, unknown>): SetlistSong => ({
    id: crypto.randomUUID(),
    name: s.name as string || s.title as string,
    artist: s.artist as string || s.artistName as string || "Unknown Artist",
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

  const handleAdd = (s: Record<string, unknown>) => {
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
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {seedSong ? `AI-Curated similar to ${seedSong.name}` : "AI-Curated for your sonic profile"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu open={seedMenuOpen} onOpenChange={setSeedMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                  seedSong
                    ? "bg-indigo-600/10 text-indigo-300 border border-indigo-500/20"
                    : "bg-white/5 text-slate-400 hover:bg-white/10"
                )}
              >
                <Target className="w-3 h-3 mr-1.5" />
                <span className="max-w-[120px] truncate">{seedSong ? seedSong.name : "Any Song"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 bg-slate-900 border-white/10 text-white p-2 rounded-xl z-[300]">
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-2 pt-1">
                Seed Recommendations From
              </DropdownMenuLabel>
              <div className="relative px-2 pb-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={seedSearch}
                  onChange={(e) => setSeedSearch(e.target.value)}
                  placeholder="Search your library..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/30"
                />
              </div>
              <DropdownMenuItem
                onClick={() => handleSelectSeed(null)}
                className={cn("h-10 rounded-lg gap-2.5 text-xs font-bold cursor-pointer", !seedSong ? "bg-indigo-600 text-white" : "text-slate-300")}
              >
                <Sparkles className="w-3.5 h-3.5" /> Any Song (sonic profile)
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <ScrollArea className="max-h-56">
                {filteredRepertoire.map((song) => (
                  <DropdownMenuItem
                    key={song.id}
                    onClick={() => handleSelectSeed(song)}
                    className="h-10 rounded-lg flex items-center gap-2.5 px-2 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{song.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{song.artist || "Unknown Artist"}</p>
                    </div>
                    {seedSong?.id === song.id && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </DropdownMenuItem>
                ))}
                {filteredRepertoire.length === 0 && (
                  <div className="px-2 py-6 text-center text-xs text-slate-500">No songs match your search</div>
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
          {error && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg mr-2">
              {isQuotaError ? <Clock className="w-3 h-3 text-amber-500" /> : <AlertCircle className="w-3 h-3 text-amber-500" />}
              <span className="text-[9px] font-black uppercase text-amber-500">{error}</span>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
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

      {seedSong && (
        <div className="flex items-center px-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            <Target className="w-3 h-3 text-indigo-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">
              Seeding from: {seedSong.name}
            </span>
            <button
              onClick={() => handleSelectSeed(null)}
              className="p-0.5 text-indigo-300 hover:text-white transition-colors"
              aria-label="Clear seed song"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

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
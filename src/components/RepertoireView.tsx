"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Library, Music, Settings2, Plus, Check, ShieldCheck,
  Star, Filter, AlertTriangle, Loader2, CloudDownload, Edit3, ListMusic, ArrowRight
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { cn } from "@/lib/utils";
import { formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import SetlistMultiSelector from './SetlistMultiSelector';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { showSuccess } from '@/utils/toast';

interface RepertoireViewProps {
  repertoire: SetlistSong[];
  onEditSong: (song: SetlistSong, defaultTab?: 'details' | 'audio' | 'charts' | 'lyrics' | 'visual' | 'config' | 'library') => void;
  allSetlists: { id: string; name: string; songs: SetlistSong[] }[];
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  onRefreshRepertoire: () => void;
  onAddSong: (song: SetlistSong) => void;
}

const RepertoireView: React.FC<RepertoireViewProps> = ({
  repertoire,
  onEditSong,
  allSetlists,
  onUpdateSetlistSongs,
  onRefreshRepertoire,
  onAddSong,
}) => {
  const { keyPreference } = useSettings();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work'>('none');
  const [filterReady, setFilterReady] = useState(false);

  const filteredAndSortedRepertoire = useMemo(() => {
    let songs = [...repertoire];
    const q = searchTerm.toLowerCase();

    songs = songs.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(q) ||
                            s.artist?.toLowerCase().includes(q) ||
                            s.user_tags?.some(tag => tag.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (filterReady && calculateReadiness(s) < 100) return false;
      return true;
    });

    if (sortMode === 'ready') {
      songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    } else if (sortMode === 'work') {
      songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    } else {
      songs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return songs;
  }, [repertoire, searchTerm, sortMode, filterReady]);

  const isItunesPreview = (url?: string) => url && (url.includes('apple.com') || url.includes('itunes-assets'));

  const handleAddNewSong = () => {
    const newSong: SetlistSong = {
      id: Math.random().toString(36).substr(2, 9), // Temporary client-side ID
      name: "New Track",
      artist: "Unknown Artist",
      previewUrl: "",
      audio_url: "", // Initialize audio_url
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
      extraction_error: null,
    };
    onAddSong(newSong);
    onEditSong(newSong, 'details'); // Open studio to details tab for new song
    showSuccess("New track added to repertoire!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
            <Button
              variant="ghost" size="sm"
              onClick={() => setSortMode('none')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'none' && "bg-background dark:bg-secondary shadow-sm"
              )}
            >
              <ListMusic className="w-3 h-3" /> <span className="hidden sm:inline">Alphabetical</span>
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => setSortMode('ready')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'ready' && "bg-background dark:bg-secondary shadow-sm text-indigo-600"
              )}
            >
              <Star className="w-3 h-3" /> <span className="hidden sm:inline">Readiness</span>
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => setSortMode('work')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'work' && "bg-background dark:bg-secondary shadow-sm text-orange-600"
              )}
            >
              <AlertTriangle className="w-3 h-3" /> <span className="hidden sm:inline">Work Needed</span>
            </Button>
          </div>
          <Button
            variant="ghost" size="sm"
            onClick={() => setFilterReady(!filterReady)}
            className={cn(
              "h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl gap-2 transition-all",
              filterReady ? "bg-emerald-500 text-emerald-600" : "text-muted-foreground hover:bg-accent dark:hover:bg-secondary"
            )}
          >
            <Filter className="w-3.5 h-3.5" /> {filterReady ? "Ready Only" : "All Tracks"}
          </Button>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
            <Input
              placeholder="Search master repertoire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 sm:h-9 pl-9 text-[11px] font-bold bg-card dark:bg-card border-border dark:border-border rounded-xl focus-visible:ring-indigo-500"
            />
          </div>
          <Button
            onClick={handleAddNewSong}
            className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" /> New Track
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-[2rem] border-4 border-border shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-secondary dark:bg-secondary border-b border-border">
                <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-16 text-center">#</th>
                <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-left">Song / Artist</th>
                <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-24 text-center">Readiness</th>
                <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-48 text-center">Harmonic Data</th>
                <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-40 text-right pr-10">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAndSortedRepertoire.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center opacity-30">
                    <Library className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">No Tracks Found</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedRepertoire.map((song, idx) => {
                  const readinessScore = calculateReadiness(song);
                  const isFullyReady = readinessScore === 100;
                  const currentPref = song.key_preference || keyPreference;
                  const displayOrigKey = formatKey(song.originalKey, currentPref);
                  const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref);
                  const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
                  const isExtractionFailed = song.extraction_status === 'failed';

                  return (
                    <tr
                      key={song.id}
                      onClick={() => onEditSong(song, 'details')} // Make entire row clickable and open to 'details'
                      className={cn(
                        "transition-all group relative cursor-pointer h-[80px]",
                        "hover:bg-accent dark:hover:bg-secondary"
                      )}
                    >
                      <td className="px-6 text-center">
                        <span className="text-[10px] font-mono font-black text-muted-foreground">{(idx + 1).toString().padStart(2, '0')}</span>
                      </td>
                      <td className="px-6 text-left">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3">
                            <h4 className="text-base font-black tracking-tight leading-none flex items-center gap-2">
                              {song.name}
                              {isFullyReady && <Check className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />}
                              {isProcessing && <CloudDownload className="w-4 h-4 text-indigo-500 animate-bounce" />}
                              {isExtractionFailed && <AlertTriangle className="w-4 h-4 text-red-500" />}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                              {song.artist || "Unknown Artist"}
                            </span>
                          </div>
                          {isExtractionFailed && song.last_sync_log && (
                            <p className="text-[8px] text-red-400 mt-1 truncate max-w-[200px]">Error: {song.last_sync_log}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 text-center">
                        <div className="flex flex-col items-center justify-center h-full">
                          <p className={cn(
                            "text-sm font-mono font-black",
                            readinessScore >= 90 ? "text-emerald-400" : "text-indigo-400"
                          )}>{readinessScore}%</p>
                          {readinessScore === 100 && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mt-1" />}
                        </div>
                      </td>
                      <td className="px-6 text-center">
                        <div className="flex items-center justify-center gap-4 h-full">
                          <div className="text-center min-w-[32px]">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Orig</p>
                            <span className="text-xs font-mono font-bold text-muted-foreground block leading-none">{displayOrigKey}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center opacity-30">
                            <ArrowRight className="w-3 h-3 text-muted-foreground mb-0.5" />
                            <div className="h-px w-6 bg-border" />
                          </div>
                          <div className="text-center min-w-[32px] relative">
                            <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Stage</p>
                            <div className={cn(
                              "font-mono font-black text-xs px-2.5 py-1 rounded-lg shadow-lg flex items-center justify-center gap-1.5 leading-none",
                              song.isKeyConfirmed ? "bg-emerald-600 text-white shadow-emerald-500/20" : "bg-indigo-600 text-white shadow-indigo-500/20"
                            )}>
                              {displayTargetKey}
                              {song.isKeyConfirmed && <Check className="w-3 h-3" />}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 text-right pr-10">
                        <div className="flex items-center justify-end gap-2 h-full">
                          <SetlistMultiSelector
                            songMasterId={song.id}
                            allSetlists={allSetlists}
                            songToAssign={song}
                            onUpdateSetlistSongs={onUpdateSetlistSongs}
                          />
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 transition-colors inline-flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onEditSong(song); }}>
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RepertoireView;
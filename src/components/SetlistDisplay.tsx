"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Music, Search, Edit, Trash2, Play, Pause, ChevronUp, ChevronDown, Settings2, ListMusic, Plus, CheckCircle, Check, CloudDownload, AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SetlistSong } from './SetlistManagementModal';
import { FilterState } from './SetlistFilters';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { calculateReadiness } from '@/utils/repertoireSync';
import { useSettings } from '@/hooks/use-settings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StudioTab } from './SongStudioView';

interface SetlistDisplayProps {
  songs: SetlistSong[];
  onSelect: (song: SetlistSong) => void;
  onEdit: (song: SetlistSong, defaultTab?: StudioTab) => void;
  onUpdateKey: (songId: string, newKey: string) => void;
  onLinkAudio: (song: SetlistSong) => void;
  onSyncProData: (song: SetlistSong) => Promise<void>;
  currentSongId: string | null;
  sortMode: 'none' | 'ready' | 'work' | 'manual';
  setSortMode: (mode: 'none' | 'ready' | 'work' | 'manual') => void;
  activeFilters: FilterState;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showHeatmap: boolean;
  allSetlists: { id: string; name: string; songs: SetlistSong[] }[];
  onRemove: (setlistSongId: string) => void;
  onUpdateSong: (setlistSongId: string, updates: Partial<SetlistSong>) => void;
  onTogglePlayed: (setlistSongId: string) => void;
  onReorder: (newOrder: SetlistSong[]) => void;
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  onOpenSortModal: () => void;
  masterRepertoire: SetlistSong[];
}

const SetlistDisplay: React.FC<SetlistDisplayProps> = ({
  songs,
  onSelect,
  onEdit,
  onUpdateKey,
  onLinkAudio,
  onSyncProData,
  currentSongId,
  sortMode,
  setSortMode,
  activeFilters,
  searchTerm,
  setSearchTerm,
  showHeatmap,
  allSetlists,
  onRemove,
  onUpdateSong,
  onTogglePlayed,
  onReorder,
  onUpdateSetlistSongs,
  onOpenSortModal,
  masterRepertoire,
}) => {
  const { keyPreference: globalKeyPreference } = useSettings();
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<SetlistSong | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false); // State for filter visibility

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleRemoveSong = async () => {
    if (!songToDelete) return;
    setIsSaving(true);
    try {
      await onRemove(songToDelete.id);
      setSongToDelete(null);
      setIsConfirmDeleteOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('songIndex', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('songIndex'), 10);
    const newSongs = [...songs];
    const [draggedSong] = newSongs.splice(dragIndex, 1);
    newSongs.splice(dropIndex, 0, draggedSong);
    onReorder(newSongs);
  };

  const filteredSongs = useMemo(() => {
    let filtered = [...songs];

    // Apply search term
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    if (lowerCaseSearchTerm) {
      filtered = filtered.filter(song =>
        song.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
        song.artist?.toLowerCase().includes(lowerCaseSearchTerm) ||
        song.user_tags?.some(tag => tag.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }

    // Apply filters
    if (activeFilters.hasAudio !== 'all') {
      filtered = filtered.filter(s => {
        if (activeFilters.hasAudio === 'full') return s.audio_url;
        if (activeFilters.hasAudio === 'itunes') return s.previewUrl && !s.audio_url;
        if (activeFilters.hasAudio === 'none') return !s.audio_url && !s.previewUrl;
        return true;
      });
    }
    if (activeFilters.hasVideo !== 'all') {
      filtered = filtered.filter(s => (!!s.youtubeUrl) === (activeFilters.hasVideo === 'yes'));
    }
    if (activeFilters.hasChart !== 'all') {
      filtered = filtered.filter(s => (!!s.pdfUrl || !!s.leadsheetUrl || !!s.ugUrl || !!s.ug_chords_text) === (activeFilters.hasChart === 'yes'));
    }
    if (activeFilters.hasPdf !== 'all') {
      filtered = filtered.filter(s => (!!s.pdfUrl || !!s.sheet_music_url) === (activeFilters.hasPdf === 'yes'));
    }
    if (activeFilters.hasUg !== 'all') {
      filtered = filtered.filter(s => (!!s.ugUrl) === (activeFilters.hasUg === 'yes'));
    }
    if (activeFilters.isConfirmed !== 'all') {
      filtered = filtered.filter(s => (!!s.isKeyConfirmed) === (activeFilters.isConfirmed === 'yes'));
    }
    if (activeFilters.isApproved !== 'all') {
      filtered = filtered.filter(s => (!!s.isApproved) === (activeFilters.isApproved === 'yes'));
    }
    if (activeFilters.readiness > 0) {
      filtered = filtered.filter(s => calculateReadiness(s) >= activeFilters.readiness);
    }
    if (activeFilters.hasUgChords !== 'all') {
      filtered = filtered.filter(s => (!!s.ug_chords_text && s.ug_chords_text.trim().length > 0) === (activeFilters.hasUgChords === 'yes'));
    }
    if (activeFilters.hasLyrics !== 'all') {
      filtered = filtered.filter(s => (!!s.lyrics && s.lyrics.length > 20) === (activeFilters.hasLyrics === 'yes'));
    }
    if (activeFilters.hasHighestNote !== 'all') {
      filtered = filtered.filter(s => (!!s.highest_note_original) === (activeFilters.hasHighestNote === 'yes'));
    }
    if (activeFilters.hasOriginalKey !== 'all') {
      filtered = filtered.filter(s => (!!s.originalKey && s.originalKey !== 'TBC') === (activeFilters.hasOriginalKey === 'yes'));
    }
    // FIX: Added filters for hasChords, isPlayed, isNotPlayed, genre, bpm, readiness
    if (activeFilters.hasChords !== 'all') {
      filtered = filtered.filter(s => (!!s.ug_chords_text && s.ug_chords_text.trim().length > 0) === (activeFilters.hasChords === 'yes'));
    }
    if (activeFilters.isPlayed !== 'all') {
      filtered = filtered.filter(s => (!!s.isPlayed) === (activeFilters.isPlayed === 'yes'));
    }
    if (activeFilters.isNotPlayed !== 'all') {
      filtered = filtered.filter(s => (!s.isPlayed) === (activeFilters.isNotPlayed === 'yes'));
    }
    if (activeFilters.genre && activeFilters.genre !== 'all') {
      filtered = filtered.filter(s => s.genre?.toLowerCase() === activeFilters.genre?.toLowerCase());
    }
    if (activeFilters.minBpm) {
      filtered = filtered.filter(s => (s.bpm ? parseInt(s.bpm) : 0) >= activeFilters.minBpm!);
    }
    if (activeFilters.maxBpm) {
      filtered = filtered.filter(s => (s.bpm ? parseInt(s.bpm) : 999) <= activeFilters.maxBpm!);
    }
    if (activeFilters.minReadiness) {
      filtered = filtered.filter(s => calculateReadiness(s) >= activeFilters.minReadiness!);
    }
    if (activeFilters.maxReadiness) {
      filtered = filtered.filter(s => calculateReadiness(s) <= activeFilters.maxReadiness!);
    }

    if (sortMode === 'ready') {
      songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    } else if (sortMode === 'work') {
      songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    } else {
      songs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return filtered;
  }, [songs, searchTerm, sortMode, activeFilters, calculateReadiness]);

  return (
    <div className="bg-card p-6 rounded-[2rem] border border-border shadow-lg space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Setlist Songs ({filteredSongs.length})</h2>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
            <Input
              placeholder="Search songs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 pr-8 text-[11px] font-bold bg-secondary border-border text-foreground"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={cn(
              "h-9 px-4 rounded-xl border transition-all",
              isFilterOpen ? "bg-indigo-600 text-white shadow-lg" : "border-border text-muted-foreground hover:bg-accent dark:hover:bg-secondary"
            )}
          >
            <Filter className="w-3.5 h-3.5 mr-2" /> Filters
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => onEdit(songs[0], 'details')} // Placeholder action for quick edit
            className="h-9 px-4 rounded-xl text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold uppercase text-[10px] tracking-widest gap-2 shadow-sm hover:shadow-md transition-all"
          >
            <Edit className="w-3.5 h-3.5" /> Edit
          </Button>
        </div>
      </div>

      {isFilterOpen && (
        <SetlistFilters 
          activeFilters={activeFilters} 
          onFilterChange={(filters) => {
            setActiveFilters(filters as FilterState);
          }} 
        />
      )}

      <ScrollArea className="h-[400px] max-h-[calc(100vh-400px)]">
        <Table>
          <TableHeader className="sticky top-0 bg-secondary z-10">
            <TableRow>
              <TableHead className="w-[40%] text-[10px] font-black uppercase tracking-widest">Song</TableHead>
              <TableHead className="w-[20%] text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Readiness</TableHead>
              <TableHead className="w-[20%] text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-48 text-center">Harmonic Data</TableHead>
              <TableHead className="w-[20%] text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-40 text-right pr-10">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSongs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-20 text-center opacity-30">
                  <Music className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">No songs match your criteria.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredSongs.map((song, index) => {
                const readiness = calculateReadiness(song);
                const isCurrent = currentSongId === song.id;
                const currentPref = song.key_preference || globalKeyPreference;
                const displayOrigKey = formatKey(song.originalKey, currentPref);
                const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref);
                const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
                const isExtractionFailed = song.extraction_status === 'failed';

                return (
                  <TableRow
                    key={song.id}
                    draggable={sortMode === 'manual'}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onDoubleClick={() => onSelect(song)}
                    className={cn(
                      "transition-all group relative",
                      isCurrent ? "border-indigo-500 bg-indigo-900/20 shadow-lg" : "border-border bg-secondary hover:bg-accent",
                      sortMode === 'manual' && 'cursor-grab'
                    )}
                  >
                    <TableCell className="px-6 text-left">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                          <h4 className="text-base font-black tracking-tight leading-none flex items-center gap-2">
                            {song.name}
                            {readiness === 100 && <Check className="w-4 h-4 text-emerald-500" />}
                            {isProcessing && <CloudDownload className="w-4 h-4 text-indigo-500 animate-bounce" />}
                            {isExtractionFailed && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                            {song.artist || "Unknown Artist"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 text-xs text-slate-500 mt-1">
                          {song.originalKey && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{song.originalKey}</Badge>}
                          {song.targetKey && song.targetKey !== song.originalKey && <Badge variant="secondary" className="bg-indigo-700 text-white">Stage: {song.targetKey}</Badge>}
                          {song.bpm && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{song.bpm} BPM</Badge>}
                          {song.duration_seconds && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{formatDuration(song.duration_seconds)}</Badge>}
                          {showHeatmap && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[9px] font-bold",
                                      readiness >= 90 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-indigo-500/20 text-indigo-400 border-indigo-500/50"
                                    )}
                                  >
                                    Readiness: {readiness}%
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-700 text-white border-slate-600">
                                  Calculated readiness score
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {isExtractionFailed && song.last_sync_log && (
                          <p className="text-[8px] text-red-400 mt-1 truncate max-w-[200px]">Error: {song.last_sync_log}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 text-center">
                      <div className="flex flex-col items-center justify-center h-full">
                        <p className={cn(
                          "text-sm font-mono font-black",
                          readiness >= 90 ? "text-emerald-400" : "text-indigo-400"
                        )}>{readiness}%</p>
                        {readiness === 100 && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mt-1" />}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 text-center">
                      <div className="flex items-center justify-center gap-4 h-full">
                        <div className="text-center min-w-[32px]">
                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Orig</p>
                          <span className="text-sm font-mono font-bold text-foreground">{displayOrigKey}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center opacity-30">
                          <ArrowRight className="w-3 h-3 text-muted-foreground mb-0.5" />
                          <div className="h-px w-6 bg-border" />
                        </div>
                        <div className="text-center min-w-[32px] relative">
                          <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Stage</p>
                          <span className="text-sm font-mono font-bold text-indigo-400">{displayTargetKey}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 text-right pr-10">
                      <div className="flex items-center justify-end gap-2 h-full">
                        <SetlistMultiSelector
                          songMasterId={song.master_id || song.id}
                          allSetlists={allSetlists}
                          songToAssign={song}
                          onUpdateSetlistSongs={onUpdateSetlistSongs}
                        />
                        <Button variant="ghost" size="icon" onClick={() => onEdit(song)} className="h-9 w-9 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            setSongToDelete(song);
                            setIsConfirmDeleteOpen(true);
                          }} 
                          className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent className="bg-popover border-border text-foreground rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to remove "{songToDelete?.name}" from this setlist?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-border bg-secondary hover:bg-accent font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveSong} className="rounded-xl bg-destructive hover:bg-destructive/90 text-white font-black uppercase text-[10px] tracking-widest">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SetlistDisplay;
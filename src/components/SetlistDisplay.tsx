"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Music, Search, Edit, Trash2, Play, Pause, ChevronUp, ChevronDown, Settings2, ListMusic, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SetlistSong, UGChordsConfig } from './SetlistManagementModal'; // Import SetlistSong from the renamed modal
import { FilterState } from './SetlistFilters';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  setActiveFilters: (filters: FilterState) => void;
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
  setActiveFilters,
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
    if (activeFilters.hasAudio) {
      filtered = filtered.filter(s => s.audio_url || s.previewUrl);
    }
    if (activeFilters.hasLyrics) {
      filtered = filtered.filter(s => s.lyrics);
    }
    if (activeFilters.hasChords) {
      filtered = filtered.filter(s => s.ug_chords_text);
    }
    if (activeFilters.hasPdf) {
      filtered = filtered.filter(s => s.pdfUrl || s.sheet_music_url);
    }
    if (activeFilters.isReadyToSing) {
      filtered = filtered.filter(s => s.is_ready_to_sing);
    }
    if (activeFilters.isPlayed) {
      filtered = filtered.filter(s => s.isPlayed);
    }
    if (activeFilters.isNotPlayed) {
      filtered = filtered.filter(s => !s.isPlayed);
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

    return filtered;
  }, [songs, searchTerm, activeFilters]);

  return (
    <div className="bg-card p-6 rounded-[2rem] border border-border shadow-lg space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Setlist Songs</h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search songs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 bg-secondary border-border text-xs font-black uppercase tracking-widest rounded-xl w-48"
            icon={<Search className="w-4 h-4 text-muted-foreground" />}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl text-indigo-600 gap-2">
                <ListMusic className="w-4 h-4" /> Sort: {sortMode === 'none' ? 'Default' : sortMode === 'ready' ? 'Ready' : 'Work'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0 bg-card border-border rounded-xl">
              <Command>
                <CommandGroup>
                  <CommandItem onSelect={() => setSortMode('none')} className={cn("cursor-pointer", sortMode === 'none' && "bg-accent text-accent-foreground")}>Default</CommandItem>
                  <CommandItem onSelect={() => setSortMode('ready')} className={cn("cursor-pointer", sortMode === 'ready' && "bg-accent text-accent-foreground")}>Readiness (High to Low)</CommandItem>
                  <CommandItem onSelect={() => setSortMode('work')} className={cn("cursor-pointer", sortMode === 'work' && "bg-accent text-accent-foreground")}>Readiness (Low to High)</CommandItem>
                  <CommandItem onSelect={onOpenSortModal} className="cursor-pointer">Manual Reorder</CommandItem>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => setActiveFilters(prev => ({ ...prev, isOpen: !prev.isOpen }))} className="h-10 px-4 rounded-xl text-indigo-600 gap-2">
            <Settings2 className="w-4 h-4" /> Filters
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[400px] max-h-[calc(100vh-400px)]">
        {filteredSongs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Music className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-bold">No songs found.</p>
            <p className="text-sm">Adjust your search or filters.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredSongs.map((song, index) => {
              const readiness = calculateReadiness(song);
              const isCurrent = currentSongId === song.id;

              return (
                <li
                  key={song.id}
                  draggable={sortMode === 'manual'}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={cn(
                    "group relative p-4 rounded-2xl border transition-all duration-200",
                    isCurrent ? "border-indigo-500 bg-indigo-900/20 shadow-lg" : "border-border bg-secondary hover:bg-accent",
                    sortMode === 'manual' && 'cursor-grab'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="flex-shrink-0 w-6 text-center text-muted-foreground font-mono text-sm opacity-70">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black uppercase tracking-tight truncate leading-tight">
                          {song.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {song.artist}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          {song.originalKey && <Badge variant="outline" className="bg-slate-700 text-slate-300 border-slate-600">{song.originalKey}</Badge>}
                          {song.targetKey && song.targetKey !== song.originalKey && <Badge variant="outline" className="bg-indigo-700 text-white border-indigo-600">Stage: {song.targetKey}</Badge>}
                          {song.bpm && <Badge variant="outline" className="bg-slate-700 text-slate-300 border-slate-600">{song.bpm} BPM</Badge>}
                          {song.duration_seconds && <Badge variant="outline" className="bg-slate-700 text-slate-300 border-slate-600">{formatDuration(song.duration_seconds)}</Badge>}
                          {showHeatmap && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "font-bold",
                                      readiness >= 75 && "bg-emerald-600/20 text-emerald-400 border-emerald-500/50",
                                      readiness >= 50 && readiness < 75 && "bg-yellow-600/20 text-yellow-400 border-yellow-500/50",
                                      readiness < 50 && "bg-red-600/20 text-red-400 border-red-500/50"
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
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => onSelect(song)} className="h-8 w-8 rounded-lg text-indigo-400 hover:bg-indigo-900/30">
                              {isCurrent ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-700 text-white border-slate-600">
                            {isCurrent ? 'Pause' : 'Play'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => onEdit(song)} className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-700 text-white border-slate-600">
                            Edit Song
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSongToDelete(song);
                                setIsConfirmDeleteOpen(true);
                              }}
                              className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-700 text-white border-slate-600">
                            Remove from Setlist
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent className="bg-slate-900 text-white border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to remove "{songToDelete?.name}" from this setlist?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 text-white hover:bg-slate-600 border-slate-600">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveSong} className="bg-red-600 hover:bg-red-700 text-white">
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
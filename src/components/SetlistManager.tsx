"use client";

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Search, X, Plus, Trash2, GripVertical, Check, Loader2, Music, ListMusic, Clock, SlidersHorizontal } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/lib/database.types';
import { formatDuration } from '@/lib/utils';
import { useRepertoire } from '@/hooks/useRepertoire';
import { useSetlist } from '@/hooks/useSetlist';

// Define types based on existing context (assuming these types exist or are inferred)
type Song = Database['public']['Tables']['repertoire']['Row'] & {
  name: string;
  artist: string;
  id: string;
};

type SetlistSong = {
  id: string;
  name: string;
  artist: string;
  originalKey: string | null;
  bpm: string | null;
  durationSeconds: number;
  isConfirmed: boolean;
  isPlayed: boolean;
};

const SetlistManager = ({ initialSetlistId, initialGigId }: { initialSetlistId: string | null, initialGigId: string | null }) => {
  const { repertoire, isLoading: isRepertoireLoading } = useRepertoire();
  const {
    setlistSongs,
    setlist,
    isLoading: isSetlistLoading,
    updateSetlist,
    addSongToSetlist,
    removeSongFromSetlist,
    reorderSongs,
    updateSongInSetlist,
    timeGoal,
    updateTimeGoal,
  } = useSetlist(initialSetlistId);

  const gigId = initialGigId || 'library';
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<SetlistSong | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const totalDurationSeconds = useMemo(() => {
    return setlistSongs.reduce((acc, song) => acc + song.durationSeconds, 0);
  }, [setlistSongs]);

  const filteredMasterRepertoire = useMemo(() => {
    if (!searchTerm) return repertoire;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return repertoire.filter(song =>
      song.title.toLowerCase().includes(lowerCaseSearch) ||
      song.artist.toLowerCase().includes(lowerCaseSearch)
    );
  }, [repertoire, searchTerm]);

  const handleUpdateTimeGoal = useCallback((value: number[]) => {
    if (initialGigId && value[0]) {
      const newGoalMinutes = value[0];
      const newGoalSeconds = newGoalMinutes * 60;
      updateTimeGoal(newGoalSeconds);
    }
  }, [initialGigId, updateTimeGoal]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragIndex !== null) {
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const mouseY = e.clientY;
      const midPoint = rect.top + rect.height / 2;
      
      if (mouseY < midPoint) {
        setDropIndex(parseInt(target.dataset.index || '0'));
      } else {
        setDropIndex(parseInt(target.dataset.index || '0') + 1);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dropIndex === null) return;

    const newSongs = [...setlistSongs];
    const [draggedSong] = newSongs.splice(dragIndex, 1);
    
    let finalDropIndex = dropIndex;
    if (dragIndex < dropIndex) {
        finalDropIndex = dropIndex - 1;
    }

    newSongs.splice(finalDropIndex, 0, draggedSong);
    
    // Since we are using the local state for drag/drop preview, we need to apply the change via API call
    // or update local state and then sync. For now, we prepare for sync.
    setDropIndex(null);
    setDragIndex(null);
    
    // Apply reordering via API call
    handleReorderSongs(newSongs);
  };

  const handleReorderSongs = async (newOrder: SetlistSong[]) => {
    if (!setlist || !updateSetlist) return;
    setIsSaving(true);
    try {
      const sortedSongs = newOrder.map((song, index) => ({
        id: song.id,
        sort_order: index,
      }));

      // Optimistically update local state for better UX
      await updateSetlist({ songs: newOrder });
      
      // In a real scenario, we might need to update individual song sort_order in DB if setlistSongs is complex,
      // but based on existing structure, updating the setlist object might suffice if 'songs' array holds order.
      // Assuming updateSetlist handles the persistence of the array order.
      
      toast({
        title: "Setlist Updated",
        description: "Song order saved successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Error reordering songs:", error);
      toast({
        title: "Error",
        description: "Failed to save song order.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSong = async () => {
    if (!songToDelete || !removeSongFromSetlist) return;
    setIsSaving(true);
    try {
      await removeSongFromSetlist(songToDelete.id);
      toast({
        title: "Song Removed",
        description: `${songToDelete.name} has been removed from the setlist.`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error deleting song:", error);
      toast({
        title: "Error",
        description: "Failed to remove song.",
        variant: "destructive",
      });
    } finally {
      setIsConfirmDeleteOpen(false);
      setSongToDelete(null);
      setIsSaving(false);
    }
  };

  const handleAddNewSong = () => {
    if (filteredMasterRepertoire.length === 0) {
      toast({
        title: "No Songs Found",
        description: "Please adjust your search term or ensure repertoire is loaded.",
        variant: "warning",
      });
      return;
    }
    
    // For simplicity, we add the first filtered song found, or prompt user if multiple exist.
    if (filteredMasterRepertoire.length === 1) {
      const songToAdd = filteredMasterRepertoire[0];
      addSongToSetlist(songToAdd.id, songToAdd.title, songToAdd.artist, songToAdd.original_key, songToAdd.bpm, 1);
      toast({
        title: "Song Added",
        description: `${songToAdd.title} added to setlist.`,
        variant: "success",
      });
    } else {
      // If multiple songs match, we need a way to select one. Since we don't have a selection UI here,
      // we'll just prompt the user to refine search or navigate to library.
      toast({
        title: "Multiple Matches",
        description: "Please refine your search to add a specific track, or go to the library to add manually.",
        variant: "default",
      });
    }
  };

  const handleConfirmTogglePlayed = (song: SetlistSong) => {
    if (!updateSongInSetlist) return;
    const newIsPlayed = !song.isPlayed;
    updateSongInSetlist(song.id, { isPlayed: newIsPlayed });
    toast({
      title: newIsPlayed ? "Marked as Played" : "Marked as Not Played",
      description: `${song.name} status updated.`,
      variant: "default",
    });
  };

  const handleConfirmToggleConfirmed = (song: SetlistSong) => {
    if (!updateSongInSetlist) return;
    const newIsConfirmed = !song.isConfirmed;
    updateSongInSetlist(song.id, { isConfirmed: newIsConfirmed });
    toast({
      title: newIsConfirmed ? "Confirmed" : "Unconfirmed",
      description: `${song.name} confirmation status updated.`,
      variant: "default",
    });
  };

  if (isRepertoireLoading || isSetlistLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-2 text-indigo-500">Loading Setlist Data...</span>
      </div>
    );
  }

  const timeGoalMinutes = Math.floor(timeGoal / 60);

  return (
    <div className="p-4 md:p-8 bg-background min-h-screen font-sans">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-4 border-border">
        <div className="flex items-center gap-3 mb-3 sm:mb-0">
          <ListMusic className="w-6 h-6 text-indigo-500" />
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            {setlist?.name || 'New Setlist'}
          </h1>
          {gigId !== 'library' && (
            <span className="text-xs font-mono bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full">
              GIG: {gigId.substring(0, 6)}...
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="rounded-full border-indigo-500 text-indigo-400 hover:bg-indigo-900/30">
            <SlidersHorizontal className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => { /* Handle Save/Publish logic */ }}
            className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase text-sm tracking-wider shadow-md shadow-indigo-600/30"
          >
            Save & Publish
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Setlist Songs */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-card p-4 rounded-xl shadow-lg border border-slate-800">
            <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
              <Music className="w-5 h-5 text-indigo-400" />
              Setlist Tracks ({setlistSongs.length})
            </h2>
            
            {/* Duration and Goal */}
            <div className="flex items-center justify-between text-sm text-slate-400 mb-4 border-b pb-3 border-slate-700">
              <span>Total Duration: {formatDuration(totalDurationSeconds)}</span>
              {gigId !== 'library' && (
                <div className="flex items-center gap-2 min-w-[150px]">
                  <Label htmlFor="time-goal" className="whitespace-nowrap text-xs">Goal: {timeGoalMinutes} min</Label>
                  <Slider
                    id="time-goal"
                    min={15}
                    max={240}
                    step={15}
                    value={[timeGoalMinutes]}
                    onValueChange={handleUpdateTimeGoal}
                    className="w-[120px]"
                  />
                </div>
              )}
            </div>

            {/* Search and Add */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                <div className="relative flex-1 sm:w-64 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-indigo-500 transition-colors z-10" />
                  <Input
                    placeholder="Search repertoire..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 pl-9 pr-8 text-[11px] font-bold bg-card dark:bg-card border-border dark:border-border rounded-xl focus-visible:ring-indigo-500"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <Button
                onClick={handleAddNewSong}
                disabled={isSaving || filteredMasterRepertoire.length === 0}
                className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-indigo-600/20 disabled:bg-indigo-800/50 disabled:shadow-none transition-all w-full sm:w-auto"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} New Track
              </Button>
            </div>

            {/* Song List */}
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {setlistSongs.length === 0 ? (
                <div className="text-center p-10 text-slate-500 border border-dashed border-slate-700 rounded-lg">
                  <Music className="w-8 h-8 mx-auto mb-2" />
                  <p>Your setlist is empty. Add songs from your repertoire above!</p>
                </div>
              ) : (
                setlistSongs.map((song, index) => (
                  <div
                    key={song.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    data-index={index}
                    className={`flex items-center justify-between p-3 bg-slate-800 rounded-md shadow-sm border border-slate-700 hover:bg-slate-700 transition-colors cursor-grab ${dragIndex === index ? 'opacity-50 border-indigo-500' : ''} active:cursor-grabbing`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{song.name}</p>
                        <p className="text-slate-400 text-xs truncate">{song.artist} | {song.originalKey || 'Key N/A'} | {song.bpm ? `${song.bpm} BPM` : 'BPM N/A'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {/* Confirmation Toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        title={song.isConfirmed ? "Confirmed" : "Needs Confirmation"}
                        onClick={() => handleConfirmToggleConfirmed(song)}
                        className={`w-8 h-8 rounded-full transition-colors ${song.isConfirmed ? 'text-green-400 hover:bg-green-900/30' : 'text-slate-500 hover:text-white'}`}
                      >
                        <Check className="w-4 h-4" />
                      </Button>

                      {/* Played Toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        title={song.isPlayed ? "Mark as Not Played" : "Mark as Played"}
                        onClick={() => handleConfirmTogglePlayed(song)}
                        className={`w-8 h-8 rounded-full transition-colors ${song.isPlayed ? 'text-indigo-400 hover:bg-indigo-900/30' : 'text-slate-500 hover:text-white'}`}
                      >
                        <Clock className="w-4 h-4" />
                      </Button>

                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSongToDelete(song);
                          setIsConfirmDeleteOpen(true);
                        }}
                        className="text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors w-8 h-8 rounded-full"
                        title="Remove from Setlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Repertoire Search */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-card p-4 rounded-xl shadow-lg border border-slate-800 sticky top-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Repertoire Search</Label>
                <span className="text-[9px] font-mono text-muted-foreground">{filteredMasterRepertoire.length} Matches</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-indigo-500 transition-colors z-10" />
                  <Input
                    placeholder="Search repertoire..."
                    className="pl-9 h-10 border-border bg-background focus-visible:ring-indigo-500 text-xs text-foreground"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  title="Clear Search"
                  onClick={() => setSearchTerm("")}
                  className="h-10 w-10 rounded-xl border-border text-muted-foreground hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Reorder Controls (Only visible if setlist songs exist and we are not actively dragging) */}
              {setlistSongs.length > 0 && dragIndex === null && (
                <div className="pt-3 border-t border-slate-800 mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const newSongs = [...setlistSongs];
                      const [draggedSong] = newSongs.splice(dragIndex || 0, 1);
                      newSongs.splice(dropIndex || 0, 0, draggedSong);
                      handleReorderSongs(newSongs);
                    }} 
                    disabled={isSaving || JSON.stringify(setlistSongs) === JSON.stringify(setlistSongs)} // Simplified check, should compare against initial state if needed
                    className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] rounded-lg gap-2 shadow-md disabled:bg-indigo-800/50 transition-all"
                  >
                    <Check className="w-3 h-3" /> Apply Order
                  </Button>
                </div>
              )}
            </div>

            {/* Repertoire List */}
            <div className="mt-4 flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {filteredMasterRepertoire.length === 0 ? (
                <div className="text-center p-6 text-slate-500">
                  <Search className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-xs">No repertoire items match "{searchTerm}".</p>
                </div>
              ) : (
                filteredMasterRepertoire.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium text-white truncate">{song.title}</p>
                      <p className="text-xs text-slate-400 truncate">{song.artist}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addSongToSetlist(song.id, song.title, song.artist, song.original_key, song.bpm, 1)}
                      disabled={isSaving || setlistSongs.some(s => s.id === song.id)}
                      className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:bg-gray-700 disabled:text-gray-400 transition-all"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Deletion */}
      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to remove <span className="font-bold text-white">"{songToDelete?.name || 'this song'}"</span> from the setlist? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDeleteOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteSong} 
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SetlistManager;
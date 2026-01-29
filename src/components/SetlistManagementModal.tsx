"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Loader2, Trash2, Edit, Check, X, Music, Search, ExternalLink, Link as LinkIcon, FileText, Youtube, Apple, Guitar, BookOpen, ScrollText, Sheet, File } from 'lucide-react';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { useSettings } from '@/hooks/use-settings';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import { GripVertical } from 'lucide-react'; // Added missing icon
import { CheckCircle2 } from 'lucide-react'; // Added missing icon
import { SetlistSortModal } from '@/components/SetlistSortModal'; // Added missing import for context
import { RepertoirePicker } from '@/components/RepertoirePicker'; // Added missing import for context
import { SetlistMultiSelector } from '@/components/SetlistMultiSelector'; // Added missing import for context

export type UGChordsConfig = {
  fontSize: number;
  fontFamily: string;
  chordBold: boolean;
  chordColor: string;
  lineSpacing: number;
  textAlign: 'left' | 'center' | 'right';
};

export type SetlistSong = {
  id: string;
  master_id?: string; // The ID of the song in the master repertoire table
  name: string;
  artist: string;
  originalKey?: string;
  targetKey?: string;
  pitch?: number;
  previewUrl?: string;
  youtubeUrl?: string;
  ugUrl?: string;
  appleMusicUrl?: string;
  pdfUrl?: string; // Added pdfUrl
  leadsheetUrl?: string;
  bpm?: string;
  genre?: string;
  isMetadataConfirmed?: boolean;
  isKeyConfirmed?: boolean;
  notes?: string;
  lyrics?: string;
  resources?: { type: string; url: string; label?: string }[];
  user_tags?: string[];
  is_pitch_linked?: boolean;
  duration_seconds?: number;
  key_preference?: string;
  is_active?: boolean;
  isApproved?: boolean;
  preferred_reader?: string;
  ug_chords_text?: string;
  ug_chords_config?: UGChordsConfig;
  is_ug_chords_present?: boolean;
  highest_note_original?: string;
  metadata_source?: string;
  sync_status?: string;
  last_sync_log?: string;
  auto_synced?: boolean;
  is_sheet_verified?: boolean;
  sheet_music_url?: string; // Added sheet_music_url
  extraction_status?: string;
  extraction_error?: string;
  audio_url?: string;
  lyrics_updated_at?: string;
  chords_updated_at?: string;
  ug_link_updated_at?: string;
  highest_note_updated_at?: string;
  original_key_updated_at?: string;
  target_key_updated_at?: string;
  isPlayed?: boolean; // For setlist_songs junction
  tempo?: number; // Added for audio control sync
  volume?: number; // Added for audio control sync
  fineTune?: number; // Added for audio control sync
  is_ready_to_sing?: boolean; // Added for performance status
};

export type Setlist = {
  id: string;
  name: string;
  songs: SetlistSong[];
  time_goal?: number;
};

type SetlistManagementModalProps = {
  gigId: string;
  isOpen: boolean;
  onClose: () => void;
  onSetlistUpdated: (setlist: SetlistSong[]) => void;
  initialSetlistSongs?: SetlistSong[];
  masterRepertoire: SetlistSong[]; // NEW: Accept masterRepertoire as a prop
};

const SetlistManagementModal: React.FC<SetlistManagementModalProps> = ({
  gigId,
  isOpen,
  onClose,
  onSetlistUpdated,
  initialSetlistSongs = [],
  masterRepertoire: masterRepertoireProp, // NEW: Destructure from props
}) => {
  const { user } = useAuth();
  const [setlistName, setSetlistName] = useState('My Setlist');
  const [setlistSongs, setSetlistSongs] = useState<SetlistSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSongToAdd, setSelectedSongToAdd] = useState<SetlistSong | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<SetlistSong | null>(null);
  const [timeGoal, setTimeGoal] = useState(7200); // Default to 2 hours (7200 seconds)
  const { keyPreference: globalKeyPreference } = useSettings();

  const fetchSetlist = useCallback(async () => {
    if (!user) {
      console.log("[SetlistManagementModal/fetchSetlist] ERROR: No user object available. Skipping fetch.");
      setIsLoading(false);
      return;
    }
    if (gigId === 'library') {
      setSetlistSongs(initialSetlistSongs);
      setIsLoading(false);
      console.log("[SetlistManagementModal/fetchSetlist] Library mode. Initial songs count:", initialSetlistSongs.length);
      return;
    }

    setIsLoading(true);
    console.log(`[SetlistManagementModal/fetchSetlist] Fetching setlist for gigId: ${gigId} (User ID: ${user.id})`);
    try {
      console.log("[SetlistManagementModal/fetchSetlist] Querying 'setlists' table...");
      const { data: setlistData, error: setlistError } = await supabase
        .from('setlists')
        .select('name, time_goal')
        .eq('id', gigId)
        .single();

      if (setlistError) {
        console.error("[SetlistManagementModal/fetchSetlist] Error fetching setlist details:", setlistError);
        throw setlistError;
      }
      console.log("[SetlistManagementModal/fetchSetlist] Setlist details data:", setlistData);

      setSetlistName(setlistData?.name || 'My Setlist');
      setTimeGoal(setlistData?.time_goal || 7200);

      console.log("[SetlistManagementModal/fetchSetlist] Querying 'setlist_songs' table...");
      const { data: junctionData, error: junctionError } = await supabase
        .from('setlist_songs')
        .select(`
          id, isPlayed, sort_order,
          repertoire:song_id (
            id, title, artist, original_key, target_key, pitch, preview_url, youtube_url, ug_url, 
            apple_music_url, pdf_url, leadsheet_url, bpm, genre, is_metadata_confirmed, is_key_confirmed, 
            notes, lyrics, resources, user_tags, is_pitch_linked, duration_seconds, key_preference, 
            is_active, is_approved, preferred_reader, ug_chords_text, 
            ug_chords_config, is_ug_chords_present, highest_note_original, 
            metadata_source, sync_status, last_sync_log, auto_synced, is_sheet_verified, sheet_music_url, 
            extraction_status, extraction_error, audio_url, lyrics_updated_at, chords_updated_at, 
            ug_link_updated_at, highest_note_updated_at, original_key_updated_at, target_key_updated_at
          )
        `)
        .eq('setlist_id', gigId)
        .order('sort_order', { ascending: true });

      if (junctionError) {
        console.error("[SetlistManagementModal/fetchSetlist] Error fetching setlist_songs junction data:", junctionError);
        throw junctionError;
      }
      
      console.log(`[SetlistManagementModal/fetchSetlist] Raw junction data received: ${junctionData ? junctionData.length : 0} entries.`, junctionData);

      const songs = (junctionData || []).map((junction: any) => {
        const masterSong = junction.repertoire;
        if (!masterSong) {
          console.warn(`[SetlistManagementModal/fetchSetlist] Song junction ID ${junction.id} references missing repertoire entry, likely due to RLS or deletion. Skipping this song.`);
          return null;
        }
        return {
          id: junction.id, // Use setlist_songs.id for unique identification within the setlist
          master_id: masterSong.id, // Keep repertoire.id as master_id
          name: masterSong.title, // Use title for name
          artist: masterSong.artist, // Use artist
          originalKey: masterSong.original_key,
          targetKey: masterSong.target_key,
          pitch: masterSong.pitch,
          previewUrl: masterSong.preview_url,
          youtubeUrl: masterSong.youtube_url,
          ugUrl: masterSong.ug_url,
          appleMusicUrl: masterSong.apple_music_url,
          pdfUrl: masterSong.pdf_url,
          leadsheetUrl: masterSong.leadsheet_url,
          bpm: masterSong.bpm,
          genre: masterSong.genre,
          isMetadataConfirmed: masterSong.is_metadata_confirmed,
          isKeyConfirmed: masterSong.is_key_confirmed,
          notes: masterSong.notes,
          lyrics: masterSong.lyrics,
          resources: masterSong.resources || [],
          user_tags: masterSong.user_tags || [],
          is_pitch_linked: masterSong.is_pitch_linked,
          duration_seconds: masterSong.duration_seconds,
          key_preference: masterSong.key_preference,
          is_active: masterSong.is_active,
          isApproved: masterSong.is_approved,
          preferred_reader: masterSong.preferred_reader,
          ug_chords_text: masterSong.ug_chords_text,
          ug_chords_config: masterSong.ug_chords_config,
          is_ug_chords_present: masterSong.is_ug_chords_present,
          highest_note_original: masterSong.highest_note_original,
          metadata_source: masterSong.metadata_source,
          sync_status: masterSong.sync_status,
          last_sync_log: masterSong.last_sync_log,
          auto_synced: masterSong.auto_synced,
          is_sheet_verified: masterSong.is_sheet_verified,
          sheet_music_url: masterSong.sheet_music_url,
          extraction_status: masterSong.extraction_status,
          extraction_error: masterSong.extraction_error,
          audio_url: masterSong.audio_url,
          lyrics_updated_at: masterSong.lyrics_updated_at,
          chords_updated_at: masterSong.chords_updated_at,
          ug_link_updated_at: masterSong.ug_link_updated_at,
          highest_note_updated_at: masterSong.highest_note_updated_at,
          original_key_updated_at: masterSong.original_key_updated_at,
          target_key_updated_at: masterSong.target_key_updated_at,
          isPlayed: junction.isPlayed || false,
          tempo: masterSong.tempo, // Added tempo
          volume: masterSong.volume, // Added volume
          fineTune: masterSong.fineTune, // Added fineTune
          is_ready_to_sing: masterSong.is_ready_to_sing, // Added is_ready_to_sing
        };
      }).filter(Boolean) as SetlistSong[];

      setSetlistSongs(songs);
      console.log("[SetlistManagementModal/fetchSetlist] Successfully mapped and loaded setlist songs count:", songs.length, songs);
    } catch (err: any) {
      showError(`Failed to load setlist: ${err.message}`);
      console.error("Error fetching setlist:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, gigId, initialSetlistSongs]);

  useEffect(() => {
    if (isOpen) {
      fetchSetlist();
    }
  }, [isOpen, fetchSetlist]);

  const handleAddSong = async (song: SetlistSong) => {
    if (!user || gigId === 'library') {
      setSetlistSongs(prev => [...prev, { ...song, id: `temp-${Date.now()}` }]);
      setSelectedSongToAdd(null);
      setSearchTerm('');
      showSuccess(`${song.name} added to setlist.`);
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('setlist_songs')
        .insert({
          setlist_id: gigId,
          song_id: song.master_id || song.id,
          sort_order: setlistSongs.length,
        })
        .select()
        .single();

      if (error) throw error;

      const newSetlistSong: SetlistSong = {
        ...song,
        id: data.id, // Use the new junction ID
        master_id: song.master_id || song.id, // Keep the original master ID
      };

      setSetlistSongs(prev => [...prev, newSetlistSong]);
      setSelectedSongToAdd(null);
      setSearchTerm('');
      showSuccess(`${song.name} added to setlist.`);
    } catch (err: any) {
      showError(`Failed to add song: ${err.message}`);
      console.error("Error adding song to setlist:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSong = async () => {
    if (!songToDelete) return;

    if (gigId === 'library') {
      setSetlistSongs(prev => prev.filter(s => s.id !== songToDelete.id));
      showSuccess(`${songToDelete.name} removed from setlist.`);
      setSongToDelete(null);
      setIsConfirmDeleteOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('setlist_songs')
        .delete()
        .eq('id', songToDelete.id);

      if (error) throw error;

      setSetlistSongs(prev => prev.filter(s => s.id !== songToDelete.id));
      showSuccess(`${songToDelete.name} removed from setlist.`);
    } catch (err: any) {
      showError(`Failed to remove song: ${err.message}`);
      console.error("Error removing song from setlist:", err);
    } finally {
      setIsSaving(false);
      setSongToDelete(null);
      setIsConfirmDeleteOpen(false);
    }
  };

  const handleReorderSongs = useCallback(async (newOrder: SetlistSong[]) => {
    setSetlistSongs(newOrder);

    if (gigId === 'library') return; // No backend sync for library mode

    // Debounce or batch updates for performance if many reorders happen quickly
    const updates = newOrder.map((song, index) => ({
      id: song.id,
      sort_order: index,
    }));

    try {
      const { error } = await supabase
        .from('setlist_songs')
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;
      // showSuccess("Setlist order updated."); // Too chatty
    } catch (err: any) {
      showError(`Failed to reorder songs: ${err.message}`);
      console.error("Error reordering songs:", err);
    }
  }, [gigId]);

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
    const newSongs = [...setlistSongs];
    const [draggedSong] = newSongs.splice(dragIndex, 1);
    newSongs.splice(dropIndex, 0, draggedSong);
    handleReorderSongs(newSongs);
  };

  const handleUpdateSetlistName = async () => {
    if (!user || gigId === 'library') return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('setlists')
        .update({ name: setlistName })
        .eq('id', gigId);
      if (error) throw error;
      showSuccess("Setlist name updated.");
    } catch (err: any) {
      showError(`Failed to update setlist name: ${err.message}`);
      console.error("Error updating setlist name:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTimeGoal = async (value: number[]) => {
    const newTimeGoal = value[0] * 60; // Convert minutes to seconds
    setTimeGoal(newTimeGoal);

    if (!user || gigId === 'library') return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('setlists')
        .update({ time_goal: newTimeGoal })
        .eq('id', gigId);
      if (error) throw error;
      showSuccess("Setlist time goal updated.");
    } catch (err: any) {
      showError(`Failed to update time goal: ${err.message}`);
      console.error("Error updating time goal:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalDurationSeconds = useMemo(() => {
    return setlistSongs.reduce((sum, song) => sum + (song.duration_seconds || 0), 0);
  }, [setlistSongs]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const filteredMasterRepertoire = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    
    const filtered = masterRepertoireProp.filter(song => { // UPDATED: Use masterRepertoireProp
      const matchesSearch = !searchTerm || 
        song.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
        song.artist?.toLowerCase().includes(lowerCaseSearchTerm) ||
        song.user_tags?.some(tag => tag.toLowerCase().includes(lowerCaseSearchTerm));

      // Check if the song is already in the current setlist (using master_id for comparison)
      const isInSetlist = setlistSongs.some(setlistSong => setlistSong.master_id === song.id);

      return matchesSearch && !isInSetlist;
    });
    
    if (searchTerm) {
      console.log(`[SetlistManagementModal/filteredMasterRepertoire] Search: "${searchTerm}". Master count: ${masterRepertoireProp.length}. Filtered count: ${filtered.length}.`);
    } else {
      console.log(`[SetlistManagementModal/filteredMasterRepertoire] No search term. Showing all available repertoire. Count: ${filtered.length}.`);
    }
    
    return filtered;
  }, [masterRepertoireProp, searchTerm, setlistSongs]); // UPDATED: Dependency array

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'youtube': return <Youtube className="w-4 h-4 text-red-500" />;
      case 'apple_music': return <Apple className="w-4 h-4 text-pink-500" />;
      case 'ug_link': return <Guitar className="w-4 h-4 text-green-500" />;
      case 'pdf': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'leadsheet': return <Sheet className="w-4 h-4 text-purple-500" />;
      case 'sheet_music': return <BookOpen className="w-4 h-4 text-indigo-500" />;
      case 'lyrics': return <ScrollText className="w-4 h-4 text-yellow-500" />;
      case 'audio': return <Music className="w-4 h-4 text-cyan-500" />;
      default: return <LinkIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  // Find the currently playing song ID from the setlist songs list
  const currentSongId = useMemo(() => {
    const playingSong = setlistSongs.find(s => s.isPlayed);
    return playingSong ? playingSong.id : null;
  }, [setlistSongs]);

  // Placeholder functions needed for JSX context (though they might be defined in parent)
  const onTogglePlayed = (id: string) => {
    const song = setlistSongs.find(s => s.id === id);
    if (song) {
      handleReorderSongs(setlistSongs.map(s => s.id === id ? {...s, isPlayed: !s.isPlayed} : s));
    }
  };
  const onEdit = (song: SetlistSong) => {
    showInfo(`Editing song: ${song.name}. (Requires parent component logic)`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b border-slate-800">
          <DialogTitle className="text-2xl font-bold text-white">
            {gigId === 'library' ? 'Manage Library Songs' : 'Manage Setlist'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {gigId === 'library' ? 'Add, edit, or remove songs from your personal repertoire library.' : 'Add, remove, and reorder songs for your setlist.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Setlist/Library Songs */}
          <div className="w-1/2 border-r border-slate-800 flex flex-col">
            <div className="p-4 border-b border-slate-800">
              {gigId !== 'library' && (
                <Input
                  placeholder="Setlist Name"
                  value={setlistName}
                  onChange={(e) => setSetlistName(e.target.value)}
                  onBlur={handleUpdateSetlistName}
                  className="mb-2 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              )}
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Total Duration: {formatDuration(totalDurationSeconds)}</span>
                {gigId !== 'library' && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="time-goal" className="whitespace-nowrap text-xs">Goal: {Math.floor(timeGoal / 60)} min</Label>
                    <Slider
                      id="time-goal"
                      min={15}
                      max={240}
                      step={15}
                      value={[timeGoal / 60]}
                      onValueChange={handleUpdateTimeGoal}
                      className="w-[120px]"
                    />
                  </div>
                )}
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : setlistSongs.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  <Music className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>{gigId === 'library' ? 'Your library is empty.' : 'Your setlist is empty.'}</p>
                  <p>Add songs from the right panel.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {setlistSongs.map((song, index) => (
                    <li
                      key={song.id}
                      draggable={gigId !== 'library'}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      className={cn(
                        "relative p-3 rounded-lg shadow-sm border",
                        song.id === currentSongId ? "border-indigo-500 bg-indigo-900/20" : "border-slate-700 bg-slate-800 hover:bg-slate-700",
                        gigId !== 'library' && 'cursor-grab'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {gigId !== 'library' && (
                            <GripVertical className="w-4 h-4 text-slate-500 shrink-0 cursor-grab" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{song.name}</p>
                            <p className="text-slate-400 text-sm truncate">{song.artist}</p>
                            <div className="flex flex-wrap gap-1 text-xs text-slate-500 mt-1">
                              {song.originalKey && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{song.originalKey}</Badge>}
                              {song.targetKey && song.targetKey !== song.originalKey && <Badge variant="secondary" className="bg-indigo-700 text-white">Stage: {song.targetKey}</Badge>}
                              {song.bpm && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{song.bpm} BPM</Badge>}
                              {song.duration_seconds && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{formatDuration(song.duration_seconds)}</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-4 shrink-0">
                          {gigId !== 'library' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => onTogglePlayed(song.id)} className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-700">
                                    <CheckCircle2 className={cn("w-4 h-4", song.isPlayed ? "text-emerald-500" : "text-slate-600")} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-700 text-white border-slate-600 text-[10px] uppercase">
                                  {song.isPlayed ? 'Mark Unplayed' : 'Mark Played'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(song)}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-700"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSongToDelete(song);
                              setIsConfirmDeleteOpen(true);
                            }}
                            className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-900/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Right Panel: Master Repertoire Search */}
          <div className="w-1/2 flex flex-col">
            <div className="p-4 border-b border-slate-800">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search master repertoire..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 bg-secondary border-border text-xs font-black uppercase tracking-widest rounded-xl"
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Master Library ({masterRepertoire.length})
                </p>
                <Button variant="outline" size="sm" onClick={() => setIsRepertoirePickerOpen(true)} className="h-8 px-3 rounded-lg text-indigo-600 gap-1.5">
                  <Plus className="w-3 h-3" /> Add From Master
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              {filteredMasterRepertoire.length === 0 && searchTerm ? (
                <p className="text-center text-slate-500 py-8">No songs found matching "{searchTerm}".</p>
              ) : filteredMasterRepertoire.length === 0 && !searchTerm ? (
                <p className="text-center text-slate-500 py-8">Start typing to search your repertoire.</p>
              ) : (
                <ul className="space-y-2">
                  {filteredMasterRepertoire.map((song) => (
                    <li
                      key={song.id}
                      className="flex items-center justify-between p-3 bg-secondary rounded-md shadow-sm border border-border hover:border-indigo-500/50 transition-all"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{song.name}</p>
                          <p className="text-slate-400 text-sm truncate">{song.artist || "Unknown Artist"}</p>
                          <div className="flex flex-wrap gap-1 text-xs text-slate-500 mt-1">
                            {song.originalKey && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{song.originalKey}</Badge>}
                            {song.bpm && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{song.bpm} BPM</Badge>}
                            <Badge variant="secondary" className={cn("text-xs", calculateReadiness(song) >= 90 ? "bg-emerald-700 text-white" : "bg-indigo-700 text-white")}>
                              {calculateReadiness(song)}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAddSong(song)}
                        disabled={isSaving}
                        className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/30 ml-4"
                      >
                        <PlusCircle className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

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
    </Dialog>
  );
};

export default SetlistDisplay;
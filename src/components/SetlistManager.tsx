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
};

type SetlistManagerProps = {
  gigId: string;
  isOpen: boolean;
  onClose: () => void;
  onSetlistUpdated: (setlist: SetlistSong[]) => void;
  initialSetlistSongs?: SetlistSong[];
};

const SetlistManager: React.FC<SetlistManagerProps> = ({
  gigId,
  isOpen,
  onClose,
  onSetlistUpdated,
  initialSetlistSongs = [],
}) => {
  const { user } = useAuth();
  const [setlistName, setSetlistName] = useState('My Setlist');
  const [setlistSongs, setSetlistSongs] = useState<SetlistSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSongToAdd, setSelectedSongToAdd] = useState<SetlistSong | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<SetlistSong | null>(null);
  const [timeGoal, setTimeGoal] = useState(7200); // Default to 2 hours (7200 seconds)
  const { keyPreference: globalKeyPreference } = useSettings();

  const fetchSetlist = useCallback(async () => {
    if (!user || gigId === 'library') {
      setSetlistSongs(initialSetlistSongs);
      setIsLoading(false);
      console.log("[SetlistManager/fetchSetlist] Library mode or no user. Initial songs count:", initialSetlistSongs.length);
      return;
    }

    setIsLoading(true);
    console.log(`[SetlistManager/fetchSetlist] Fetching setlist for gigId: ${gigId}`);
    try {
      const { data: setlistData, error: setlistError } = await supabase
        .from('setlists')
        .select('name, time_goal')
        .eq('id', gigId)
        .single();

      if (setlistError) throw setlistError;

      setSetlistName(setlistData?.name || 'My Setlist');
      setTimeGoal(setlistData?.time_goal || 7200);

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

      if (junctionError) throw junctionError;

      const songs = (junctionData || []).map((junction: any) => {
        const masterSong = junction.repertoire;
        if (!masterSong) {
          console.warn(`[SetlistManager/fetchSetlist] Song junction ID ${junction.id} references missing repertoire entry.`);
          return null;
        }
        return {
          ...masterSong,
          id: junction.id, // Use setlist_songs.id for unique identification within the setlist
          master_id: masterSong.id, // Keep repertoire.id as master_id
          name: masterSong.title, // Override name with repertoire title
          artist: masterSong.artist, // Ensure artist is mapped
          originalKey: masterSong.original_key,
          targetKey: masterSong.target_key,
          pitch: masterSong.pitch,
          previewUrl: masterSong.preview_url,
          youtubeUrl: masterSong.youtube_url,
          ugUrl: masterSong.ug_url,
          appleMusicUrl: masterSong.apple_music_url,
          pdfUrl: masterSong.pdf_url, // Ensure pdfUrl is mapped
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
          sheet_music_url: masterSong.sheet_music_url, // Ensure sheet_music_url is mapped
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
        };
      }).filter(Boolean) as SetlistSong[];

      setSetlistSongs(songs);
      console.log("[SetlistManager/fetchSetlist] Successfully loaded setlist songs count:", songs.length);
    } catch (err: any) {
      showError(`Failed to load setlist: ${err.message}`);
      console.error("Error fetching setlist:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, gigId, initialSetlistSongs]);

  const fetchMasterRepertoire = useCallback(async () => {
    if (!user) return;
    console.log("[SetlistManager/fetchMasterRepertoire] Fetching master repertoire...");
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title');
      if (error) throw error;
      const mappedRepertoire = data.map((d: any) => ({
        id: d.id,
        master_id: d.id,
        name: d.title,
        artist: d.artist,
        originalKey: d.original_key ?? 'TBC',
        targetKey: d.target_key ?? d.original_key ?? 'TBC',
        pitch: d.pitch ?? 0,
        previewUrl: d.preview_url,
        youtubeUrl: d.youtube_url,
        ugUrl: d.ug_url,
        appleMusicUrl: d.apple_music_url,
        pdfUrl: d.pdf_url,
        leadsheetUrl: d.leadsheet_url,
        bpm: d.bpm,
        genre: d.genre,
        isMetadataConfirmed: d.is_metadata_confirmed,
        isKeyConfirmed: d.is_key_confirmed,
        notes: d.notes,
        lyrics: d.lyrics,
        resources: d.resources || [],
        user_tags: d.user_tags || [],
        is_pitch_linked: d.is_pitch_linked ?? true,
        duration_seconds: d.duration_seconds,
        key_preference: d.key_preference,
        is_active: d.is_active,
        isApproved: d.is_approved,
        preferred_reader: d.preferred_reader,
        ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: d.is_ug_chords_present,
        highest_note_original: d.highest_note_original,
        metadata_source: d.metadata_source,
        sync_status: d.sync_status,
        last_sync_log: d.last_sync_log,
        auto_synced: d.auto_synced,
        is_sheet_verified: d.is_sheet_verified,
        sheet_music_url: d.sheet_music_url,
        extraction_status: d.extraction_status,
        extraction_error: d.extraction_error,
        audio_url: d.audio_url,
        lyrics_updated_at: d.lyrics_updated_at,
        chords_updated_at: d.chords_updated_at,
        ug_link_updated_at: d.ug_link_updated_at,
        highest_note_updated_at: d.highest_note_updated_at,
        original_key_updated_at: d.original_key_updated_at,
        target_key_updated_at: d.target_key_updated_at,
      })));
      setMasterRepertoire(mappedRepertoire);
      console.log("[SetlistManager/fetchMasterRepertoire] Successfully loaded master repertoire songs count:", mappedRepertoire.length);
    } catch (err: any) {
      showError(`Failed to load repertoire: ${err.message}`);
      console.error("Error fetching master repertoire:", err);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      fetchSetlist();
      fetchMasterRepertoire();
    }
  }, [isOpen, fetchSetlist, fetchMasterRepertoire]);

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
    const filtered = masterRepertoire.filter(song =>
      (song.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
        song.artist?.toLowerCase().includes(lowerCaseSearchTerm)) &&
      !setlistSongs.some(setlistSong => setlistSong.master_id === song.id)
    );
    
    if (searchTerm) {
      console.log(`[SetlistManager/filteredMasterRepertoire] Search: "${searchTerm}". Master count: ${masterRepertoire.length}. Filtered count: ${filtered.length}.`);
    }
    
    if (!searchTerm) return [];
    return filtered;
  }, [masterRepertoire, searchTerm, setlistSongs]);

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
                    <Label htmlFor="time-goal" className="whitespace-nowrap">Goal: {Math.floor(timeGoal / 60)} min</Label>
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
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      className="flex items-center justify-between p-3 bg-slate-800 rounded-md shadow-sm border border-slate-700 hover:bg-slate-700 transition-colors cursor-grab"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{song.name}</p>
                        <p className="text-slate-400 text-sm truncate">{song.artist}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          {song.originalKey && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{song.originalKey}</Badge>}
                          {song.targetKey && song.targetKey !== song.originalKey && <Badge variant="secondary" className="bg-indigo-700 text-white">Stage: {song.targetKey}</Badge>}
                          {song.bpm && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{song.bpm} BPM</Badge>}
                          {song.duration_seconds && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{formatDuration(song.duration_seconds)}</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {gigId !== 'library' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Checkbox
                                  checked={song.isPlayed}
                                  onCheckedChange={async (checked) => {
                                    const newSetlistSongs = setlistSongs.map(s =>
                                      s.id === song.id ? { ...s, isPlayed: checked as boolean } : s
                                    );
                                    setSetlistSongs(newSetlistSongs);
                                    try {
                                      await supabase.from('setlist_songs').update({ isPlayed: checked }).eq('id', song.id);
                                    } catch (err) {
                                      showError("Failed to update song played status.");
                                      console.error("Error updating isPlayed status:", err);
                                    }
                                  }}
                                  className="data-[state=checked]:bg-indigo-500 data-[state=checked]:text-white border-slate-600"
                                />
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-700 text-white border-slate-600">
                                Mark as Played
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSongToDelete(song);
                            setIsConfirmDeleteOpen(true);
                          }}
                          className="text-slate-400 hover:text-red-500 hover:bg-slate-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* Right Panel: Repertoire Search */}
          <div className="w-1/2 flex flex-col">
            <div className="p-4 border-b border-slate-800">
              <Input
                placeholder="Search repertoire..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                icon={<Search className="w-4 h-4 text-slate-500" />}
              />
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
                      className="flex items-center justify-between p-3 bg-slate-800 rounded-md shadow-sm border border-slate-700"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{song.name}</p>
                        <p className="text-slate-400 text-sm truncate">{song.artist}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          {song.originalKey && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{song.originalKey}</Badge>}
                          {song.bpm && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{song.bpm} BPM</Badge>}
                          {song.duration_seconds && <Badge variant="secondary" className="bg-slate-700 text-slate-300">{formatDuration(song.duration_seconds)}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {song.pdfUrl && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="bg-blue-900/30 text-blue-300 border-blue-800">
                                    <FileText className="w-3 h-3 mr-1" /> PDF
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-700 text-white border-slate-600">
                                  PDF available
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {song.sheet_music_url && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="bg-indigo-900/30 text-indigo-300 border-indigo-800">
                                    <BookOpen className="w-3 h-3 mr-1" /> Sheet Music
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-700 text-white border-slate-600">
                                  Sheet Music Link available
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {song.ug_chords_text && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="bg-green-900/30 text-green-300 border-green-800">
                                    <Guitar className="w-3 h-3 mr-1" /> UG Chords
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-700 text-white border-slate-600">
                                  Ultimate Guitar Chords available
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {song.leadsheetUrl && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="bg-purple-900/30 text-purple-300 border-purple-800">
                                    <Sheet className="w-3 h-3 mr-1" /> Leadsheet
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-700 text-white border-slate-600">
                                  Leadsheet available
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAddSong(song)}
                        disabled={isSaving}
                        className="text-slate-400 hover:text-green-500 hover:bg-slate-700 ml-4"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-slate-800">
          <Button variant="secondary" onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent className="bg-slate-900 text-white border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              Are you sure you want to remove "{songToDelete?.name}" from this {gigId === 'library' ? 'library' : 'setlist'}?
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
    </Dialog>
  );
};

export default SetlistManager;
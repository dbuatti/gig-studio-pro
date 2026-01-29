"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Minus, Search, GripVertical, X, Check, Music, ListMusic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showSuccess, showError } from '@/utils/toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useAuth } from '@/components/AuthProvider';

// Define the SetlistSong and Setlist interfaces
export interface SetlistSong {
  id: string; // This is the setlist_songs.id when in a setlist, or repertoire.id when in master repertoire
  master_id: string; // This is always the repertoire.id
  name: string;
  artist?: string;
  originalKey?: string;
  targetKey?: string;
  pitch?: number;
  previewUrl?: string;
  youtubeUrl?: string;
  ugUrl?: string;
  appleMusicUrl?: string;
  pdfUrl?: string;
  leadsheetUrl?: string;
  bpm?: string;
  genre?: string;
  isSyncing?: boolean;
  isMetadataConfirmed?: boolean;
  isKeyConfirmed?: boolean;
  notes?: string;
  lyrics?: string;
  resources?: any[];
  user_tags?: string[];
  is_pitch_linked?: boolean;
  duration_seconds?: number;
  key_preference?: string;
  is_active?: boolean;
  fineTune?: number;
  tempo?: number;
  volume?: number;
  isApproved?: boolean;
  is_ready_to_sing?: boolean;
  preferred_reader?: string;
  ug_chords_text?: string;
  ug_chords_config?: any;
  is_ug_chords_present?: boolean;
  highest_note_original?: string;
  metadata_source?: string;
  sync_status?: string;
  last_sync_log?: string;
  auto_synced?: boolean;
  is_sheet_verified?: boolean;
  sheet_music_url?: string;
  extraction_status?: string;
  extraction_error?: string;
  audio_url?: string;
  lyrics_updated_at?: string;
  chords_updated_at?: string;
  ug_link_updated_at?: string;
  highest_note_updated_at?: string;
  original_key_updated_at?: string;
  target_key_updated_at?: string;
  pdf_updated_at?: string;
  isPlayed?: boolean; // Specific to setlist_songs
}

export interface Setlist {
  id: string;
  name: string;
  songs: SetlistSong[];
  time_goal?: number;
}

interface SetlistManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  gigId: string;
  onSetlistUpdated: () => void;
  masterRepertoire: SetlistSong[];
}

interface SortableItemProps {
  song: SetlistSong;
  onRemove: (setlistSongId: string) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ song, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-3 bg-background rounded-xl border border-border shadow-sm",
        isDragging && "ring-2 ring-indigo-500 ring-offset-2 ring-offset-card"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:bg-accent cursor-grab"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate text-foreground">{song.name}</p>
          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:bg-destructive/10"
        onClick={() => onRemove(song.id)}
      >
        <Minus className="w-4 h-4" />
      </Button>
    </div>
  );
};

const SetlistManagementModal: React.FC<SetlistManagementModalProps> = ({
  isOpen,
  onClose,
  gigId,
  onSetlistUpdated,
  masterRepertoire,
}) => {
  const { user } = useAuth();
  const [currentSetlistSongs, setCurrentSetlistSongs] = useState<SetlistSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchCurrentSetlistSongs = useCallback(async () => {
    if (!gigId) return;
    setLoading(true);
    try {
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

      const songs: SetlistSong[] = (junctionData || []).map((junction: any) => {
        const masterSong = junction.repertoire;
        if (!masterSong) return null;
        return {
          ...masterSong,
          id: junction.id, // Use setlist_songs.id for unique identification within the setlist
          master_id: masterSong.id, // Keep repertoire.id as master_id
          name: masterSong.title,
          isPlayed: junction.isPlayed || false,
          ug_chords_config: masterSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        };
      }).filter(Boolean) as SetlistSong[];
      setCurrentSetlistSongs(songs);
    } catch (err: any) {
      showError(`Failed to load setlist songs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [gigId]);

  useEffect(() => {
    if (isOpen) {
      fetchCurrentSetlistSongs();
    }
  }, [isOpen, fetchCurrentSetlistSongs]);

  const availableSongs = useMemo(() => {
    const currentSongMasterIds = new Set(currentSetlistSongs.map(s => s.master_id));
    return masterRepertoire.filter(song =>
      !currentSongMasterIds.has(song.id) &&
      (song.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       song.artist?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [masterRepertoire, currentSetlistSongs, searchTerm]);

  const handleAddSong = async (song: SetlistSong) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('setlist_songs')
        .insert({ setlist_id: gigId, song_id: song.master_id || song.id, sort_order: currentSetlistSongs.length });
      if (error) throw error;
      showSuccess(`Added "${song.name}" to setlist!`);
      await fetchCurrentSetlistSongs();
      onSetlistUpdated();
    } catch (err: any) {
      showError(`Failed to add song: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSong = async (setlistSongId: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('setlist_songs')
        .delete()
        .eq('id', setlistSongId)
        .eq('setlist_id', gigId);
      if (error) throw error;
      showSuccess(`Removed song from setlist.`);
      await fetchCurrentSetlistSongs();
      onSetlistUpdated();
    } catch (err: any) {
      showError(`Failed to remove song: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id === over?.id) return;

    const oldIndex = currentSetlistSongs.findIndex(song => song.id === active.id);
    const newIndex = currentSetlistSongs.findIndex(song => song.id === over?.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = Array.from(currentSetlistSongs);
    const [movedSong] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, movedSong);

    setCurrentSetlistSongs(newOrder); // Optimistic update

    setIsSaving(true);
    try {
      const updates = newOrder.map((song, index) => ({
        id: song.id,
        sort_order: index,
      }));

      const { error } = await supabase
        .from('setlist_songs')
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;
      showSuccess("Setlist reordered!");
      onSetlistUpdated();
    } catch (err: any) {
      showError(`Failed to reorder setlist: ${err.message}`);
      // Revert optimistic update on error
      fetchCurrentSetlistSongs();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 bg-card border-border overflow-hidden rounded-[2rem] shadow-2xl flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between p-6 border-b border-border bg-secondary shrink-0">
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
            <ListMusic className="w-6 h-6 text-indigo-600" /> Manage Setlist
            {isSaving && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 p-0 text-muted-foreground hover:text-foreground">
            <X className="w-6 h-6" />
          </Button>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-2 gap-6 p-6 overflow-hidden">
          {/* Current Setlist Songs */}
          <div className="flex flex-col bg-background rounded-2xl border border-border shadow-inner overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary">
              <h3 className="text-sm font-black uppercase tracking-tight text-foreground">
                Current Setlist ({currentSetlistSongs.length})
              </h3>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
            </div>
            <ScrollArea className="flex-1 p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : currentSetlistSongs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                  <Music className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">No songs in this setlist yet.</p>
                  <p className="text-xs">Add some from the right panel!</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={currentSetlistSongs.map(song => song.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {currentSetlistSongs.map((song) => (
                        <SortableItem key={song.id} song={song} onRemove={handleRemoveSong} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </ScrollArea>
          </div>

          {/* Available Songs */}
          <div className="flex flex-col bg-background rounded-2xl border border-border shadow-inner overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary">
              <h3 className="text-sm font-black uppercase tracking-tight text-foreground">
                Available Songs ({availableSongs.length})
              </h3>
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search songs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs bg-card border-border"
                />
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              {availableSongs.length === 0 && searchTerm ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                  <Search className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">No matching songs found.</p>
                </div>
              ) : availableSongs.length === 0 && !searchTerm ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
                  <Music className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">All songs are already in the setlist!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableSongs.map((song) => (
                    <div key={song.id} className="flex items-center justify-between p-3 bg-card rounded-xl border border-border shadow-sm">
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate text-foreground">{song.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-indigo-600 hover:bg-indigo-600/10"
                        onClick={() => handleAddSong(song)}
                        disabled={isSaving}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SetlistManagementModal;
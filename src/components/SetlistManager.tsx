"use client";

import React from 'react';
import { 
  GripVertical, MoreVertical, Music, Play, Edit3, Trash2, 
  CheckCircle2, AlertCircle, Clock, Zap, Hash
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calculateReadiness } from '@/utils/repertoireSync';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export interface SetlistSong {
  id: string;
  master_id?: string;
  name: string;
  artist?: string;
  originalKey?: string;
  targetKey?: string;
  pitch?: number;
  previewUrl?: string;
  audio_url?: string;
  youtubeUrl?: string;
  ugUrl?: string;
  pdfUrl?: string;
  leadsheetUrl?: string;
  sheet_music_url?: string;
  bpm?: string;
  genre?: string;
  isPlayed?: boolean;
  isKeyConfirmed?: boolean;
  isApproved?: boolean;
  isMetadataConfirmed?: boolean;
  energy_level?: 'Peak' | 'Groove' | 'Pulse' | 'Ambient';
  lyrics?: string;
  notes?: string;
  user_tags?: string[];
  resources?: any[];
  duration_seconds?: number;
  [key: string]: any;
}

export interface Setlist {
  id: string;
  name: string;
  songs: SetlistSong[];
  time_goal?: number;
}

interface SetlistManagerProps {
  songs: SetlistSong[];
  onSelect: (song: SetlistSong) => void;
  onEdit: (song: SetlistSong, tab?: any) => void;
  onUpdateKey: (id: string, key: string) => Promise<void>;
  currentSongId?: string;
  onRemove: (id: string) => Promise<void>;
  onTogglePlayed: (id: string) => Promise<void>;
  onReorder: (songs: SetlistSong[]) => Promise<void>;
  [key: string]: any;
}

const SetlistManager: React.FC<SetlistManagerProps> = ({
  songs,
  onSelect,
  onEdit,
  onUpdateKey,
  currentSongId,
  onRemove,
  onTogglePlayed,
  onReorder,
}) => {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(songs);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    onReorder(items);
  };

  const getReadinessColor = (score: number) => {
    if (score >= 90) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (score >= 70) return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    if (score >= 40) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-red-500 bg-red-500/10 border-red-500/20";
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="setlist-songs">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {songs.map((song, index) => {
                const readiness = calculateReadiness(song);
                const isActive = currentSongId === song.id;

                return (
                  <Draggable key={song.id} draggableId={song.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "group relative flex items-center gap-4 p-4 bg-card border border-border rounded-2xl transition-all duration-200",
                          isActive && "ring-2 ring-indigo-500 bg-indigo-500/5 border-indigo-500/50",
                          snapshot.isDragging && "shadow-2xl scale-[1.02] z-50 bg-card/90 backdrop-blur-sm"
                        )}
                      >
                        <div {...provided.dragHandleProps} className="text-muted-foreground/30 hover:text-indigo-500 transition-colors">
                          <GripVertical className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0 flex items-center gap-4">
                          <div className="flex flex-col">
                            <h4 className={cn(
                              "text-sm font-black uppercase tracking-tight truncate",
                              song.isPlayed && "line-through opacity-50"
                            )}>
                              {song.name}
                            </h4>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
                              {song.artist || "Unknown Artist"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 shrink-0">
                          {/* Readiness Indicator */}
                          <div className="flex flex-col items-end gap-1.5 w-24">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ready</span>
                              <span className={cn("text-[10px] font-black", readiness >= 90 ? "text-emerald-500" : readiness >= 70 ? "text-blue-500" : "text-amber-500")}>
                                {readiness}%
                              </span>
                            </div>
                            <Progress value={readiness} className="h-1 bg-slate-800" />
                          </div>

                          {/* Energy Zone */}
                          {song.energy_level && (
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border-none",
                              song.energy_level === 'Peak' && "bg-red-500/10 text-red-500",
                              song.energy_level === 'Groove' && "bg-amber-500/10 text-amber-500",
                              song.energy_level === 'Pulse' && "bg-emerald-500/10 text-emerald-500",
                              song.energy_level === 'Ambient' && "bg-blue-500/10 text-blue-500"
                            )}>
                              {song.energy_level}
                            </Badge>
                          )}

                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => onSelect(song)}
                              className={cn("h-9 w-9 rounded-xl", isActive ? "text-indigo-500 bg-indigo-500/10" : "text-muted-foreground hover:text-indigo-500")}
                            >
                              <Play className="w-4 h-4 fill-current" />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl bg-slate-900 border-white/10">
                                <DropdownMenuItem onClick={() => onEdit(song)} className="gap-2 font-bold uppercase text-[10px] tracking-widest">
                                  <Edit3 className="w-3.5 h-3.5" /> Edit Studio
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onTogglePlayed(song.id)} className="gap-2 font-bold uppercase text-[10px] tracking-widest">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {song.isPlayed ? "Mark Unplayed" : "Mark Played"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onRemove(song.id)} className="gap-2 font-bold uppercase text-[10px] tracking-widest text-red-500 focus:text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" /> Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default SetlistManager;
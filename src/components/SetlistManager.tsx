"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListMusic, Trash2, Play, GripVertical, Music, Youtube, ArrowRight, CheckCircle2, Circle, Link2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_KEYS } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

export interface SetlistSong {
  id: string;
  name: string;
  previewUrl: string;
  youtubeUrl?: string;
  originalKey?: string;
  targetKey?: string;
  pitch: number;
  isPlayed?: boolean;
}

interface SetlistManagerProps {
  songs: SetlistSong[];
  onRemove: (id: string) => void;
  onSelect: (song: SetlistSong) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onTogglePlayed: (id: string) => void;
  onLinkAudio: (songName: string) => void;
  currentSongId?: string;
}

const SetlistManager: React.FC<SetlistManagerProps> = ({ 
  songs, 
  onRemove, 
  onSelect, 
  onUpdateKey, 
  onTogglePlayed,
  onLinkAudio,
  currentSongId 
}) => {
  const playedCount = songs.filter(s => s.isPlayed).length;

  return (
    <Card className="h-full border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-indigo-600" />
            Setlist / Gig Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] border-green-200 text-green-600 bg-green-50">
              {playedCount}/{songs.length} PLAYED
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[550px]">
          {songs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-6 text-center">
              <Music className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-xs uppercase font-bold tracking-tighter">Your setlist is empty</p>
              <p className="text-[10px] mt-1">Paste a table or search for songs to build your gig.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {songs.map((song) => {
                const isSelected = currentSongId === song.id;
                const needsAudio = !song.previewUrl;
                
                return (
                  <div 
                    key={song.id}
                    className={cn(
                      "group flex flex-col p-3 transition-all",
                      isSelected ? "bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-l-indigo-600 shadow-sm" : "hover:bg-slate-50 dark:hover:bg-slate-900",
                      song.isPlayed && !isSelected && "opacity-60 grayscale-[0.5]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={song.isPlayed} 
                          onCheckedChange={() => onTogglePlayed(song.id)}
                          className="h-4 w-4 rounded-full border-slate-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(song)}>
                        <p className={cn(
                          "text-xs font-bold truncate leading-none mb-1 transition-all",
                          song.isPlayed && "line-through text-slate-400 decoration-slate-300",
                          needsAudio && "text-amber-600"
                        )}>
                          {song.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono border-indigo-200 text-indigo-600">
                            {song.pitch > 0 ? `+${song.pitch}` : song.pitch} ST
                          </Badge>
                          {song.youtubeUrl && <Youtube className="w-3 h-3 text-red-500 opacity-60" />}
                          {needsAudio && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); onLinkAudio(song.name); }}
                              className="flex items-center gap-1 text-[8px] font-black text-amber-600 uppercase hover:text-amber-700 transition-colors"
                            >
                              <Link2 className="w-2.5 h-2.5" /> Link Engine
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => onRemove(song.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn(
                            "h-8 w-8 rounded-full transition-all",
                            needsAudio ? "text-slate-300 cursor-not-allowed" : "text-indigo-600 hover:bg-indigo-50"
                          )}
                          disabled={needsAudio}
                          onClick={() => onSelect(song)}
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 pl-7 flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border rounded-md px-1.5 py-0.5 shadow-sm">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Orig</span>
                        <span className="text-[10px] font-mono font-bold text-slate-600">{song.originalKey || "—"}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <div className="flex-1">
                        <Select 
                          value={song.targetKey} 
                          onValueChange={(val) => onUpdateKey(song.id, val)}
                        >
                          <SelectTrigger className="h-6 text-[10px] py-0 px-2 font-bold font-mono border-indigo-100 bg-indigo-50/30 text-indigo-600">
                            <SelectValue placeholder="Key" />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_KEYS.map(k => (
                              <SelectItem key={k} value={k} className="text-[10px] font-mono">{k}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default SetlistManager;
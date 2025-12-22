"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListMusic, Trash2, Play, GripVertical, Music, Youtube, ArrowRight } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_KEYS } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";

export interface SetlistSong {
  id: string;
  name: string;
  previewUrl: string;
  youtubeUrl?: string;
  originalKey?: string;
  targetKey?: string;
  pitch: number;
}

interface SetlistManagerProps {
  songs: SetlistSong[];
  onRemove: (id: string) => void;
  onSelect: (song: SetlistSong) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  currentSongId?: string;
}

const SetlistManager: React.FC<SetlistManagerProps> = ({ songs, onRemove, onSelect, onUpdateKey, currentSongId }) => {
  return (
    <Card className="h-full border-slate-200 dark:border-slate-800 shadow-lg">
      <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-indigo-600" />
            Setlist / Gig Log
          </CardTitle>
          <Badge variant="secondary" className="font-mono">{songs.length} SONGS</Badge>
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
                    className={`group flex flex-col p-3 transition-colors ${
                      isSelected 
                        ? "bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-l-indigo-600" 
                        : "hover:bg-slate-50 dark:hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-400 shrink-0 cursor-grab" />
                      
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(song)}>
                        <p className={cn(
                          "text-xs font-bold truncate leading-none mb-1",
                          needsAudio && "text-slate-400"
                        )}>
                          {song.name}
                          {needsAudio && <span className="ml-2 text-[8px] uppercase font-black text-amber-500 bg-amber-50 px-1 rounded">Metadata Only</span>}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono border-indigo-200 text-indigo-600">
                            {song.pitch > 0 ? `+${song.pitch}` : song.pitch} ST
                          </Badge>
                          {song.youtubeUrl && <Youtube className="w-3 h-3 text-red-500 opacity-60" />}
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
                          className="h-8 w-8 rounded-full text-indigo-600 hover:bg-indigo-50"
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
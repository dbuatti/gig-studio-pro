"use client";

import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListMusic, Trash2, Play, Music, Youtube, ArrowRight, Link2, CheckCircle2, CircleDashed, Copy, Upload, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_KEYS } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

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
  onUpdateSong: (id: string, updates: Partial<SetlistSong>) => void;
  currentSongId?: string;
}

const SetlistManager: React.FC<SetlistManagerProps> = ({ 
  songs, 
  onRemove, 
  onSelect, 
  onUpdateKey, 
  onTogglePlayed,
  onLinkAudio,
  onUpdateSong,
  currentSongId 
}) => {
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyAllLinks = () => {
    const links = songs.map(s => s.youtubeUrl).filter(Boolean).join('\n');
    if (!links) {
      showError("No YouTube links found in this setlist.");
      return;
    }
    navigator.clipboard.writeText(links);
    showSuccess("All YouTube links copied to clipboard!");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, songId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(songId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${songId}-${Math.random()}.${fileExt}`;
      const filePath = `tracks/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('audio_tracks')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('audio_tracks')
        .getPublicUrl(filePath);

      onUpdateSong(songId, { previewUrl: publicUrl });
      showSuccess("Performance track uploaded and linked!");
    } catch (err) {
      showError("Upload failed.");
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gig Dashboard</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={copyAllLinks}
          className="h-7 text-[9px] font-black uppercase tracking-tight gap-2 border-indigo-100 text-indigo-600"
        >
          <Copy className="w-3 h-3" /> Copy All YT Links
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b">
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-12 text-center">Done</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Song Title / Metadata</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-48">Key Signature</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-32 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {songs.map((song, idx) => {
              const isSelected = currentSongId === song.id;
              const hasAudio = !!song.previewUrl;
              
              return (
                <tr 
                  key={song.id}
                  className={cn(
                    "transition-colors group",
                    isSelected ? "bg-indigo-50/50 dark:bg-indigo-900/10" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                    song.isPlayed && "opacity-50"
                  )}
                >
                  <td className="p-4 text-center">
                    <button onClick={() => onTogglePlayed(song.id)} className="transition-transform active:scale-90">
                      {song.isPlayed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <CircleDashed className="w-5 h-5 text-slate-300 group-hover:text-indigo-400" />
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-black text-slate-300">{(idx + 1).toString().padStart(2, '0')}</span>
                        <span className={cn(
                          "text-sm font-bold tracking-tight",
                          song.isPlayed && "line-through text-slate-400"
                        )}>{song.name}</span>
                        {!hasAudio && (
                          <Badge variant="outline" className="text-[8px] uppercase border-amber-200 text-amber-600 bg-amber-50 leading-none h-4">No Audio</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {song.youtubeUrl ? (
                          <a href={song.youtubeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] text-red-600 font-bold hover:underline">
                            <Youtube className="w-3 h-3" /> Video Linked
                          </a>
                        ) : (
                          <button onClick={() => onLinkAudio(song.name)} className="flex items-center gap-1 text-[9px] font-black text-indigo-400 uppercase hover:underline">
                            <Link2 className="w-2.5 h-2.5" /> Find Video
                          </button>
                        )}
                        
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="audio/*" 
                            className="hidden" 
                            id={`upload-${song.id}`}
                            onChange={(e) => handleFileUpload(e, song.id)}
                          />
                          <label 
                            htmlFor={`upload-${song.id}`}
                            className="flex items-center gap-1 text-[9px] font-black text-indigo-600 uppercase hover:underline cursor-pointer"
                          >
                            {uploadingId === song.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Upload className="w-2.5 h-2.5" />}
                            {hasAudio ? "Replace Audio" : "Upload MP3"}
                          </label>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase text-slate-400">Original</span>
                        <span className="text-[11px] font-mono font-bold">{song.originalKey || "TBC"}</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <div className="flex-1">
                        <span className="text-[8px] font-black uppercase text-indigo-500">Target</span>
                        <Select 
                          value={song.targetKey} 
                          onValueChange={(val) => onUpdateKey(song.id, val)}
                        >
                          <SelectTrigger className="h-7 text-[11px] py-0 px-2 font-bold font-mono border-indigo-100 bg-indigo-50/30 text-indigo-600 focus:ring-1 focus:ring-indigo-500">
                            <SelectValue placeholder="Key" />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_KEYS.map(k => (
                              <SelectItem key={k} value={k} className="text-[11px] font-mono">{k}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {song.pitch !== 0 && (
                        <Badge variant="secondary" className="text-[9px] h-5 px-1 font-mono bg-indigo-100 text-indigo-700 border-none">
                          {song.pitch > 0 ? `+${song.pitch}` : song.pitch}ST
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn(
                          "h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-2",
                          !hasAudio ? "text-slate-300 cursor-not-allowed" : "text-indigo-600 hover:bg-indigo-50"
                        )}
                        disabled={!hasAudio}
                        onClick={() => onSelect(song)}
                      >
                        {isSelected ? "Active" : "Perform"}
                        <Play className={cn("w-3 h-3", isSelected ? "fill-current" : "")} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50"
                        onClick={() => onRemove(song.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SetlistManager;
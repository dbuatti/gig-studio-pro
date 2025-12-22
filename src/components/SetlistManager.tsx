"use client";

import React, { useRef, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { ListMusic, Trash2, Play, Music, Youtube, ArrowRight, Link2, CheckCircle2, CircleDashed, Copy, Upload, Loader2, Sparkles, FileText, ShieldCheck, Edit3, Search, FileDown, FileCheck, SortAsc, SortDesc, LayoutList, Volume2, Headphones } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_KEYS, calculateSemitones } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import SongDetailModal from './SongDetailModal';

export interface SetlistSong {
  id: string;
  name: string;
  artist?: string;
  previewUrl: string;
  youtubeUrl?: string;
  pdfUrl?: string;
  originalKey?: string;
  targetKey?: string;
  pitch: number;
  isPlayed?: boolean;
  bpm?: string;
  genre?: string;
  isSyncing?: boolean;
  isMetadataConfirmed?: boolean;
  notes?: string;
  resources?: string[];
}

interface SetlistManagerProps {
  songs: SetlistSong[];
  onRemove: (id: string) => void;
  onSelect: (song: SetlistSong) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onTogglePlayed: (id: string) => void;
  onLinkAudio: (songName: string) => void;
  onUpdateSong: (id: string, updates: Partial<SetlistSong>) => void;
  onSyncProData: (song: SetlistSong) => Promise<void>;
  currentSongId?: string;
}

const RESOURCE_TYPES = [
  { id: 'UG', label: 'Ultimate Guitar', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'FS', label: 'ForScore', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'SM', label: 'Sheet Music', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'LS', label: 'Lead Sheet', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'PDF', label: 'iPad PDF', color: 'bg-red-100 text-red-700 border-red-200' },
];

type SortMode = 'none' | 'ready' | 'work';

const SetlistManager: React.FC<SetlistManagerProps> = ({ 
  songs, 
  onRemove, 
  onSelect, 
  onUpdateKey, 
  onTogglePlayed,
  onLinkAudio,
  onUpdateSong,
  onSyncProData,
  currentSongId 
}) => {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('none');
  const [editingSong, setEditingSong] = useState<SetlistSong | null>(null);
  const [manualLink, setManualLink] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const isItunesPreview = (url: string) => url && (url.includes('apple.com') || url.includes('itunes-assets'));

  const getUGUrl = (song: SetlistSong) => {
    const searchTerm = encodeURIComponent(`${song.name} ${song.artist || ''} chords`);
    return `https://www.ultimate-guitar.com/search.php?search_type=title&value=${searchTerm}`;
  };

  // Readiness scoring logic
  const getReadinessScore = (song: SetlistSong) => {
    let score = 0;
    // Only give high points if it's a REAL full track (not a preview)
    if (song.previewUrl && !isItunesPreview(song.previewUrl)) score += 5;
    if (song.isMetadataConfirmed) score += 3;
    if (song.pdfUrl) score += 3;
    if (song.youtubeUrl) score += 1;
    if (song.bpm) score += 1;
    if (song.notes) score += 1;
    if (song.resources) score += song.resources.length;
    return score;
  };

  const processedSongs = useMemo(() => {
    if (sortMode === 'none') return songs;
    
    return [...songs].sort((a, b) => {
      const scoreA = getReadinessScore(a);
      const scoreB = getReadinessScore(b);
      return sortMode === 'ready' ? scoreB - scoreA : scoreA - scoreB;
    });
  }, [songs, sortMode]);

  const toggleResource = (song: SetlistSong, resourceId: string) => {
    const currentResources = song.resources || [];
    const newResources = currentResources.includes(resourceId)
      ? currentResources.filter(id => id !== resourceId)
      : [...currentResources, resourceId];
    
    onUpdateSong(song.id, { resources: newResources });
  };

  const handlePdfUpload = async (file: File, songId: string) => {
    if (file.type !== 'application/pdf') {
      showError("Please drop a PDF file.");
      return;
    }

    setUploadingId(songId);
    try {
      const fileName = `sheets/${songId}-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('audio_tracks')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('audio_tracks')
        .getPublicUrl(fileName);

      onUpdateSong(songId, { pdfUrl: publicUrl });
      showSuccess("Sheet music linked!");
    } catch (err) {
      showError("Upload failed.");
    } finally {
      setUploadingId(null);
      setDragOverId(null);
    }
  };

  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const onDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handlePdfUpload(file, id);
  };

  const cycleSortMode = () => {
    if (sortMode === 'none') setSortMode('ready');
    else if (sortMode === 'ready') setSortMode('work');
    else setSortMode('none');
  };

  const handleCopyLink = (url?: string) => {
    if (url) {
      navigator.clipboard.writeText(url);
      showSuccess("YouTube link copied!");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gig Dashboard</h3>
          <div className="h-4 w-px bg-slate-200" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={cycleSortMode}
            className={cn(
              "h-7 text-[9px] font-black uppercase tracking-tight gap-2 transition-all",
              sortMode !== 'none' ? "bg-indigo-600 text-white hover:bg-indigo-700" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            {sortMode === 'none' && <LayoutList className="w-3 h-3" />}
            {sortMode === 'ready' && <SortAsc className="w-3 h-3" />}
            {sortMode === 'work' && <SortDesc className="w-3 h-3" />}
            
            {sortMode === 'none' && "List Order"}
            {sortMode === 'ready' && "Ready-First"}
            {sortMode === 'work' && "Work-First"}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setIsBulkSyncing(true);
              songs.forEach(s => !s.isMetadataConfirmed && onSyncProData(s));
              setTimeout(() => setIsBulkSyncing(false), 2000);
            }}
            disabled={isBulkSyncing}
            className="h-7 text-[9px] font-black uppercase tracking-tight gap-2 border-indigo-200 text-indigo-700 bg-indigo-50/50"
          >
            {isBulkSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Sync Pro Info
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b">
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-12 text-center">Done</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Song Title / Resources</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-48">Harmonic State</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-32 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {processedSongs.map((song, idx) => {
              const isSelected = currentSongId === song.id;
              const isPreview = isItunesPreview(song.previewUrl);
              const hasAudio = !!song.previewUrl && !isPreview;
              const isUploading = uploadingId === song.id;
              const readiness = getReadinessScore(song);
              const needsSync = !song.isMetadataConfirmed;

              // Display cleanup logic for artist/name
              let displayName = song.name;
              let displayArtist = song.artist;
              if (!displayArtist && displayName.includes(' - ')) {
                const parts = displayName.split(' - ');
                displayName = parts[0];
                displayArtist = parts[1];
              }
              
              return (
                <tr 
                  key={song.id}
                  onDragOver={(e) => onDragOver(e, song.id)}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(e) => onDrop(e, song.id)}
                  className={cn(
                    "transition-all group relative",
                    isSelected ? "bg-indigo-50/50 dark:bg-indigo-900/10" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                    song.isPlayed && "opacity-50",
                    dragOverId === song.id && "bg-indigo-100 border-2 border-dashed border-indigo-400"
                  )}
                >
                  <td className="p-4 text-center">
                    <button onClick={() => onTogglePlayed(song.id)}>
                      {song.isPlayed ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <CircleDashed className="w-5 h-5 text-slate-300" />}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-black text-slate-300">{(idx + 1).toString().padStart(2, '0')}</span>
                        <span className="text-sm font-bold tracking-tight">{displayName}</span>
                        {song.isMetadataConfirmed && <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />}
                        
                        {song.isSyncing && (
                          <Badge variant="outline" className="text-[8px] uppercase border-indigo-200 text-indigo-600 bg-indigo-50 leading-none h-4 animate-pulse">Syncing...</Badge>
                        )}

                        {/* Readiness Tag */}
                        {sortMode !== 'none' && (
                          <Badge variant="outline" className={cn(
                            "text-[8px] font-black h-4 px-1 border-none",
                            readiness > 12 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {readiness > 12 ? "READY" : "WORK"}
                          </Badge>
                        )}
                      </div>
                      
                      {displayArtist && <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-7">{displayArtist}</span>}
                      
                      <div className="flex items-center gap-1.5 ml-7 mt-2">
                        <TooltipProvider>
                          <div className="flex items-center gap-1.5">
                            {RESOURCE_TYPES.map(res => {
                              const isActive = song.resources?.includes(res.id);
                              return (
                                <button
                                  key={res.id}
                                  onClick={() => toggleResource(song, res.id)}
                                  className={cn(
                                    "text-[8px] font-black px-1.5 py-0.5 rounded border transition-all",
                                    isActive ? cn(res.color, "shadow-sm opacity-100") : "bg-slate-50 text-slate-400 border-slate-100 opacity-40 hover:opacity-100"
                                  )}
                                >
                                  {res.id}
                                </button>
                              );
                            })}

                            <div className="w-1.5" /> {/* Spacing between resources and audio indicators */}

                            {hasAudio && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-[8px] font-black px-1.5 py-0.5 rounded border bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm flex items-center gap-1 animate-in zoom-in duration-300">
                                    <Volume2 className="w-2 h-2" /> AUD
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-[9px] font-bold uppercase">Performance Audio Ready</TooltipContent>
                              </Tooltip>
                            )}

                            {isPreview && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-[8px] font-black px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-100 flex items-center gap-1">
                                    <Headphones className="w-2 h-2" /> PRE
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-[9px] font-bold uppercase">iTunes Preview Stream</TooltipContent>
                              </Tooltip>
                            )}

                            {song.pdfUrl && (
                              <a 
                                href={song.pdfUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 shadow-sm flex items-center gap-1"
                              >
                                <FileDown className="w-2 h-2" /> PDF
                              </a>
                            )}
                          </div>
                        </TooltipProvider>
                      </div>

                      <div className="flex items-center gap-3 mt-2 ml-7">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => onSyncProData(song)}
                            className={cn(
                              "flex items-center gap-1 text-[9px] font-black uppercase transition-all mr-1",
                              needsSync ? "text-indigo-600 animate-pulse font-extrabold" : "text-slate-400 hover:text-indigo-600"
                            )}
                            disabled={song.isSyncing}
                          >
                            {song.isSyncing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                            {needsSync ? "Sync Pro Data" : "Verified"}
                          </button>

                          <div className="h-2 w-px bg-slate-200 mx-1" />

                          <a href={getUGUrl(song)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] text-amber-600 font-bold hover:underline">
                            <FileText className="w-2.5 h-2.5" /> Chords
                          </a>
                          
                          {song.youtubeUrl && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => onSelect(song)} className="flex items-center gap-1 text-[9px] text-red-600 font-bold hover:underline">
                                <Youtube className="w-3 h-3" /> Video
                              </button>
                              <button onClick={() => handleCopyLink(song.youtubeUrl)} className="text-slate-400 hover:text-indigo-600 p-0.5">
                                <Copy className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}

                          <label className="flex items-center gap-1 text-[9px] font-black text-indigo-600 uppercase hover:underline cursor-pointer">
                            <Upload className="w-2.5 h-2.5" />
                            {isUploading ? "Uploading..." : "Drop PDF"}
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
                        <Select value={song.targetKey} onValueChange={(val) => onUpdateKey(song.id, val)}>
                          <SelectTrigger className="h-7 text-[11px] font-bold font-mono border-indigo-100 bg-indigo-50/30 text-indigo-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_KEYS.map(k => <SelectItem key={k} value={k} className="font-mono text-[11px]">{k}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-300 hover:text-indigo-600" onClick={() => setEditingSong(song)}>
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn("h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-2", !song.previewUrl ? "text-slate-300" : "text-indigo-600")}
                        disabled={!song.previewUrl}
                        onClick={() => onSelect(song)}
                      >
                        {isSelected ? "Active" : "Perform"} <Play className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500" onClick={() => onRemove(song.id)}>
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
      <SongDetailModal song={editingSong} isOpen={!!editingSong} onClose={() => setEditingSong(null)} onSave={onUpdateSong} />
    </div>
  );
};

export default SetlistManager;
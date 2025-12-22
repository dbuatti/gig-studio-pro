"use client";

import React, { useRef, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { ListMusic, Trash2, Play, Music, Youtube, ArrowRight, Link2, CheckCircle2, CircleDashed, Copy, Upload, Loader2, Sparkles, FileText, ShieldCheck, Edit3, Search, FileDown, FileCheck, SortAsc, SortDesc, LayoutList, Volume2, Headphones, ChevronUp, ChevronDown } from 'lucide-react';
import { ALL_KEYS, calculateSemitones } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import SongStudioModal from './SongStudioModal';

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
  onReorder: (newSongs: SetlistSong[]) => void;
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
  onReorder,
  currentSongId 
}) => {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('none');
  const [studioSong, setStudioSong] = useState<SetlistSong | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const isItunesPreview = (url: string) => url && (url.includes('apple.com') || url.includes('itunes-assets'));

  const getUGUrl = (song: SetlistSong) => {
    const searchTerm = encodeURIComponent(`${song.name} ${song.artist || ''} chords`);
    return `https://www.ultimate-guitar.com/search.php?search_type=title&value=${searchTerm}`;
  };

  const getReadinessScore = (song: SetlistSong) => {
    let score = 0;
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
    let base = songs;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      base = base.filter(s => s.name.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));
    }

    if (sortMode === 'none') return base;
    
    return [...base].sort((a, b) => {
      const scoreA = getReadinessScore(a);
      const scoreB = getReadinessScore(b);
      return sortMode === 'ready' ? scoreB - scoreA : scoreA - scoreB;
    });
  }, [songs, sortMode, searchTerm]);

  const toggleResource = (song: SetlistSong, resourceId: string) => {
    const currentResources = song.resources || [];
    const newResources = currentResources.includes(resourceId)
      ? currentResources.filter(id => id !== resourceId)
      : [...currentResources, resourceId];
    
    onUpdateSong(song.id, { resources: newResources });
  };

  const handleMove = (id: string, direction: 'up' | 'down') => {
    const index = songs.findIndex(s => s.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === songs.length - 1) return;

    const newSongs = [...songs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSongs[index], newSongs[targetIndex]] = [newSongs[targetIndex], newSongs[index]];
    onReorder(newSongs);
  };

  const processAudioUpload = async (file: File, songId: string) => {
    setUploadingId(songId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `tracks/${songId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('audio_tracks')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('audio_tracks')
        .getPublicUrl(fileName);

      onUpdateSong(songId, { previewUrl: publicUrl });
      showSuccess("Performance track linked!");
    } catch (err) {
      showError("Audio upload failed.");
    } finally {
      setUploadingId(null);
    }
  };

  const handlePdfUpload = async (file: File, songId: string) => {
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
      showError("PDF upload failed.");
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
    setDragOverId(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type.startsWith('audio/')) {
      processAudioUpload(file, id);
    } else if (file.type === 'application/pdf') {
      handlePdfUpload(file, id);
    } else {
      showError("Unsupported file type. Drop an audio file or PDF.");
    }
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-2">
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

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <Input 
              placeholder="Search setlist..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-[10px] bg-white border-slate-200 focus-visible:ring-indigo-500"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => songs.forEach(s => !s.isMetadataConfirmed && onSyncProData(s))}
            className="h-8 text-[9px] font-black uppercase tracking-tight gap-2 border-indigo-200 text-indigo-700 bg-indigo-50/50"
          >
            <Sparkles className="w-3 h-3" /> Sync Pro
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b">
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-12 text-center">Done</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Song Title / Resources</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-32 text-center">Reorder</th>
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
              const needsSync = !song.isMetadataConfirmed;

              return (
                <tr 
                  key={song.id}
                  onDragOver={(e) => onDragOver(e, song.id)}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(e) => onDrop(e, song.id)}
                  onClick={() => setStudioSong(song)}
                  className={cn(
                    "transition-all group relative cursor-pointer",
                    isSelected ? "bg-indigo-50/50 dark:bg-indigo-900/10" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                    song.isPlayed && "opacity-50",
                    dragOverId === song.id && "bg-indigo-100 border-2 border-dashed border-indigo-400"
                  )}
                >
                  <td className="p-4 text-center">
                    <button onClick={(e) => { e.stopPropagation(); onTogglePlayed(song.id); }}>
                      {song.isPlayed ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <CircleDashed className="w-5 h-5 text-slate-300" />}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-black text-slate-300">{(idx + 1).toString().padStart(2, '0')}</span>
                        <span className={cn("text-sm font-bold tracking-tight", song.isPlayed && "line-through")}>
                          {song.name}
                        </span>
                        {song.isMetadataConfirmed && <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />}
                      </div>
                      
                      {song.artist && <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-7">{song.artist}</span>}
                      
                      <div className="flex items-center gap-1.5 ml-7 mt-2">
                        <TooltipProvider>
                          <div className="flex items-center gap-1.5">
                            {RESOURCE_TYPES.map(res => {
                              const isActive = song.resources?.includes(res.id);
                              return (
                                <button 
                                  key={res.id} 
                                  onClick={(e) => { e.stopPropagation(); toggleResource(song, res.id); }} 
                                  className={cn("text-[8px] font-black px-1.5 py-0.5 rounded border transition-all", isActive ? cn(res.color, "shadow-sm opacity-100") : "bg-slate-50 text-slate-400 border-slate-100 opacity-40 hover:opacity-100")}
                                >
                                  {res.id}
                                </button>
                              );
                            })}
                            <div className="w-1.5" />
                            {hasAudio && (
                              <Tooltip><TooltipTrigger asChild><div className="text-[8px] font-black px-1.5 py-0.5 rounded border bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm flex items-center gap-1"><Volume2 className="w-2 h-2" /> AUD</div></TooltipTrigger><TooltipContent className="text-[9px] font-bold uppercase">Performance Audio Ready</TooltipContent></Tooltip>
                            )}
                            {isPreview && (
                              <Tooltip><TooltipTrigger asChild><div className="text-[8px] font-black px-1.5 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-100 flex items-center gap-1"><Headphones className="w-2 h-2" /> PRE</div></TooltipTrigger><TooltipContent className="text-[9px] font-bold uppercase">iTunes Preview Stream</TooltipContent></Tooltip>
                            )}
                            {song.pdfUrl && (
                              <a href={song.pdfUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 shadow-sm flex items-center gap-1"><FileDown className="w-2 h-2" /> PDF</a>
                            )}
                          </div>
                        </TooltipProvider>
                      </div>

                      <div className="flex items-center gap-3 mt-2 ml-7">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onSyncProData(song); }} 
                            className={cn("flex items-center gap-1 text-[9px] font-black uppercase transition-all mr-1", needsSync ? "text-indigo-600 animate-pulse font-extrabold" : "text-slate-400 hover:text-indigo-600")} 
                            disabled={song.isSyncing}
                          >
                            {song.isSyncing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                            {needsSync ? "Sync Pro Data" : "Verified"}
                          </button>
                          <div className="h-2 w-px bg-slate-200 mx-1" />
                          <a href={getUGUrl(song)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-[9px] text-amber-600 font-bold hover:underline"><FileText className="w-2.5 h-2.5" /> Chords</a>
                          {song.youtubeUrl && (
                            <div className="flex items-center gap-1">
                              <button onClick={(e) => { e.stopPropagation(); onSelect(song); }} className="flex items-center gap-1 text-[9px] text-red-600 font-bold hover:underline"><Youtube className="w-3 h-3" /> Video</button>
                              <button onClick={(e) => { e.stopPropagation(); handleCopyLink(song.youtubeUrl); }} className="text-slate-400 hover:text-indigo-600 p-0.5"><Copy className="w-2.5 h-2.5" /></button>
                            </div>
                          )}
                          <label 
                            className="flex items-center gap-1 text-[9px] font-black text-indigo-600 uppercase hover:underline cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Upload className="w-2.5 h-2.5" /> {isUploading ? "Uploading..." : "Drop Track/PDF"}
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="audio/*,application/pdf" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.type.startsWith('audio/')) processAudioUpload(file, song.id);
                                else if (file.type === 'application/pdf') handlePdfUpload(file, song.id);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col items-center gap-1">
                       <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-indigo-600" onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'up'); }} disabled={idx === 0}>
                         <ChevronUp className="w-4 h-4" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-indigo-600" onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'down'); }} disabled={idx === processedSongs.length - 1}>
                         <ChevronDown className="w-4 h-4" />
                       </Button>
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
                        <div className="h-7 text-[11px] font-bold font-mono bg-indigo-50/30 text-indigo-600 px-2 flex items-center rounded border border-indigo-100">
                          {song.targetKey}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-300 hover:text-indigo-600" onClick={(e) => { e.stopPropagation(); setStudioSong(song); }}><Edit3 className="w-3.5 h-3.5" /></Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn("h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-2", !song.previewUrl ? "text-slate-300" : "text-indigo-600")} 
                        disabled={!song.previewUrl} 
                        onClick={(e) => { e.stopPropagation(); onSelect(song); }}
                      >
                        {isSelected ? "Active" : "Perform"} <Play className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500" onClick={(e) => { e.stopPropagation(); onRemove(song.id); }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SongStudioModal 
        song={studioSong} 
        isOpen={!!studioSong} 
        onClose={() => setStudioSong(null)} 
        onSave={onUpdateSong} 
        onUpdateKey={onUpdateKey}
        onPerform={(song) => {
          onSelect(song);
          setStudioSong(null);
        }}
      />
    </div>
  );
};

export default SetlistManager;
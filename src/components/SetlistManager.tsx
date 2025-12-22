"use client";

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ListMusic, Trash2, Play, Music, Youtube, ArrowRight, Link2, CheckCircle2, CircleDashed, Copy, Upload, Loader2, Sparkles, FileText, ShieldCheck, Edit3, Search, FileDown, FileCheck, SortAsc, SortDesc, LayoutList, Volume2, Headphones, ChevronUp, ChevronDown, BarChart2, Smartphone, Clock, Check } from 'lucide-react';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, calculateSemitones, formatKey } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import SongStudioModal from './SongStudioModal';
import { useSettings, KeyPreference } from '@/hooks/use-settings';

export interface SetlistSong {
  id: string;
  name: string;
  artist?: string;
  previewUrl: string;
  youtubeUrl?: string;
  ugUrl?: string; 
  appleMusicUrl?: string;
  pdfUrl?: string;
  leadsheetUrl?: string; // New: Dedicated lead sheet slot
  originalKey?: string;
  targetKey?: string;
  pitch: number;
  isPlayed?: boolean;
  bpm?: string;
  genre?: string;
  isSyncing?: boolean;
  isMetadataConfirmed?: boolean;
  isKeyConfirmed?: boolean;
  notes?: string;
  lyrics?: string;
  resources?: string[];
  user_tags?: string[];
  isKeyLinked?: boolean;
  duration_seconds?: number;
  key_preference?: KeyPreference;
}

export const RESOURCE_TYPES = [
  { id: 'UG', label: 'Ultimate Guitar', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  { id: 'LYRICS', label: 'Has Lyrics', color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
  { id: 'LEAD', label: 'Lead Sheet', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' }, // Added: LEAD
  { id: 'UGP', label: 'UG Playlist', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  { id: 'FS', label: 'ForScore', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  { id: 'PDF', label: 'Stage PDF', color: 'bg-red-500/10 text-red-700 border-red-200' },
];

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
  const { keyPreference: globalPreference } = useSettings();
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const saved = localStorage.getItem('gig_sort_mode');
    return (saved as SortMode) || 'none';
  });
  const [studioSong, setStudioSong] = useState<SetlistSong | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    localStorage.setItem('gig_sort_mode', sortMode);
  }, [sortMode]);

  const isItunesPreview = (url: string) => url && (url.includes('apple.com') || url.includes('itunes-assets'));

  const getReadinessScore = (song: SetlistSong) => {
    let score = 0;
    if (song.previewUrl && !isItunesPreview(song.previewUrl)) score += 5;
    if (song.isKeyConfirmed) score += 4; 
    if (song.isMetadataConfirmed) score += 2;
    if (song.pdfUrl || song.leadsheetUrl) score += 3;
    if (song.ugUrl) score += 2; 
    if (song.lyrics) score += 2;
    if (song.bpm) score += 1;
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

  const handleMove = (id: string, direction: 'up' | 'down') => {
    if (sortMode !== 'none' || searchTerm) return;

    const index = songs.findIndex(s => s.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === songs.length - 1) return;

    const newSongs = [...songs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSongs[index], newSongs[targetIndex]] = [newSongs[targetIndex], newSongs[index]];
    onReorder(newSongs);
  };

  const formatSecs = (s: number = 0) => {
    const m = Math.floor(s / 60);
    const rs = Math.floor(s % 60);
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  const isReorderingEnabled = sortMode === 'none' && !searchTerm;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSortMode('none')}
              className={cn("h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-2", sortMode === 'none' && "bg-white dark:bg-slate-700 shadow-sm")}
            >
              <LayoutList className="w-3 h-3" /> List Order
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSortMode('ready')}
              className={cn("h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-2", sortMode === 'ready' && "bg-white dark:bg-slate-700 shadow-sm text-indigo-600")}
            >
              <SortAsc className="w-3 h-3" /> Readiness
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <Input 
              placeholder="Search Gig Repertoire..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 text-[11px] font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl focus-visible:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 rounded-[2rem] border-4 border-slate-100 dark:border-slate-900 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b dark:border-slate-800">
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-16 text-center">Sts</th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Song / Resource Matrix</th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-24 text-center">Move</th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-48 text-center">Harmonic Map</th>
                <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-40 text-right pr-10">Command</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
              {processedSongs.map((song, idx) => {
                const isSelected = currentSongId === song.id;
                const readinessScore = getReadinessScore(song);
                const isReady = readinessScore >= 8;
                const hasAudio = !!song.previewUrl && !isItunesPreview(song.previewUrl);
                
                const currentPref = song.key_preference || globalPreference;
                const displayOrigKey = formatKey(song.originalKey, currentPref);
                const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref);

                return (
                  <tr 
                    key={song.id}
                    onClick={() => setStudioSong(song)}
                    className={cn(
                      "transition-all group relative cursor-pointer",
                      isSelected ? "bg-indigo-50/50 dark:bg-indigo-900/10" : "hover:bg-slate-50/30 dark:hover:bg-slate-800/50",
                      song.isPlayed && "opacity-40 grayscale-[0.5]"
                    )}
                  >
                    <td className="py-6 px-6 text-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onTogglePlayed(song.id); }}
                        className="transition-transform active:scale-90"
                      >
                        {song.isPlayed ? (
                          <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 group-hover:border-indigo-300 transition-colors">
                            <CircleDashed className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    </td>

                    <td className="py-6 px-6">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono font-black text-slate-300">{(idx + 1).toString().padStart(2, '0')}</span>
                          <h4 className={cn("text-base font-black tracking-tight leading-none", song.isPlayed && "line-through text-slate-400")}>
                            {song.name}
                          </h4>
                          {song.isMetadataConfirmed && <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />}
                          <div className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isReady ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                          )} />
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none ml-7">
                            {song.artist || "Unknown Artist"}
                          </span>
                          <span className="text-slate-200 dark:text-slate-800 text-[8px]">•</span>
                          <span className="text-[9px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> {formatSecs(song.duration_seconds)}
                          </span>
                          <span className="text-slate-200 dark:text-slate-800 text-[8px]">•</span>
                          <span className="text-[9px] font-mono font-bold text-slate-400">{song.bpm ? `${song.bpm} BPM` : 'TEMPO TBC'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 ml-7 mt-3">
                          <TooltipProvider>
                            {RESOURCE_TYPES.map(res => {
                              const isActive = song.resources?.includes(res.id) || 
                                             (res.id === 'UG' && song.ugUrl) || 
                                             (res.id === 'LYRICS' && song.lyrics) ||
                                             (res.id === 'LEAD' && song.leadsheetUrl); // Added check for LEAD
                              if (!isActive) return null;
                              return (
                                <span key={res.id} className={cn("text-[8px] font-black px-2 py-0.5 rounded-full border shadow-sm", res.color)}>
                                  {res.id}
                                </span>
                              );
                            })}
                            
                            {hasAudio && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="h-5 w-5 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                    <Volume2 className="w-3 h-3" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-[10px] font-black uppercase">Direct Audio Link Active</TooltipContent>
                              </Tooltip>
                            )}

                            {(song.pdfUrl || song.leadsheetUrl) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="h-5 w-5 rounded-lg bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                                    <FileDown className="w-3 h-3" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-[10px] font-black uppercase">Chart / Sheet Music Attached</TooltipContent>
                              </Tooltip>
                            )}
                          </TooltipProvider>
                        </div>
                      </div>
                    </td>

                    <td className="py-6 px-6">
                      <div className="flex flex-col items-center gap-0.5">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn(
                            "h-7 w-7 transition-all",
                            isReorderingEnabled ? "text-slate-300 hover:text-indigo-600 hover:bg-indigo-50" : "text-slate-100 opacity-20 cursor-not-allowed"
                          )} 
                          onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'up'); }} 
                          disabled={!isReorderingEnabled || idx === 0}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn(
                            "h-7 w-7 transition-all",
                            isReorderingEnabled ? "text-slate-300 hover:text-indigo-600 hover:bg-indigo-50" : "text-slate-100 opacity-20 cursor-not-allowed"
                          )} 
                          onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'down'); }} 
                          disabled={!isReorderingEnabled || idx === processedSongs.length - 1}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>

                    <td className="py-6 px-6">
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Orig</p>
                          <span className="text-xs font-mono font-bold text-slate-500">{displayOrigKey}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <ArrowRight className="w-3 h-3 text-slate-300 mb-1" />
                          <div className="h-px w-8 bg-slate-100 dark:bg-slate-800" />
                        </div>
                        <div className="text-center relative">
                          <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1">Stage</p>
                          <div className={cn(
                            "font-mono font-black text-xs px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1.5",
                            song.isKeyConfirmed 
                              ? "bg-emerald-600 text-white shadow-emerald-500/20" 
                              : "bg-indigo-600 text-white shadow-indigo-500/20"
                          )}>
                            {displayTargetKey}
                            {song.isKeyConfirmed && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-6 px-6 text-right pr-10">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          size="sm" 
                          className={cn(
                            "h-9 px-4 text-[10px] font-black uppercase tracking-[0.1em] gap-2 rounded-xl transition-all",
                            !song.previewUrl 
                              ? "bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-600" 
                              : isSelected 
                                ? "bg-indigo-100 text-indigo-600 border border-indigo-200" 
                                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/20"
                          )} 
                          disabled={!song.previewUrl} 
                          onClick={(e) => { e.stopPropagation(); onSelect(song); }}
                        >
                          {isSelected ? "Active" : "Perform"} <Play className={cn("w-3 h-3 fill-current", isSelected && "fill-indigo-600")} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" 
                          onClick={(e) => { e.stopPropagation(); onRemove(song.id); }}
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
      
      <SongStudioModal 
        song={studioSong} 
        isOpen={!!studioSong} 
        onClose={() => setStudioSong(null)} 
        onSave={onUpdateSong} 
        onUpdateKey={onUpdateKey}
        onSyncProData={onSyncProData}
        onPerform={(song) => {
          onSelect(song);
          setStudioSong(null);
        }}
      />
    </div>
  );
};

export default SetlistManager;
"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  Music, 
  FileText, 
  Download, 
  Apple, 
  Link2, 
  ExternalLink, 
  Printer, 
  ClipboardPaste, 
  Eye 
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { SetlistSong } from '../SetlistManager';
import { showSuccess } from '@/utils/toast';

interface LibraryEngineProps {
  formData: Partial<SetlistSong>;
  handleDownloadAll: () => Promise<void>;
  isMobile: boolean;
  // Added these to support the missing preview/utility functions
  setPreviewPdfUrl?: (url: string | null) => void;
  handleUgPrint?: () => void;
}

const LibraryEngine: React.FC<LibraryEngineProps> = ({ 
  formData, 
  handleDownloadAll, 
  isMobile,
  setPreviewPdfUrl,
  handleUgPrint 
}) => {
  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-500 h-full flex flex-col">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-white">RESOURCE MATRIX</h3>
          <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">Centralized management for all song assets and links.</p>
        </div>
        <Button 
          onClick={handleDownloadAll} 
          className="w-full md:w-auto bg-indigo-600<dyad-problem-report summary="15 problems">
<problem file="src/components/SetlistManager.tsx" line="16" column="29" code="2307">Cannot find module '@/components/song-studio/SongStudioModal' or its corresponding type declarations.</problem>
<problem file="src/components/PerformanceOverlay.tsx" line="20" column="29" code="2307">Cannot find module './song-studio/SongStudioModal' or its corresponding type declarations.</problem>
<problem file="src/pages/Index.tsx" line="24" column="29" code="2307">Cannot find module '@/components/song-studio/SongStudioModal' or its corresponding type declarations.</problem>
<problem file="src/App.tsx" line="13" column="29" code="2307">Cannot find module '@/components/song-studio/SongStudioModal' or its corresponding type declarations.</problem>
<problem file="src/components/song-studio/SongStudioModal.tsx" line="44" column="33" code="2307">Cannot find module './YoutubeMediaManager' or its corresponding type declarations.</problem>
<problem file="src/components/song-studio/SongStudioModal.tsx" line="45" column="28" code="2307">Cannot find module './SongDetailsTab' or its corresponding type declarations.</problem>
<problem file="src/components/song-studio/SongStudioModal.tsx" line="46" column="27" code="2307">Cannot find module './SongChartsTab' or its corresponding type declarations.</problem>
<problem file="src/components/song-studio/SongStudioModal.tsx" line="47" column="26" code="2307">Cannot find module './LyricsEngine' or its corresponding type declarations.</problem>
<problem file="src/components/song-studio/SongStudioModal.tsx" line="48" column="27" code="2307">Cannot find module './LibraryEngine' or its corresponding type declarations.</problem>
<problem file="src/components/song-studio/SongStudioModal.tsx" line="49" column="27" code="2307">Cannot find module './SongConfigTab' or its corresponding type declarations.</problem>
<problem file="src/components/song-studio/SongStudioModal.tsx" line="50" column="34" code="2307">Cannot find module './SongAudioPlaybackTab' or its corresponding type declarations.</problem>
<problem file="src/components/song-studio/SongConfigTab.tsx" line="18" column="29" code="2307">Cannot find module './SongAssetMatrix' or its corresponding type declarations.</problem>
<problem file="src/components/song-studio/SongConfigTab.tsx" line="19" column="28" code="2307">Cannot find module './SongTagManager' or its corresponding type declarations.</problem>
<problem file="src/components/song-studio/SongAudioPlaybackTab.tsx" line="14" column="31" code="2307">Cannot find module './SongAnalysisTools' or its corresponding type declarations.</problem>
<problem file="src/components/song-studio/SongAudioPlaybackTab.tsx" line="15" column="31" code="2307">Cannot find module './SongAudioControls' or its corresponding type declarations.</problem>
</dyad-problem-report><think>**Analyzing Import Paths**

I'm currently wading through a swamp of TypeScript errors. It seems my recent restructuring of components into `src/components/song-studio` has left a trail of broken import paths in its wake.  The compiler is screaming about missing modules, a clear indicator that I need to meticulously update every affected import statement to reflect the new file locations.


**Tackling Broken Imports**

Okay, I've identified 15 TypeScript errors stemming from the component restructuring. It's clear that the module not found errors are all due to outdated or incorrect import paths. My plan now is to meticulously update these import statements. Specifically, I'll update references to `SongStudioModal` in `SetlistManager.tsx`, `PerformanceOverlay.tsx`, `Index.tsx`, and `App.tsx`. Next, I'll fix internal imports within `SongStudioModal.tsx`, using relative paths. After that, I'll move on to fixing the file mentioned in the final error.


**Updating Import Paths**

I've got a concrete plan in place to fix those pesky import errors. I'll meticulously update the import statements in `SetlistManager.tsx`, `PerformanceOverlay.tsx`, `Index.tsx`, and `App.tsx` to reflect the new component structure. Then, I'll switch my focus to relative paths inside the `song-studio` directory itself, fixing imports within `SongStudioModal.tsx`, `SongConfigTab.tsx`, and `SongAudioPlaybackTab.tsx` to ensure everything is linked up correctly. This should clear the way for a smooth compile.


</think>You're right! My apologies. When I moved the files, I missed updating some of the import paths within the components themselves and in the files that import them. I'll correct these 15 TypeScript errors by adjusting the import statements to reflect the new `src/components/song-studio` directory structure.

Here are the corrected files:

<dyad-write path="src/components/SetlistManager.tsx" description="Updating import path for SongStudioModal.">
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { 
  ListMusic, Trash2, Play, Music, Youtube, ArrowRight, 
  CircleDashed, CheckCircle2, Volume2, ChevronUp, ChevronDown, 
  Search, LayoutList, SortAsc, SortDesc, ClipboardList, Clock, 
  ShieldCheck, Check, MoreVertical, Settings2, FileText, Filter, AlertTriangle, Loader2
} from 'lucide-react';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, transposeKey, calculateSemitones } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { showSuccess } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import SongStudioModal from '@/components/song-studio/SongStudioModal';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { RESOURCE_TYPES } from '@/utils/constants';
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import SetlistFilters, { FilterState } from './SetlistFilters';
import { calculateReadiness } from '@/utils/repertoireSync';
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

export interface SetlistSong {
  id: string; // Unique for the setlist entry
  master_id?: string; // The UUID from the repertoire table
  name: string;
  artist?: string;
  previewUrl: string;
  youtubeUrl?: string;
  ugUrl?: string; 
  appleMusicUrl?: string;
  pdfUrl?: string;
  leadsheetUrl?: string;
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
  is_active?: boolean;
  fineTune?: number; // Added for fine-tuning pitch
  tempo?: number; // Added for tempo stretching
  volume?: number; // Added for master gain control
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
  onOpenAdmin?: () => void;
}

type SortMode = 'none' | 'ready' | 'work';

const SetlistManager: React.FC<SetlistManagerProps> = ({ 
  songs, 
  onRemove, 
  onSelect, 
  onUpdateKey, 
  onTogglePlayed,
  onUpdateSong,
  onSyncProData,
  onReorder,
  currentSongId,
  onOpenAdmin
}) => {
  const isMobile = useIsMobile();
  const { keyPreference: globalPreference } = useSettings();
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const saved = localStorage.getItem('gig_sort_mode');
    return (saved as SortMode) || 'none';
  });
  const [activeFilters, setActiveFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('gig_active_filters');
    return saved ? JSON.parse(saved) : {
      hasAudio: 'all',
      hasVideo: 'all',
      hasChart: 'all',
      hasPdf: 'all',
      hasUg: 'all',
      isConfirmed: 'all',
      readiness: 100
    };
  });
  const [studioSong, setStudioSong] = useState<SetlistSong | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('gig_sort_mode', sortMode);
    localStorage.setItem('gig_active_filters', JSON.stringify(activeFilters));
  }, [sortMode, activeFilters]);

  const isItunesPreview = (url: string) => url && (url.includes('apple.com') || url.includes('itunes-assets'));

  const processedSongs = useMemo(() => {
    let base = songs;
    
    // Search Filtering
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      base = base.filter(s => s.name.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));
    }

    // Asset and Completion Filtering
    base = base.filter(s => {
      const score = calculateReadiness(s);

      // Completion Logic
      if (score > activeFilters.readiness) return false;

      // Audio Filter Logic (iTunes is treated as 'no audio' when filtering for 'Full')
      const hasPreview = !!s.previewUrl;
      const isItunes = hasPreview && isItunesPreview(s.previewUrl);
      const hasFullAudio = hasPreview && !isItunes;

      if (activeFilters.hasAudio === 'full' && !hasFullAudio) return false;
      if (activeFilters.hasAudio === 'itunes' && !isItunes) return false;
      if (activeFilters.hasAudio === 'none' && hasFullAudio) return false;
      
      if (activeFilters.hasVideo === 'yes' && !s.youtubeUrl) return false;
      if (activeFilters.hasVideo === 'no' && s.youtubeUrl) return false;

      if (activeFilters.hasChart === 'yes' && !(s.pdfUrl || s.leadsheetUrl || s.ugUrl)) return false;
      if (activeFilters.hasChart === 'no' && (s.pdfUrl || s.leadsheetUrl || s.ugUrl)) return false;

      if (activeFilters.hasPdf === 'yes' && !(s.pdfUrl || s.leadsheetUrl)) return false;
      if (activeFilters.hasPdf === 'no' && (s.pdfUrl || s.leadsheetUrl)) return false;

      if (activeFilters.hasUg === 'yes' && !s.ugUrl) return false;
      if (activeFilters.hasUg === 'no' && s.ugUrl) return false;

      if (activeFilters.isConfirmed === 'yes' && !s.isKeyConfirmed) return false;
      if (activeFilters.isConfirmed === 'no' && s.isKeyConfirmed) return false;

      return true;
    });

    if (sortMode === 'none') return base;
    
    return [...base].sort((a, b) => {
      const scoreA = calculateReadiness(a);
      const scoreB = calculateReadiness(b);
      return sortMode === 'ready' ? scoreB - scoreA : scoreA - scoreB;
    });
  }, [songs, sortMode, searchTerm, activeFilters]);

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

  const isReorderingEnabled = sortMode === 'none' && !searchTerm;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSortMode('none')}
              className={cn("h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg", sortMode === 'none' && "bg-white dark:bg-slate-700 shadow-sm")}
            >
              <LayoutList className="w-3 h-3" /> <span className="hidden sm:inline">List Order</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSortMode('ready')}
              className={cn("h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg", sortMode === 'ready' && "bg-white dark:bg-slate-700 shadow-sm text-indigo-600")}
            >
              <SortAsc className="w-3 h-3" /> <span className="hidden sm:inline">Readiness</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSortMode('work')}
              className={cn("h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg", sortMode === 'work' && "bg-white dark:bg-slate-700 shadow-sm text-orange-600")}
            >
              <SortDesc className="w-3 h-3" /> <span className="hidden sm:inline">Work Needed</span>
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={cn(
              "h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl gap-2 transition-all",
              isFilterOpen ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            <Filter className="w-3.5 h-3.5" /> Filter Matrix
          </Button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <Input 
              placeholder="Search Gig Repertoire..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 sm:h-9 pl-9 text-[11px] font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl focus-visible:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {isFilterOpen && (
        <SetlistFilters activeFilters={activeFilters} onFilterChange={setActiveFilters} />
      )}

      {isMobile ? (
        <div className="space-y-3 px-1 pb-4">
          {processedSongs.map((song, idx) => {
            const isSelected = currentSongId === song.id;
            const readinessScore = calculateReadiness(song);
            const isReady = readinessScore >= 80;
            const hasAudio = !!song.previewUrl && !isItunesPreview(song.previewUrl);
            const currentPref = song.key_preference || globalPreference;
            const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref);

            return (
              <div 
                key={song.id}
                onClick={() => setStudioSong(song)}
                className={cn(
                  "bg-white dark:bg-slate-950 rounded-2xl border-2 transition-all p-4 flex flex-col gap-3 shadow-sm",
                  isSelected ? "border-indigo-500 shadow-md ring-1 ring-indigo-500/20" : "border-slate-100 dark:border-slate-900",
                  song.isPlayed && "opacity-50 grayscale-[0.2]"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onTogglePlayed(song.id); }}
                      className="mt-1"
                    >
                      {song.isPlayed ? (
                        <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-slate-200 dark:border-slate-800" />
                      )}
                    </button>
                    <div>
                      <h4 className={cn("text-sm font-black tracking-tight", song.isPlayed && "line-through text-slate-400")}>
                        {song.name}
                      </h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                        {song.artist || "Unknown Artist"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {song.isSyncing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    ) : (
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        isReady ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                      )} />
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setStudioSong(song); }}>
                          <Settings2 className="w-4 h-4 mr-2" /> Configure Studio
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'up'); }} disabled={!isReorderingEnabled || idx === 0}>
                          <ChevronUp className="w-4 h-4 mr-2" /> Move Up
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'down'); }} disabled={!isReorderingEnabled || idx === processedSongs.length - 1}>
                          <ChevronDown className="w-4 h-4 mr-2" /> Move Down
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(song.id); }}>
                          <Trash2 className="w-4 h-4 mr-2" /> Remove Track
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-900 pt-3">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Key</span>
                      <div className={cn(
                        "font-mono font-black text-[10px] px-2 py-0.5 rounded-lg text-white flex items-center gap-1",
                        song.isKeyConfirmed ? "bg-emerald-600" : "bg-indigo-600"
                      )}>
                        {displayTargetKey} {song.isKeyConfirmed && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Tempo</span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">{song.bpm || "--"} BPM</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {hasAudio && <Volume2 className="w-3.5 h-3.5 text-indigo-500" />}
                    <Button 
                      size="sm" 
                      className={cn(
                        "h-8 px-4 text-[9px] font-black uppercase tracking-widest rounded-xl gap-2",
                        !song.previewUrl ? "bg-slate-100 text-slate-400" : "bg-indigo-600 text-white"
                      )}
                      disabled={!song.previewUrl}
                      onClick={(e) => { e.stopPropagation(); onSelect(song); }}
                    >
                      {isSelected ? "Active" : "Perform"} <Play className="w-3 h-3 fill-current" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-950 rounded-[2rem] border-4 border-slate-100 dark:border-slate-900 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b dark:border-slate-800">
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-16 text-center">Sts</th>
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-left">Song / Resource Matrix</th>
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-24 text-center">Move</th>
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-48 text-center">Harmonic Map</th>
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-40 text-right pr-10">Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                {processedSongs.map((song, idx) => {
                  const isSelected = currentSongId === song.id;
                  const readinessScore = calculateReadiness(song);
                  const isReady = readinessScore >= 80;
                  const hasAudio = !!song.previewUrl && !isItunesPreview(song.previewUrl);
                  
                  const currentPref = song.key_preference || globalPreference;
                  const displayOrigKey = formatKey(song.originalKey, currentPref);
                  const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref);

                  return (
                    <tr 
                      key={song.id}
                      onClick={() => setStudioSong(song)}
                      className={cn(
                        "transition-all group relative cursor-pointer h-[80px]",
                        isSelected ? "bg-indigo-50/50 dark:bg-indigo-900/10" : "hover:bg-slate-50/30 dark:hover:bg-slate-800/50",
                        song.isPlayed && "opacity-40 grayscale-[0.5]"
                      )}
                    >
                      <td className="px-6 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onTogglePlayed(song.id); }}
                          className="transition-transform active:scale-90 inline-flex items-center justify-center"
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

                      <td className="px-6 text-left">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono font-black text-slate-300 min-w-[20px]">{(idx + 1).toString().padStart(2, '0')}</span>
                            <h4 className={cn("text-base font-black tracking-tight leading-none", song.isPlayed && "line-through text-slate-400")}>
                              {song.name}
                            </h4>
                            {song.isMetadataConfirmed && <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />}
                            {song.isSyncing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 ml-1" />
                            ) : (
                              <div className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isReady ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                              )} />
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 ml-[32px]">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                              {song.artist || "Unknown Artist"}
                            </span>
                            <span className="text-slate-200 dark:text-slate-800 text-[8px]">•</span>
                            <span className="text-[9px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" /> {Math.floor((song.duration_seconds || 0) / 60)}:{(Math.floor((song.duration_seconds || 0) % 60)).toString().padStart(2, '0')}
                            </span>
                            <span className="text-slate-200 dark:text-slate-800 text-[8px]">•</span>
                            <span className="text-[9px] font-mono font-bold text-slate-400">{song.bpm ? `${song.bpm} BPM` : 'TEMPO TBC'}</span>
                          </div>

                          <div className="flex items-center gap-1.5 ml-[32px] mt-1">
                            <TooltipProvider>
                              {RESOURCE_TYPES.map(res => {
                                const isActive = song.resources?.includes(res.id) || 
                                               (res.id === 'UG' && song.ugUrl) || 
                                               (res.id === 'LYRICS' && song.lyrics) ||
                                               (res.id === 'LEAD' && song.leadsheetUrl);
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
                            </TooltipProvider>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5 h-full">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn(
                              "h-7 w-7 transition-all flex items-center justify-center",
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
                              "h-7 w-7 transition-all flex items-center justify-center",
                              isReorderingEnabled ? "text-slate-300 hover:text-indigo-600 hover:bg-indigo-50" : "text-slate-100 opacity-20 cursor-not-allowed"
                            )} 
                            onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'down'); }} 
                            disabled={!isReorderingEnabled || idx === processedSongs.length - 1}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>

                      <td className="px-6 text-center">
                        <div className="flex items-center justify-center gap-4 h-full">
                          <div className="text-center min-w-[32px]">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Orig</p>
                            <span className="text-xs font-mono font-bold text-slate-500 block leading-none">{displayOrigKey}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center opacity-30">
                            <ArrowRight className="w-3 h-3 text-slate-300 mb-0.5" />
                            <div className="h-px w-6 bg-slate-100 dark:bg-slate-800" />
                          </div>
                          <div className="text-center min-w-[32px] relative">
                            <p className="text-[8px] font-black text-indigo-50 uppercase tracking-widest mb-0.5">Stage</p>
                            <div className={cn(
                              "font-mono font-black text-xs px-2.5 py-1 rounded-lg shadow-lg flex items-center justify-center gap-1.5 leading-none h-6",
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

                      <td className="px-6 text-right pr-10">
                        <div className="flex items-center justify-end gap-2 h-full">
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
                            className="h-9 w-9 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors inline-flex items-center justify-center" 
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(song.id); }}
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
      )}
      
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
        onOpenAdmin={onOpenAdmin}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-slate-900 border-white/10 text-white rounded-[2rem]">
          <AlertDialogHeader>
            <div className="bg-red-500/10 w-12 h-12 rounded-2xl flex items-center justify-center text-red-500 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Remove Track?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will remove the song from your active setlist. The master record will remain in your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:text-white font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deleteConfirmId) {
                  onRemove(deleteConfirmId);
                  setDeleteConfirmId(null);
                  showSuccess("Track Removed");
                }
              }}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest"
            >
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SetlistManager;
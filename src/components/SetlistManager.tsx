"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ListMusic, Trash2, Play, Music, Youtube, ArrowRight, CircleDashed, CheckCircle2, Volume2, ChevronUp, ChevronDown, Search, LayoutList, SortAsc, SortDesc, ClipboardList, Clock, ShieldCheck, Check, MoreVertical, Settings2, FileText, Filter, AlertTriangle, Loader2, Guitar } from 'lucide-react';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, transposeKey, calculateSemitones } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { showSuccess } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { RESOURCE_TYPES, DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import SetlistFilters, { FilterState } from './SetlistFilters';
import { calculateReadiness } from '@/utils/repertoireSync';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export interface UGChordsConfig {
  fontFamily: string;
  fontSize: number;
  chordBold: boolean;
  chordColor: string;
  lineSpacing: number;
  textAlign: "left" | "center" | "right";
}

export interface SetlistSong {
  id: string;
  master_id?: string;
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
  is_pitch_linked?: boolean; 
  duration_seconds?: number;
  key_preference?: KeyPreference;
  is_active?: boolean;
  fineTune?: number;
  tempo?: number;
  volume?: number;
  isApproved?: boolean;
  preferred_reader?: 'ug' | 'ls' | 'fn' | null;
  ug_chords_text?: string;
  ug_chords_config?: UGChordsConfig;
  is_ug_chords_present?: boolean;
  highest_note_original?: string;
  is_ug_link_verified?: boolean; 
  metadata_source?: string; 
  sync_status?: 'IDLE' | 'SYNCING' | 'COMPLETED' | 'ERROR'; 
  last_sync_log?: string;
  auto_synced?: boolean;
  is_sheet_verified?: boolean;
  sheet_music_url?: string; // Added this line
}

interface SetlistManagerProps {
  songs: SetlistSong[]; 
  onRemove: (id: string) => void;
  onSelect: (song: SetlistSong) => void;
  onEdit: (song: SetlistSong) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onTogglePlayed: (id: string) => void;
  onLinkAudio: (songName: string) => void;
  onUpdateSong: (id: string, updates: Partial<SetlistSong>) => void;
  onSyncProData: (song: SetlistSong) => Promise<void>;
  onReorder: (newSongs: SetlistSong[]) => void;
  currentSongId?: string;
  onOpenAdmin?: () => void;
  sortMode: 'none' | 'ready' | 'work';
  setSortMode: (mode: 'none' | 'ready' | 'work') => void;
  activeFilters: FilterState;
  setActiveFilters: (filters: FilterState) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showHeatmap: boolean; // New prop for heatmap
}

const SetlistManager: React.FC<SetlistManagerProps> = ({
  songs: processedSongs,
  onRemove,
  onSelect,
  onEdit,
  onUpdateKey,
  onTogglePlayed,
  onUpdateSong,
  onSyncProData,
  onReorder,
  currentSongId,
  onOpenAdmin,
  sortMode,
  setSortMode,
  activeFilters,
  setActiveFilters,
  searchTerm,
  setSearchTerm,
  showHeatmap // Destructure new prop
}) => {
  const isMobile = useIsMobile();
  const { keyPreference: globalPreference } = useSettings();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isItunesPreview = (url: string) => url && (url.includes('apple.com') || url.includes('itunes-assets'));

  const handleMove = (id: string, direction: 'up' | 'down') => {
    if (sortMode !== 'none' || searchTerm) return;
    
    const index = processedSongs.findIndex(s => s.id === id);
    if (index === -1) return;
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === processedSongs.length - 1) return;
    
    const newSongs = [...processedSongs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSongs[index], newSongs[targetIndex]] = [newSongs[targetIndex], newSongs[index]];
    onReorder(newSongs);
  };

  const isReorderingEnabled = sortMode === 'none' && !searchTerm;

  const getHeatmapClass = (song: SetlistSong) => {
    if (!showHeatmap) return "";

    const readiness = calculateReadiness(song);
    const hasAudio = !!song.previewUrl && !isItunesPreview(song.previewUrl);
    const hasYoutubeLink = !!song.youtubeUrl && song.youtubeUrl.trim() !== "";
    const hasUgLink = !!song.ugUrl && song.ugUrl.trim() !== "";
    const hasUgChordsText = !!song.ug_chords_text && song.ug_chords_text.trim().length > 0;
    const hasSheetLink = !!(song.pdfUrl || song.leadsheetUrl || song.sheet_music_url);

    // Red (Critical Attention)
    if (
      !hasAudio || // Missing master audio
      !hasYoutubeLink || // Missing YouTube link
      (hasUgLink && !hasUgChordsText) || // Has UG link but no chords content (Empty Sheets)
      readiness < 40 // Low readiness score
    ) {
      return "bg-red-500/10 border-red-500/20";
    }

    // Orange (Needs Review/Unverified)
    if (
      (hasUgLink && !song.is_ug_link_verified) || // Unverified UG link (still using this for internal state, but UI will simplify)
      (hasSheetLink && !song.is_sheet_verified) || // Unverified sheet music link
      !song.isMetadataConfirmed // Metadata not confirmed
    ) {
      return "bg-orange-500/10 border-orange-500/20";
    }

    return ""; // No heatmap color
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setSortMode('none')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'none' && "bg-white dark:bg-slate-700 shadow-sm"
              )}
            >
              <LayoutList className="w-3 h-3" /> <span className="hidden sm:inline">List Order</span>
            </Button>
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setSortMode('ready')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'ready' && "bg-white dark:bg-slate-700 shadow-sm text-indigo-600"
              )}
            >
              <SortAsc className="w-3 h-3" /> <span className="hidden sm:inline">Readiness</span>
            </Button>
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setSortMode('work')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'work' && "bg-white dark:bg-slate-700 shadow-sm text-orange-600"
              )}
            >
              <SortDesc className="w-3 h-3" /> <span className="hidden sm:inline">Work Needed</span>
            </Button>
          </div>
          <Button 
            variant="ghost" size="sm" 
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
        <SetlistFilters 
          activeFilters={activeFilters} 
          onFilterChange={setActiveFilters} 
        />
      )}

      {isMobile ? (
        <div className="space-y-3 px-1 pb-4">
          {processedSongs.map((song, idx) => {
            const isSelected = currentSongId === song.id;
            const readinessScore = calculateReadiness(song);
            const isFullyReady = readinessScore === 100;
            const hasAudio = !!song.previewUrl && !isItunesPreview(song.previewUrl);
            const currentPref = song.key_preference || globalPreference;
            const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref);

            return (
              <div 
                key={song.id}
                onClick={() => onEdit(song)}
                className={cn(
                  "bg-white dark:bg-slate-950 rounded-2xl border-2 transition-all p-4 flex flex-col gap-3 shadow-sm",
                  isSelected ? "border-indigo-500 shadow-md ring-1 ring-indigo-500/20" : "border-slate-100 dark:border-slate-900",
                  song.isPlayed && "opacity-50 grayscale-[0.2]",
                  getHeatmapClass(song) // Apply heatmap class
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePlayed(song.id);
                      }}
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
                      <h4 className={cn("text-sm font-black tracking-tight flex items-center gap-1.5", song.isPlayed && "line-through text-slate-400")}>
                        {song.name}
                        {isFullyReady && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20" />}
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
                        isFullyReady ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                      )} />
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(song);
                          }}
                        >
                          <Settings2 className="w-4 h-4 mr-2" />
                          Configure Studio
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMove(song.id, 'up');
                          }}
                          disabled={!isReorderingEnabled || idx === 0}
                        >
                          <ChevronUp className="w-4 h-4 mr-2" />
                          Move Up
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMove(song.id, 'down');
                          }}
                          disabled={!isReorderingEnabled || idx === processedSongs.length - 1}
                        >
                          <ChevronDown className="w-4 h-4 mr-2" />
                          Move Down
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(song.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove Track
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
                        {displayTargetKey}
                        {song.isKeyConfirmed && <Check className="w-2.5 h-2.5" />}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(song);
                      }}
                    >
                      {isSelected ? "Active" : "Perform"}
                      <Play className="w-3 h-3 fill-current" />
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
                  const isFullyReady = readinessScore === 100;
                  const hasAudio = !!song.previewUrl && !isItunesPreview(song.previewUrl);
                  const currentPref = song.key_preference || globalPreference;
                  const displayOrigKey = formatKey(song.originalKey, currentPref);
                  const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref);

                  return (
                    <tr 
                      key={song.id}
                      onClick={() => onEdit(song)}
                      className={cn(
                        "transition-all group relative cursor-pointer h-[80px]",
                        isSelected ? "bg-indigo-50/50 dark:bg-indigo-900/10" : "hover:bg-slate-50/30 dark:hover:bg-slate-800/50",
                        song.isPlayed && "opacity-40 grayscale-[0.5]",
                        getHeatmapClass(song) // Apply heatmap class
                      )}
                    >
                      <td className="px-6 text-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePlayed(song.id);
                          }}
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
                            <h4 className={cn("text-base font-black tracking-tight leading-none flex items-center gap-2", song.isPlayed && "line-through text-slate-400")}>
                              {song.name}
                              {isFullyReady && <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />}
                            </h4>
                            {song.isMetadataConfirmed && <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />}
                            {song.isSyncing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 ml-1" />
                            ) : (
                              <div className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isFullyReady ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                              )} />
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-[32px]">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                              {song.artist || "Unknown Artist"}
                            </span>
                            <span className="text-slate-200 dark:text-slate-800 text-[8px]">•</span>
                            <span className="text-[9px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {Math.floor((song.duration_seconds || 0) / 60)}:{(Math.floor((song.duration_seconds || 0) % 60)).toString().padStart(2, '0')}
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
                                  (res.id === 'LEAD' && song.leadsheetUrl) ||
                                  (res.id === 'UG' && song.ug_chords_text);
                                
                                if (!isActive) return null;
                                
                                return (
                                  <span 
                                    key={res.id} 
                                    className={cn("text-[8px] font-black px-2 py-0.5 rounded-full border shadow-sm", res.color)}
                                  >
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
                                  <TooltipContent className="text-[10px] font-black uppercase">
                                    Direct Audio Link Active
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TooltipProvider>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5 h-full">
                          <Button 
                            variant="ghost" size="icon" 
                            className={cn(
                              "h-7 w-7 transition-all flex items-center justify-center",
                              isReorderingEnabled ? "text-slate-300 hover:text-indigo-600 hover:bg-indigo-50" : "text-slate-100 opacity-20 cursor-not-allowed"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMove(song.id, 'up');
                            }}
                            disabled={!isReorderingEnabled || idx === 0}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" size="icon" 
                            className={cn(
                              "h-7 w-7 transition-all flex items-center justify-center",
                              isReorderingEnabled ? "text-slate-300 hover:text-indigo-600 hover:bg-indigo-50" : "text-slate-100 opacity-20 cursor-not-allowed"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMove(song.id, 'down');
                            }}
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
                              "font-mono font-black text-xs px-2.5 py-1 rounded-lg shadow-lg flex items-center justify-center gap-1.5 leading-none",
                              song.isKeyConfirmed ? "bg-emerald-600 text-white shadow-emerald-500/20" : "bg-indigo-600 text-white shadow-indigo-500/20"
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
                              !song.previewUrl ? "bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-600" : 
                              isSelected ? "bg-indigo-100 text-indigo-600 border border-indigo-200" : 
                              "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/20"
                            )}
                            disabled={!song.previewUrl}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(song);
                            }}
                          >
                            {isSelected ? "Active" : "Perform"}
                            <Play className={cn("w-3 h-3 fill-current", isSelected && "fill-indigo-600")} />
                          </Button>
                          <Button 
                            variant="ghost" size="icon" 
                            className="h-9 w-9 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors inline-flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(song.id);
                            }}
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
            <AlertDialogCancel className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10 hover:text-white font-bold uppercase text-[10px] tracking-widest">
              Cancel
            </AlertDialogCancel>
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
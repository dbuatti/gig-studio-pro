"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ListMusic, Trash2, Play, Music, Youtube, ArrowRight, CircleDashed, CheckCircle2, Volume2, ChevronUp, ChevronDown, Search, LayoutList, SortAsc, AlertTriangle, Loader2, Guitar, CloudDownload, Edit3, Filter, MoreVertical, Settings2, Check, ShieldCheck, Clock, Star, Zap, Sparkles, Info } from 'lucide-react';

import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, transposeKey, calculateSemitones } from '@/utils/keyUtils';
import { cn } from '@/lib/utils';
import { showSuccess } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { RESOURCE_TYPES, DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import SetlistFilters, { FilterState, DEFAULT_FILTERS } from './SetlistFilters';
import { calculateReadiness } from '@/utils/repertoireSync';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import SetlistMultiSelector from './SetlistMultiSelector';
import { SheetLink } from './LinkDisplayOverlay';
import { sortSongsByStrategy, analyzeEnergyFatigue } from '@/utils/SetlistGenerator';
import SongRecommender from './SongRecommender';

export interface UGChordsConfig {
  fontFamily: string;
  fontSize: number;
  chordBold: boolean;
  chordColor: string;
  lineSpacing: number;
  textAlign: "left" | "center" | "right";
}

export type EnergyZone = 'Ambient' | 'Pulse' | 'Groove' | 'Peak';

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
  is_ready_to_sing?: boolean;
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
  sheet_music_url?: string;
  extraction_status?: 'idle' | 'PENDING' | 'queued' | 'processing' | 'completed' | 'failed';
  extraction_error?: string;
  audio_url?: string;
  comfort_level?: number;
  last_extracted_at?: string;
  source_type?: string;
  is_in_library?: boolean;
  lyrics_updated_at?: string;
  chords_updated_at?: string;
  ug_link_updated_at?: string;
  highest_note_updated_at?: string;
  original_key_updated_at?: string;
  target_key_updated_at?: string;
  pdf_updated_at?: string;
  links?: SheetLink[];
  energy_level?: EnergyZone;
}

export interface Setlist {
  id: string;
  name: string;
  songs: SetlistSong[];
  time_goal?: number;
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
  sortMode: 'none' | 'ready' | 'work' | 'manual' | 'energy-asc' | 'energy-desc' | 'zig-zag' | 'wedding-ramp';
  setSortMode: (mode: 'none' | 'ready' | 'work' | 'manual' | 'energy-asc' | 'energy-desc' | 'zig-zag' | 'wedding-ramp') => void;
  activeFilters: FilterState;
  setActiveFilters: (filters: FilterState) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showHeatmap: boolean;
  allSetlists: Setlist[];
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  onOpenSortModal: () => void;
  onBulkVibeCheck: () => Promise<void>;
  masterRepertoire?: SetlistSong[];
  activeSetlistId?: string | null;
}

const SetlistManager: React.FC<SetlistManagerProps> = ({
  songs: rawSongs,
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
  showHeatmap,
  allSetlists,
  onUpdateSetlistSongs,
  onOpenSortModal,
  onBulkVibeCheck,
  masterRepertoire = [],
  activeSetlistId
}) => {
  const isMobile = useIsMobile();
  const { keyPreference: globalPreference } = useSettings();
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isVibeChecking, setIsVibeChecking] = useState(false);

  const processedSongs = useMemo(() => {
    let songs = [...rawSongs];
    const q = searchTerm.toLowerCase();
    
    if (q) {
      songs = songs.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.artist?.toLowerCase().includes(q)
      );
    }

    if (sortMode === 'ready') {
      songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    } else if (sortMode === 'work') {
      songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    } else if (sortMode === 'none') {
      songs = rawSongs.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.artist?.toLowerCase().includes(q)
      );
    } else if (sortMode === 'manual') {
      // Manual sort is handled by parent
    } else if (sortMode.startsWith('energy')) {
      songs = sortSongsByStrategy(songs, sortMode);
    } else if (sortMode === 'zig-zag' || sortMode === 'wedding-ramp') {
      songs = sortSongsByStrategy(songs, sortMode);
    }

    return songs;
  }, [rawSongs, searchTerm, sortMode]);

  const energyFatigueIndices = useMemo(() => {
    if (sortMode !== 'manual' && sortMode !== 'none') return [];
    return analyzeEnergyFatigue(processedSongs);
  }, [processedSongs, sortMode]);

  const handleMove = (id: string, direction: 'up' | 'down') => {
    if (sortMode !== 'manual' || searchTerm) return;
    const index = processedSongs.findIndex(s => s.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === processedSongs.length - 1) return;
    const newSongs = [...processedSongs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSongs[index], newSongs[targetIndex]] = [newSongs[targetIndex], newSongs[index]];
    onReorder(newSongs);
    showSuccess("Setlist reordered!");
  };

  const handleMoveToTop = (id: string) => {
    if (sortMode !== 'manual' || searchTerm) return;
    const index = processedSongs.findIndex(s => s.id === id);
    if (index <= 0) return;
    const newSongs = [...processedSongs];
    const [songToMove] = newSongs.splice(index, 1);
    newSongs.unshift(songToMove);
    onReorder(newSongs);
    showSuccess("Song moved to top!");
  };

  const handleMoveToBottom = (id: string) => {
    if (sortMode !== 'manual' || searchTerm) return;
    const index = processedSongs.findIndex(s => s.id === id);
    if (index === -1 || index === processedSongs.length - 1) return;
    const newSongs = [...processedSongs];
    const [songToMove] = newSongs.splice(index, 1);
    newSongs.push(songToMove);
    onReorder(newSongs);
    showSuccess("Song moved to bottom!");
  };

  const isReorderingEnabled = sortMode === 'manual' && !searchTerm;

  const getHeatmapClass = (song: SetlistSong) => {
    if (!showHeatmap) return "";
    const readiness = calculateReadiness(song);
    const hasAudio = !!song.audio_url;
    const hasYoutubeLink = !!song.youtubeUrl && song.youtubeUrl.trim() !== "";
    const hasUgLink = !!song.ugUrl && song.ugUrl.trim() !== "";
    const hasUgChordsText = !!song.ug_chords_text && song.ug_chords_text.trim().length > 0;
    const hasSheetLink = !!(song.pdfUrl || song.leadsheetUrl || song.sheet_music_url);
    if (!hasAudio || !hasYoutubeLink || (hasUgLink && !hasUgChordsText) || readiness < 40) return "bg-red-500/10 border-red-500/20";
    if ((hasUgLink && !song.is_ug_link_verified) || (hasSheetLink && !song.is_sheet_verified) || !song.isMetadataConfirmed) return "bg-orange-500/10 border-orange-500/20";
    return "";
  };

  const getEnergyBarClass = (energyLevel: EnergyZone | undefined) => {
    switch (energyLevel) {
      case 'Ambient': return 'bg-blue-400 w-1/4';
      case 'Pulse': return 'bg-emerald-400 w-2/4';
      case 'Groove': return 'bg-amber-400 w-3/4';
      case 'Peak': return 'bg-red-500 w-full';
      default: return 'bg-slate-700 w-1/4';
    }
  };

  const handleVibeCheckAction = async () => {
    setIsVibeChecking(true);
    try {
      await onBulkVibeCheck();
    } finally {
      setIsVibeChecking(false);
    }
  };

  const missingEnergyCount = useMemo(() => {
    return rawSongs.filter(s => !s.energy_level && s.name && s.artist && s.bpm).length;
  }, [rawSongs]);

  const getReadinessBreakdown = (song: SetlistSong) => {
    const items = [];
    if (song.audio_url && song.extraction_status === 'completed') items.push("✅ Full Audio (25%)");
    else items.push("❌ Missing Audio");
    
    const hasLyrics = (song.lyrics || "").length > 20;
    const hasChords = (song.ug_chords_text || "").length > 10;
    if (hasLyrics && hasChords) items.push("✅ Lyrics & Chords (20%)");
    else if (hasLyrics || hasChords) items.push("⚠️ Partial Charts (10%)");
    else items.push("❌ No Charts");

    if (song.isKeyConfirmed) items.push("✅ Key Confirmed (15%)");
    if (song.bpm) items.push("✅ BPM Set (10%)");
    if (song.pdfUrl || song.leadsheetUrl || song.sheet_music_url) items.push("✅ Sheet Music (10%)");
    if (song.isMetadataConfirmed) items.push("✅ Metadata Verified (5%)");
    if (song.isApproved) items.push("✅ Approved (5%)");

    return items;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setSortMode('none')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'none' && "bg-background dark:bg-secondary shadow-sm"
              )}
            >
              <LayoutList className="w-3 h-3" /> <span className="hidden sm:inline">List Order</span>
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => setSortMode('manual')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'manual' && "bg-background dark:bg-secondary shadow-sm text-indigo-600"
              )}
            >
              <SortAsc className="w-3 h-3" /> <span className="hidden sm:inline">Manual</span>
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={onOpenSortModal}
              className="h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg text-indigo-600 hover:bg-indigo-50"
            >
              <Sparkles className="w-3 h-3" /> <span className="hidden sm:inline">AI Sort</span>
            </Button>
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setSortMode('ready')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'ready' && "bg-background dark:bg-secondary shadow-sm text-indigo-600"
              )}
            >
              <Star className="w-3 h-3" /> <span className="hidden sm:inline">Readiness</span>
            </Button>
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setSortMode('work')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'work' && "bg-background dark:bg-secondary shadow-sm text-orange-600"
              )}
            >
              <AlertTriangle className="w-3 h-3" /> <span className="hidden sm:inline">Work Needed</span>
            </Button>
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setSortMode('energy-asc')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'energy-asc' && "bg-background dark:bg-secondary shadow-sm text-purple-600"
              )}
            >
              <Zap className="w-3 h-3" /> <span className="hidden sm:inline">Energy ↑</span>
            </Button>
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setSortMode('energy-desc')}
              className={cn(
                "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                sortMode === 'energy-desc' && "bg-background dark:bg-secondary shadow-sm text-purple-600"
              )}
            >
              <Zap className="w-3 h-3" /> <span className="hidden sm:inline">Energy ↓</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" size="sm" 
                  className={cn(
                    "h-7 px-3 text-[10px] font-black uppercase tracking-tight gap-1.5 shrink-0 rounded-lg",
                    (sortMode === 'zig-zag' || sortMode === 'wedding-ramp') && "bg-background dark:bg-secondary shadow-sm text-pink-600"
                  )}
                >
                  <Zap className="w-3 h-3" /> <span className="hidden sm:inline">Flow</span> <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-2 rounded-2xl bg-popover border-border text-foreground">
                <DropdownMenuItem onClick={() => setSortMode('zig-zag')} className="text-xs font-bold uppercase h-10 rounded-xl">
                  Zig-Zag (Club)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortMode('wedding-ramp')} className="text-xs font-bold uppercase h-10 rounded-xl">
                  Wedding Ramp (Gala)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button 
            variant="ghost" size="sm" 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={cn(
              "h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl gap-2 transition-all",
              isFilterOpen ? "bg-indigo-50 text-indigo-600" : "text-muted-foreground hover:bg-accent dark:hover:bg-secondary"
            )}
          >
            <Filter className="w-3.5 h-3.5" /> Filter Matrix
          </Button>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleVibeCheckAction}
                  disabled={isVibeChecking || missingEnergyCount === 0}
                  className={cn(
                    "h-10 px-6 rounded-xl font-black uppercase tracking-wider text-[10px] gap-2 shadow-lg",
                    isVibeChecking ? "bg-purple-600/50 text-white" : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20"
                  )}
                >
                  {isVibeChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Vibe Check ({missingEnergyCount})
                </Button>
              </TooltipTrigger>
              {missingEnergyCount === 0 && (
                <TooltipContent className="bg-popover text-foreground border-border text-[10px] font-black uppercase">
                  All tracks have an Energy Zone set.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <div className="relative flex-1 sm:w-64 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
            <Input 
              placeholder="Search Gig Repertoire..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 sm:h-9 pl-9 text-[11px] font-bold bg-card dark:bg-card border-border dark:border-border rounded-xl focus-visible:ring-indigo-500"
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

      {energyFatigueIndices.length > 0 && (
        <div className="p-4 bg-red-600/10 border border-red-600/20 rounded-2xl flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black uppercase text-red-400">Energy Fatigue Warning</p>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              You have {energyFatigueIndices.length} high-energy clusters (3+ 'Peak' songs in a row). Consider adding a 'Pulse' or 'Ambient' track to prevent audience burnout.
            </p>
          </div>
        </div>
      )}

      {isMobile ? (
        <div className="space-y-3 px-1 pb-4">
          {processedSongs.map((song, idx) => {
            const isSelected = currentSongId === song.id;
            const readinessScore = calculateReadiness(song);
            const isFullyReady = readinessScore === 100;
            const hasAudio = !!song.audio_url;
            const currentPref = song.key_preference || globalPreference;
            const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref);
            const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
            const isExtractionFailed = song.extraction_status === 'failed';

            return (
              <div 
                key={song.id}
                onClick={() => onEdit(song)}
                className={cn(
                  "bg-card rounded-2xl border-2 transition-all p-4 flex flex-col gap-3 shadow-sm relative overflow-hidden",
                  isSelected ? "border-indigo-500 shadow-md ring-1 ring-indigo-500/20" : "border-border",
                  song.isPlayed && "opacity-50 grayscale-[0.2]",
                  getHeatmapClass(song)
                )}
              >
                <div className={cn("absolute top-0 left-0 h-full transition-all duration-500", getEnergyBarClass(song.energy_level))} />
                <div className="flex items-start justify-between relative z-10">
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
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground dark:border-border" />
                      )}
                    </button>
                    <div>
                      <h4 className={cn("text-sm font-black tracking-tight flex items-center gap-1.5 text-foreground", song.isPlayed && "line-through text-muted-foreground")}>
                        {song.name}
                        {isFullyReady && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20" />}
                        {isProcessing && <CloudDownload className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />}
                        {isExtractionFailed && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                      </h4>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">
                        {song.artist || "Unknown Artist"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-0.5">Ready</span>
                      <span className={cn(
                        "text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg",
                        readinessScore >= 90 ? "bg-emerald-600/20 text-emerald-400" : "bg-amber-600/20 text-amber-400"
                      )}>
                        {readinessScore}%
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-accent dark:hover:bg-secondary">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdateSong(song.id, { isApproved: !song.isApproved }); showSuccess(`Song marked as ${song.isApproved ? 'unapproved' : 'approved'} for gig.`); }}>
                          {song.isApproved ? <Check className="w-4 h-4 mr-2 text-emerald-500" /> : <ListMusic className="w-4 h-4 mr-2" />}
                          {song.isApproved ? "Unapprove for Gig" : "Approve for Gig"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToTop(song.id); }} disabled={!isReorderingEnabled || idx === 0}>
                          <ChevronUp className="w-4 h-4 mr-2 text-indigo-600" /> Move to Top
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'up'); }} disabled={!isReorderingEnabled || idx === 0}>
                          <ChevronUp className="w-4 h-4 mr-2 opacity-50" /> Move Up
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'down'); }} disabled={!isReorderingEnabled || idx === processedSongs.length - 1}>
                          <ChevronDown className="w-4 h-4 mr-2 opacity-50" /> Move Down
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToBottom(song.id); }} disabled={!isReorderingEnabled || idx === processedSongs.length - 1}>
                          <ChevronDown className="w-4 h-4 mr-2 text-indigo-600" /> Move to Bottom
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(song); }}>
                          <Settings2 className="w-4 h-4 mr-2" /> Configure Studio
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(song.id); }}>
                          <Trash2 className="w-4 h-4 mr-2" /> Remove Track
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-0.5">Key</span>
                      <div className={cn(
                        "font-mono font-black text-[10px] px-2 py-0.5 rounded-lg text-white flex items-center gap-1",
                        song.isKeyConfirmed ? "bg-emerald-600" : "bg-indigo-600"
                      )}>
                        {displayTargetKey}
                        {song.isKeyConfirmed && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-0.5">Tempo</span>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground">{song.bpm || "--"} BPM</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {hasAudio && <Volume2 className="w-3.5 h-3.5 text-indigo-500" />}
                    <Button 
                      size="sm"
                      className={cn(
                        "h-8 px-4 text-[9px] font-black uppercase tracking-widest rounded-xl gap-2",
                        !song.audio_url ? "bg-secondary text-muted-foreground dark:bg-secondary hover:bg-secondary dark:hover:bg-secondary" : isSelected ? "bg-indigo-100 text-indigo-600 border border-indigo-200" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/20"
                      )}
                      disabled={!song.audio_url}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(song);
                      }}
                    >
                      {isSelected ? "Active" : "Perform"}
                      <Play className={cn("w-3 h-3 fill-current", isSelected && "fill-indigo-600")} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card rounded-[2rem] border-4 border-border shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-secondary dark:bg-secondary border-b border-border">
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-16 text-center">Sts</th>
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-left">Song / Resource Matrix</th>
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-24 text-center">Energy</th>
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-20 text-center">Ready</th>
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-24 text-center">Move</th>
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-48 text-center">Harmonic Map</th>
                  <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-40 text-right pr-10">Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {processedSongs.map((song, idx) => {
                  const isSelected = currentSongId === song.id;
                  const readinessScore = calculateReadiness(song);
                  const isFullyReady = readinessScore === 100;
                  const hasAudio = !!song.audio_url;
                  const currentPref = song.key_preference || globalPreference;
                  const displayOrigKey = formatKey(song.originalKey, currentPref);
                  const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref);
                  const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
                  const isExtractionFailed = song.extraction_status === 'failed';

                  return (
                    <tr 
                      key={song.id}
                      onClick={() => onEdit(song)}
                      className={cn(
                        "transition-all group relative cursor-pointer h-[80px]",
                        isSelected ? "bg-indigo-100 dark:bg-indigo-900/10" : "hover:bg-accent dark:hover:bg-secondary",
                        song.isPlayed && "opacity-40 grayscale-[0.5]",
                        getHeatmapClass(song)
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
                            <div className="h-6 w-6 rounded-full border-2 border-muted-foreground flex items-center justify-center text-muted-foreground group-hover:border-indigo-300 transition-colors">
                              <CircleDashed className="w-4 h-4" />
                            </div>
                          )}
                        </button>
                      </td>
                      <td className="px-6 text-left">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono font-black text-muted-foreground min-w-[20px]">{(idx + 1).toString().padStart(2, '0')}</span>
                            <h4 className={cn("text-base font-black tracking-tight leading-none flex items-center gap-2 text-foreground", song.isPlayed && "line-through text-muted-foreground")}>
                              {song.name}
                              {isFullyReady && <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />}
                              {isProcessing && <CloudDownload className="w-4 h-4 text-indigo-500 animate-bounce" />}
                              {isExtractionFailed && <AlertTriangle className="w-4 h-4 text-red-500" />}
                            </h4>
                            {song.isMetadataConfirmed && <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />}
                          </div>
                          <div className="flex items-center gap-2 ml-[32px]">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                              {song.artist || "Unknown Artist"}
                            </span>
                            <span className="text-muted-foreground text-[8px]">•</span>
                            <span className="text-[9px] font-mono font-bold text-muted-foreground flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {Math.floor((song.duration_seconds || 0) / 60)}:{(Math.floor((song.duration_seconds || 0) % 60)).toString().padStart(2, '0')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center gap-1">
                                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                  <div className={cn("h-full transition-all duration-500", getEnergyBarClass(song.energy_level))} />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                  {song.energy_level || 'TBC'}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px] font-black uppercase">
                              Energy Zone: {song.energy_level || 'Not Classified'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-6 text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-center gap-1 cursor-help">
                                <span className={cn(
                                  "text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg flex items-center gap-1.5",
                                  readinessScore >= 90 ? "bg-emerald-600/20 text-emerald-400" : "bg-amber-600/20 text-amber-400"
                                )}>
                                  {readinessScore}%
                                  <Info className="w-2.5 h-2.5 opacity-50" />
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="p-3 bg-slate-900 border-white/10 rounded-xl shadow-2xl">
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">Readiness Breakdown</p>
                                {getReadinessBreakdown(song).map((item, i) => (
                                  <p key={i} className="text-[10px] font-bold text-slate-300 flex items-center gap-2">
                                    {item}
                                  </p>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-6 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5 h-full">
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7 transition-all flex items-center justify-center", isReorderingEnabled ? "text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50" : "text-muted-foreground opacity-20 cursor-not-allowed")} onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'up'); }} disabled={!isReorderingEnabled || idx === 0}>
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className={cn("h-7 w-7 transition-all flex items-center justify-center", isReorderingEnabled ? "text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50" : "text-muted-foreground opacity-20 cursor-not-allowed")} onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'down'); }} disabled={!isReorderingEnabled || idx === processedSongs.length - 1}>
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-6 text-center">
                        <div className="flex items-center justify-center gap-4 h-full">
                          <div className="text-center min-w-[32px]">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Orig</p>
                            <span className="text-xs font-mono font-bold text-foreground">{displayOrigKey}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center opacity-30">
                            <ArrowRight className="w-3 h-3 text-muted-foreground mb-0.5" />
                            <div className="h-px w-6 bg-border" />
                          </div>
                          <div className="text-center min-w-[32px] relative">
                            <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Stage</p>
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
                          <SetlistMultiSelector
                            songMasterId={song.id}
                            allSetlists={allSetlists}
                            songToAssign={song}
                            onUpdateSetlistSongs={onUpdateSetlistSongs}
                          />
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 transition-colors inline-flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onEdit(song); }}>
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-accent dark:hover:bg-secondary">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdateSong(song.id, { isApproved: !song.isApproved }); showSuccess(`Song marked as ${song.isApproved ? 'unapproved' : 'approved'} for gig.`); }}>
                                {song.isApproved ? <Check className="w-4 h-4 mr-2 text-emerald-500" /> : <ListMusic className="w-4 h-4 mr-2" />}
                                {song.isApproved ? "Unapprove for Gig" : "Approve for Gig"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToTop(song.id); }} disabled={!isReorderingEnabled || idx === 0}>
                                <ChevronUp className="w-4 h-4 mr-2 text-indigo-600" /> Move to Top
                              </ChevronUp>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'up'); }} disabled={!isReorderingEnabled || idx === 0}>
                                <ChevronUp className="w-4 h-4 mr-2 opacity-50" /> Move Up
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'down'); }} disabled={!isReorderingEnabled || idx === processedSongs.length - 1}>
                                <ChevronDown className="w-4 h-4 mr-2 opacity-50" /> Move Down
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToBottom(song.id); }} disabled={!isReorderingEnabled || idx === processedSongs.length - 1}>
                                <ChevronDown className="w-4 h-4 mr-2 text-indigo-600" /> Move to Bottom
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(song); }}>
                                <Settings2 className="w-4 h-4 mr-2" /> Configure Studio
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(song.id); }}>
                                <Trash2 className="w-4 h-4 mr-2" /> Remove Track
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {activeSetlistId && masterRepertoire.length > 0 && (
        <SongRecommender 
          currentSongs={rawSongs} 
          repertoire={masterRepertoire} 
          onAddSong={(song) => onUpdateSetlistSongs(activeSetlistId, song, 'add')}
        />
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-card border-border text-foreground rounded-[2rem]">
          <AlertDialogHeader>
            <div className="bg-destructive/10 w-12 h-12 rounded-2xl flex items-center justify-center text-destructive mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Remove Track?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will remove the song from your active setlist. The master record will remain in your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl border-border bg-secondary hover:bg-accent hover:text-foreground font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirmId) { onRemove(deleteConfirmId); setDeleteConfirmId(null); showSuccess("Track Removed"); } }} className="rounded-xl bg-destructive hover:bg-destructive-foreground text-white font-black uppercase text-[10px] tracking-widest">Confirm Removal</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SetlistManager;
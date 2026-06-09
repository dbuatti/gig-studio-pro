"use client";
import React, { useState, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, CircleDashed, CloudDownload, AlertTriangle,
  ShieldCheck, Clock, ArrowRight, Check, ChevronDown,
  ChevronUp, Edit3, MoreVertical, ListMusic, Settings2, Trash2, LayoutList, Library,
  BookOpen, Tv, Sliders, Loader2, RotateCcw, Plus
} from 'lucide-react';

import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, transposeKey, calculateSemitones } from '@/utils/keyUtils';
import { cn } from '@/lib/utils';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { SubsetSongSuggesterModal } from './SubsetSongSuggesterModal';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { RESOURCE_TYPES, DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useIsMobile } from '@/hooks/use-mobile';
import SetlistFilters, { FilterState, DEFAULT_FILTERS } from './SetlistFilters';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SheetLink } from './LinkDisplayOverlay';
import { sortSongsByStrategy, analyzeEnergyFatigue } from '@/utils/SetlistGenerator';
import SongRecommender from './SongRecommender';
import { supabase } from '@/integrations/supabase/client';
import SetlistRow from './SetlistRow';
import SetlistMobileCard from './SetlistMobileCard';
import SetlistControls from './SetlistControls';

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
  needs_improvement?: boolean;
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
  set_group?: number;
  sort_order?: number;
}

export interface Setlist {
  id: string;
  name: string;
  songs: SetlistSong[];
  time_goal?: number;
  set_names?: Record<string, string>;
  stimulus_text?: string;
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
  isFilterOpen: boolean;
  setIsFilterOpen: (open: boolean) => void;
  onOpenSetReader?: (groupNum: number) => void;
  onOpenSetKaraoke?: (groupNum: number) => void;
  onCompileSetSongs?: (groupNum: number) => void;
  onReshuffleSubset?: (groupNum: number) => void;
  onRefresh?: () => Promise<void>;
}

const SetlistManager: React.FC<SetlistManagerProps> = ({
  songs: rawSongs,
  onRemove,
  onSelect,
  onEdit,
  onUpdateKey,
  onTogglePlayed,
  onUpdateSong,
  onUpdateSetlistSongs,
  onReorder,
  currentSongId,
  sortMode,
  setSortMode,
  activeFilters,
  setActiveFilters,
  searchTerm,
  setSearchTerm,
  showHeatmap,
  allSetlists,
  onOpenSortModal,
  onBulkVibeCheck,
  masterRepertoire = [],
  activeSetlistId,
  isFilterOpen,
  setIsFilterOpen,
  onOpenSetReader,
  onOpenSetKaraoke,
  onCompileSetSongs,
  onReshuffleSubset,
  onRefresh
}) => {
  const isMobile = useIsMobile();
  const { keyPreference: globalPreference } = useSettings();
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isVibeChecking, setIsVibeChecking] = useState(false);
  const [vibeCheckProgress, setVibeCheckProgress] = useState(0);
  
  // Subset practice & discovery states
  const [reshufflingGroup, setReshufflingGroup] = useState<number | null>(null);
  const [suggesterGroup, setSuggesterGroup] = useState<number | null>(null);

  const handleReshuffle = async (groupNum: number) => {
    if (onReshuffleSubset) {
      setReshufflingGroup(groupNum);
      try {
        await onReshuffleSubset(groupNum);
      } finally {
        setReshufflingGroup(null);
      }
    }
  };

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
    } else if (sortMode.startsWith('energy') || sortMode === 'zig-zag' || sortMode === 'wedding-ramp') {
      songs = sortSongsByStrategy(songs, sortMode);
    }

    return songs;
  }, [rawSongs, searchTerm, sortMode]);

  const groupedBySet = useMemo(() => {
    if (sortMode !== 'manual' && sortMode !== 'none') return { 1: processedSongs };
    
    const groups: Record<number, SetlistSong[]> = {};
    processedSongs.forEach(song => {
      const group = song.set_group || 1;
      if (!groups[group]) groups[group] = [];
      groups[group].push(song);
    });
    return groups;
  }, [processedSongs, sortMode]);

  const sortedSetGroups = useMemo(() => {
    return Object.keys(groupedBySet).map(Number).sort((a, b) => {
      if (a === 99) return 1;
      if (b === 99) return -1;
      return a - b;
    });
  }, [groupedBySet]);

  const hasMultipleSets = sortedSetGroups.length > 0;

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

  const getSetLabel = (group: number) => {
    if (activeSetlistId) {
      const activeSetlist = allSetlists.find(s => s.id === activeSetlistId);
      if (activeSetlist?.set_names?.[group.toString()]) {
        return activeSetlist.set_names[group.toString()];
      }
    }
    if (group === 99) return "Surplus / Backup";
    return `Set ${group}`;
  };

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
    const songsToVibeCheck = rawSongs.filter(s => !s.energy_level && s.name && s.artist);
    if (songsToVibeCheck.length === 0) {
      showInfo("All songs already have an Energy Zone.");
      return;
    }

    setIsVibeChecking(true);
    setVibeCheckProgress(0);
    
    let successCount = 0;
    let failCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (let i = 0; i < songsToVibeCheck.length; i++) {
        const song = songsToVibeCheck[i];
        try {
          if (i > 0) await new Promise(resolve => setTimeout(resolve, 4000));

          const { data, error } = await supabase.functions.invoke('vibe-check', {
            body: {
              title: song.name,
              artist: song.artist,
              bpm: song.bpm,
              genre: song.genre,
              userTags: song.user_tags
            }
          });

          if (error) throw new Error(error.message || "Unknown error");

          if (data?.energy_level) {
            await syncToMasterRepertoire(user.id, [{
              id: song.master_id || song.id,
              energy_level: data.energy_level,
              genre: data.refined_genre || song.genre
            }]);
            successCount++;
          }
        } catch (err) {
          failCount++;
        }
        setVibeCheckProgress(Math.round(((i + 1) / songsToVibeCheck.length) * 100));
      }

      if (successCount > 0) {
        showSuccess(`Vibe Check Complete: ${successCount} updated, ${failCount} failed.`);
        await onBulkVibeCheck(); 
      } else if (failCount > 0) {
        showError(`Vibe Check failed for ${failCount} songs.`);
      }
    } catch (err: any) {
      showError(`Vibe Check Error: ${err.message}`);
    } finally {
      setIsVibeChecking(false);
      setVibeCheckProgress(0);
    }
  };

  const getReadinessBreakdown = (song: SetlistSong) => {
    const items = [];
    const status = (song.extraction_status || "").toLowerCase();
    if (song.audio_url && status === 'completed') items.push("✅ Full Audio (20%)");
    else if (song.previewUrl) items.push("⚠️ Preview Only (5%)");
    else items.push("❌ No Audio");
    
    const hasLyrics = (song.lyrics || "").length > 50;
    const hasChords = (song.ug_chords_text || "").length > 20;
    if (hasLyrics && hasChords) items.push("✅ Lyrics & Chords (20%)");
    else if (hasLyrics || hasChords) items.push("⚠️ Partial Charts (10%)");
    else items.push("❌ No Charts");

    if (song.isKeyConfirmed) items.push("✅ Key Confirmed (10%)");
    if (song.bpm && song.bpm !== "0") items.push("✅ BPM Set (10%)");
    if (song.pdfUrl || song.leadsheetUrl || song.sheet_music_url) items.push("✅ Sheet Music (5%)");
    if (song.isMetadataConfirmed) items.push("✅ Metadata Verified (5%)");
    
    const comfort = song.comfort_level || 0;
    items.push(`${comfort > 0 ? '✅' : '❌'} Mastery Rating: ${comfort}/5 stars (${Math.round((comfort/5)*30)}%)`);

    return items;
  };

  return (
    <div className="space-y-8">
      <SetlistControls 
        sortMode={sortMode}
        setSortMode={setSortMode}
        onOpenSortModal={onOpenSortModal}
        isFilterOpen={isFilterOpen}
        setIsFilterOpen={setIsFilterOpen}
        handleVibeCheck={handleVibeCheckAction}
        isVibeChecking={isVibeChecking}
        vibeCheckProgress={vibeCheckProgress}
        vibeCheckCount={rawSongs.filter(s => !s.energy_level && s.name && s.artist).length}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
      />

      {isFilterOpen && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <SetlistFilters activeFilters={activeFilters} onFilterChange={setActiveFilters} />
        </div>
      )}

      {energyFatigueIndices.length > 0 && (
        <div className="p-6 bg-red-600/10 border border-red-500/20 rounded-[2.5rem] flex items-start gap-6 shadow-2xl shadow-red-900/10">
          <div className="bg-red-600 p-3 rounded-2xl shadow-lg shadow-red-900/20">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-base font-black uppercase tracking-tight text-red-400">Energy Fatigue Warning</p>
            <p className="text-sm text-slate-400 mt-2 font-medium leading-relaxed max-w-3xl">
              You have {energyFatigueIndices.length} high-energy clusters (3+ 'Peak' songs in a row). Consider adding a 'Pulse' or 'Ambient' track to prevent audience burnout.
            </p>
          </div>
        </div>
      )}

      {isMobile ? (
        <div className="space-y-6 px-1 pb-8">
          {sortedSetGroups.map(groupNum => (
            <React.Fragment key={groupNum}>
              {hasMultipleSets && (
                <div className="flex flex-col gap-2 py-3">
                  <div className="flex items-center gap-4">
                    <Badge className={cn(
                      "h-8 px-5 rounded-full font-black uppercase tracking-widest text-[10px] gap-2.5",
                      groupNum === 99 ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-indigo-600 text-white"
                    )}>
                      {groupNum === 99 && <AlertTriangle className="w-3.5 h-3.5" />}
                      {getSetLabel(groupNum)}
                    </Badge>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                  {groupNum !== 99 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenSetReader?.(groupNum)}
                        className="h-8 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-indigo-400 border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 gap-1.5 shrink-0"
                      >
                        <BookOpen className="w-3 h-3" />
                        Reader
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenSetKaraoke?.(groupNum)}
                        className="h-8 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 gap-1.5 shrink-0"
                      >
                        <Tv className="w-3 h-3" />
                        Karaoke
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCompileSetSongs?.(groupNum)}
                        className="h-8 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-amber-400 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 gap-1.5 shrink-0"
                      >
                        <Sliders className="w-3 h-3" />
                        Compile
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {groupedBySet[groupNum].map((song) => (
                <SetlistMobileCard
                  key={song.id}
                  song={song}
                  isSelected={currentSongId === song.id}
                  readinessScore={calculateReadiness(song)}
                  isFullyReady={calculateReadiness(song) === 100}
                  currentPref={globalPreference}
                  onTogglePlayed={onTogglePlayed}
                  onEdit={onEdit}
                  onSelect={onSelect}
                  onUpdateSong={onUpdateSong}
                  onUpdateKey={onUpdateKey}
                  setDeleteConfirmId={setDeleteConfirmId}
                  getHeatmapClass={getHeatmapClass}
                  getEnergyBarClass={getEnergyBarClass}
                />
              ))}
              {groupNum !== 99 && (
                <div className="flex items-center gap-2 px-2 pt-2 pb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSuggesterGroup(groupNum)}
                    className="flex-1 h-9 rounded-xl text-[10px] font-bold uppercase tracking-wider text-indigo-400 border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Suggest Songs
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reshufflingGroup === groupNum}
                    onClick={() => handleReshuffle(groupNum)}
                    className="flex-1 h-9 rounded-xl text-[10px] font-bold uppercase tracking-wider text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 gap-1.5"
                  >
                    {reshufflingGroup === groupNum ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    Reshuffle
                  </Button>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="bg-slate-950/50 rounded-[3rem] border-4 border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-900/90 border-b border-white/10">
                  <th className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 w-24 text-center">Status</th>
                  <th className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 text-left">Track Details</th>
                  <th className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 w-36 text-center">Energy</th>
                  <th className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 w-40 text-center">Mastery</th>
                  <th className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 w-28 text-center cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => setSortMode(sortMode === 'ready' ? 'work' : 'ready')}>
                    <div className="flex items-center justify-center gap-1.5">
                      Ready
                      {sortMode === 'ready' && <ChevronDown className="w-3.5 h-3.5" />}
                      {sortMode === 'work' && <ChevronUp className="w-3.5 h-3.5" />}
                    </div>
                  </th>
                  <th className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 w-32 text-center">Order</th>
                  <th className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 w-64 text-center">Harmonic Map</th>
                  <th className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 w-56 text-right pr-14">Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {processedSongs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-40 text-center">
                      <div className="flex flex-col items-center justify-center space-y-6 opacity-30">
                        <Library className="w-20 h-20 text-indigo-500" />
                        <div>
                          <p className="text-2xl font-black uppercase tracking-tight">Setlist Empty</p>
                          <p className="text-sm font-bold uppercase tracking-widest mt-2">Add tracks from your library to begin</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedSetGroups.map(groupNum => (
                    <React.Fragment key={groupNum}>
                      {hasMultipleSets && (
                        <tr className="bg-slate-900/60 border-y border-white/10">
                          <td colSpan={8} className="py-4 px-10">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <Badge className={cn(
                                  "h-8 px-5 rounded-full font-black uppercase tracking-widest text-[10px] gap-2.5",
                                  groupNum === 99 ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-indigo-600 text-white"
                                )}>
                                  {groupNum === 99 && <AlertTriangle className="w-3.5 h-3.5" />}
                                  {getSetLabel(groupNum)}
                                </Badge>
                                
                                {groupNum !== 99 && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onOpenSetReader?.(groupNum)}
                                      className="h-8 px-3 rounded-xl text-xs font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 gap-1.5 transition-all"
                                    >
                                      <BookOpen className="w-3.5 h-3.5" />
                                      Set Reader
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onOpenSetKaraoke?.(groupNum)}
                                      className="h-8 px-3 rounded-xl text-xs font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1.5 transition-all"
                                    >
                                      <Tv className="w-3.5 h-3.5" />
                                      Set Karaoke
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => onCompileSetSongs?.(groupNum)}
                                      className="h-8 px-3 rounded-xl text-xs font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-1.5 transition-all"
                                    >
                                      <Sliders className="w-3.5 h-3.5" />
                                      Compile Set
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="h-px flex-1 bg-white/10" />
                            </div>
                          </td>
                        </tr>
                      )}
                      {groupedBySet[groupNum].map((song, idx) => (
                        <SetlistRow
                          key={song.id}
                          song={song}
                          isSelected={currentSongId === song.id}
                          readinessScore={calculateReadiness(song)}
                          isFullyReady={calculateReadiness(song) === 100}
                          currentPref={globalPreference}
                          idx={idx}
                          onTogglePlayed={onTogglePlayed}
                          onEdit={onEdit}
                          onSelect={onSelect}
                          onUpdateSong={onUpdateSong}
                          onUpdateKey={onUpdateKey}
                          onRemove={onRemove}
                          allSetlists={allSetlists}
                          onUpdateSetlistSongs={onUpdateSetlistSongs}
                          isReorderingEnabled={sortMode === 'manual' && !searchTerm}
                          handleMove={handleMove}
                          handleMoveToTop={handleMoveToTop}
                          handleMoveToBottom={handleMoveToBottom}
                          setDeleteConfirmId={setDeleteConfirmId}
                          getHeatmapClass={getHeatmapClass}
                          getEnergyBarClass={getEnergyBarClass}
                          getReadinessBreakdown={getReadinessBreakdown}
                        />
                      ))}
                      {groupNum !== 99 && (
                        <tr className="bg-slate-950/20 border-b border-white/5">
                          <td colSpan={8} className="py-4 px-10">
                            <div className="flex items-center gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSuggesterGroup(groupNum)}
                                className="h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-indigo-400 border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 gap-2 transition-all"
                              >
                                <Plus className="w-4 h-4" />
                                Suggest Songs for {getSetLabel(groupNum)}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={reshufflingGroup === groupNum}
                                onClick={() => handleReshuffle(groupNum)}
                                className="h-9 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 gap-2 transition-all"
                              >
                                {reshufflingGroup === groupNum ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-4 h-4" />
                                )}
                                Reshuffle Flow
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSetlistId && masterRepertoire.length > 0 && (
        <div className="mt-12">
          <SongRecommender currentSongs={rawSongs} repertoire={masterRepertoire} onAddSong={(song) => onUpdateSetlistSongs(activeSetlistId, song, 'add')} />
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-slate-950 border-white/10 text-white rounded-[2.5rem] p-10 shadow-2xl">
          <AlertDialogHeader>
            <div className="bg-red-600/10 w-20 h-20 rounded-[2rem] flex items-center justify-center text-red-500 mb-8 shadow-lg shadow-red-900/10">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <AlertDialogTitle className="text-3xl font-black uppercase tracking-tight">Remove Track?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 font-medium text-lg leading-relaxed">
              This will remove the song from your active setlist. The master record will remain in your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4">
            <AlertDialogCancel className="rounded-2xl border-white/5 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-xs tracking-widest h-16 px-10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirmId) { onRemove(deleteConfirmId); setDeleteConfirmId(null); showSuccess("Track Removed"); } }} className="rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-widest h-16 px-10 shadow-xl shadow-red-600/20">Confirm Removal</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SubsetSongSuggesterModal
        isOpen={suggesterGroup !== null}
        onClose={() => setSuggesterGroup(null)}
        subsetName={suggesterGroup !== null ? getSetLabel(suggesterGroup) : ""}
        subsetSongs={suggesterGroup !== null ? groupedBySet[suggesterGroup] || [] : []}
        repertoire={masterRepertoire}
        setlistId={activeSetlistId || ""}
        setGroup={suggesterGroup || 1}
        onSongAdded={async () => {
          if (onRefresh) await onRefresh();
        }}
      />
    </div>
  );
};

export default SetlistManager;
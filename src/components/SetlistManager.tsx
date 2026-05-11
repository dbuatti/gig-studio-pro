"use client";
import React, { useState, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { 
  ListMusic, Trash2, Play, Music, Youtube, ArrowRight, CircleDashed, 
  CheckCircle2, Volume2, ChevronUp, ChevronDown, Search, LayoutList, 
  SortAsc, AlertTriangle, Loader2, Guitar, CloudDownload, Edit3, 
  Filter, MoreVertical, Settings2, Check, ShieldCheck, Clock, Star, 
  Zap, Sparkles, Info, TrendingUp, Hash 
} from 'lucide-react';

import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, transposeKey, calculateSemitones } from '@/utils/keyUtils';
import { cn } from '@/lib/utils';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  setIsFilterOpen
}) => {
  const isMobile = useIsMobile();
  const { keyPreference: globalPreference } = useSettings();
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isVibeChecking, setIsVibeChecking] = useState(false);
  const [vibeCheckProgress, setVibeCheckProgress] = useState(0);

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

  const hasMultipleSets = sortedSetGroups.length > 1;

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

          if (error) throw error;

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
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 px-2">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-1 bg-slate-900/50 p-1.5 rounded-2xl w-full sm:w-auto overflow-x-auto no-scrollbar border border-white/5">
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setSortMode('none')}
              className={cn(
                "h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 shrink-0 rounded-xl transition-all",
                sortMode === 'none' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white"
              )}
            >
              <LayoutList className="w-3.5 h-3.5" /> <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => setSortMode('manual')}
              className={cn(
                "h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 shrink-0 rounded-xl transition-all",
                sortMode === 'manual' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white"
              )}
            >
              <SortAsc className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Manual</span>
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={onOpenSortModal}
              className="h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 shrink-0 rounded-xl text-indigo-400 hover:bg-indigo-500/10"
            >
              <Sparkles className="w-3.5 h-3.5" /> <span className="hidden sm:inline">AI Sort</span>
            </Button>
            <div className="w-px h-4 bg-white/10 mx-1 hidden sm:block" />
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setSortMode(sortMode === 'ready' ? 'work' : 'ready')}
              className={cn(
                "h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 shrink-0 rounded-xl transition-all",
                (sortMode === 'ready' || sortMode === 'work') ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-slate-400 hover:text-white"
              )}
            >
              {sortMode === 'work' ? <TrendingUp className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{sortMode === 'work' ? 'Work Needed' : 'Ready'}</span>
            </Button>
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setSortMode('energy-asc')}
              className={cn(
                "h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 shrink-0 rounded-xl transition-all",
                sortMode === 'energy-asc' ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "text-slate-400 hover:text-white"
              )}
            >
              <Zap className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Energy</span>
            </Button>
          </div>
          <Button 
            variant="ghost" size="sm" 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={cn(
              "h-11 px-5 text-[10px] font-black uppercase tracking-widest rounded-2xl gap-2.5 transition-all border",
              isFilterOpen ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/20" : "bg-slate-900/50 text-slate-400 border-white/5 hover:text-white hover:bg-slate-800"
            )}
          >
            <Filter className="w-4 h-4" /> Matrix Filters
          </Button>
        </div>
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleVibeCheckAction}
                  disabled={isVibeChecking || (rawSongs.filter(s => !s.energy_level && s.name && s.artist).length === 0)}
                  className={cn(
                    "h-11 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-2.5 shadow-xl transition-all active:scale-95",
                    isVibeChecking ? "bg-purple-600/50 text-white cursor-wait" : "bg-purple-600 hover:bg-purple-50 text-white shadow-purple-600/20"
                  )}
                >
                  {isVibeChecking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {vibeCheckProgress}%
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Vibe Check ({rawSongs.filter(s => !s.energy_level && s.name && s.artist).length})
                    </>
                  )}
                </Button>
              </TooltipTrigger>
            </Tooltip>
          </TooltipProvider>
          <div className="relative flex-1 sm:w-72 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <Input 
              placeholder="Search Gig Repertoire..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 pl-11 text-[11px] font-bold bg-slate-900/50 border-white/5 rounded-2xl focus-visible:ring-indigo-500/50 focus-visible:bg-slate-900 transition-all"
            />
          </div>
        </div>
      </div>

      {isFilterOpen && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <SetlistFilters activeFilters={activeFilters} onFilterChange={setActiveFilters} />
        </div>
      )}

      {energyFatigueIndices.length > 0 && (
        <div className="p-5 bg-red-600/10 border border-red-500/20 rounded-[2rem] flex items-start gap-5 shadow-2xl shadow-red-900/10">
          <div className="bg-red-600 p-2 rounded-xl shadow-lg shadow-red-600/20">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-tight text-red-400">Energy Fatigue Warning</p>
            <p className="text-[11px] text-slate-400 mt-1.5 font-medium leading-relaxed max-w-2xl">
              You have {energyFatigueIndices.length} high-energy clusters (3+ 'Peak' songs in a row). Consider adding a 'Pulse' or 'Ambient' track to prevent audience burnout.
            </p>
          </div>
        </div>
      )}

      {isMobile ? (
        <div className="space-y-4 px-1 pb-6">
          {sortedSetGroups.map(groupNum => (
            <React.Fragment key={groupNum}>
              {hasMultipleSets && (
                <div className="flex items-center gap-3 py-2">
                  <Badge className={cn(
                    "h-7 px-4 rounded-full font-black uppercase tracking-widest text-[9px] gap-2",
                    groupNum === 99 ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-indigo-600 text-white"
                  )}>
                    {groupNum === 99 && <AlertTriangle className="w-3 h-3" />}
                    {getSetLabel(groupNum)}
                  </Badge>
                  <div className="h-px flex-1 bg-white/5" />
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
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="bg-slate-950/50 rounded-[2.5rem] border-4 border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-slate-900/80 border-b border-white/5">
                  <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 w-20 text-center">Sts</th>
                  <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">Song / Resource Matrix</th>
                  <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 w-32 text-center">Energy</th>
                  <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 w-36 text-center">Mastery</th>
                  <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 w-24 text-center cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => setSortMode(sortMode === 'ready' ? 'work' : 'ready')}>
                    <div className="flex items-center justify-center gap-1">
                      Ready
                      {sortMode === 'ready' && <ChevronDown className="w-3 h-3" />}
                      {sortMode === 'work' && <ChevronUp className="w-3 h-3" />}
                    </div>
                  </th>
                  <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28 text-center">Move</th>
                  <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 w-56 text-center">Harmonic Map</th>
                  <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 w-48 text-right pr-12">Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedSetGroups.map(groupNum => (
                  <React.Fragment key={groupNum}>
                    {hasMultipleSets && (
                      <tr className="bg-slate-900/40 border-y border-white/5">
                        <td colSpan={8} className="py-3 px-8">
                          <div className="flex items-center gap-3">
                            <Badge className={cn(
                              "h-7 px-4 rounded-full font-black uppercase tracking-widest text-[9px] gap-2",
                              groupNum === 99 ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-indigo-600 text-white"
                            )}>
                              {groupNum === 99 && <AlertTriangle className="w-3 h-3" />}
                              {getSetLabel(groupNum)}
                            </Badge>
                            <div className="h-px flex-1 bg-white/5" />
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
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSetlistId && masterRepertoire.length > 0 && (
        <div className="mt-10">
          <SongRecommender currentSongs={rawSongs} repertoire={masterRepertoire} onAddSong={(song) => onUpdateSetlistSongs(activeSetlistId, song, 'add')} />
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-slate-950 border-white/10 text-white rounded-[2.5rem] p-8 shadow-2xl">
          <AlertDialogHeader>
            <div className="bg-red-600/10 w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-red-500 mb-6 shadow-lg shadow-red-900/10">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Remove Track?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 font-medium text-base leading-relaxed">
              This will remove the song from your active setlist. The master record will remain in your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 gap-4">
            <AlertDialogCancel className="rounded-2xl border-white/5 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[11px] tracking-widest h-14 px-8">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirmId) { onRemove(deleteConfirmId); setDeleteConfirmId(null); showSuccess("Track Removed"); } }} className="rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black uppercase text-[11px] tracking-widest h-14 px-8 shadow-xl shadow-red-600/20">Confirm Removal</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SetlistManager;
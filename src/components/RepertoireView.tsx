"use client";

import React, { useState, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Library, Music, Settings2, Plus, Check, ShieldCheck,
  Star, Filter, AlertTriangle, Loader2, CloudDownload, Edit3, ListMusic, ArrowRight, Trash2, X
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { cn } from "@/lib/utils";
import { formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import SetlistMultiSelector from './SetlistMultiSelector';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { showSuccess } from '@/utils/toast';
import SetlistFilters, { FilterState, DEFAULT_FILTERS } from './SetlistFilters';
import SetlistExporter from './SetlistExporter';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import RepertoireSuggestions from './RepertoireSuggestions';
import { filterAndSortRepertoire } from '@/utils/repertoireFilters';
import { useIsMobile } from '@/hooks/use-mobile';
import RepertoireMobileCard from './RepertoireMobileCard';

interface RepertoireViewProps {
  repertoire: SetlistSong[];
  onEditSong: (song: SetlistSong, defaultTab?: 'details' | 'audio' | 'charts' | 'lyrics' | 'visual' | 'config' | 'library') => void;
  allSetlists: { id: string; name: string; songs: SetlistSong[] }[];
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  onRefreshRepertoire: () => void;
  onAddSong: (song: SetlistSong) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortMode: 'none' | 'ready' | 'work' | 'manual';
  setSortMode: (mode: 'none' | 'ready' | 'work' | 'manual') => void;
  activeFilters: FilterState;
  setActiveFilters: (filters: FilterState) => void;
  onAutoLink?: () => Promise<void>;
  onGlobalAutoSync?: () => Promise<void>;
  onBulkRefreshAudio?: () => Promise<void>;
  onClearAutoLinks?: () => Promise<void>;
  onBulkVibeCheck?: () => Promise<void>;
  isBulkDownloading?: boolean;
  missingAudioCount?: number;
  onOpenAdmin?: () => void;
  onDeleteSong: (songId: string) => Promise<void>;
  activeSetlistId?: string | null;
}

const RepertoireView: React.FC<RepertoireViewProps> = ({
  repertoire,
  onEditSong,
  allSetlists,
  onUpdateSetlistSongs,
  onRefreshRepertoire,
  onAddSong,
  searchTerm,
  setSearchTerm,
  sortMode,
  setSortMode,
  activeFilters,
  setActiveFilters,
  onAutoLink,
  onGlobalAutoSync,
  onBulkRefreshAudio,
  onClearAutoLinks,
  onBulkVibeCheck,
  isBulkDownloading,
  missingAudioCount,
  onOpenAdmin,
  onDeleteSong,
  activeSetlistId,
}) => {
  const { keyPreference } = useSettings();
  const isMobile = useIsMobile();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const activeSetlistSongs = useMemo(() => {
    if (!activeSetlistId) return [];
    return allSetlists.find(l => l.id === activeSetlistId)?.songs || [];
  }, [allSetlists, activeSetlistId]);

  const filteredAndSortedRepertoire = useMemo(() => {
    return filterAndSortRepertoire(
      repertoire,
      searchTerm,
      activeFilters,
      sortMode,
      activeSetlistSongs
    );
  }, [repertoire, searchTerm, activeFilters, sortMode, activeSetlistSongs]);

  const handleAddNewSong = () => {
    const newSong: SetlistSong = {
      id: Math.random().toString(36).substr(2, 9),
      name: "New Track",
      artist: "Unknown Artist",
      previewUrl: "",
      audio_url: "",
      pitch: 0,
      originalKey: "C",
      targetKey: "C",
      isPlayed: false,
      isSyncing: true,
      isMetadataConfirmed: false,
      isKeyConfirmed: false,
      duration_seconds: 0,
      notes: "",
      lyrics: "",
      resources: [],
      user_tags: [],
      is_pitch_linked: true,
      isApproved: false,
      preferred_reader: null,
      ug_chords_config: DEFAULT_UG_CHORDS_CONFIG,
      is_ug_chords_present: false,
      highest_note_original: null,
      is_ug_link_verified: false,
      metadata_source: null,
      sync_status: 'IDLE',
      last_sync_log: null,
      auto_synced: false,
      is_sheet_verified: false,
      sheet_music_url: null,
      extraction_status: 'idle',
      extraction_error: null,
    };
    onAddSong(newSong);
    onEditSong(newSong, 'details');
    showSuccess("New track added to repertoire!");
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmId) {
      await onDeleteSong(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="space-y-8">
      <RepertoireSuggestions repertoire={repertoire} onAddSong={onAddSong} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                  <ListMusic className="w-3 h-3" /> <span className="hidden sm:inline">Alphabetical</span>
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
              <div className="relative flex-1 sm:w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  placeholder="Search master repertoire..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 sm:h-9 pl-9 pr-8 text-[11px] font-bold bg-card dark:bg-card border-border dark:border-border rounded-xl focus-visible:ring-indigo-500"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Button
                onClick={handleAddNewSong}
                className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-indigo-600/20"
              >
                <Plus className="w-3.5 h-3.5" /> New Track
              </Button>
            </div>
          </div>
          
          {isFilterOpen && (
            <SetlistFilters 
              activeFilters={activeFilters} 
              onFilterChange={setActiveFilters} 
            />
          )}
        </div>
        <div className="lg:col-span-1">
          <SetlistExporter 
            songs={repertoire}
            onAutoLink={onAutoLink}
            onGlobalAutoSync={onGlobalAutoSync}
            onBulkRefreshAudio={onBulkRefreshAudio}
            onClearAutoLinks={onClearAutoLinks}
            onBulkVibeCheck={onBulkVibeCheck}
            isBulkDownloading={false}
            missingAudioCount={missingAudioCount}
            onOpenAdmin={onOpenAdmin}
          />
        </div>
      </div>

      {isMobile ? (
        <div className="space-y-4">
          {filteredAndSortedRepertoire.length === 0 ? (
            <div className="py-20 text-center space-y-6 bg-slate-900/50 rounded-[2.5rem] border border-white/5 shadow-2xl animate-in fade-in zoom-in duration-700">
              <Library className="w-16 h-16 mx-auto text-indigo-500 opacity-50" />
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">No Tracks Found</h3>
                <p className="text-slate-400 max-w-xs mx-auto mt-2 font-medium">
                  Try adjusting your search or filters to find what you're looking for.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => { setSearchTerm(""); setActiveFilters(DEFAULT_FILTERS); }}
                className="h-12 px-6 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px]"
              >
                Clear All Filters
              </Button>

            </div>
          ) : (
            filteredAndSortedRepertoire.map((song) => (
              <RepertoireMobileCard
                key={song.id}
                song={song}
                onEdit={onEditSong}
                onDelete={setDeleteConfirmId}
                allSetlists={allSetlists}
                onUpdateSetlistSongs={onUpdateSetlistSongs}
                currentPref={keyPreference}
              />
            ))
          )}
        </div>
      ) : (
        <div className="bg-slate-950/50 rounded-[2.5rem] border-4 border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-900/90 backdrop-blur-md z-10 border-b border-white/5">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 w-[40%]">Song / Artist</TableHead>
                  <TableHead className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 w-[20%] text-center">Readiness</TableHead>
                  <TableHead className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 w-[20%] text-center">Harmonic Data</TableHead>
                  <TableHead className="py-5 px-8 text-[10px] font-black uppercase tracking-widest text-slate-500 w-[20%] text-right pr-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedRepertoire.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="py-32 text-center">
                      <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-700">
                        <Library className="w-20 h-20 text-indigo-500 opacity-50" />
                        <div>
                          <h3 className="text-2xl font-black uppercase tracking-tight">No Tracks Found</h3>
                          <p className="text-slate-400 max-w-xs mx-auto mt-2 font-medium">
                            Try adjusting your search or filters to find what you're looking for.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => { setSearchTerm(""); setActiveFilters(DEFAULT_FILTERS); }}
                          className="h-14 px-8 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[11px] gap-3"
                        >
                          Clear All Filters
                        </Button>

                      </div>
                    </TableCell>
                  </TableRow>
                ) : (

                  filteredAndSortedRepertoire.map((song) => {
                    const readinessScore = calculateReadiness(song);
                    const isFullyReady = readinessScore === 100;
                    const currentPref = song.key_preference || keyPreference;
                    const displayOrigKey = formatKey(song.originalKey, currentPref);
                    const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref);
                    const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
                    const isExtractionFailed = song.extraction_status === 'failed';

                    return (
                      <TableRow
                        key={song.id}
                        onClick={() => onEditSong(song, 'details')}
                        className={cn(
                          "transition-all group relative cursor-pointer h-[90px] border-b border-white/5",
                          "hover:bg-white/[0.02]"
                        )}
                      >
                        <TableCell className="py-4 px-8 text-left">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-4">
                              <h4 className="text-lg font-black tracking-tight leading-none flex items-center gap-2.5 text-white">
                                {song.name}
                                {isFullyReady && <Check className="w-4.5 h-4.5 text-emerald-500 fill-emerald-500/20" />}
                                {isProcessing && <CloudDownload className="w-4.5 h-4.5 text-indigo-500 animate-bounce" />}
                                {isExtractionFailed && <AlertTriangle className="w-4.5 h-4.5 text-red-500" />}
                              </h4>
                              {song.isMetadataConfirmed && <ShieldCheck className="w-4 h-4 text-indigo-500" />}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                {song.artist || "Unknown Artist"}
                              </span>
                            </div>
                            {isExtractionFailed && song.last_sync_log && (
                              <p className="text-[8px] text-red-400 mt-1 truncate max-w-[200px]">Error: {song.last_sync_log}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-8 text-center">
                          <div className="flex flex-col items-center justify-center h-full gap-1.5">
                            <span className={cn(
                              "text-[11px] font-mono font-bold px-3 py-1 rounded-xl flex items-center gap-2 shadow-lg",
                              readinessScore >= 90 ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/20" : "bg-indigo-600/20 text-indigo-400 border border-indigo-500/20"
                            )}>
                              {readinessScore}%
                            </span>
                            {readinessScore === 100 && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-8 text-center">
                          <div className="flex items-center justify-center gap-6 h-full">
                            <div className="text-center min-w-[40px]">
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Orig</p>
                              <span className="text-sm font-mono font-bold text-slate-300">{displayOrigKey}</span>
                            </div>
                            <div className="flex flex-col items-center justify-center opacity-20">
                              <ArrowRight className="w-4 h-4 text-slate-400 mb-1" />
                              <div className="h-px w-8 bg-white/20" />
                            </div>
                            <div className="text-center min-w-[40px] relative">
                              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Stage</p>
                              <div className={cn(
                                "font-mono font-black text-sm px-3.5 py-1.5 rounded-xl shadow-2xl flex items-center justify-center gap-2 leading-none border transition-all",
                                song.isKeyConfirmed ? "bg-emerald-600 text-white border-emerald-400 shadow-emerald-500/20" : "bg-indigo-600 text-white border-indigo-400 shadow-indigo-500/20"
                              )}>
                                {displayTargetKey}
                                {song.isKeyConfirmed && <Check className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-8 text-right pr-12">
                          <div className="flex items-center justify-end gap-3 h-full">
                            <SetlistMultiSelector
                              songMasterId={song.id}
                              allSetlists={allSetlists}
                              songToAssign={song}
                              onUpdateSetlistSongs={onUpdateSetlistSongs}
                            />
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all inline-flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onEditSong(song); }}>
                              <Edit3 className="w-5 h-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-2xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all inline-flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(song.id);
                              }}
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-card border-border text-foreground rounded-[2rem]">
          <AlertDialogHeader>
            <div className="bg-destructive/10 w-12 h-12 rounded-2xl flex items-center justify-center text-destructive mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Permanently Delete Track?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will remove the song and all its associated data from your master repertoire. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl border-border bg-secondary hover:bg-accent hover:text-foreground font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="rounded-xl bg-destructive hover:bg-destructive-foreground text-white font-black uppercase text-[10px] tracking-widest">Confirm Deletion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RepertoireView;
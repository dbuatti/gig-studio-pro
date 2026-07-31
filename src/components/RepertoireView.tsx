"use client";

import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import BatchImportRepertoire from './BatchImportRepertoire';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  sortMode: 'none' | 'ready' | 'work' | 'manual' | 'artist';
  setSortMode: (mode: 'none' | 'ready' | 'work' | 'manual' | 'artist') => void;
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
  onRetryFailed?: () => Promise<void>;
  retryFailedCount?: number;
  onDeleteSong: (songId: string) => Promise<void>;
  activeSetlistId?: string | null;
  userId?: string;
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
  onRetryFailed,
  retryFailedCount,
  onDeleteSong,
  activeSetlistId,
  userId,
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
    <div className="space-y-6">
      <RepertoireSuggestions repertoire={repertoire} onAddSong={onAddSong} activeSetlistSongs={activeSetlistSongs} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setSortMode('none')}
                  className={cn(
                    "h-7 px-3 text-[9px] font-black uppercase tracking-widest gap-1.5 shrink-0 rounded-lg transition-all",
                    sortMode === 'none' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-500 hover:text-white"
                  )}
                >
                  <ListMusic className="w-3 h-3" /> <span className="hidden sm:inline">A-Z</span>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setSortMode('artist')}
                  className={cn(
                    "h-7 px-3 text-[9px] font-black uppercase tracking-widest gap-1.5 shrink-0 rounded-lg transition-all",
                    sortMode === 'artist' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-500 hover:text-white"
                  )}
                >
                  <Music className="w-3 h-3" /> <span className="hidden sm:inline">Artist</span>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setSortMode('ready')}
                  className={cn(
                    "h-7 px-3 text-[9px] font-black uppercase tracking-widest gap-1.5 shrink-0 rounded-lg transition-all",
                    sortMode === 'ready' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "text-slate-500 hover:text-white"
                  )}
                >
                  <Star className="w-3 h-3" /> <span className="hidden sm:inline">Rdy</span>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setSortMode('work')}
                  className={cn(
                    "h-7 px-3 text-[9px] font-black uppercase tracking-widest gap-1.5 shrink-0 rounded-lg transition-all",
                    sortMode === 'work' ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20" : "text-slate-500 hover:text-white"
                  )}
                >
                  <AlertTriangle className="w-3 h-3" /> <span className="hidden sm:inline">Work</span>
                </Button>
              </div>
              <Button
                variant="ghost" size="sm"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  "h-7 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg gap-1.5 transition-all border",
                  isFilterOpen ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/20" : "text-slate-500 border-white/5 hover:text-white hover:bg-white/5"
                )}
              >
                <Filter className="w-3 h-3" /> Filter
              </Button>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 pl-9 pr-8 text-[11px] font-bold bg-slate-900/60 border-white/5 rounded-xl focus-visible:ring-indigo-500/50 transition-all"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {userId && (
                <BatchImportRepertoire userId={userId} onComplete={onRefreshRepertoire} />
              )}
              <Button
                onClick={handleAddNewSong}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[9px] tracking-widest gap-1.5 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> New
              </Button>
            </div>
          </div>
          
          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <SetlistFilters 
                  activeFilters={activeFilters} 
                  onFilterChange={setActiveFilters} 
                />
              </motion.div>
            )}
          </AnimatePresence>
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
            onRetryFailed={onRetryFailed}
            retryFailedCount={retryFailedCount}
          />
        </div>
      </div>

      {isMobile ? (
        <div className="space-y-6">
          {filteredAndSortedRepertoire.length === 0 ? (
            <div className="py-24 text-center space-y-6 bg-slate-900/50 rounded-[3rem] border border-white/5 shadow-2xl animate-in fade-in zoom-in duration-700">
              <Library className="w-16 h-16 mx-auto text-indigo-500 opacity-50" />
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">{repertoire.length === 0 ? 'Library is Empty' : 'No Results'}</h3>
                <p className="text-slate-400 max-w-xs mx-auto mt-2 font-medium">
                  {repertoire.length === 0 ? 'Add your first track to get started.' : 'Try adjusting your search or filters.'}
                </p>
              </div>
              {repertoire.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => { setSearchTerm(""); setActiveFilters(DEFAULT_FILTERS); }}
                  className="h-14 px-8 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[11px]"
                >
                  Clear All Filters
                </Button>
              )}
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
        <div className="bg-slate-950/50 rounded-2xl border border-white/5 shadow-xl overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-900/90 backdrop-blur-md z-10 border-b border-white/5">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="py-2.5 px-3 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 w-[45%]">Song</TableHead>
                  <TableHead className="py-2.5 px-3 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 w-[15%] text-center">Rdy</TableHead>
                  <TableHead className="py-2.5 px-3 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 w-[20%] text-center">Key</TableHead>
                  <TableHead className="py-2.5 px-3 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 w-[20%] text-right">Act</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedRepertoire.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="py-40 text-center">
                      <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-700">
                        <Library className="w-24 h-24 text-indigo-500 opacity-50" />
                        <div>
                          <h3 className="text-3xl font-black uppercase tracking-tight">{repertoire.length === 0 ? 'Library is Empty' : 'No Results'}</h3>
                          <p className="text-slate-400 max-w-sm mx-auto mt-3 font-medium text-lg">
                            {repertoire.length === 0 ? 'Add your first track to get started.' : 'Try adjusting your search or filters.'}
                          </p>
                        </div>
                        {repertoire.length > 0 && (
                          <Button
                            variant="outline"
                            onClick={() => { setSearchTerm(""); setActiveFilters(DEFAULT_FILTERS); }}
                            className="h-16 px-10 rounded-[2rem] border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs gap-4"
                          >
                            Clear All Filters
                          </Button>
                        )}
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
                          "transition-all group relative cursor-pointer h-[48px] border-b border-white/[0.03]",
                          "hover:bg-white/[0.02]"
                        )}
                      >
                        <TableCell className="py-1.5 px-3 text-left min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <h4 className="text-[13px] font-bold tracking-tight leading-none flex items-center gap-1.5 text-white truncate max-w-[260px]">
                              {song.name}
                              {isProcessing && <CloudDownload className="w-3 h-3 text-indigo-500 animate-bounce shrink-0" />}
                              {isExtractionFailed && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                            </h4>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest truncate shrink-0 max-w-[100px]">{song.artist || "Unknown"}</span>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-white/10 text-xs font-medium">
                                  {song.name} — {song.artist || "Unknown Artist"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {isFullyReady && <Check className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20 shrink-0" />}
                            {song.isMetadataConfirmed && <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 px-3 text-center w-16">
                          <span className={cn(
                            "text-[9px] font-mono font-black px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 border",
                            readinessScore >= 90 ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/20" : "bg-indigo-600/20 text-indigo-400 border-indigo-500/20"
                          )}>
                            {readinessScore}%
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5 px-3 text-center w-32">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[9px] font-mono font-bold text-slate-600">{displayOrigKey}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-700" />
                            <div className={cn(
                              "font-mono font-black text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 leading-none border",
                              song.isKeyConfirmed ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/20" : "bg-indigo-600/20 text-indigo-400 border-indigo-500/20"
                            )}>
                              {displayTargetKey}
                              {song.isKeyConfirmed && <Check className="w-2 h-2" />}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5 px-3 text-right pr-3 w-40">
                          <div className="flex items-center justify-end gap-0.5">
                            <SetlistMultiSelector
                              songMasterId={song.id}
                              allSetlists={allSetlists}
                              songToAssign={song}
                              onUpdateSetlistSongs={onUpdateSetlistSongs}
                            />
                            <button className="h-7 w-7 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all inline-flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onEditSong(song); }}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="h-7 w-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all inline-flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(song.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
        <AlertDialogContent className="bg-slate-950 border-white/10 text-white rounded-[2.5rem] p-10 shadow-2xl">
          <AlertDialogHeader>
            <div className="bg-red-600/10 w-20 h-20 rounded-[2rem] flex items-center justify-center text-red-500 mb-8 shadow-lg shadow-red-900/10">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <AlertDialogTitle className="text-3xl font-black uppercase tracking-tight">Permanently Delete Track?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 font-medium text-lg leading-relaxed">
              This will remove the song and all its associated data from your master repertoire. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-12 gap-4">
            <AlertDialogCancel className="rounded-2xl border-white/5 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-xs tracking-widest h-16 px-10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-widest h-16 px-10 shadow-xl shadow-red-600/20">Confirm Deletion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RepertoireView;
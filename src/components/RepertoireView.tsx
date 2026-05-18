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
    <div className="space-y-10">
      <RepertoireSuggestions repertoire={repertoire} onAddSong={onAddSong} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-1 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setSortMode('none')}
                  className={cn(
                    "h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 shrink-0 rounded-xl transition-all",
                    sortMode === 'none' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:text-white"
                  )}
                >
                  <ListMusic className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Alphabetical</span>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setSortMode('ready')}
                  className={cn(
                    "h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 shrink-0 rounded-xl transition-all",
                    sortMode === 'ready' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Star className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Readiness</span>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setSortMode('work')}
                  className={cn(
                    "h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 shrink-0 rounded-xl transition-all",
                    sortMode === 'work' ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20" : "text-slate-400 hover:text-white"
                  )}
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Work Needed</span>
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
                <Filter className="w-4 h-4" /> Matrix
              </Button>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <Input
                  placeholder="Search master repertoire..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 pl-11 pr-10 text-[11px] font-bold bg-slate-900/50 border-white/5 rounded-2xl focus-visible:ring-indigo-500/50 focus-visible:bg-slate-900 transition-all"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                onClick={handleAddNewSong}
                className="h-11 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest gap-2.5 shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> New Track
              </Button>
            </div>
          </div>
          
          {isFilterOpen && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <SetlistFilters 
                activeFilters={activeFilters} 
                onFilterChange={setActiveFilters} 
              />
            </div>
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
        <div className="space-y-6">
          {filteredAndSortedRepertoire.length === 0 ? (
            <div className="py-24 text-center space-y-6 bg-slate-900/50 rounded-[3rem] border border-white/5 shadow-2xl animate-in fade-in zoom-in duration-700">
              <Library className="w-16 h-16 mx-auto text-indigo-500 opacity-50" />
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">No Tracks Found</h3>
                <p className="text-slate-400 max-w-xs mx-auto mt-2 font-medium">
                  Try adjusting your search or filters to find what you're looking for.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => { setSearchTerm(""); setActiveFilters(DEFAULT_FILTERS); }}
                className="h-14 px-8 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[11px]"
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
        <div className="bg-slate-950/50 rounded-[3rem] border-4 border-white/5 shadow-2xl overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-900/90 backdrop-blur-md z-10 border-b border-white/10">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 w-[40%]">Song / Artist</TableHead>
                  <TableHead className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 w-[20%] text-center">Readiness</TableHead>
                  <TableHead className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 w-[20%] text-center">Harmonic Data</TableHead>
                  <TableHead className="py-6 px-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 w-[20%] text-right pr-14">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedRepertoire.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="py-40 text-center">
                      <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-700">
                        <Library className="w-24 h-24 text-indigo-500 opacity-50" />
                        <div>
                          <h3 className="text-3xl font-black uppercase tracking-tight">No Tracks Found</h3>
                          <p className="text-slate-400 max-w-sm mx-auto mt-3 font-medium text-lg">
                            Try adjusting your search or filters to find what you're looking for.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => { setSearchTerm(""); setActiveFilters(DEFAULT_FILTERS); }}
                          className="h-16 px-10 rounded-[2rem] border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs gap-4"
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
                          "transition-all group relative cursor-pointer h-[100px] border-b border-white/5",
                          "hover:bg-white/[0.02]"
                        )}
                      >
                        <TableCell className="py-5 px-10 text-left">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-4">
                              <h4 className="text-xl font-black tracking-tight leading-none flex items-center gap-3 text-white">
                                {song.name}
                                {isFullyReady && <Check className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />}
                                {isProcessing && <CloudDownload className="w-5 h-5 text-indigo-500 animate-bounce" />}
                                {isExtractionFailed && <AlertTriangle className="w-5 h-5 text-red-500" />}
                              </h4>
                              {song.isMetadataConfirmed && <ShieldCheck className="w-4.5 h-4.5 text-indigo-500" />}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                {song.artist || "Unknown Artist"}
                              </span>
                            </div>
                            {isExtractionFailed && song.last_sync_log && (
                              <p className="text-[9px] text-red-400 mt-1.5 truncate max-w-[250px] font-medium">Error: {song.last_sync_log}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-5 px-10 text-center">
                          <div className="flex flex-col items-center justify-center h-full gap-2">
                            <span className={cn(
                              "text-xs font-mono font-black px-4 py-1.5 rounded-xl flex items-center gap-2.5 shadow-lg",
                              readinessScore >= 90 ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/20" : "bg-indigo-600/20 text-indigo-400 border border-indigo-500/20"
                            )}>
                              {readinessScore}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5 px-10 text-center">
                          <div className="flex items-center justify-center gap-8 h-full">
                            <div className="text-center min-w-[45px]">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Orig</p>
                              <span className="text-base font-mono font-bold text-slate-300">{displayOrigKey}</span>
                            </div>
                            <div className="flex flex-col items-center justify-center opacity-20">
                              <ArrowRight className="w-5 h-5 text-slate-400 mb-1" />
                              <div className="h-px w-10 bg-white/20" />
                            </div>
                            <div className="text-center min-w-[45px] relative">
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">Stage</p>
                              <div className={cn(
                                "font-mono font-black text-base px-4 py-2 rounded-xl shadow-2xl flex items-center justify-center gap-2.5 leading-none border transition-all",
                                song.isKeyConfirmed ? "bg-emerald-600 text-white border-emerald-400 shadow-emerald-500/20" : "bg-indigo-600 text-white border-indigo-400 shadow-indigo-500/20"
                              )}>
                                {displayTargetKey}
                                {song.isKeyConfirmed && <Check className="w-4 h-4" />}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-5 px-10 text-right pr-14">
                          <div className="flex items-center justify-end gap-4 h-full">
                            <SetlistMultiSelector
                              songMasterId={song.id}
                              allSetlists={allSetlists}
                              songToAssign={song}
                              onUpdateSetlistSongs={onUpdateSetlistSongs}
                            />
                            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all inline-flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onEditSong(song); }}>
                              <Edit3 className="w-6 h-6" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-12 w-12 rounded-2xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all inline-flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(song.id);
                              }}
                            >
                              <Trash2 className="w-6 h-6" />
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
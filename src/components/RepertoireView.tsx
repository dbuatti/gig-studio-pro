"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Library, Music, Settings2, Plus, Check, ShieldCheck,
  Star, Filter, AlertTriangle, Loader2, CloudDownload, Edit3, ListMusic, ArrowRight, Trash2, Wand2
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { cn } from "@/lib/utils";
import { formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import SetlistMultiSelector from './SetlistMultiSelector';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { showSuccess } from '@/utils/toast';
import SetlistFilters, { FilterState, DEFAULT_FILTERS } from './SetlistFilters';
import SetlistExporter from './SetlistExporter'; // Import SetlistExporter (Automation Hub)
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface RepertoireViewProps {
  repertoire: SetlistSong[];
  onEditSong: (song: SetlistSong, defaultTab?: 'details' | 'audio' | 'charts' | 'lyrics' | 'visual' | 'config' | 'library') => void;
  allSetlists: { id: string; name: string; songs: SetlistSong[] }[];
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  onRefreshRepertoire: () => void;
  onAddSong: (song: SetlistSong) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sortMode: 'none' | 'ready' | 'work';
  setSortMode: (mode: 'none' | 'ready' | 'work') => void;
  activeFilters: FilterState;
  setActiveFilters: (filters: FilterState) => void;
  // Automation Hub Props
  onAutoLink?: () => Promise<void>;
  onGlobalAutoSync?: () => Promise<void>;
  onBulkRefreshAudio?: () => Promise<void>;
  onClearAutoLinks?: () => Promise<void>;
  isBulkDownloading?: boolean;
  missingAudioCount?: number;
  onOpenAdmin?: () => void;
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
  isBulkDownloading,
  missingAudioCount,
  onOpenAdmin
}) => {
  const { keyPreference } = useSettings();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredAndSortedRepertoire = useMemo(() => {
    let songs = [...repertoire];
    const q = searchTerm.toLowerCase();

    songs = songs.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(q) ||
                            s.artist?.toLowerCase().includes(q) ||
                            s.user_tags?.some(tag => tag.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      
      const readiness = calculateReadiness(s);
      const hasAudio = !!s.audio_url;
      const hasItunesPreview = !!s.previewUrl && (s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'));
      const hasVideo = !!s.youtubeUrl;
      const hasPdf = !!s.pdfUrl || !!s.leadsheetUrl || !!s.sheet_music_url;
      const hasUg = !!s.ugUrl;
      const hasUgChords = !!s.ug_chords_text && s.ug_chords_text.trim().length > 0;

      if (activeFilters.readiness > 0 && readiness < activeFilters.readiness) return false;
      if (activeFilters.isConfirmed === 'yes' && !s.isKeyConfirmed) return false;
      if (activeFilters.isConfirmed === 'no' && s.isKeyConfirmed) return false;
      if (activeFilters.isApproved === 'yes' && !s.isApproved) return false;
      if (activeFilters.isApproved === 'no' && s.isApproved) return false;
      if (activeFilters.hasAudio === 'full' && !hasAudio) return false;
      if (activeFilters.hasAudio === 'itunes' && !hasItunesPreview) return false;
      if (activeFilters.hasAudio === 'none' && (hasAudio || hasItunesPreview)) return false;
      if (activeFilters.hasVideo === 'yes' && !hasVideo) return false;
      if (activeFilters.hasVideo === 'no' && hasVideo) return false;
      if (activeFilters.hasChart === 'yes' && !(hasPdf || hasUg || hasUgChords)) return false;
      if (activeFilters.hasChart === 'no' && (hasPdf || hasUg || hasUgChords)) return false;
      if (activeFilters.hasPdf === 'yes' && !hasPdf) return false;
      if (activeFilters.hasPdf === 'no' && hasPdf) return false;
      if (activeFilters.hasUg === 'yes' && !hasUg) return false;
      if (activeFilters.hasUg === 'no' && hasUg) return false;
      if (activeFilters.hasUgChords === 'yes' && !hasUgChords) return false;
      if (activeFilters.hasUgChords === 'no' && hasUgChords) return false;
      
      return true;
    });

    if (sortMode === 'ready') {
      songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    } else if (sortMode === 'work') {
      songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    } else {
      songs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return songs;
  }, [repertoire, searchTerm, sortMode, activeFilters]);

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

  const handleDeleteSong = (songId: string) => {
    setDeleteConfirmId(null);
    onRefreshRepertoire();
    showSuccess("Song removed from master repertoire.");
  };

  return (
    <div className="space-y-8">
      {/* RESTORED: Automation Hub at the top of Repertoire View */}
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
                  className="h-10 sm:h-9 pl-9 text-[11px] font-bold bg-card dark:bg-card border-border dark:border-border rounded-xl focus-visible:ring-indigo-500"
                />
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
            isBulkDownloading={isBulkDownloading}
            missingAudioCount={missingAudioCount}
            onOpenAdmin={onOpenAdmin}
          />
        </div>
      </div>

      <div className="bg-card rounded-[2rem] border-4 border-border shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-secondary z-10">
              <TableRow>
                <TableHead className="w-[40%] text-[10px] font-black uppercase tracking-widest">Song</TableHead>
                <TableHead className="w-[20%] text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Readiness</TableHead>
                <TableHead className="w-[20%] text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-48 text-center">Harmonic Data</TableHead>
                <TableHead className="w-[20%] text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-40 text-right pr-10">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedRepertoire.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center opacity-30">
                    <Library className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">No Tracks Found</p>
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
                        "transition-all group relative cursor-pointer h-[80px]",
                        "hover:bg-accent dark:hover:bg-secondary"
                      )}
                    >
                      <TableCell className="px-6 text-left">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3">
                            <h4 className="text-base font-black tracking-tight leading-none flex items-center gap-2">
                              {song.name}
                              {isFullyReady && <Check className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />}
                              {isProcessing && <CloudDownload className="w-4 h-4 text-indigo-500 animate-bounce" />}
                              {isExtractionFailed && <AlertTriangle className="w-4 h-4 text-red-500" />}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                              {song.artist || "Unknown Artist"}
                            </span>
                          </div>
                          {isExtractionFailed && song.last_sync_log && (
                            <p className="text-[8px] text-red-400 mt-1 truncate max-w-[200px]">Error: {song.last_sync_log}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 text-center">
                        <div className="flex flex-col items-center justify-center h-full">
                          <p className={cn(
                            "text-sm font-mono font-black",
                            readinessScore >= 90 ? "text-emerald-400" : "text-indigo-400"
                          )}>{readinessScore}%</p>
                          {readinessScore === 100 && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mt-1" />}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 text-center">
                        <div className="flex items-center justify-center gap-4 h-full">
                          <div className="text-center min-w-[32px]">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Orig</p>
                            <span className="text-xs font-mono font-bold text-muted-foreground block leading-none">{displayOrigKey}</span>
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
                      </TableCell>
                      <TableCell className="px-6 text-right pr-10">
                        <div className="flex items-center justify-end gap-2 h-full">
                          <SetlistMultiSelector
                            songMasterId={song.id}
                            allSetlists={allSetlists}
                            songToAssign={song}
                            onUpdateSetlistSongs={onUpdateSetlistSongs}
                          />
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 transition-colors inline-flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onEditSong(song); }}>
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors inline-flex items-center justify-center" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setDeleteConfirmId(song.id); 
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
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

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-card border-border text-foreground rounded-[2rem]">
          <AlertDialogHeader>
            <div className="bg-destructive/10 w-12 h-12 rounded-2xl flex items-center justify-center text-destructive mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">Remove Track?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will remove the song from your master repertoire. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl border-border bg-secondary hover:bg-accent hover:text-foreground font-bold uppercase text-[10px] tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirmId) { handleDeleteSong(deleteConfirmId); } }} className="rounded-xl bg-destructive hover:bg-destructive-foreground text-white font-black uppercase text-[10px] tracking-widest">Confirm Removal</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RepertoireView;
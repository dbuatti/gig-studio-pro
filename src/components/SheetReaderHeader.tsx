"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Search, Music, ChevronLeft, ChevronRight, Loader2, ChevronDown, Maximize2, Minimize2, Bug, Hash, Sparkles, ListMusic, Play, Pause, Gauge, Volume2, Activity, RotateCcw, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils';
import { SetlistSong } from './SetlistManager';
import { KeyPreference } from '@/hooks/use-settings';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { showError } from '@/utils/toast';
import { AudioEngineControls } from '@/hooks/use-tone-audio';

type ChartType = 'pdf' | 'leadsheet' | 'chords';

interface SheetReaderHeaderProps {
  currentSong: SetlistSong | null;
  onClose: () => void;
  onOpenRepertoireSearch: () => void;
  onOpenCurrentSongStudio: () => void;
  onPrevSong: () => void;
  onNextSong: () => void;
  isLoading: boolean;
  keyPreference: KeyPreference;
  onUpdateKey: (newTargetKey: string) => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  setIsOverlayOpen: (isOpen: boolean) => void;
  isOverrideActive: boolean;
  pitch: number;
  setPitch: (pitch: number) => void;
  isPlaying: boolean;
  isLoadingAudio: boolean;
  onTogglePlayback: () => void;
  onLoadAudio: (url: string, initialPitch: number) => Promise<void>;
  progress: number;
  duration: number;
  onSetProgress: (value: number) => void;
  onStopPlayback: () => void;
  volume: number;
  setVolume: (value: number) => void;
  tempo: number;
  readerKeyPreference: 'sharps' | 'flats';
  setReaderKeyPreference: (pref: 'sharps' | 'flats') => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSavePreference: (pref: 'sharps' | 'flats') => void;
  audioEngine: AudioEngineControls;
  effectiveTargetKey: string;
  onPullKey: () => void;
  pdfCurrentPage: number;
  setPdfCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  selectedChartType: ChartType;
  pdfNumPages: number | null; // NEW: Add pdfNumPages
}

const SheetReaderHeader: React.FC<SheetReaderHeaderProps> = ({
  currentSong,
  onClose,
  onOpenRepertoireSearch,
  onOpenCurrentSongStudio,
  onPrevSong,
  onNextSong,
  isLoading,
  keyPreference,
  onUpdateKey,
  isFullScreen,
  onToggleFullScreen,
  setIsOverlayOpen,
  isOverrideActive,
  pitch,
  setPitch,
  isPlaying,
  isLoadingAudio,
  onTogglePlayback,
  onLoadAudio,
  progress,
  duration,
  onSetProgress,
  onStopPlayback,
  volume,
  setVolume,
  tempo,
  readerKeyPreference,
  setReaderKeyPreference,
  isSidebarOpen,
  onToggleSidebar,
  onSavePreference,
  audioEngine,
  effectiveTargetKey,
  onPullKey,
  pdfCurrentPage,
  setPdfCurrentPage,
  selectedChartType,
  pdfNumPages, // NEW: Destructure pdfNumPages
}) => {
  const displayKey = effectiveTargetKey ? formatKey(effectiveTargetKey, readerKeyPreference) : null;
  const keysToUse = readerKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAudioButtonClick = async () => {
    if (!currentSong) return;
    const urlToLoad = currentSong.audio_url || currentSong.previewUrl;
    if (!urlToLoad) {
      showError("No audio source available for this song.");
      return;
    }
    if (!audioEngine.currentBuffer || audioEngine.currentUrl !== urlToLoad) {
      await onLoadAudio(urlToLoad, pitch || 0);
    }
    onTogglePlayback();
  };

  const handlePrevPdfPage = () => {
    setPdfCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPdfPage = () => {
    setPdfCurrentPage(prev => Math.min(prev + 1, pdfNumPages || 999));
  };

  if (isFullScreen) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-60 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300 h-[112px]"
    >
      {/* Left Section: Navigation & Sidebar Toggle */}
      <div className="flex items-center gap-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-xl bg-white/5" title="Back to Dashboard"><ArrowLeft className="w-5 h-5 text-slate-400" /></Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className={cn(
            "h-10 w-10 rounded-xl transition-all",
            isSidebarOpen ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white/5 hover:bg-white/10 text-slate-400"
          )}
          title="Toggle Song List"
        >
          <ListMusic className="w-5 h-5" />
        </Button>
      </div>

      {/* Center Section: Song Info, Playback, Progress, Tempo, Pitch */}
      <div className="flex-1 flex items-center justify-center gap-6 px-6">
        {/* Playback Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleAudioButtonClick}
          disabled={isLoadingAudio || (!currentSong?.audio_url && !currentSong?.previewUrl)}
          className={cn(
            "h-14 w-14 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center",
            isPlaying ? "bg-red-600 text-white hover:bg-red-700 shadow-red-600/20" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20",
            (isLoadingAudio || (!currentSong?.audio_url && !currentSong?.previewUrl)) && "opacity-50 cursor-not-allowed"
          )}
          title={isPlaying ? "Pause Audio" : "Play Audio"}
        >
          {isLoadingAudio ? <Loader2 className="w-7 h-7 animate-spin" /> : (isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" />)}
        </Button>

        {/* Song Info & Progress */}
        <div className="flex-1 text-left min-w-0 max-w-xl">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          ) : currentSong ? (
            <>
              <h2 className="text-lg font-black uppercase tracking-tight text-white line-clamp-1">{currentSong.name}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 line-clamp-1">{currentSong.artist || "Unknown Artist"}</p>
            </>
          ) : (
            <p className="text-sm font-bold text-slate-500">No Song Selected</p>
          )}

          <div className="mt-2 space-y-1">
            <Slider
              value={[duration > 0 ? (progress / 100) * duration : 0]}
              max={duration}
              step={1}
              onValueChange={([v]) => onSetProgress((v / duration) * 100)}
              className="w-full"
              disabled={!currentSong?.previewUrl}
            />
            <div className="flex justify-between text-[10px] font-mono font-black text-slate-500 uppercase">
              <span>{formatTime((progress / 100) * duration)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Tempo & Pitch */}
        <div className="flex items-center gap-6 ml-6">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
              <Gauge className="w-3 h-3" /> Tempo
            </span>
            <span className="text-xl font-black text-white font-mono">{currentSong?.bpm || "--"} <span className="text-[10px] text-slate-500">BPM</span></span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
              <Activity className="w-3 h-3" /> Pitch
            </span>
            <span className="text-xl font-black text-white font-mono">{pitch > 0 ? '+' : ''}{pitch} <span className="text-[10px] text-slate-500">ST</span></span>
          </div>
        </div>
      </div>

      {/* Right Section: Song Navigation, Settings, Utilities */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Song/Page Navigation */}
        {(selectedChartType === 'pdf' || selectedChartType === 'leadsheet') ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevPdfPage}
              disabled={isLoading || pdfCurrentPage === 1}
              className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
              Page {pdfCurrentPage} {pdfNumPages ? `/ ${pdfNumPages}` : ''}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextPdfPage}
              disabled={isLoading || (pdfNumPages && pdfCurrentPage >= pdfNumPages)}
              className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevSong}
              disabled={isLoading}
              className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400"
              title="Previous Song"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNextSong}
              disabled={isLoading}
              className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400"
              title="Next Song"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Harmonic Settings Dropdown */}
        {currentSong && (
          <DropdownMenu onOpenChange={setIsOverlayOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                onPointerDown={(e) => e.stopPropagation()}
                className="bg-white/5 border-white/10 text-xs font-black font-mono h-10 px-3 rounded-xl text-indigo-400 gap-2 min-w-[80px]"
                disabled={isLoading}
                title="Harmonic Settings"
              >
                <span className="flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" />
                  {displayKey || <Skeleton className="h-4 w-6 bg-white/10" />}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white z-[300] max-h-60 overflow-y-auto custom-scrollbar">
                <DropdownMenuItem
                  onClick={() => { setReaderKeyPreference('sharps'); onSavePreference('sharps'); }}
                  className="font-bold cursor-pointer flex items-center justify-between"
                >
                  <span>Sharps (#)</span>
                  {readerKeyPreference === 'sharps' && <span className="text-emerald-500">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setReaderKeyPreference('flats'); onSavePreference('flats'); }}
                  className="font-bold cursor-pointer flex items-center justify-between"
                >
                  <span>Flats (b)</span>
                  {readerKeyPreference === 'flats' && <span className="text-emerald-500">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onClick={() => onPullKey()}
                  disabled={!currentSong.ug_chords_text || currentSong.originalKey !== 'TBC'}
                  className="font-bold cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Pull Key from Chords
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">Stage Key</DropdownMenuLabel>
                {keysToUse.map(k => (
                  <DropdownMenuItem key={k} onSelect={() => onUpdateKey(k)} className="font-mono font-bold cursor-pointer">
                    {k}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        )}

        {/* Utility Buttons */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenRepertoireSearch}
          className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
          title="Search Repertoire"
        >
          <Search className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenCurrentSongStudio}
          disabled={!currentSong}
          className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
          title="Open Current Song in Studio"
        >
          <FileText className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleFullScreen}
          className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
          title={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </Button>
      </div>
    </div>
  );
};

export default SheetReaderHeader;
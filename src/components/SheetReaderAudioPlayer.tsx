"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, Minus, Plus, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SetlistSong } from '@/components/SetlistManager';
import { formatKey } from '@/utils/keyUtils';
import { KeyPreference } from '@/hooks/use-settings';
import { CustomProgress } from '@/components/CustomProgress'; // NEW: Import CustomProgress
import { CustomSlider } from '@/components/CustomSlider'; // NEW: Import CustomSlider

interface SheetReaderAudioPlayerProps {
  currentSong: SetlistSong | null;
  isPlaying: boolean;
  progress: number; // 0-100 percentage
  duration: number; // seconds
  onTogglePlayback: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (progress: number) => void;
  volume: number; // dB, e.g., -60 to 0
  setVolume: (volume: number) => void;
  pitch: number; // semitones - still passed but not controlled here
  setPitch: (pitch: number) => void; // still passed but not controlled here
  isLoadingAudio: boolean;
  readerKeyPreference: KeyPreference;
  effectiveTargetKey: string;
  isPlayerVisible: boolean;
}

const SheetReaderAudioPlayer: React.FC<SheetReaderAudioPlayerProps> = ({
  currentSong,
  isPlaying,
  progress,
  duration,
  onTogglePlayback,
  onNext,
  onPrevious,
  onSeek,
  volume,
  setVolume,
  pitch, // still passed but not controlled here
  setPitch, // still passed but not controlled here
  isLoadingAudio,
  readerKeyPreference,
  effectiveTargetKey,
  isPlayerVisible,
}) => {
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayKey = effectiveTargetKey ? formatKey(effectiveTargetKey, readerKeyPreference) : null;

  if (!isPlayerVisible || !currentSong) return null;

  const isProcessing = currentSong.extraction_status === 'processing' || currentSong.extraction_status === 'queued';
  const isExtractionFailed = currentSong.extraction_status === 'failed';
  const isAudioUnavailable = !currentSong.audio_url && !currentSong.previewUrl;

  const isDisabled = isLoadingAudio || isProcessing || isExtractionFailed || isAudioUnavailable;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-t border-white/10 px-6 py-3 flex items-center justify-between shadow-lg h-24">
      {/* Left Section: Song Info & Progress */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="flex flex-col text-left min-w-0">
          <h3 className="text-sm font-black uppercase tracking-tight truncate text-white leading-none">
            {currentSong.name || "No Song Loaded"}
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate mt-0.5">
            {currentSong.artist || "Unknown Artist"}
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-center gap-1 ml-4">
          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Key</span>
          <span className="text-sm font-mono font-bold text-white">{displayKey || '--'}</span>
        </div>
      </div>

      {/* Center Section: Playback Controls */}
      <div className="flex items-center gap-4 flex-1 justify-center">
        <Button variant="ghost" size="icon" onClick={onPrevious} disabled={isDisabled} className="h-10 w-10 rounded-full hover:bg-white/10 text-slate-400">
          <SkipBack className="w-5 h-5" />
        </Button>

        <Button
          onClick={onTogglePlayback}
          disabled={isDisabled}
          className={cn(
            "h-14 w-14 rounded-full shadow-2xl flex items-center justify-center p-0 transition-all hover:scale-105 active:scale-95",
            isDisabled
              ? "bg-slate-600 cursor-not-allowed"
              : isPlaying
                ? "bg-red-600 hover:bg-red-700 shadow-[0_0_30px_rgba(220,38,38,0.3)]"
                : "bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_30px_rgba(79,70,229,0.3)]"
          )}
        >
          {isLoadingAudio || isProcessing ? (
            <Loader2 className="w-7 h-7 animate-spin text-white" />
          ) : isPlaying ? (
            <Pause className="w-7 h-7 text-white" />
          ) : (
            <Play className="w-7 h-7 ml-1 fill-current text-white" />
          )}
        </Button>

        <Button variant="ghost" size="icon" onClick={onNext} disabled={isDisabled} className="h-10 w-10 rounded-full hover:bg-white/10 text-slate-400">
          <SkipForward className="w-5 h-5" />
        </Button>
      </div>

      {/* Right Section: Volume Control */}
      <div className="flex items-center gap-4 flex-1 justify-end">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1 w-48">
          <Volume2 className="w-4 h-4 text-slate-400 ml-1" />
          <CustomSlider
            value={[volume]}
            min={-60}
            max={0}
            step={1}
            onValueChange={([v]) => setVolume(v)}
            className="flex-1"
            disabled={isDisabled}
          />
        </div>
      </div>

      {/* Progress Bar (Full Width) */}
      <div className="absolute top-0 left-0 right-0 h-1.5">
        <CustomProgress value={progress} className="h-full bg-white/10" indicatorClassName="bg-indigo-500" />
      </div>
    </div>
  );
};

export default SheetReaderAudioPlayer;
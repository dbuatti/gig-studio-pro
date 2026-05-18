"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SetlistSong } from '@/components/SetlistManager';
import { formatKey } from '@/utils/keyUtils';
import { KeyPreference } from '@/hooks/use-settings';
import { CustomProgress } from '@/components/CustomProgress';
import { CustomSlider } from '@/components/CustomSlider';
import { useIsMobile } from '@/hooks/use-mobile';

interface SheetReaderAudioPlayerProps {
  currentSong: SetlistSong | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onTogglePlayback: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (progress: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
  pitch: number;
  setPitch: (pitch: number) => void;
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
  pitch,
  setPitch,
  isLoadingAudio,
  readerKeyPreference,
  effectiveTargetKey,
  isPlayerVisible,
}) => {
  const isMobile = useIsMobile();
  const displayKey = effectiveTargetKey ? formatKey(effectiveTargetKey, readerKeyPreference) : null;

  if (!isPlayerVisible || !currentSong) return null;

  const isProcessing = currentSong.extraction_status === 'processing' || currentSong.extraction_status === 'queued';
  const isExtractionFailed = currentSong.extraction_status === 'failed';
  const isAudioUnavailable = !currentSong.audio_url && !currentSong.previewUrl;

  const isDisabled = isLoadingAudio || isProcessing || isExtractionFailed || isAudioUnavailable;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-t border-white/10 px-4 md:px-6 py-2 md:py-3 flex items-center justify-between shadow-lg",
      isMobile ? "h-20" : "h-24"
    )}>
      {/* Song Info - Hidden on very small mobile to save space */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex flex-col text-left min-w-0">
          <h3 className="text-[10px] md:text-sm font-black uppercase tracking-tight truncate text-white leading-none">
            {currentSong.name || "No Song"}
          </h3>
          <p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate mt-0.5">
            {currentSong.artist || "Unknown"}
          </p>
        </div>
        {!isMobile && (
          <div className="flex flex-col items-center gap-1 ml-4">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Key</span>
            <span className="text-sm font-mono font-bold text-white">{displayKey || '--'}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 md:gap-4 flex-1 justify-center">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onPrevious} 
          disabled={isDisabled} 
          className="h-8 w-8 md:h-10 md:w-10 rounded-full hover:bg-white/10 text-slate-400"
        >
          <SkipBack className="w-4 h-4 md:w-5 md:h-5" />
        </Button>

        <Button
          onClick={onTogglePlayback}
          disabled={isDisabled}
          className={cn(
            "rounded-full shadow-2xl flex items-center justify-center p-0 transition-all hover:scale-105 active:scale-95",
            isMobile ? "h-11 w-11" : "h-14 w-14",
            isDisabled
              ? "bg-slate-600 cursor-not-allowed"
              : isPlaying
                ? "bg-red-600 hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
                : "bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
          )}
        >
          {isLoadingAudio || isProcessing ? (
            <Loader2 className={cn("animate-spin text-white", isMobile ? "w-5 h-5" : "w-7 h-7")} />
          ) : isPlaying ? (
            <Pause className={cn("text-white", isMobile ? "w-5 h-5" : "w-7 h-7")} />
          ) : (
            <Play className={cn("fill-current text-white", isMobile ? "w-5 h-5 ml-0.5" : "w-7 h-7 ml-1")} />
          )}
        </Button>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onNext} 
          disabled={isDisabled} 
          className="h-8 w-8 md:h-10 md:w-10 rounded-full hover:bg-white/10 text-slate-400"
        >
          <SkipForward className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
      </div>

      {/* Volume - Hidden on mobile to save space, accessible via system controls */}
      <div className="flex items-center gap-4 flex-1 justify-end">
        {!isMobile ? (
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
        ) : (
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Key</span>
            <span className="text-xs font-mono font-black text-white">{displayKey || '--'}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1">
        <CustomProgress value={progress} className="h-full bg-white/10" indicatorClassName="bg-indigo-500" />
      </div>
    </div>
  );
};

export default SheetReaderAudioPlayer;
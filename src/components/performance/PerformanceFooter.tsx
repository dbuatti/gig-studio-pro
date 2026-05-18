"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SkipBack, SkipForward, Play, Pause, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PerformanceFooterProps {
  progress: number;
  duration: number;
  isPlaying: boolean;
  isLoadingAudio?: boolean;
  isExtractionFailed?: boolean;
  onTogglePlayback: () => void;
  onNext: () => void;
  onPrevious: () => void;
  viewMode: string;
}

const PerformanceFooter: React.FC<PerformanceFooterProps> = ({
  progress, duration, isPlaying, isLoadingAudio, isExtractionFailed,
  onTogglePlayback, onNext, onPrevious, viewMode
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-24 md:h-32 border-t border-white/10 bg-slate-900/90 backdrop-blur-2xl px-4 md:px-16 flex items-center justify-between shrink-0 relative z-50">
      <div className="hidden sm:flex items-center gap-6 md:gap-12 text-sm font-mono min-w-[280px] md:min-w-[380px]">
        <span className="text-xl md:text-3xl font-black text-indigo-400">{formatTime((progress / 100) * duration)}</span>
        <div className="flex-1 w-32 md:w-80 space-y-2">
           <Progress value={progress} className="h-2 md:h-4 bg-white/5" />
           <div className="flex justify-between text-[8px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest">
             <span>Progression</span>
             <span>{Math.round(progress)}%</span>
           </div>
        </div>
        <span className="text-xl md:text-3xl font-black text-slate-500">{formatTime(duration)}</span>
      </div>

      <div className="flex items-center gap-6 md:gap-16 flex-1 justify-center sm:flex-none">
        <Button variant="ghost" size="icon" onClick={onPrevious} className="h-12 w-12 md:h-20 md:w-20 rounded-full hover:bg-white/5 text-slate-400">
          <SkipBack className="w-6 h-6 md:w-12 md:h-12" />
        </Button>

        <Button 
          onClick={onTogglePlayback}
          disabled={isLoadingAudio || isExtractionFailed} 
          className={cn(
            "h-16 w-16 md:h-28 md:w-28 rounded-2xl md:rounded-[2.5rem] shadow-2xl flex items-center justify-center p-0 transition-all hover:scale-110 active:scale-90",
            isLoadingAudio || isExtractionFailed ? "bg-slate-600 cursor-not-allowed" : isPlaying ? "bg-red-600 hover:bg-red-700 shadow-[0_0_60px_rgba(220,38,38,0.4)]" : "bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_60px_rgba(79,70,229,0.4)]"
          )}
        >
          {isLoadingAudio ? <Loader2 className="w-8 h-8 md:w-14 md:h-14 animate-spin text-white" /> : isExtractionFailed ? <AlertTriangle className="w-8 h-8 md:w-14 md:h-14 text-white" /> : isPlaying ? <Pause className="w-8 h-8 md:w-14 md:h-14 text-white" /> : <Play className="w-8 h-8 md:w-14 md:h-14 ml-1 md:ml-2.5 fill-current text-white" />}
        </Button>

        <Button variant="ghost" size="icon" onClick={onNext} className="h-12 w-12 md:h-20 md:w-20 rounded-full hover:bg-white/5 text-slate-400">
          <SkipForward className="w-6 h-6 md:w-12 md:h-12" />
        </Button>
      </div>

      <div className="hidden sm:flex items-center gap-4 md:gap-10 text-[8px] md:text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 min-w-[280px] md:min-w-[380px] justify-end">
        <div className="flex flex-col items-end">
          <span className="text-indigo-400">{viewMode.toUpperCase()} FEED</span>
          <span className="flex items-center gap-2 text-emerald-500 mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
            LIVE DATA SYNC
          </span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceFooter;
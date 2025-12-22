"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Play, Pause, SkipForward, SkipBack, X, Music, 
  Waves, ListMusic, Activity, ArrowRight, Volume2 
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import AudioVisualizer from './AudioVisualizer';
import { cn } from "@/lib/utils";

interface PerformanceOverlayProps {
  songs: SetlistSong[];
  currentIndex: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onTogglePlayback: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  analyzer: any;
}

const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  songs,
  currentIndex,
  isPlaying,
  progress,
  duration,
  onTogglePlayback,
  onNext,
  onPrevious,
  onClose,
  analyzer
}) => {
  const currentSong = songs[currentIndex];
  const nextSong = songs[currentIndex + 1];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col animate-in fade-in zoom-in duration-300">
      {/* Stage Header */}
      <div className="h-20 border-b border-white/10 px-8 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Live Stage Mode</h2>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black uppercase tracking-tight">Gig in Progress</span>
              <div className="flex gap-1 ml-4">
                {songs.map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "h-1.5 w-6 rounded-full transition-all duration-500",
                      i === currentIndex ? "bg-indigo-500 w-12" : i < currentIndex ? "bg-green-500" : "bg-white/10"
                    )} 
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
          <X className="w-8 h-8" />
        </Button>
      </div>

      {/* Stage Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background Visualizer Ambient */}
        <div className="absolute inset-0 opacity-10 pointer-events-none scale-150 blur-3xl">
          <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
        </div>

        <div className="max-w-4xl w-full space-y-12 z-10">
          {/* Current Song Display */}
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-black uppercase tracking-widest">
              <Music className="w-3 h-3" /> Now Performing
            </div>
            
            <h1 className="text-7xl font-black uppercase tracking-tighter leading-none">
              {currentSong?.name}
            </h1>
            
            <div className="flex items-center justify-center gap-4 text-2xl font-bold text-slate-400">
              <span>{currentSong?.artist}</span>
              <div className="w-2 h-2 rounded-full bg-slate-700" />
              <span className="text-indigo-400 font-mono">
                {currentSong?.targetKey}
                {currentSong?.pitch !== 0 && (
                  <span className="text-sm ml-2">({currentSong.pitch > 0 ? '+' : ''}{currentSong.pitch}ST)</span>
                )}
              </span>
            </div>
          </div>

          {/* Large Visualizer */}
          <div className="w-full bg-slate-900/40 rounded-3xl border border-white/5 p-8 shadow-2xl">
            <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
            <div className="mt-8 space-y-4">
              <div className="flex justify-between text-sm font-mono text-slate-400 font-bold">
                <span>{formatTime((progress / 100) * duration)}</span>
                <span className="text-indigo-500">{(progress).toFixed(1)}% COMPLETE</span>
                <span>{formatTime(duration)}</span>
              </div>
              <Progress value={progress} className="h-4 bg-white/5" />
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex flex-col items-center gap-8">
            <div className="flex items-center gap-12">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onPrevious}
                className="h-16 w-16 rounded-full hover:bg-white/10"
              >
                <SkipBack className="w-8 h-8" />
              </Button>
              
              <Button 
                size="lg" 
                onClick={onTogglePlayback}
                className="h-32 w-32 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_50px_rgba(79,70,229,0.4)] transition-all hover:scale-110"
              >
                {isPlaying ? <Pause className="w-16 h-16" /> : <Play className="w-16 h-16 ml-2" />}
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onNext}
                className="h-16 w-16 rounded-full hover:bg-white/10"
              >
                <SkipForward className="w-8 h-8" />
              </Button>
            </div>

            {/* Next Song Preview */}
            {nextSong && (
              <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 flex items-center gap-6 group cursor-pointer hover:bg-slate-800 transition-colors" onClick={onNext}>
                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Up Next</div>
                <ArrowRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-2 transition-transform" />
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">{nextSong.name}</span>
                  <span className="text-sm text-slate-500">{nextSong.artist}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stage Footer Status */}
      <div className="h-16 border-t border-white/10 px-8 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-900/30">
        <div className="flex gap-8">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3 h-3 text-indigo-500" />
            Audio Output: Stage Main
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            Transposition: Active Sync
          </div>
        </div>
        <div>
          Gig Studio Pro | Live v1.0
        </div>
      </div>
    </div>
  );
};

export default PerformanceOverlay;
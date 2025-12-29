"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from "@/lib/utils";

interface AudioPlaybackControlsProps {
  isPlaying: boolean;
  progress: number;
  duration: number;
  onTogglePlayback: () => Promise<void>;
  onStopPlayback: () => void;
  onSetProgress: (value: number) => void;
  isLoadingAudio: boolean;
  songName?: string;
}

const AudioPlaybackControls: React.FC<AudioPlaybackControlsProps> = ({
  isPlaying,
  progress,
  duration,
  onTogglePlayback,
  onStopPlayback,
  onSetProgress,
  isLoadingAudio,
  songName,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2.5">
      <div className="flex justify-between text-[9px] font-mono text-indigo-600 font-black uppercase tracking-tighter">
        <span>{formatTime((progress / 100) * duration)}</span>
        <span className="opacity-60 truncate max-w-[180px]">{songName}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <Slider value={[progress]} max={100} step={0.1} onValueChange={([v]) => onSetProgress(v)} disabled={isLoadingAudio || duration === 0} />

      <div className="flex items-center justify-center gap-6">
        <Button variant="outline" size="icon" onClick={onStopPlayback} className="rounded-full h-10 w-10" disabled={isLoadingAudio}>
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button size="lg" onClick={onTogglePlayback} className="w-16 h-16 rounded-full shadow-xl bg-indigo-600 hover:bg-indigo-700" disabled={isLoadingAudio}>
          {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-0.5" />}
        </Button>
        <div className="w-10" /> {/* Spacer for alignment */}
      </div>
    </div>
  );
};

export default AudioPlaybackControls;
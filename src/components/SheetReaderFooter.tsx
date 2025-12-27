"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, Gauge, Volume2, Activity, Check, Guitar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SetlistSong } from './SetlistManager';
import { formatKey } from '@/utils/keyUtils';
import { KeyPreference } from '@/hooks/use-settings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface SheetReaderFooterProps {
  currentSong: SetlistSong | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onTogglePlayback: () => void;
  onStopPlayback: () => void;
  onSetProgress: (value: number) => void;
  localPitch: number;
  setLocalPitch: (value: number) => void;
  volume: number;
  setVolume: (value: number) => void;
  keyPreference: KeyPreference;
  // NEW: Auto-scroll props
  chordAutoScrollEnabled: boolean;
  setChordAutoScrollEnabled: (enabled: boolean) => void;
  chordScrollSpeed: number;
  setChordScrollSpeed: (speed: number) => void;
}

const SheetReaderFooter: React.FC<SheetReaderFooterProps> = ({
  currentSong,
  isPlaying,
  progress,
  duration,
  onTogglePlayback,
  onStopPlayback,
  onSetProgress,
  localPitch,
  setLocalPitch,
  volume,
  setVolume,
  keyPreference,
  // NEW: Auto-scroll props
  chordAutoScrollEnabled,
  setChordAutoScrollEnabled,
  chordScrollSpeed,
  setChordScrollSpeed,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayKey = formatKey(currentSong?.targetKey || currentSong?.originalKey, keyPreference);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-xl border-t border-white/10 px-6 py-3 flex items-center justify-between shadow-lg animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-6">
        <Button variant="ghost" size="icon" onClick={onStopPlayback} className="h-10 w-10 rounded-xl hover:bg-white/10 text-slate-400">
          <RotateCcw className="w-5 h-5" />
        </Button>
        <Button
          onClick={onTogglePlayback}
          className={cn(
            "h-14 w-14 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95",
            isPlaying ? "bg-red-600 hover:bg-red-700 shadow-red-600/30" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30"
          )}
        >
          {isPlaying ? <Pause className="w-7 h-7 text-white" /> : <Play className="w-7 h-7 ml-1 text-white" />}
        </Button>
      </div>

      <div className="flex-1 mx-8 space-y-2 max-w-md">
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

      <div className="flex items-center gap-6">
        {/* NEW: Chord Auto-Scroll Controls */}
        {currentSong?.ug_chords_text && (
          <div className="flex items-center gap-4 bg-white/5 p-2 rounded-xl border border-white/10">
            <div className="flex flex-col items-center">
              <Label htmlFor="chord-autoscroll" className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
                <Guitar className="w-3 h-3" /> Auto-Scroll
              </Label>
              <Switch 
                id="chord-autoscroll"
                checked={chordAutoScrollEnabled}
                onCheckedChange={setChordAutoScrollEnabled}
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>
            <div className="flex flex-col items-center">
              <Label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
                Speed
              </Label>
              <Slider 
                value={[chordScrollSpeed]} 
                min={0.5} 
                max={2.0} 
                step={0.05} 
                onValueChange={([v]) => setChordScrollSpeed(v)}
                className="w-20"
                disabled={!chordAutoScrollEnabled}
              />
              <span className="text-[10px] font-mono font-bold text-slate-500 mt-1">{chordScrollSpeed.toFixed(2)}x</span>
            </div>
          </div>
        )}

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
          <span className="text-xl font-black text-white font-mono">{localPitch > 0 ? '+' : ''}{localPitch} <span className="text-[10px] text-slate-500">ST</span></span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
            <Volume2 className="w-3 h-3" /> Gain
          </span>
          <span className="text-xl font-black text-white font-mono">{Math.round(((volume || -6) + 60) * 1.66)}%</span>
        </div>
      </div>
    </div>
  );
};

export default SheetReaderFooter;
"use client";

import React from 'react';
import { Label } from "@/components/ui/label";
import { Slider } from '@/components/ui/slider';
import { SetlistSong } from './SetlistManager';
import { cn } from "@/lib/utils";
import { Volume2 } from 'lucide-react';
import { transposeKey } from '@/utils/keyUtils';

interface SongAudioControlsProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void; // Changed signature
  // Harmonic Sync Props
  pitch: number;
  setPitch: (pitch: number) => void;
  targetKey: string;
  setTargetKey: (targetKey: string) => void;
  isPitchLinked: boolean;
  setIsPitchLinked: (linked: boolean) => void;
  // Other props
  setTempo: (tempo: number) => void;
  setVolume: (volume: number) => void;
  setFineTune: (fineTune: number) => void;
  isMobile: boolean;
}

const SongAudioControls: React.FC<SongAudioControlsProps> = ({
  song,
  formData,
  handleAutoSave, // Changed signature
  // Harmonic Sync Props
  pitch,
  setPitch,
  targetKey,
  setTargetKey,
  isPitchLinked,
  setIsPitchLinked,
  // Other props
  setTempo,
  setVolume,
  setFineTune,
  isMobile,
}) => {
  return (
    <div className={cn("grid gap-6 md:gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
      <div className={cn("space-y-10 bg-white/5 border border-white/5", isMobile ? "p-6 rounded-3xl" : "p-10 rounded-[2.5rem]")}>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pitch Processor</Label>
            <span className="text-sm md:text-lg font-mono font-black text-indigo-400">{(pitch || 0) > 0 ? '+' : ''}{pitch || 0} ST</span>
          </div>
          <Slider 
            value={[pitch || 0]} 
            min={-24} 
            max={24} 
            step={1} 
            onValueChange={(v) => {
              setPitch(v[0]); // Use setPitch from useHarmonicSync
            }} 
          />
        </div>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Fine Tune Matrix</Label>
            <span className="text-sm font-mono font-black text-slate-500">{(formData.fineTune || 0) > 0 ? '+' : ''}{formData.fineTune || 0} Cents</span>
          </div>
          <Slider value={[formData.fineTune || 0]} min={-100} max={100} step={1} onValueChange={([v]) => {
            handleAutoSave({ fineTune: v });
            setFineTune(v);
          }} />
        </div>
      </div>
      <div className={cn("space-y-10 bg-white/5 border border-white/5", isMobile ? "p-6 rounded-3xl" : "p-10 rounded-[2.5rem]")}>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tempo Stretch</Label>
            <span className="text-sm font-mono font-black text-indigo-400">{(formData.tempo || 1).toFixed(2)}x</span>
          </div>
          <Slider value={[formData.tempo || 1]} min={0.5} max={1.5} step={0.01} onValueChange={([v]) => {
            handleAutoSave({ tempo: v });
            setTempo(v);
          }} />
        </div>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><Volume2 className="w-3 h-3 text-indigo-500" /> Master Gain</Label>
            <span className="text-sm font-mono font-black text-slate-500">{Math.round(((formData.volume || -6) + 60) * 1.66)}%</span>
          </div>
          <Slider value={[formData.volume || -6]} min={-60} max={0} step={1} onValueChange={([v]) => {
            handleAutoSave({ volume: v });
            setVolume(v);
          }} />
        </div>
      </div>
    </div>
  );
};

export default SongAudioControls;
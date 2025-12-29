"use client";

import React from 'react';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings2, Volume2, Sparkles, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { transposeKey } from '@/utils/keyUtils';
import { showSuccess, showError } from '@/utils/toast';

interface AudioHarmonicControlsProps {
  pitch: number;
  setPitch: (p: number) => void;
  tempo: number;
  setTempo: (t: number) => void;
  volume: number;
  setVolume: (v: number) => void;
  fineTune: number;
  setFineTune: (f: number) => void;
  originalKey?: string;
  currentSongId?: string;
  onUpdateSongKey?: (songId: string, newTargetKey: string) => void;
}

const AudioHarmonicControls: React.FC<AudioHarmonicControlsProps> = ({
  pitch,
  setPitch,
  tempo,
  setTempo,
  volume,
  setVolume,
  fineTune,
  setFineTune,
  originalKey,
  currentSongId,
  onUpdateSongKey,
}) => {
  const suggestedKey = React.useMemo(() => {
    if (!originalKey || originalKey === "TBC") return null;
    return transposeKey(originalKey, pitch);
  }, [originalKey, pitch]);

  const handleApplyKey = () => {
    if (currentSongId && suggestedKey && onUpdateSongKey) {
      onUpdateSongKey(currentSongId, suggestedKey);
      showSuccess(`Applied ${suggestedKey}`);
    }
  };

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const shift = direction === 'up' ? 12 : -12;
    const newPitch = pitch + shift;
    if (newPitch > 24 || newPitch < -24) {
      showError("Range limit reached.");
      return;
    }
    setPitch(newPitch);
    if (currentSongId && onUpdateSongKey && originalKey && originalKey !== "TBC") {
      const newTarget = transposeKey(originalKey, newPitch);
      onUpdateSongKey(currentSongId, newTarget);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Settings2 className="w-3 h-3 text-indigo-500" /> Key Transposer
          </Label>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {pitch > 0 ? `+${pitch}` : pitch} ST
            </span>
            <div className="flex bg-slate-200/50 dark:bg-slate-800/50 rounded-lg border p-0.5 shadow-inner">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleOctaveShift('down')} className="h-7 px-2 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-black uppercase text-slate-500 hover:text-indigo-600 transition-colors border-r">- oct</button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[9px] font-black uppercase">-12 ST</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleOctaveShift('up')} className="h-7 px-2 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-black uppercase text-slate-500 hover:text-indigo-600 transition-colors">+ oct</button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[9px] font-black uppercase">+12 ST</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <Slider value={[pitch]} min={-24} max={24} step={1} onValueChange={([v]) => setPitch(v)} />
          </div>
          {suggestedKey && (
            <Button onClick={handleApplyKey} size="sm" className="bg-indigo-50 text-indigo-600 h-9 px-3 text-[10px] uppercase font-black gap-1">
              <Sparkles className="w-3 h-3" /> Apply {suggestedKey}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 pt-4 border-t">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tempo</Label>
            <span className="text-xs font-mono font-bold text-indigo-600">{tempo.toFixed(2)}x</span>
          </div>
          <Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={([v]) => setTempo(v)} />
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Volume2 className="w-3 h-3 text-indigo-500" /> Gain</Label>
            <span className="text-[10px] font-mono font-bold text-slate-600">{Math.round((volume + 60) * 1.66)}%</span>
          </div>
          <Slider value={[volume]} min={-60} max={0} step={1} onValueChange={([v]) => setVolume(v)} />
        </div>
      </div>
    </div>
  );
};

export default AudioHarmonicControls;
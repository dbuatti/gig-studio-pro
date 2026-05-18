"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Gauge, Shuffle, AlignLeft, Settings2, Music, Check, Minus, Plus, Activity, ArrowRight 
} from 'lucide-react';
import Metronome from '../Metronome';
import { SetlistSong } from '../SetlistManager';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, transposeKey } from '@/utils/keyUtils';
import { cn } from '@/lib/utils';

interface PerformanceSidebarProps {
  currentSong: SetlistSong;
  nextSong?: SetlistSong;
  onShuffle: () => void;
  onUpdateSong: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onNext: () => void;
  localNotes: string;
  setLocalNotes: (val: string) => void;
  handleSaveNotes: () => void;
  viewMode: string;
  autoScrollEnabled: boolean;
  setAutoScrollEnabled: (val: boolean) => void;
  scrollSpeed: number;
  setScrollSpeed: (val: number) => void;
  globalPreference: 'sharps' | 'flats' | 'neutral';
}

const PerformanceSidebar: React.FC<PerformanceSidebarProps> = ({
  currentSong, nextSong, onShuffle, onUpdateSong, onUpdateKey, onNext,
  localNotes, setLocalNotes, handleSaveNotes, viewMode,
  autoScrollEnabled, setAutoScrollEnabled, scrollSpeed, setScrollSpeed,
  globalPreference
}) => {
  const currentPref = currentSong.key_preference || globalPreference;
  const keysToUse = currentPref === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;
  const displayCurrentKey = formatKey(currentSong.targetKey || currentSong.originalKey, currentPref);

  const handleQuickTranspose = (direction: 'up' | 'down') => {
    const shift = direction === 'up' ? 1 : -1;
    const newPitch = (currentSong.pitch || 0) + shift;
    const newTarget = transposeKey(currentSong.originalKey || "C", newPitch);
    onUpdateKey(currentSong.id, newTarget);
  };

  return (
    <div className="flex flex-col space-y-8 md:space-y-10 h-full">
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2 font-mono">
            <Gauge className="w-4 h-4" /> Live Timing
          </h3>
          <Button variant="ghost" size="sm" onClick={onShuffle} className="h-7 px-3 bg-white/5 border border-white/5 text-indigo-400 text-[8px] font-black uppercase rounded-lg">
            <Shuffle className="w-3 h-3 mr-2" /> Shuffle
          </Button>
        </div>
        <Metronome initialBpm={parseInt(currentSong.bpm || "120")} />
      </div>

      {viewMode === 'lyrics' && (
        <div className="space-y-4 animate-in slide-in-from-right duration-500">
          <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-pink-400 flex items-center gap-2 font-mono">
            <AlignLeft className="w-4 h-4" /> Teleprompter
          </h3>
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-black uppercase text-white">Auto-Scroll</span>
                <span className="text-[9px] font-bold text-slate-500 uppercase mt-1">Track Progress (S)</span>
              </div>
              <Switch checked={autoScrollEnabled} onCheckedChange={setAutoScrollEnabled} className="data-[state=checked]:bg-pink-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[8px] font-black text-slate-500 uppercase">Velocity</span>
                <span className="text-xl font-black text-pink-400 font-mono">{scrollSpeed.toFixed(2)}x</span>
              </div>
              <Slider value={[scrollSpeed]} onValueChange={([v]) => setScrollSpeed(v)} min={0.5} max={2.0} step={0.05} disabled={!autoScrollEnabled} />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2 font-mono">
          <Settings2 className="w-4 h-4" /> Harmonic Override
        </h3>
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-6">
          <div className="grid grid-cols-2 gap-4 relative">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-500 uppercase font-mono mb-1">Original</span>
              <span className="text-xl font-mono font-black text-slate-400">{currentSong.originalKey || "TBC"}</span>
            </div>
            <div className="h-10 w-px bg-white/10 absolute left-1/2 -translate-x-1/2 top-1" />
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black text-indigo-400 uppercase font-mono mb-1">Stage Key</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-mono font-black text-white">{displayCurrentKey}</span>
                {currentSong.isKeyConfirmed && <Check className="w-4 h-4 text-emerald-500" />}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Select value={formatKey(currentSong.targetKey || currentSong.originalKey, currentPref)} onValueChange={(val) => onUpdateKey(currentSong.id, val)}>
                <SelectTrigger className="bg-slate-950 border-white/10 text-xs font-black font-mono h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                  {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono text-xs font-bold">{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex bg-slate-950 border border-white/10 rounded-xl p-1">
              <Button variant="ghost" size="icon" onClick={() => handleQuickTranspose('down')} className="h-10 w-10 rounded-lg text-slate-400"><Minus className="w-3 h-3" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleQuickTranspose('up')} className="h-10 w-10 rounded-lg text-slate-400"><Plus className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2 font-mono">
          <Activity className="w-4 h-4" /> Stage Cues
        </h3>
        <Textarea 
          placeholder="Live notes, cues..."
          className="bg-slate-950 border-white/5 min-h-[120px] text-base font-medium leading-relaxed resize-none rounded-2xl p-6 focus:ring-indigo-500/20 custom-scrollbar"
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          onBlur={handleSaveNotes}
        />
      </div>

      {nextSong && (
        <div className="pt-6 border-t border-white/10">
          <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4 font-mono">Sequence: Next</div>
          <div className="bg-indigo-600/5 border border-indigo-500/20 rounded-2xl p-6 flex items-center gap-6 cursor-pointer hover:bg-indigo-600/10 transition-all group" onClick={onNext}>
            <div className="bg-indigo-600 p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform shrink-0">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-black uppercase tracking-tight truncate leading-tight">{nextSong.name}</div>
              <div className="text-[9px] font-bold text-indigo-400/60 uppercase tracking-widest mt-1">{nextSong.artist}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceSidebar;
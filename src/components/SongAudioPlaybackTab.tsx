"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from '@/components/ui/slider';
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, Music, Volume2, Youtube } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import { SetlistSong } from './SetlistManager';
import { AudioEngineControls } from '@/hooks/use-tone-audio';
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';

interface SongAudioPlaybackTabProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  audioEngine: AudioEngineControls;
  isMobile: boolean;
  onLoadAudioFromUrl: (url: string, initialPitch: number) => Promise<void>;
  onSave: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  transposeKey: (key: string, semitones: number) => string;
}

const SongAudioPlaybackTab: React.FC<SongAudioPlaybackTabProps> = ({
  song,
  formData,
  audioEngine,
  isMobile,
  onLoadAudioFromUrl,
  onSave,
  onUpdateKey,
  transposeKey
}) => {
  const {
    isPlaying, progress, duration, analyzer,
    pitch, tempo, volume, fineTune,
    setPitch, setTempo, setVolume, setFineTune,
    setProgress, togglePlayback, stopPlayback,
  } = audioEngine;

  const isItunesPreview = (url: string) => url && (url.includes('apple.com') || url.includes('itunes-assets'));

  const handleLoadAudio = async () => {
    if (!formData.previewUrl) {
      showError("No audio preview URL available.");
      return;
    }
    await onLoadAudioFromUrl(formData.previewUrl, formData.pitch || 0);
  };

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const shift = direction === 'up' ? 12 : -12;
    const newPitch = (pitch || 0) + shift;
    if (newPitch > 24 || newPitch < -24) return;
    updatePitch(newPitch);
  };

  const updatePitch = (newPitch: number) => {
    setPitch(newPitch);
    if (song && formData.originalKey) {
      const newTargetKey = transposeKey(formData.originalKey, newPitch);
      onSave(song.id, { pitch: newPitch, targetKey: newTargetKey });
      onUpdateKey(song.id, newTargetKey);
    }
  };

  return (
    <div className={cn("space-y-6 md:space-y-12 animate-in fade-in duration-500")}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm md:text-lg font-black uppercase tracking-[0.2em] text-indigo-400">Audio Processing Matrix</h3>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Real-time pitch and time-stretching engine active.</p>
        </div>
      </div>

      {/* Visualizer & Main Transport */}
      <div className={cn("bg-slate-900/50 border border-white/5 space-y-6 md:space-y-12", isMobile ? "p-6 rounded-3xl" : "p-12 rounded-[3rem]")}>
        <div className={cn(isMobile ? "h-24" : "h-40")}>
          <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
        </div>

        {formData.previewUrl ? (
          <>
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest">
                <span className="text-indigo-400">{new Date((progress / 100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
              </div>
              <Slider value={[progress]} max={100} step={0.1} onValueChange={([v]) => setProgress(v)} />
            </div>
            
            <div className="flex items-center justify-center gap-8 md:gap-12">
              <Button variant="ghost" size="icon" onClick={stopPlayback} className="h-12 w-12 md:h-20 md:w-20 rounded-full border border-white/5">
                <RotateCcw className="w-5 h-5 md:w-8 md:h-8" />
              </Button>
              <Button size="lg" onClick={togglePlayback} className="h-20 w-20 md:h-32 md:w-32 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-2xl">
                {isPlaying ? <Pause className="w-8 h-8 md:w-12 md:h-12" /> : <Play className="w-8 h-8 md:w-12 md:h-12 ml-1 fill-current" />}
              </Button>
              <div className="h-12 w-12 md:h-20 md:w-20" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 md:py-12 text-center space-y-6">
            <div className="bg-indigo-600/10 p-6 rounded-full border border-indigo-500/20"><Music className="w-8 h-8 text-indigo-400" /></div>
            <p className="text-sm text-slate-500">No master audio linked. Use Discovery or Upload to activate engine.</p>
          </div>
        )}
      </div>

      {/* RESTORED: PROCESSING CONTROLS */}
      <div className={cn("grid gap-6 md:gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        
        {/* Pitch Matrix */}
        <div className={cn("space-y-8 bg-white/5 border border-white/5", isMobile ? "p-6 rounded-3xl" : "p-10 rounded-[2.5rem]")}>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pitch Processor</Label>
              <div className="flex items-center gap-3">
                <span className="text-lg font-mono font-black text-indigo-400">{(pitch || 0) > 0 ? '+' : ''}{pitch || 0} ST</span>
                <div className="flex bg-white/5 rounded-lg border border-white/10 p-0.5">
                   <button onClick={() => handleOctaveShift('down')} className="h-7 px-2 text-[10px] font-black uppercase text-slate-400 border-r border-white/5">- oct</button>
                   <button onClick={() => handleOctaveShift('up')} className="h-7 px-2 text-[10px] font-black uppercase text-slate-400">+ oct</button>
                </div>
              </div>
            </div>
            <Slider value={[pitch || 0]} min={-24} max={24} step={1} onValueChange={([v]) => updatePitch(v)} />
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fine Tune (Cents)</Label>
              <span className="text-lg font-mono font-black text-slate-500">{fineTune > 0 ? '+' : ''}{fineTune}</span>
            </div>
            <Slider value={[fineTune]} min={-100} max={100} step={1} onValueChange={([v]) => setFineTune(v)} />
          </div>
        </div>

        {/* Tempo & Volume Matrix */}
        <div className={cn("space-y-8 bg-white/5 border border-white/5", isMobile ? "p-6 rounded-3xl" : "p-10 rounded-[2.5rem]")}>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tempo Stretch</Label>
              <span className="text-lg font-mono font-black text-indigo-400">{tempo.toFixed(2)}x</span>
            </div>
            <Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={([v]) => setTempo(v)} />
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Volume2 className="w-3 h-3" /> Master Gain
              </Label>
              <span className="text-lg font-mono font-black text-slate-500">{Math.round((volume + 60) * 1.66)}%</span>
            </div>
            <Slider value={[volume]} min={-60} max={0} step={1} onValueChange={([v]) => setVolume(v)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongAudioPlaybackTab;
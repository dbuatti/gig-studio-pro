"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw, Music } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import { SetlistSong } from './SetlistManager';
import { useToneAudio, AudioEngineControls } from '@/hooks/use-tone-audio';
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';

interface SongAudioPlaybackTabProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  audioEngine: AudioEngineControls;
  isMobile: boolean;
  onLoadAudioFromUrl: (url: string, initialPitch: number) => Promise<void>;
}

const SongAudioPlaybackTab: React.FC<SongAudioPlaybackTabProps> = ({
  song,
  formData,
  audioEngine,
  isMobile,
  onLoadAudioFromUrl,
}) => {
  const {
    isPlaying, progress, duration, analyzer,
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

  return (
    <div className={cn("space-y-6 md:space-y-12 animate-in fade-in duration-500")}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm md:text-lg font-black uppercase tracking-[0.2em] text-indigo-400">Audio Processing Matrix</h3>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Real-time pitch and time-stretching engine.</p>
        </div>
      </div>
      <div className={cn("bg-slate-900/50 border border-white/5 space-y-6 md:space-y-12", isMobile ? "p-6 rounded-3xl" : "p-12 rounded-[3rem]")}>
        <div className={cn(isMobile ? "h-24" : "h-40")}>
          <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
        </div>
        {formData.previewUrl ? (
          <>
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] font-mono font-black text-slate-500">
                <span className="text-indigo-400">{new Date((progress / 100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
              </div>
              <Slider value={[progress]} max={100} step={0.1} onValueChange={([v]) => setProgress(v)} />
            </div>
            <div className="flex items-center justify-center gap-8">
              <Button variant="ghost" size="icon" onClick={stopPlayback} className="h-12 w-12 md:h-16 md:w-16 rounded-full border border-white/5"><RotateCcw className="w-5 h-5" /></Button>
              <Button size="lg" onClick={togglePlayback} className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-2xl">
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1 fill-current" />}
              </Button>
              <div className="h-12 w-12 md:h-16 md:w-16" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 md:py-12 text-center space-y-6">
            <div className="bg-indigo-600/10 p-6 rounded-full border border-indigo-500/20"><Music className="w-8 h-8 text-indigo-400" /></div>
            <p className="text-sm text-slate-500">Upload a master or discover on YouTube to activate.</p>
            {song?.previewUrl && isItunesPreview(song.previewUrl) && (
              <Button onClick={handleLoadAudio} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] h-10 px-6 rounded-xl gap-2">
                <Play className="w-3.5 h-3.5" /> Load iTunes Preview
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SongAudioPlaybackTab;
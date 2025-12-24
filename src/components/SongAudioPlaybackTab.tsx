"use client";

import React, { useState, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import { analyze } from 'web-audio-beat-detector';
import { Music, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

import AudioVisualizer from './AudioVisualizer';
import SongAnalysisTools from './SongAnalysisTools';
import SongAudioControls from './SongAudioControls';
import { SetlistSong } from './SetlistManager';
import { AudioEngineControls } from '@/hooks/use-tone-audio';

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
    isPlaying, progress, duration, analyzer, currentBuffer,
    setPitch, setTempo, setVolume, setFineTune,
    setProgress, togglePlayback, stopPlayback,
  } = audioEngine;

  // --- State & Refs ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const metronomeSynth = useRef<Tone.MembraneSynth | null>(null);
  const metronomeLoop = useRef<Tone.Loop | null>(null);

  // --- Helpers ---
  const formatTime = (seconds: number) => 
    new Date(seconds * 1000).toISOString().substr(14, 5);

  const isItunesPreview = useMemo(() => 
    formData.previewUrl?.includes('apple.com') || formData.previewUrl?.includes('itunes-assets'),
    [formData.previewUrl]
  );

  const handleAutoSave = (updates: Partial<SetlistSong>) => {
    if (song?.id) onSave(song.id, updates);
  };

  // --- Handlers ---
  const handleLoadAudio = async () => {
    if (!formData.previewUrl) return showError("No audio URL available.");
    await onLoadAudioFromUrl(formData.previewUrl, formData.pitch || 0);
  };

  const handleDetectBPM = async () => {
    if (!currentBuffer) return showError("Load audio first.");
    setIsAnalyzing(true);
    try {
      const bpm = Math.round(await analyze(currentBuffer));
      handleAutoSave({ bpm: bpm.toString() });
      showSuccess(`BPM Detected: ${bpm}`);
    } catch (err) {
      showError("BPM detection failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-12 animate-in fade-in duration-500">
      {/* 1. Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm md:text-lg font-black uppercase tracking-[0.2em] text-indigo-400">
            Audio Processing Matrix
          </h3>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Real-time pitch and time-stretching engine active.
          </p>
        </div>
      </header>

      {/* 2. Visualizer & Transport */}
      <section className={cn(
        "bg-slate-900/50 border border-white/5 space-y-6 md:space-y-12",
        isMobile ? "p-6 rounded-3xl" : "p-12 rounded-[3rem]"
      )}>
        <div className={isMobile ? "h-24" : "h-40"}>
          <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
        </div>

        {formData.previewUrl ? (
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] md:text-xs font-mono font-black text-slate-500 uppercase tracking-widest">
                <span className="text-indigo-400">{formatTime((progress / 100) * duration)}</span>
                <span className="hidden md:inline">Transport Master Clock</span>
                <span>{formatTime(duration)}</span>
              </div>
              <Slider value={[progress]} max={100} step={0.1} onValueChange={([v]) => setProgress(v)} />
            </div>
            
            <div className="flex items-center justify-center gap-8 md:gap-12">
              <Button variant="ghost" size="icon" onClick={stopPlayback} className="h-12 w-12 md:h-20 md:w-20 rounded-full border border-white/5">
                <RotateCcw className="w-5 h-5 md:w-8 md:h-8" />
              </Button>
              <Button size="lg" onClick={togglePlayback} className="h-20 w-20 md:h-32 md:w-32 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-2xl">
                {isPlaying ? <Pause className="w-8 h-8 md:w-12 md:h-12" /> : <Play className="w-8 h-8 md:w-12 md:h-12 ml-1 md:ml-2 fill-current" />}
              </Button>
              <div className="h-12 w-12 md:h-20 md:w-20" /> {/* Spacer */}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 md:py-12 text-center space-y-6">
            <div className="bg-indigo-600/10 p-6 rounded-full border border-indigo-500/20">
              <Music className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-sm text-slate-500 max-w-sm px-4">
              Upload a master file or load the iTunes preview to start transposing.
            </p>
            {isItunesPreview && (
              <Button onClick={handleLoadAudio} className="bg-indigo-600 font-black uppercase text-[10px] h-10 px-6 rounded-xl gap-2">
                <Play className="w-3.5 h-3.5" /> Load iTunes Preview
              </Button>
            )}
          </div>
        )}
      </section>

      {/* 3. Specialized Modular Tools */}
      <div className="grid gap-6">
        <SongAnalysisTools 
          song={song}
          formData={formData}
          handleAutoSave={handleAutoSave}
          currentBuffer={currentBuffer}
          isMobile={isMobile}
          handleDetectBPM={handleDetectBPM}
          isAnalyzing={isAnalyzing}
        />

        <SongAudioControls
          song={song}
          formData={formData}
          handleAutoSave={handleAutoSave}
          onUpdateKey={onUpdateKey}
          setPitch={setPitch}
          setTempo={setTempo}
          setVolume={setVolume}
          setFineTune={setFineTune}
          isMobile={isMobile}
          transposeKey={transposeKey}
        />
      </div>
    </div>
  );
};

export default SongAudioPlaybackTab;
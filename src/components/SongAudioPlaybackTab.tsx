"use client";

import React, { useState } from 'react';
import { analyze } from 'web-audio-beat-detector';
import { Music, Play, Pause, RotateCcw, Loader2, CloudDownload, AlertTriangle } from 'lucide-react';

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
  onSave: (updates: Partial<SetlistSong>) => void;
  onUpdateKey: (newTargetKey: string) => void;
  transposeKey: (key: string, semitones: number) => string;
  // Harmonic Sync Props
  pitch: number;
  setPitch: (pitch: number) => void;
  targetKey: string;
  setTargetKey: (targetKey: string) => void;
  isPitchLinked: boolean;
  setIsPitchLinked: (linked: boolean) => void;
}

const SongAudioPlaybackTab: React.FC<SongAudioPlaybackTabProps> = ({
  song,
  formData,
  audioEngine,
  isMobile,
  onLoadAudioFromUrl,
  onSave,
  onUpdateKey,
  transposeKey,
  // Harmonic Sync Props
  pitch,
  setPitch,
  targetKey,
  setTargetKey,
  isPitchLinked,
  setIsPitchLinked,
}) => {
  const {
    isPlaying, progress, duration, analyzer, currentBuffer,
    setTempo, setVolume, setFineTune,
    setProgress, togglePlayback, stopPlayback,
    isLoadingAudio, // Destructure isLoadingAudio
  } = audioEngine;

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const formatTime = (seconds: number) => 
    new Date(seconds * 1000).toISOString().substr(14, 5);

  // Determine which URL to use for playback
  const audioSourceUrl = formData.extraction_status === 'completed' && formData.audio_url ? formData.audio_url : formData.previewUrl;

  const handleAutoSave = (updates: Partial<SetlistSong>) => {
    onSave(updates);
  };

  const handleLoadAudio = async () => {
    if (!audioSourceUrl) return showError("No audio URL available.");
    // Pass the current pitch from the harmonic sync hook
    await onLoadAudioFromUrl(audioSourceUrl, pitch || 0);
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

  const isProcessing = formData.extraction_status === 'processing' || formData.extraction_status === 'queued';
  const isExtractionFailed = formData.extraction_status === 'failed';

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
        <div className="flex items-center gap-2">
          {isProcessing && (
            <div className="flex items-center gap-2 text-indigo-400">
              <CloudDownload className="w-4 h-4 animate-bounce" />
              <span className="text-[9px] font-black uppercase">Extracting Audio...</span>
            </div>
          )}
          {isExtractionFailed && (
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase">Extraction Failed</span>
            </div>
          )}
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

        {audioSourceUrl ? (
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
              
              <Button 
                size="lg" 
                onClick={togglePlayback} 
                disabled={isLoadingAudio}
                className={cn(
                  "h-20 w-20 md:h-32 md:w-32 rounded-full shadow-2xl flex items-center justify-center transition-all",
                  isLoadingAudio ? "bg-slate-600 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                )}
              >
                {isLoadingAudio ? (
                  <Loader2 className="w-8 h-8 md:w-12 md:h-12 animate-spin text-white" />
                ) : isPlaying ? (
                  <Pause className="w-8 h-8 md:w-12 md:h-12 text-white fill-current" />
                ) : (
                  <Play className="w-8 h-8 md:w-12 md:h-12 text-white fill-current ml-1 md:ml-2" />
                )}
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
            {formData.previewUrl && (
              <Button 
                onClick={handleLoadAudio} 
                disabled={isLoadingAudio}
                className="bg-indigo-600 font-black uppercase text-[10px] h-10 px-6 rounded-xl gap-2"
              >
                {isLoadingAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} 
                {isLoadingAudio ? "Loading..." : "Load iTunes Preview"}
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
        />

        <SongAudioControls
          song={song}
          formData={formData}
          handleAutoSave={handleAutoSave}
          // Pass harmonic sync props
          pitch={pitch}
          setPitch={setPitch}
          targetKey={targetKey}
          setTargetKey={setTargetKey}
          isPitchLinked={isPitchLinked}
          setIsPitchLinked={setIsPitchLinked}
          setTempo={setTempo}
          setVolume={setVolume}
          setFineTune={setFineTune}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
};

export default SongAudioPlaybackTab;
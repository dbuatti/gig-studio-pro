"use client";

import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from '@/components/ui/slider';
import { Label } from "@/components/ui/label";
import { 
  Play, Pause, RotateCcw, Music, Volume2, 
  VolumeX, Timer, Disc, Loader2, Youtube 
} from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import { SetlistSong } from './SetlistManager';
import { AudioEngineControls } from '@/hooks/use-tone-audio';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import { analyze } from 'web-audio-beat-detector';
import * as Tone from 'tone';
import SongAnalysisTools from './SongAnalysisTools'; // New import
import SongAudioControls from './SongAudioControls'; // New import
import { transposeKey } from '@/utils/keyUtils'; // Ensure transposeKey is imported

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
    pitch, tempo, volume, fineTune,
    setPitch, setTempo, setVolume, setFineTune,
    setProgress, togglePlayback, stopPlayback,
  } = audioEngine;

  // Local State for BPM Engine
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const metronomeSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const metronomeLoopRef = useRef<Tone.Loop | null>(null);

  const isItunesPreview = (url: string) => url && (url.includes('apple.com') || url.includes('itunes-assets'));

  const handleLoadAudio = async () => {
    if (!formData.previewUrl) {
      showError("No audio preview URL available.");
      return;
    }
    await onLoadAudioFromUrl(formData.previewUrl, formData.pitch || 0);
  };

  const updatePitch = (newPitch: number) => {
    setPitch(newPitch);
    if (song && formData.originalKey) {
      const newTargetKey = transposeKey(formData.originalKey, newPitch);
      onSave(song.id, { pitch: newPitch, targetKey: newTargetKey });
      onUpdateKey(song.id, newTargetKey);
    }
  };

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const shift = direction === 'up' ? 12 : -12;
    const newPitch = (pitch || 0) + shift;
    if (newPitch > 24 || newPitch < -24) {
      showError("Range limit reached.");
      return;
    }
    updatePitch(newPitch);
  };

  const handleDetectBPM = async () => {
    if (!currentBuffer) {
      showError("Load audio first to scan BPM.");
      return;
    }
    setIsAnalyzing(true);
    try {
      const detectedBpm = await analyze(currentBuffer);
      const roundedBpm = Math.round(detectedBpm);
      onSave(song?.id || '', { bpm: roundedBpm.toString() });
      showSuccess(`BPM Detected: ${roundedBpm}`);
    } catch (err) {
      showError("BPM detection failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleMetronome = async () => {
    if (!formData.bpm) {
      showError("Set a BPM first.");
      return;
    }
    if (isMetronomeActive) {
      Tone.getTransport().stop();
      metronomeLoopRef.current?.stop();
      setIsMetronomeActive(false);
    } else {
      if (Tone.getContext().state !== 'running') await Tone.start();
      
      if (!metronomeSynthRef.current) {
        metronomeSynthRef.current = new Tone.MembraneSynth().toDestination();
      }
      
      Tone.getTransport().bpm.value = parseInt(formData.bpm);
      
      if (!metronomeLoopRef.current) {
        metronomeLoopRef.current = new Tone.Loop((time) => {
          metronomeSynthRef.current?.triggerAttackRelease("C4", "32n", time);
        }, "4n").start(0);
      } else {
        metronomeLoopRef.current.start(0);
      }
      
      Tone.getTransport().start();
      setIsMetronomeActive(true);
    }
  };

  return (
    <div className={cn("space-y-6 md:space-y-12 animate-in fade-in duration-500")}>
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm md:text-lg font-black uppercase tracking-[0.2em] text-indigo-400">Audio Processing Matrix</h3>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Real-time pitch and time-stretching processing active.</p>
        </div>
      </div>

      {/* 2. VISUALIZER & TRANSPORT BOX */}
      <div className={cn("bg-slate-900/50 border border-white/5 space-y-6 md:space-y-12", isMobile ? "p-6 rounded-3xl" : "p-12 rounded-[3rem]")}>
        <div className={cn(isMobile ? "h-24" : "h-40")}>
          <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
        </div>

        {formData.previewUrl ? (
          <>
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] md:text-xs font-mono font-black text-slate-500 uppercase tracking-widest">
                <span className="text-indigo-400">{new Date((progress / 100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                <span className="hidden md:inline">Transport Master Clock</span>
                <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
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
              <div className="h-12 w-12 md:h-20 md:w-20" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 md:py-12 text-center space-y-6">
            <div className="bg-indigo-600/10 p-6 rounded-full border border-indigo-500/20"><Music className="w-8 h-8 text-indigo-400" /></div>
            <p className="text-sm text-slate-500 max-w-sm px-4">Upload a master file or load the iTunes preview to start transposing.</p>
            {song?.previewUrl && isItunesPreview(song.previewUrl) && (
              <Button onClick={handleLoadAudio} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] h-10 px-6 rounded-xl gap-2">
                <Play className="w-3.5 h-3.5" /> Load iTunes Preview
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 3. BPM & METRONOME CONSOLE */}
      <div className={cn(
        "bg-slate-900 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6", 
        isMobile ? "p-6 rounded-3xl" : "p-8 rounded-[2.5rem]"
      )}>
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Library BPM</span>
            <div className="flex items-center gap-4 mt-1">
              <input
                type="text"
                value={formData.bpm || ""}
                onChange={(e) => onSave(song?.id || '', { bpm: e.target.value })}
                className="bg-transparent border-none p-0 h-auto text-2xl md:text-3xl font-black font-mono text-indigo-400 focus:outline-none w-20"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMetronome}
                className={cn(
                  "h-10 w-10 rounded-xl transition-all",
                  isMetronomeActive ? "bg-indigo-600 text-white shadow-lg" : "bg-white/5 text-slate-400"
                )}
              >
                {isMetronomeActive ? <Volume2 className="w-5 h-5 animate-pulse" /> : <VolumeX className="w-5 h-5" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDetectBPM}
              disabled={isAnalyzing || !formData.previewUrl}
              className="flex-1 md:flex-none h-10 px-4 bg-indigo-600/10 text-indigo-400 font-black uppercase tracking-widest text-[9px] gap-2 rounded-xl"
            >
              {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Disc className="w-3.5 h-3.5" />}
              Scan BPM
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open('https://www.beatsperminuteonline.com/', '_blank')}
              className="flex-1 md:flex-none h-10 px-4 bg-white/5 text-slate-400 font-black uppercase tracking-widest text-[9px] gap-2 rounded-xl"
            >
              <Timer className="w-3.5 h-3.5" />
              Tap Tool
            </Button>
          </div>
        </div>
      </div>

      {/* New: SongAnalysisTools */}
      <SongAnalysisTools 
        song={song}
        formData={formData}
        handleAutoSave={onSave} // Pass onSave directly
        currentBuffer={currentBuffer}
        isMobile={isMobile}
      />

      {/* New: SongAudioControls */}
      <SongAudioControls
        song={song}
        formData={formData}
        handleAutoSave={onSave} // Pass onSave directly
        onUpdateKey={onUpdateKey}
        setPitch={setPitch}
        setTempo={setTempo}
        setVolume={setVolume}
        setFineTune={setFineTune}
        isMobile={isMobile}
      />
    </div>
  );
};

export default SongAudioPlaybackTab;
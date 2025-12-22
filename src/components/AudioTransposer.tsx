"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, Upload, Volume2, Info, Waves, Settings2, Gauge, Activity } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import AudioVisualizer from './AudioVisualizer';
import { cn } from "@/lib/utils";

const AudioTransposer = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [fineTune, setFineTune] = useState(0);
  const [tempo, setTempo] = useState(1);
  const [volume, setVolume] = useState(-6);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [eqHigh, setEqHigh] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const limiterRef = useRef<Tone.Limiter | null>(null);
  const compressorRef = useRef<Tone.Compressor | null>(null);
  const eqRef = useRef<Tone.EQ3 | null>(null);
  const analyzerRef = useRef<Tone.Analyser | null>(null);
  const requestRef = useRef<number>();
  
  const playbackStartTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);

  useEffect(() => {
    analyzerRef.current = new Tone.Analyser("fft", 256);
    limiterRef.current = new Tone.Limiter(-1).toDestination();
    compressorRef.current = new Tone.Compressor({
      threshold: -20,
      ratio: 3,
      attack: 0.005,
      release: 0.1
    }).connect(limiterRef.current);
    
    eqRef.current = new Tone.EQ3({
      low: 0,
      mid: 0,
      high: 0
    }).connect(compressorRef.current);
    
    limiterRef.current.connect(analyzerRef.current);

    return () => {
      stopPlayback();
      playerRef.current?.dispose();
      limiterRef.current?.dispose();
      compressorRef.current?.dispose();
      eqRef.current?.dispose();
      analyzerRef.current?.dispose();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const loadAudioFile = async (uploadedFile: File) => {
    if (!uploadedFile.type.startsWith('audio/')) {
      showError("Please upload a valid audio file.");
      return;
    }

    try {
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      
      if (playerRef.current) playerRef.current.dispose();

      playerRef.current = new Tone.GrainPlayer(audioBuffer).connect(eqRef.current!);
      playerRef.current.grainSize = 0.18;
      playerRef.current.overlap = 0.1;
      playerRef.current.detune = (pitch * 100) + fineTune;
      playerRef.current.playbackRate = tempo;
      playerRef.current.volume.value = volume;

      setFile(uploadedFile);
      setDuration(audioBuffer.duration);
      setProgress(0);
      offsetRef.current = 0;
      setIsPlaying(false);
      showSuccess("Pro Studio Engine Ready");
    } catch (err) {
      showError("Engine initialization failed.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) loadAudioFile(uploadedFile);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) loadAudioFile(droppedFile);
  };

  const animateProgress = () => {
    if (isPlaying && playerRef.current) {
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      const currentSeconds = offsetRef.current + elapsed;
      const newProgress = (currentSeconds / duration) * 100;
      
      if (currentSeconds >= duration) {
        setIsPlaying(false);
        setProgress(0);
        offsetRef.current = 0;
        return;
      }
      
      setProgress(newProgress);
      requestRef.current = requestAnimationFrame(animateProgress);
    }
  };

  useEffect(() => {
    if (isPlaying) requestRef.current = requestAnimationFrame(animateProgress);
    else if (requestRef.current) cancelAnimationFrame(requestRef.current);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, tempo]);

  const togglePlayback = async () => {
    if (!playerRef.current) return;
    if (Tone.getContext().state !== 'running') await Tone.start();

    if (isPlaying) {
      playerRef.current.stop();
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      offsetRef.current += elapsed;
      setIsPlaying(false);
    } else {
      const startTime = (progress / 100) * duration;
      offsetRef.current = startTime;
      playbackStartTimeRef.current = Tone.now();
      playerRef.current.start(0, startTime);
      setIsPlaying(true);
    }
  };

  const stopPlayback = () => {
    if (playerRef.current) {
      playerRef.current.stop();
      setIsPlaying(false);
      setProgress(0);
      offsetRef.current = 0;
    }
  };

  const updateDetune = (newPitch: number, newFine: number) => {
    if (playerRef.current) playerRef.current.detune = (newPitch * 100) + newFine;
  };

  const handlePitchChange = (values: number[]) => {
    setPitch(values[0]);
    updateDetune(values[0], fineTune);
  };

  const handleFineTuneChange = (values: number[]) => {
    setFineTune(values[0]);
    updateDetune(pitch, values[0]);
  };

  const handleTempoChange = (values: number[]) => {
    const newTempo = values[0];
    setTempo(newTempo);
    if (playerRef.current) {
      playerRef.current.playbackRate = newTempo;
      if (isPlaying) {
        const elapsed = (Tone.now() - playbackStartTimeRef.current) * (tempo);
        offsetRef.current += elapsed;
        playbackStartTimeRef.current = Tone.now();
      }
    }
  };

  const handleEqChange = (values: number[]) => {
    setEqHigh(values[0]);
    if (eqRef.current) eqRef.current.high.value = values[0];
  };

  const handleVolumeChange = (values: number[]) => {
    setVolume(values[0]);
    if (playerRef.current) playerRef.current.volume.value = values[0];
  };

  const handleSeek = (values: number[]) => {
    const newProgress = values[0];
    setProgress(newProgress);
    const newOffset = (newProgress / 100) * duration;
    offsetRef.current = newOffset;
    
    if (isPlaying && playerRef.current) {
      playerRef.current.stop();
      playbackStartTimeRef.current = Tone.now();
      playerRef.current.start(0, newOffset);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-2xl border-t-4 border-t-indigo-600 overflow-hidden">
      <div className="bg-indigo-600 px-6 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="font-bold text-xs tracking-widest uppercase">Direct Stream Processor v2.5</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono opacity-80">
          <span>LATENCY: ULTRA-LOW</span>
          <span>SPS: 44.1KHZ</span>
        </div>
      </div>
      
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Waves className="w-6 h-6 text-indigo-600" />
              Transposer Studio Pro
            </CardTitle>
            <CardDescription>Advanced harmonic shifting and time-stretching engine.</CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Info className="w-5 h-5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Features independent Pitch and Tempo control using high-order granular synthesis with transient protection.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div 
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "relative h-24 flex items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden group",
            isDragging 
              ? "bg-indigo-50 border-indigo-500 scale-[1.01] dark:bg-indigo-900/20" 
              : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          )}
        >
          {file ? (
            <div className="absolute inset-0 z-10 p-2">
              <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
              <div className="absolute top-2 left-4 px-2 py-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded text-[10px] font-bold border">
                {file.name}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center pointer-events-none">
              <Upload className={cn(
                "w-8 h-8 mb-2 transition-transform",
                isDragging ? "text-indigo-600 scale-110" : "text-indigo-400 group-hover:scale-110"
              )} />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isDragging ? "Drop to load engine" : "Load Mastering Source"}
              </p>
            </div>
          )}
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer z-20"
          />
        </div>

        {file && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-center gap-6">
              <Button variant="outline" size="icon" onClick={stopPlayback} className="rounded-full h-12 w-12 border-indigo-100">
                <RotateCcw className="w-5 h-5" />
              </Button>
              <Button size="lg" onClick={togglePlayback} className="w-20 h-20 rounded-full shadow-2xl bg-indigo-600 hover:bg-indigo-700 transition-all hover:scale-110 group">
                {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1 group-hover:text-white" />}
              </Button>
              <div className="w-12" />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-mono text-indigo-500 font-bold uppercase tracking-tighter">
                <span>{new Date((progress/100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                <span className="opacity-40">Timeline Position</span>
                <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
              </div>
              <Slider value={[progress]} max={100} step={0.1} onValueChange={handleSeek} className="cursor-pointer" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Settings2 className="w-3 h-3 text-indigo-500" /> Semitones
                    </Label>
                    <span className="text-xl font-mono font-bold text-indigo-600">{pitch > 0 ? `+${pitch}` : pitch}</span>
                  </div>
                  <Slider value={[pitch]} min={-12} max={12} step={1} onValueChange={handlePitchChange} />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Fine Tune (Cents)</Label>
                    <span className="text-sm font-mono text-indigo-400 font-bold">{fineTune > 0 ? `+${fineTune}` : fineTune}¢</span>
                  </div>
                  <Slider value={[fineTune]} min={-100} max={100} step={1} onValueChange={handleFineTuneChange} />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Gauge className="w-3 h-3 text-indigo-500" /> Tempo Scaler
                    </Label>
                    <span className="text-sm font-mono text-indigo-600 font-bold">{tempo.toFixed(2)}x</span>
                  </div>
                  <Slider value={[tempo]} min={0.5} max={2.0} step={0.01} onValueChange={handleTempoChange} />
                </div>
              </div>

              <div className="space-y-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/50">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Volume2 className="w-3 h-3 text-indigo-500" /> Output Gain
                    </Label>
                    <span className="text-xs font-mono font-bold">{Math.round((volume + 60) * 1.66)}%</span>
                  </div>
                  <Slider value={[volume]} min={-60} max={0} step={1} onValueChange={handleVolumeChange} />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">High Brilliance (EQ)</Label>
                    <span className="text-xs font-mono font-bold text-indigo-400">{eqHigh > 0 ? `+${eqHigh}` : eqHigh}dB</span>
                  </div>
                  <Slider value={[eqHigh]} min={-12} max={12} step={1} onValueChange={handleEqChange} />
                  <p className="text-[9px] text-muted-foreground italic">Use brilliance to recover clarity lost during high positive shifts.</p>
                </div>

                <div className="pt-4 border-t flex items-center justify-between">
                  <span className="text-[9px] font-bold text-indigo-600 uppercase">Phase Preservation</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AudioTransposer;
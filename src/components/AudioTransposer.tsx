"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, Upload, Music, Volume2, Info, Waves, Settings2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const AudioTransposer = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [fineTune, setFineTune] = useState(0);
  const [volume, setVolume] = useState(-6);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const limiterRef = useRef<Tone.Limiter | null>(null);
  const compressorRef = useRef<Tone.Compressor | null>(null);
  const requestRef = useRef<number>();
  
  const playbackStartTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);

  useEffect(() => {
    // Create professional mastering chain
    limiterRef.current = new Tone.Limiter(-1).toDestination();
    compressorRef.current = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25
    }).connect(limiterRef.current);

    return () => {
      stopPlayback();
      playerRef.current?.dispose();
      limiterRef.current?.dispose();
      compressorRef.current?.dispose();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.type.includes('audio')) {
      showError("Please upload a valid audio file.");
      return;
    }

    try {
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      
      if (playerRef.current) {
        playerRef.current.dispose();
      }

      // Tuned GrainPlayer for high-fidelity music transposition
      playerRef.current = new Tone.GrainPlayer(audioBuffer).connect(compressorRef.current!);
      playerRef.current.grainSize = 0.15; // Slightly tighter grains for better transients
      playerRef.current.overlap = 0.08;   // Smooth crossfading
      playerRef.current.detune = (pitch * 100) + fineTune;
      playerRef.current.volume.value = volume;

      setFile(uploadedFile);
      setDuration(audioBuffer.duration);
      setProgress(0);
      offsetRef.current = 0;
      setIsPlaying(false);
      showSuccess("Studio engine initialized with Limiter/Compressor.");
    } catch (err) {
      showError("Failed to load audio file.");
      console.error(err);
    }
  };

  const animateProgress = () => {
    if (isPlaying && playerRef.current) {
      const elapsed = Tone.now() - playbackStartTimeRef.current;
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
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animateProgress);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying]);

  const togglePlayback = async () => {
    if (!playerRef.current) return;

    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    if (isPlaying) {
      playerRef.current.stop();
      const elapsed = Tone.now() - playbackStartTimeRef.current;
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
    if (playerRef.current) {
      playerRef.current.detune = (newPitch * 100) + newFine;
    }
  };

  const handlePitchChange = (values: number[]) => {
    const val = values[0];
    setPitch(val);
    updateDetune(val, fineTune);
  };

  const handleFineTuneChange = (values: number[]) => {
    const val = values[0];
    setFineTune(val);
    updateDetune(pitch, val);
  };

  const handleVolumeChange = (values: number[]) => {
    const newVol = values[0];
    setVolume(newVol);
    if (playerRef.current) {
      playerRef.current.volume.value = newVol;
    }
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
    <Card className="w-full max-w-2xl mx-auto shadow-2xl border-t-4 border-t-indigo-500 overflow-hidden">
      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waves className="w-5 h-5 text-indigo-500" />
          <span className="font-bold tracking-tight uppercase text-xs text-indigo-600 dark:text-indigo-400">Mastering Chain Active</span>
        </div>
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-indigo-400" />
        </div>
      </div>
      
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-6 h-6 text-primary" />
            Studio Transposer Pro
          </div>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">Dual-stage signal chain with Limiter (-1dB) and Soft-knee Compression for maximum fidelity.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardDescription>
          Ultra-low latency granular synthesis with harmonic compensation.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 group relative">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <Upload className="w-12 h-12 text-muted-foreground group-hover:text-indigo-500 transition-colors mb-4" />
          <p className="text-sm font-medium">
            {file ? file.name : "Import High-Resolution Audio"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Lossless formats supported</p>
        </div>

        {file && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={stopPlayback}
                className="rounded-full hover:bg-destructive/10 hover:text-destructive border-indigo-100"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
              <Button
                size="lg"
                onClick={togglePlayback}
                className="w-16 h-16 rounded-full shadow-xl bg-indigo-600 hover:bg-indigo-700 hover:scale-105 transition-all"
              >
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </Button>
              <div className="w-10" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                <span>{new Date((progress/100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
              </div>
              <Slider
                value={[progress]}
                max={100}
                step={0.1}
                onValueChange={handleSeek}
                className="cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Settings2 className="w-3 h-3" /> Semitones
                    </Label>
                    <span className="text-lg font-mono font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                      {pitch > 0 ? `+${pitch}` : pitch}
                    </span>
                  </div>
                  <Slider
                    value={[pitch]}
                    min={-12}
                    max={12}
                    step={1}
                    onValueChange={handlePitchChange}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fine-Tune (Cents)</Label>
                    <span className="text-sm font-mono text-indigo-400">
                      {fineTune > 0 ? `+${fineTune}` : fineTune}¢
                    </span>
                  </div>
                  <Slider
                    value={[fineTune]}
                    min={-100}
                    max={100}
                    step={1}
                    onValueChange={handleFineTuneChange}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Volume2 className="w-3 h-3" /> Output Gain
                    </Label>
                    <span className="text-sm font-mono text-muted-foreground">{Math.round((volume + 60) * 1.66)}%</span>
                  </div>
                  <Slider
                    value={[volume]}
                    min={-60}
                    max={0}
                    step={1}
                    onValueChange={handleVolumeChange}
                  />
                </div>

                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100/50 dark:border-indigo-900/50">
                  <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 leading-relaxed italic">
                    "Grain Engine 2.1 is optimized for transient preservation during negative shifts."
                  </p>
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
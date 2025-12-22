"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, Upload, Music, Volume2, Info } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const AudioTransposer = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [volume, setVolume] = useState(-6);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Using GrainPlayer for superior pitch shifting quality
  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const requestRef = useRef<number>();
  
  const playbackStartTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      stopPlayback();
      playerRef.current?.dispose();
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

      // Initialize GrainPlayer with high-quality settings
      // GrainSize 0.2 and Overlap 0.1 are optimal for smooth music transposition
      playerRef.current = new Tone.GrainPlayer(audioBuffer).toDestination();
      playerRef.current.grainSize = 0.2;
      playerRef.current.overlap = 0.1;
      playerRef.current.detune = pitch * 100; // Convert semitones to cents
      playerRef.current.volume.value = volume;

      setFile(uploadedFile);
      setDuration(audioBuffer.duration);
      setProgress(0);
      offsetRef.current = 0;
      setIsPlaying(false);
      showSuccess("High-fidelity audio engine loaded.");
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

  const handlePitchChange = (values: number[]) => {
    const newPitch = values[0];
    setPitch(newPitch);
    if (playerRef.current) {
      // detune is measured in cents (100 cents = 1 semitone)
      playerRef.current.detune = newPitch * 100;
    }
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
    <Card className="w-full max-w-2xl mx-auto shadow-xl border-t-4 border-t-primary">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-6 h-6 text-primary" />
            Studio Transposer
          </div>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">Uses Granular Synthesis to maintain audio fidelity even at extreme pitch shifts.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardDescription>
          Professional real-time transposition with zero speed variance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-colors hover:bg-accent/50 group relative">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <Upload className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors mb-4" />
          <p className="text-sm font-medium">
            {file ? file.name : "Load your MP3 / WAV"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Studio-quality processing enabled</p>
        </div>

        {file && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={stopPlayback}
                className="rounded-full"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
              <Button
                size="lg"
                onClick={togglePlayback}
                className="w-16 h-16 rounded-full shadow-lg hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </Button>
              <div className="w-10" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
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
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-bold">Key Shift</Label>
                  <span className="text-lg font-mono bg-primary/10 px-3 py-1 rounded text-primary">
                    {pitch > 0 ? `+${pitch}` : pitch} ST
                  </span>
                </div>
                <Slider
                  value={[pitch]}
                  min={-12}
                  max={12}
                  step={1}
                  onValueChange={handlePitchChange}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                  <span>-1 Octave</span>
                  <span>Original</span>
                  <span>+1 Octave</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <Volume2 className="w-4 h-4" /> Volume
                  </Label>
                  <span className="text-sm text-muted-foreground">{Math.round((volume + 60) * 1.66)}%</span>
                </div>
                <Slider
                  value={[volume]}
                  min={-60}
                  max={0}
                  step={1}
                  onValueChange={handleVolumeChange}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AudioTransposer;
"use client";

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as Tone from 'tone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Play, Pause, RotateCcw, Upload, Volume2, Info, Waves, Settings2, Gauge, Activity, Link as LinkIcon, Globe, Search, Youtube, PlusCircle } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import AudioVisualizer from './AudioVisualizer';
import SongSearch from './SongSearch';
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface AudioTransposerRef {
  loadFromUrl: (url: string, name: string, youtubeUrl?: string) => Promise<void>;
  setPitch: (pitch: number) => void;
  getPitch: () => number;
  triggerSearch: (query: string) => void;
}

interface AudioTransposerProps {
  onAddToSetlist?: (previewUrl: string, name: string, ytUrl?: string, pitch?: number) => void;
}

const AudioTransposer = forwardRef<AudioTransposerRef, AudioTransposerProps>(({ onAddToSetlist }, ref) => {
  const [file, setFile] = useState<{ name: string; url?: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [fineTune, setFineTune] = useState(0);
  const [tempo, setTempo] = useState(1);
  const [volume, setVolume] = useState(-6);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [eqHigh, setEqHigh] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState("search");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeYoutubeUrl, setActiveYoutubeUrl] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");

  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const limiterRef = useRef<Tone.Limiter | null>(null);
  const compressorRef = useRef<Tone.Compressor | null>(null);
  const eqRef = useRef<Tone.EQ3 | null>(null);
  const analyzerRef = useRef<Tone.Analyser | null>(null);
  const requestRef = useRef<number>();
  
  const playbackStartTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);

  const initEngine = async () => {
    // Only start if not already running to satisfy browser policy
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    
    // Lazily create nodes only when needed
    if (!analyzerRef.current) {
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
    }
    return true;
  };

  useEffect(() => {
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

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const loadAudioBuffer = async (audioBuffer: AudioBuffer, identifier: string, youtubeUrl?: string, previewUrl?: string) => {
    try {
      await initEngine();
      if (playerRef.current) playerRef.current.dispose();

      playerRef.current = new Tone.GrainPlayer(audioBuffer).connect(eqRef.current!);
      playerRef.current.grainSize = 0.18;
      playerRef.current.overlap = 0.1;
      playerRef.current.detune = (pitch * 100) + fineTune;
      playerRef.current.playbackRate = tempo;
      playerRef.current.volume.value = volume;

      setFile({ name: identifier, url: previewUrl });
      setDuration(audioBuffer.duration);
      setProgress(0);
      offsetRef.current = 0;
      setIsPlaying(false);
      
      setActiveYoutubeUrl(youtubeUrl);
      if (youtubeUrl) {
        setActiveVideoId(getYoutubeId(youtubeUrl));
      } else {
        setActiveVideoId(null);
      }

      showSuccess("Engine Ready");
    } catch (err) {
      console.error("Buffer error:", err);
      showError("Engine initialization failed.");
    }
  };

  const loadFromUrl = async (targetUrl: string, name?: string, youtubeUrl?: string) => {
    setIsLoadingUrl(true);
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error("Could not fetch file");
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      await loadAudioBuffer(audioBuffer, name || "Remote Audio", youtubeUrl, targetUrl);
      if (!name) setUrl("");
    } catch (err) {
      showError("Failed to load audio stream.");
    } finally {
      setIsLoadingUrl(false);
    }
  };

  useImperativeHandle(ref, () => ({
    loadFromUrl,
    setPitch: (newPitch: number) => {
      setPitch(newPitch);
      if (playerRef.current) playerRef.current.detune = (newPitch * 100) + fineTune;
    },
    getPitch: () => pitch,
    triggerSearch: (query: string) => {
      setSearchQuery(query);
      setActiveTab("search");
    }
  }));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) loadFile(uploadedFile);
  };

  const loadFile = async (uploadedFile: File) => {
    if (!uploadedFile.type.startsWith('audio/')) {
      showError("Invalid audio format.");
      return;
    }
    const arrayBuffer = await uploadedFile.arrayBuffer();
    const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
    loadAudioBuffer(audioBuffer, uploadedFile.name);
  };

  const togglePlayback = async () => {
    await initEngine();
    if (!playerRef.current) return;

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

  return (
    <Card className="w-full shadow-2xl border-t-4 border-t-indigo-600 overflow-hidden">
      <div className="bg-indigo-600 px-6 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="font-bold text-xs tracking-widest uppercase">Direct Stream Processor</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono opacity-80 uppercase">
          <span>Latency: Low</span>
        </div>
      </div>
      
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Waves className="w-6 h-6 text-indigo-600" />
              Transposer Studio
            </CardTitle>
            <CardDescription>Shift keys and tempo in real-time.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {file && onAddToSetlist && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onAddToSetlist(file.url || '', file.name, activeYoutubeUrl, pitch)}
                className="h-9 border-green-200 text-green-600 hover:bg-green-50 font-bold text-[10px] uppercase gap-2"
              >
                <PlusCircle className="w-4 h-4" /> Save
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="search" className="gap-2"><Search className="w-4 h-4" /> Search</TabsTrigger>
            <TabsTrigger value="upload" className="gap-2"><Upload className="w-4 h-4" /> Upload</TabsTrigger>
            <TabsTrigger value="url" className="gap-2"><Globe className="w-4 h-4" /> URL</TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="space-y-4">
            <SongSearch 
              onSelectSong={(url, name, yt) => loadFromUrl(url, name, yt)} 
              onAddToSetlist={onAddToSetlist || (() => {})}
              externalQuery={searchQuery}
            />
          </TabsContent>

          <TabsContent value="upload">
            <div 
              className="relative h-32 flex items-center justify-center rounded-xl border-2 border-dashed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-all hover:border-indigo-500 group"
            >
              <div className="flex flex-col items-center pointer-events-none text-center p-4">
                <Upload className="w-8 h-8 mb-2 text-indigo-400 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Load High-Res Audio</p>
              </div>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Direct link to .mp3" 
                  className="pl-9 h-11 text-sm"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => loadFromUrl(url)} 
                disabled={!url || isLoadingUrl}
                className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 font-bold uppercase text-[10px]"
              >
                {isLoadingUrl ? <Activity className="w-4 h-4 animate-spin" /> : "Fetch"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {file && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300 border-t pt-6">
            <div className="flex flex-col items-center gap-6">
              {activeVideoId && (
                <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg border-b-4 border-red-600 bg-black">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src={`https://www.youtube.com/embed/${activeVideoId}`}
                    title="Video association" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    allowFullScreen
                  />
                </div>
              )}
              
              <div className="w-full">
                <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
              </div>
              
              <div className="flex items-center justify-center gap-6">
                <Button variant="outline" size="icon" onClick={stopPlayback} className="rounded-full h-12 w-12 border-indigo-100">
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <Button size="lg" onClick={togglePlayback} className="w-20 h-20 rounded-full shadow-2xl bg-indigo-600 hover:bg-indigo-700 transition-all hover:scale-110 group">
                  {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}
                </Button>
                <div className="w-12" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-mono text-indigo-500 font-bold uppercase">
                <span>{new Date((progress/100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                <span className="opacity-40 truncate max-w-[200px]">{file.name}</span>
                <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
              </div>
              <Slider value={[progress]} max={100} step={0.1} onValueChange={(v) => {
                const p = v[0];
                setProgress(p);
                const offset = (p / 100) * duration;
                offsetRef.current = offset;
                if (isPlaying && playerRef.current) {
                  playerRef.current.stop();
                  playbackStartTimeRef.current = Tone.now();
                  playerRef.current.start(0, offset);
                }
              }} />
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
                  <Slider value={[pitch]} min={-12} max={12} step={1} onValueChange={(v) => {
                    setPitch(v[0]);
                    if (playerRef.current) playerRef.current.detune = (v[0] * 100) + fineTune;
                  }} />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tempo Scaler</Label>
                    <span className="text-sm font-mono text-indigo-600 font-bold">{tempo.toFixed(2)}x</span>
                  </div>
                  <Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={(v) => {
                    setTempo(v[0]);
                    if (playerRef.current) playerRef.current.playbackRate = v[0];
                  }} />
                </div>
              </div>

              <div className="space-y-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-indigo-100/50">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Volume2 className="w-3 h-3 text-indigo-500" /> Output Gain
                    </Label>
                    <span className="text-xs font-mono font-bold">{Math.round((volume + 60) * 1.66)}%</span>
                  </div>
                  <Slider value={[volume]} min={-60} max={0} step={1} onValueChange={(v) => {
                    setVolume(v[0]);
                    if (playerRef.current) playerRef.current.volume.value = v[0];
                  }} />
                </div>
                <div className="pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Youtube className="w-3 h-3 text-red-600" />
                    <span className="text-[9px] font-bold text-indigo-600 uppercase">Pro Reference Mode</span>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default AudioTransposer;
"use client";

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as Tone from 'tone';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Play, Pause, RotateCcw, Upload, Volume2, Waves, Settings2, Activity, Link as LinkIcon, Globe, Search, Youtube, PlusCircle, Library } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import AudioVisualizer from './AudioVisualizer';
import SongSearch from './SongSearch';
import MyLibrary from './MyLibrary';
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SetlistSong } from './SetlistManager';

export interface AudioTransposerRef {
  loadFromUrl: (url: string, name: string, artist: string, youtubeUrl?: string) => Promise<void>;
  setPitch: (pitch: number) => void;
  getPitch: () => number;
  triggerSearch: (query: string) => void;
  togglePlayback: () => Promise<void>;
  getProgress: () => { progress: number; duration: number };
  getAnalyzer: () => Tone.Analyser | null;
  getIsPlaying: () => boolean;
}

interface AudioTransposerProps {
  onAddToSetlist?: (previewUrl: string, name: string, artist: string, ytUrl?: string, pitch?: number) => void;
  onAddExistingSong?: (song: SetlistSong) => void;
  onSongEnded?: () => void;
  repertoire?: SetlistSong[];
}

const AudioTransposer = forwardRef<AudioTransposerRef, AudioTransposerProps>(({ onAddToSetlist, onAddExistingSong, onSongEnded, repertoire = [] }, ref) => {
  const [file, setFile] = useState<{ name: string; artist?: string; url?: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [fineTune, setFineTune] = useState(0);
  const [tempo, setTempo] = useState(1);
  const [volume, setVolume] = useState(-6);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
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
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    
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

  const loadAudioBuffer = async (audioBuffer: AudioBuffer, name: string, artist: string, youtubeUrl?: string, previewUrl?: string) => {
    try {
      await initEngine();
      if (playerRef.current) playerRef.current.dispose();

      playerRef.current = new Tone.GrainPlayer(audioBuffer).connect(eqRef.current!);
      playerRef.current.grainSize = 0.18;
      playerRef.current.overlap = 0.1;
      playerRef.current.detune = (pitch * 100) + fineTune;
      playerRef.current.playbackRate = tempo;
      playerRef.current.volume.value = volume;

      setFile({ name, artist, url: previewUrl });
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

      showSuccess("Performance Ready");
    } catch (err) {
      console.error("Buffer error:", err);
      showError("Engine initialization failed.");
    }
  };

  const loadFromUrl = async (targetUrl: string, name: string, artist: string, youtubeUrl?: string) => {
    setIsLoadingUrl(true);
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error("Could not fetch file");
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      await loadAudioBuffer(audioBuffer, name, artist, youtubeUrl, targetUrl);
      if (!name) setUrl("");
    } catch (err) {
      showError("Failed to load audio stream.");
    } finally {
      setIsLoadingUrl(false);
    }
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
    },
    togglePlayback,
    getProgress: () => ({ progress, duration }),
    getAnalyzer: () => analyzerRef.current,
    getIsPlaying: () => isPlaying
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
    loadAudioBuffer(audioBuffer, uploadedFile.name, "Uploaded Track");
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
        if (onSongEnded) onSongEnded();
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
    <div className="flex flex-col h-full">
      <div className="bg-indigo-600 px-6 py-2.5 flex items-center justify-between text-white shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span className="font-bold text-[10px] tracking-widest uppercase">Direct Stream Processor</span>
        </div>
        <div className="flex items-center gap-4 text-[9px] font-mono opacity-80 uppercase">
          <span>Latency: Low</span>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
              <Waves className="w-5 h-5 text-indigo-600" />
              Song Studio
            </h2>
            <p className="text-xs text-slate-500 font-medium">Shift keys and prepare your repertoire.</p>
          </div>
          {file && onAddToSetlist && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onAddToSetlist(file.url || '', file.name, file.artist || "Unknown", activeYoutubeUrl, pitch)}
              className="h-8 border-green-200 text-green-600 hover:bg-green-50 font-bold text-[10px] uppercase gap-2"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Save
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9 bg-slate-100 dark:bg-slate-800 p-1 mb-6">
            <TabsTrigger value="search" className="text-[10px] uppercase font-bold gap-1.5"><Search className="w-3 h-3" /> iTunes</TabsTrigger>
            <TabsTrigger value="repertoire" className="text-[10px] uppercase font-bold gap-1.5"><Library className="w-3 h-3" /> Lib</TabsTrigger>
            <TabsTrigger value="upload" className="text-[10px] uppercase font-bold gap-1.5"><Upload className="w-3 h-3" /> Up</TabsTrigger>
            <TabsTrigger value="url" className="text-[10px] uppercase font-bold gap-1.5"><Globe className="w-3 h-3" /> URL</TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="mt-0 space-y-4">
            <SongSearch 
              onSelectSong={(url, name, artist, yt) => loadFromUrl(url, name, artist, yt)} 
              onAddToSetlist={(url, name, artist, yt) => onAddToSetlist?.(url, name, artist, yt)}
              externalQuery={searchQuery}
            />
          </TabsContent>

          <TabsContent value="repertoire" className="mt-0 space-y-4">
            <MyLibrary 
              repertoire={repertoire} 
              onAddSong={(song) => onAddExistingSong?.(song)}
            />
          </TabsContent>

          <TabsContent value="upload" className="mt-0">
            <div 
              className="relative h-28 flex items-center justify-center rounded-xl border-2 border-dashed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-all hover:border-indigo-500 group"
            >
              <div className="flex flex-col items-center pointer-events-none text-center p-4">
                <Upload className="w-7 h-7 mb-1.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Drop High-Res Audio</p>
              </div>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-0 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Direct link to .mp3" 
                  className="pl-9 h-10 text-xs font-medium"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => loadFromUrl(url, "Remote Link", "Web Stream")} 
                disabled={!url || isLoadingUrl}
                className="bg-indigo-600 hover:bg-indigo-700 h-10 px-5 font-bold uppercase text-[10px]"
              >
                {isLoadingUrl ? <Activity className="w-3.5 h-3.5 animate-spin" /> : "Fetch"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {file && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 border-t pt-6">
            <div className="flex flex-col items-center gap-5">
              {activeVideoId && (
                <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 bg-black">
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
                <Button variant="outline" size="icon" onClick={stopPlayback} className="rounded-full h-10 w-10 border-slate-200">
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button size="lg" onClick={togglePlayback} className="w-16 h-16 rounded-full shadow-xl bg-indigo-600 hover:bg-indigo-700 transition-all hover:scale-105 group">
                  {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-0.5" />}
                </Button>
                <div className="w-10" />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between text-[9px] font-mono text-indigo-600 font-black uppercase tracking-tighter">
                <span>{new Date((progress/100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                <span className="opacity-60 truncate max-w-[180px]">{file.name}</span>
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

            <div className="grid grid-cols-1 gap-6 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Settings2 className="w-3 h-3 text-indigo-500" /> Pitch
                    </Label>
                    <span className="text-xs font-mono font-bold text-indigo-600">{pitch > 0 ? `+${pitch}` : pitch} ST</span>
                  </div>
                  <Slider value={[pitch]} min={-12} max={12} step={1} onValueChange={(v) => {
                    setPitch(v[0]);
                    if (playerRef.current) playerRef.current.detune = (v[0] * 100) + fineTune;
                  }} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tempo</Label>
                    <span className="text-xs font-mono text-indigo-600 font-bold">{tempo.toFixed(2)}x</span>
                  </div>
                  <Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={(v) => {
                    setTempo(v[0]);
                    if (playerRef.current) playerRef.current.playbackRate = v[0];
                  }} />
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex justify-between items-center">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Volume2 className="w-3 h-3 text-indigo-500" /> Gain
                  </Label>
                  <span className="text-[10px] font-mono font-bold text-slate-600">{Math.round((volume + 60) * 1.66)}%</span>
                </div>
                <Slider value={[volume]} min={-60} max={0} step={1} onValueChange={(v) => {
                  setVolume(v[0]);
                  if (playerRef.current) playerRef.current.volume.value = v[0];
                }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default AudioTransposer;
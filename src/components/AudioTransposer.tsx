"use client";

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as Tone from 'tone';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Play, Pause, RotateCcw, Upload, Volume2, Waves, Settings2, Activity, Link as LinkIcon, Globe, Search, Youtube, PlusCircle, Library, Sparkles, Check, FileText, ExternalLink, Subtitles, X, ChevronUp, ChevronDown } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import AudioVisualizer from './AudioVisualizer';
import SongSearch from './SongSearch';
import MyLibrary from './MyLibrary';
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SetlistSong } from './SetlistManager';
import { transposeKey } from '@/utils/keyUtils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export interface AudioTransposerRef {
  loadFromUrl: (url: string, name: string, artist: string, youtubeUrl?: string, originalKey?: string, ugUrl?: string) => Promise<void>;
  setPitch: (pitch: number) => void;
  getPitch: () => number;
  triggerSearch: (query: string) => void;
  togglePlayback: () => Promise<void>;
  stopPlayback: () => void;
  getProgress: () => { progress: number; duration: number };
  getAnalyzer: () => Tone.Analyser | null;
  getIsPlaying: () => boolean;
}

interface AudioTransposerProps {
  onAddToSetlist?: (previewUrl: string, name: string, artist: string, ytUrl?: string, pitch?: number, ugUrl?: string) => void;
  onAddExistingSong?: (song: SetlistSong) => void;
  onUpdateSongKey?: (songId: string, newTargetKey: string) => void;
  onSongEnded?: () => void;
  onPlaybackChange?: (isPlaying: boolean) => void;
  repertoire?: SetlistSong[];
  currentSong?: SetlistSong | null;
}

const AudioTransposer = forwardRef<AudioTransposerRef, AudioTransposerProps>(({ 
  onAddToSetlist, 
  onAddExistingSong, 
  onUpdateSongKey,
  onSongEnded, 
  onPlaybackChange,
  repertoire = [],
  currentSong
}, ref) => {
  const [file, setFile] = useState<{ id?: string; name: string; artist?: string; url?: string; originalKey?: string; ugUrl?: string } | null>(null);
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
  const [activeUgUrl, setActiveUgUrl] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");

  const playerRef = useRef<Tone.GrainPlayer | null>(null);
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
    }
    return true;
  };

  useEffect(() => {
    return () => {
      stopPlayback();
      playerRef.current?.dispose();
      analyzerRef.current?.dispose();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const loadAudioBuffer = async (audioBuffer: AudioBuffer, name: string, artist: string, youtubeUrl?: string, previewUrl?: string, originalKey?: string, ugUrl?: string) => {
    try {
      await initEngine();
      if (playerRef.current) playerRef.current.dispose();

      playerRef.current = new Tone.GrainPlayer(audioBuffer).toDestination();
      playerRef.current.connect(analyzerRef.current!);
      playerRef.current.grainSize = 0.18;
      playerRef.current.overlap = 0.1;
      playerRef.current.detune = (pitch * 100) + fineTune;
      playerRef.current.playbackRate = tempo;
      playerRef.current.volume.value = volume;

      setFile({ id: currentSong?.id, name, artist, url: previewUrl, originalKey, ugUrl });
      setDuration(audioBuffer.duration);
      setProgress(0);
      offsetRef.current = 0;
      setIsPlaying(false);
      if (onPlaybackChange) onPlaybackChange(false);
      
      setActiveYoutubeUrl(youtubeUrl);
      setActiveUgUrl(ugUrl);
      if (youtubeUrl) {
        setActiveVideoId(getYoutubeId(youtubeUrl));
      } else {
        setActiveVideoId(null);
      }

      showSuccess("Audio Matrix Loaded");
    } catch (err) {
      showError("Engine error.");
    }
  };

  const loadFromUrl = async (targetUrl: string, name: string, artist: string, youtubeUrl?: string, originalKey?: string, ugUrl?: string) => {
    setIsLoadingUrl(true);
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error("Fetch error");
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      await loadAudioBuffer(audioBuffer, name, artist, youtubeUrl, targetUrl, originalKey, ugUrl);
      if (!name) setUrl("");
    } catch (err) {
      showError("Load failed.");
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
      if (onPlaybackChange) onPlaybackChange(false);
    } else {
      const startTime = (progress / 100) * duration;
      offsetRef.current = startTime;
      playbackStartTimeRef.current = Tone.now();
      playerRef.current.start(0, startTime);
      setIsPlaying(true);
      if (onPlaybackChange) onPlaybackChange(true);
    }
  };

  const stopPlayback = () => {
    if (playerRef.current) {
      playerRef.current.stop();
      setIsPlaying(false);
      if (onPlaybackChange) onPlaybackChange(false);
      setProgress(0);
      offsetRef.current = 0;
    }
  };

  const suggestedKey = useMemo(() => {
    const activeKey = file?.originalKey || currentSong?.originalKey;
    if (!activeKey || activeKey === "TBC") return null;
    return transposeKey(activeKey, pitch);
  }, [file?.originalKey, currentSong?.originalKey, pitch]);

  const handleApplyKey = () => {
    if (currentSong && suggestedKey && onUpdateSongKey) {
      onUpdateSongKey(currentSong.id, suggestedKey);
      showSuccess(`Applied ${suggestedKey}`);
    }
  };

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const shift = direction === 'up' ? 12 : -12;
    const newPitch = pitch + shift;
    
    if (newPitch > 24 || newPitch < -24) {
      showError("Range limit reached.");
      return;
    }

    setPitch(newPitch);
    if (playerRef.current) {
      playerRef.current.detune = (newPitch * 100) + fineTune;
    }
    
    if (currentSong && onUpdateSongKey) {
      const activeKey = file?.originalKey || currentSong?.originalKey;
      if (activeKey && activeKey !== "TBC") {
        const newTarget = transposeKey(activeKey, newPitch);
        onUpdateSongKey(currentSong.id, newTarget);
      }
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
    stopPlayback,
    getProgress: () => ({ progress, duration }),
    getAnalyzer: () => analyzerRef.current,
    getIsPlaying: () => isPlaying
  }));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) loadFile(uploadedFile);
  };

  const loadFile = async (uploadedFile: File) => {
    if (!uploadedFile.type.startsWith('audio/')) return;
    const arrayBuffer = await uploadedFile.arrayBuffer();
    const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
    loadAudioBuffer(audioBuffer, uploadedFile.name, "Manual Upload");
  };

  const animateProgress = () => {
    if (isPlaying && playerRef.current) {
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      const currentSeconds = offsetRef.current + elapsed;
      const newProgress = (currentSeconds / duration) * 100;
      
      if (currentSeconds >= duration) {
        setIsPlaying(false);
        if (onPlaybackChange) onPlaybackChange(false);
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
          <Subtitles className="w-3.5 h-3.5 animate-pulse" />
          <span className="font-black text-[10px] tracking-widest uppercase">Performance Engine Ready</span>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
              <Waves className="w-5 h-5 text-indigo-600" />
              Song Studio
            </h2>
          </div>
          {file && onAddToSetlist && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onAddToSetlist(file.url || '', file.name, file.artist || "Unknown", activeYoutubeUrl, pitch, activeUgUrl)}
              className="h-8 border-green-200 text-green-600 hover:bg-green-50 font-bold text-[10px] uppercase gap-2"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Save to Gig
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
              onAddToSetlist={(url, name, artist, yt, ug) => onAddToSetlist?.(url, name, artist, yt, 0, ug)}
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
            <div className="relative h-24 flex items-center justify-center rounded-xl border-2 border-dashed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 transition-all hover:border-indigo-500 group">
              <div className="flex flex-col items-center pointer-events-none text-center p-4">
                <Upload className="w-6 h-6 mb-1 text-indigo-400 group-hover:scale-110 transition-transform" />
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Drop Studio Master</p>
              </div>
              <input type="file" accept="audio/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-0 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Direct .mp3 URL" className="pl-9 h-10 text-xs" value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
              <Button onClick={() => loadFromUrl(url, "Remote Link", "Web Stream")} disabled={!url || isLoadingUrl} className="bg-indigo-600 h-10 px-5 font-bold uppercase text-[10px]">
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
                  <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${activeVideoId}`} frameBorder="0" allowFullScreen />
                </div>
              )}
              
              <div className="w-full">
                <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
              </div>
              
              <div className="flex items-center justify-center gap-6">
                <Button variant="outline" size="icon" onClick={stopPlayback} className="rounded-full h-10 w-10">
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button size="lg" onClick={togglePlayback} className="w-16 h-16 rounded-full shadow-xl bg-indigo-600 hover:bg-indigo-700">
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

            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <LinkIcon className="w-3.5 h-3.5 text-indigo-500" /> Manual Metadata Links
                </span>
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[9px] font-bold text-slate-500 uppercase flex items-center justify-between">
                    <span>YouTube Full Version</span>
                    <button 
                      onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(file.artist + ' ' + file.name + ' full audio')}`, '_blank')}
                      className="text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <Youtube className="w-3 h-3" /> Find
                    </button>
                  </Label>
                  <Input 
                    placeholder="Paste YouTube Link..." 
                    className="h-8 text-[10px] bg-white border-slate-100" 
                    value={activeYoutubeUrl || ""} 
                    onChange={(e) => {
                      setActiveYoutubeUrl(e.target.value);
                      setActiveVideoId(getYoutubeId(e.target.value));
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[9px] font-bold text-slate-500 uppercase flex items-center justify-between">
                    <span>Ultimate Guitar Tab</span>
                    <button 
                      onClick={() => window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(file.artist + ' ' + file.name + ' chords')}`, '_blank')}
                      className="text-orange-500 hover:text-orange-600 flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" /> Search
                    </button>
                  </Label>
                  <Input 
                    placeholder="Paste UG Tab Link..." 
                    className="h-8 text-[10px] bg-white border-slate-100" 
                    value={activeUgUrl || ""} 
                    onChange={(e) => setActiveUgUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Settings2 className="w-3 h-3 text-indigo-500" /> Key Transposer
                  </Label>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {pitch > 0 ? `+${pitch}` : pitch} ST
                    </span>
                    <div className="flex bg-slate-200/50 dark:bg-slate-800/50 rounded-lg border p-0.5 shadow-inner">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={() => handleOctaveShift('down')}
                              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-500 hover:text-indigo-600 transition-colors border-r"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-[9px] font-black uppercase">-12 ST</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={() => handleOctaveShift('up')}
                              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-500 hover:text-indigo-600 transition-colors"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="text-[9px] font-black uppercase">+12 ST</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <Slider value={[pitch]} min={-24} max={24} step={1} onValueChange={(v) => {
                      setPitch(v[0]);
                      if (playerRef.current) playerRef.current.detune = (v[0] * 100) + fineTune;
                    }} />
                  </div>
                  {suggestedKey && (
                    <Button onClick={handleApplyKey} size="sm" className="bg-indigo-50 text-indigo-600 h-9 px-3 text-[10px] uppercase font-black gap-1">
                      <Sparkles className="w-3 h-3" /> Apply {suggestedKey}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tempo</Label>
                    <span className="text-xs font-mono text-indigo-600 font-bold">{tempo.toFixed(2)}x</span>
                  </div>
                  <Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={(v) => {
                    setTempo(v[0]);
                    if (playerRef.current) playerRef.current.playbackRate = v[0];
                  }} />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
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
          </div>
        )}
      </div>
    </div>
  );
});

export default AudioTransposer;
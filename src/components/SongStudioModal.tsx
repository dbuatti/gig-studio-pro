"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { SetlistSong } from './SetlistManager';
import { ALL_KEYS, calculateSemitones } from '@/utils/keyUtils';
import { 
  Music, FileText, Youtube, Settings2, 
  Sparkles, Waves, Activity, Play, Pause,
  Volume2, Gauge, ExternalLink, Library,
  Upload, Link2, X, Plus, Tag, Check, Loader2,
  FileDown, Headphones, Wand2, Download,
  Globe, Eye, Link as LinkIcon, RotateCcw,
  Zap, Disc, VolumeX
} from 'lucide-react';
import { cn } from "@/lib/utils";
import AudioVisualizer from './AudioVisualizer';
import * as Tone from 'tone';
import { analyze } from 'web-audio-beat-detector';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Slider } from '@/components/ui/slider';

interface SongStudioModalProps {
  song: SetlistSong | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onPerform?: (song: SetlistSong) => void;
}

const RESOURCE_TYPES = [
  { id: 'UG', label: 'Ultimate Guitar', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'FS', label: 'ForScore', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'SM', label: 'Sheet Music', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'LS', label: 'Lead Sheet', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'PDF', label: 'iPad PDF', color: 'bg-red-100 text-red-700 border-red-200' },
];

const SongStudioModal: React.FC<SongStudioModalProps> = ({ 
  song, 
  isOpen, 
  onClose, 
  onSave, 
  onUpdateKey,
  onPerform 
}) => {
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<'details' | 'audio' | 'visual' | 'library'>('audio');
  const [newTag, setNewTag] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Audio Engine State
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tempo, setTempo] = useState(1);
  const [volume, setVolume] = useState(-6);
  const [fineTune, setFineTune] = useState(0);
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);

  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const analyzerRef = useRef<Tone.Analyser | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);
  const requestRef = useRef<number>();
  const metronomeSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const metronomeLoopRef = useRef<Tone.Loop | null>(null);
  
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);

  useEffect(() => {
    if (song && isOpen) {
      setFormData({
        name: song.name || "",
        artist: song.artist || "",
        bpm: song.bpm || "",
        originalKey: song.originalKey || "C",
        targetKey: song.targetKey || "C",
        notes: song.notes || "",
        youtubeUrl: song.youtubeUrl || "",
        previewUrl: song.previewUrl || "",
        pdfUrl: song.pdfUrl || "",
        ugUrl: song.ugUrl || "",
        resources: song.resources || [],
        pitch: song.pitch || 0,
        user_tags: song.user_tags || [],
        isKeyLinked: song.isKeyLinked ?? true
      });
      
      if (song.previewUrl) {
        prepareAudio(song.previewUrl, song.pitch || 0);
      }
    }
    return () => {
      cleanupAudio();
      stopMetronome();
    };
  }, [song?.id, isOpen]);

  // Update metronome BPM in real-time if it's active
  useEffect(() => {
    if (isMetronomeActive && formData.bpm) {
      const bpmValue = parseInt(formData.bpm);
      if (!isNaN(bpmValue) && bpmValue > 0) {
        Tone.getTransport().bpm.value = bpmValue;
      }
    }
  }, [formData.bpm, isMetronomeActive]);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const handleAutoSave = (updates: Partial<SetlistSong>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (song) onSave(song.id, updates);
    }, 800);
  };

  const cleanupAudio = () => {
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current.dispose();
      playerRef.current = null;
    }
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setIsPlaying(false);
    setProgress(0);
    playbackOffsetRef.current = 0;
    currentBufferRef.current = null;
  };

  const stopMetronome = () => {
    Tone.getTransport().stop();
    metronomeLoopRef.current?.stop();
    setIsMetronomeActive(false);
  };

  const toggleMetronome = async () => {
    if (!formData.bpm) {
      showError("Set a BPM first.");
      return;
    }

    if (isMetronomeActive) {
      stopMetronome();
    } else {
      if (Tone.getContext().state !== 'running') await Tone.start();
      
      if (!metronomeSynthRef.current) {
        metronomeSynthRef.current = new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 4,
          oscillator: { type: "sine" }
        }).toDestination();
      }
      
      const bpmValue = parseInt(formData.bpm);
      if (isNaN(bpmValue) || bpmValue <= 0) return;
      
      Tone.getTransport().bpm.value = bpmValue;
      
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

  const prepareAudio = async (url: string, pitch: number) => {
    if (!url) return;
    try {
      if (Tone.getContext().state !== 'running') await Tone.start();
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Audio fetch failed");
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      
      currentBufferRef.current = buffer;
      
      if (!analyzerRef.current) {
        analyzerRef.current = new Tone.Analyser("fft", 256);
      }

      if (playerRef.current) playerRef.current.dispose();
      playerRef.current = new Tone.GrainPlayer(buffer).toDestination();
      playerRef.current.connect(analyzerRef.current);
      playerRef.current.detune = (pitch * 100) + fineTune;
      playerRef.current.playbackRate = tempo;
      playerRef.current.volume.value = volume;
      playerRef.current.grainSize = 0.18;
      playerRef.current.overlap = 0.1;
      
      setDuration(buffer.duration);
    } catch (err) {
      console.error("Audio Load Error:", err);
    }
  };

  const handleDetectBPM = async () => {
    if (!currentBufferRef.current) {
      showError("Link an audio track first.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const bpm = await analyze(currentBufferRef.current);
      const roundedBpm = Math.round(bpm);
      handleAutoSave({ bpm: roundedBpm.toString() });
      showSuccess(`Detected Tempo: ${roundedBpm} BPM`);
    } catch (err) {
      showError("Could not determine tempo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const togglePlayback = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.stop();
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      playbackOffsetRef.current += elapsed;
      setIsPlaying(false);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    } else {
      const startTime = (progress / 100) * duration;
      playbackOffsetRef.current = startTime;
      playbackStartTimeRef.current = Tone.now();
      playerRef.current.start(0, startTime);
      setIsPlaying(true);
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  const stopPlayback = () => {
    if (playerRef.current) {
      playerRef.current.stop();
      setIsPlaying(false);
      setProgress(0);
      playbackOffsetRef.current = 0;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  };

  const animate = () => {
    if (playerRef.current && isPlaying) {
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      const currentSeconds = playbackOffsetRef.current + elapsed;
      const newProgress = (currentSeconds / duration) * 100;

      if (currentSeconds >= duration) {
        setIsPlaying(false);
        setProgress(0);
        playbackOffsetRef.current = 0;
        return;
      }

      setProgress(newProgress);
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !song) return;

    setIsUploading(true);
    try {
      const isAudio = file.type.startsWith('audio/');
      const folder = isAudio ? 'tracks' : 'sheets';
      const fileName = `${folder}/${song.id}-${Date.now()}.${file.name.split('.').pop()}`;

      const { error: uploadError } = await supabase.storage.from('audio_tracks').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('audio_tracks').getPublicUrl(fileName);
      
      const update = isAudio ? { previewUrl: publicUrl } : { pdfUrl: publicUrl };
      
      setFormData(prev => ({ ...prev, ...update }));
      onSave(song.id, update);
      
      if (isAudio) prepareAudio(publicUrl, formData.pitch || 0);
      showSuccess(`Successfully linked ${file.name}`);
    } catch (err) {
      showError("Asset upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const addTag = () => {
    if (!newTag.trim() || !song) return;
    const currentTags = formData.user_tags || [];
    if (!currentTags.includes(newTag.trim())) {
      const updated = [...currentTags, newTag.trim()];
      handleAutoSave({ user_tags: updated });
    }
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    if (!song) return;
    const updated = (formData.user_tags || []).filter(t => t !== tag);
    handleAutoSave({ user_tags: updated });
  };

  const toggleResource = (id: string) => {
    if (!song) return;
    const current = formData.resources || [];
    const updated = current.includes(id) ? current.filter(rid => rid !== id) : [...current, id];
    handleAutoSave({ resources: updated });
  };

  const updateHarmonics = (updates: Partial<SetlistSong>) => {
    if (!song) return;
    setFormData(prev => {
      const next = { ...prev, ...updates };
      const isLinked = next.isKeyLinked ?? true;
      
      if (isLinked) {
        const diff = calculateSemitones(next.originalKey || "C", next.targetKey || "C");
        next.pitch = diff;
        if (playerRef.current) playerRef.current.detune = (diff * 100) + fineTune;
      }
      
      onSave(song.id, next);
      return next;
    });
  };

  const handleDownloadAll = () => {
    const links = [
      { url: formData.previewUrl, name: `${formData.name}_Audio` },
      { url: formData.pdfUrl, name: `${formData.name}_Chart` },
      { url: formData.youtubeUrl, name: `${formData.name}_Reference` },
      { url: formData.ugUrl, name: `${formData.name}_UG_Chords` }
    ].filter(l => !!l.url);

    if (links.length === 0) {
      showError("No downloadable assets found.");
      return;
    }

    links.forEach(link => {
      const a = document.createElement('a');
      a.href = link.url!;
      a.download = link.name;
      a.target = '_blank';
      a.click();
    });
    showSuccess(`Started download for ${links.length} assets.`);
  };

  const handleUgAction = () => {
    if (formData.ugUrl) {
      window.open(formData.ugUrl, '_blank');
    } else {
      const query = encodeURIComponent(`${formData.artist} ${formData.name}`);
      const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}&type=600`;
      window.open(searchUrl, '_blank');
    }
  };

  if (!song) return null;
  const videoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-5xl p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white rounded-[2rem]"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{formData.name || "Song Studio"}</DialogTitle>
          <DialogDescription>Configure song metadata, assets, and harmonic settings.</DialogDescription>
        </DialogHeader>

        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-indigo-600/20 backdrop-blur-sm border-4 border-dashed border-indigo-500 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-indigo-400 animate-bounce" />
              <p className="text-xl font-black uppercase tracking-tighter">Drop Audio or PDF to Link</p>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4">
             <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
             <p className="text-sm font-black uppercase tracking-[0.2em] text-white">Syncing Master Asset...</p>
          </div>
        )}

        <div className="flex h-[800px]">
          <div className="w-80 bg-slate-900/50 border-r border-white/5 flex flex-col">
            <div className="p-8 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-indigo-600 p-1.5 rounded-lg">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="font-black uppercase tracking-tighter text-xs">Pro Studio Config</span>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-1 truncate">{formData.name || ""}</h2>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest truncate">{formData.artist || "Unknown Artist"}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Harmonic Engine</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={() => updateHarmonics({ isKeyLinked: !formData.isKeyLinked })}
                          className={cn(
                            "p-1.5 rounded-lg border transition-all",
                            formData.isKeyLinked ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white/5 border-white/10 text-slate-500"
                          )}
                        >
                          <LinkIcon className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px] font-black uppercase">
                        {formData.isKeyLinked ? "Keys are Linked to Pitch" : "Pitch is Independent"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Original Key</Label>
                    <Select value={formData.originalKey || "C"} onValueChange={(val) => updateHarmonics({ originalKey: val })}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white font-bold font-mono h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {ALL_KEYS.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-[9px] font-bold text-indigo-400 uppercase">Stage Key</Label>
                      <span className="text-[9px] font-mono text-slate-500">{(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span>
                    </div>
                    <Select value={formData.targetKey || "C"} onValueChange={(val) => {
                      updateHarmonics({ targetKey: val });
                      onUpdateKey(song.id, val);
                    }}>
                      <SelectTrigger className="bg-indigo-600 border-none text-white font-bold font-mono h-11 shadow-lg shadow-indigo-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {ALL_KEYS.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Library Matrix</Label>
                <div className="grid grid-cols-1 gap-2">
                  {RESOURCE_TYPES.map(res => {
                    const isActive = formData.resources?.includes(res.id) || (res.id === 'UG' && formData.ugUrl);
                    return (
                      <button
                        key={res.id}
                        onClick={() => toggleResource(res.id)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                          isActive 
                            ? "bg-indigo-600/20 border-indigo-500 text-indigo-400" 
                            : "bg-white/5 text-slate-500 border-white/5 hover:border-white/10"
                        )}
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest">{res.label}</span>
                        {isActive ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 opacity-30" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Custom Tags</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(formData.user_tags || []).map(t => (
                    <Badge key={t} variant="secondary" className="bg-white/5 text-indigo-300 border-white/10 px-2 py-1 gap-1 text-[9px] font-bold uppercase">
                      {t} <button onClick={() => removeTag(t)}><X className="w-2.5 h-2.5 hover:text-white" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Add tag..." 
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    className="h-9 text-[10px] bg-white/5 border-white/10 font-bold uppercase"
                  />
                  <Button size="icon" variant="ghost" className="h-9 w-9 bg-white/5" onClick={addTag}><Tag className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-600">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Live Sync: ON
              </div>
              <span>PRO V2.5</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="h-16 border-b border-white/5 flex items-center px-10 justify-between bg-black/20 shrink-0">
              <div className="flex gap-8">
                {['audio', 'details', 'visual', 'library'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={cn(
                      "text-[10px] font-black uppercase tracking-[0.3em] h-16 transition-all border-b-4",
                      activeTab === tab ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white"
                    )}
                  >
                    {tab.toUpperCase()} ENGINE
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4">
                 <div className="h-8 w-px bg-white/5" />
                 <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-500 hover:text-white font-bold uppercase tracking-widest text-[10px]">Close Studio</Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10">
              {activeTab === 'audio' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400">Audio Transposition Matrix</h3>
                      <p className="text-xs text-slate-500 mt-1">Direct stream processing with real-time pitch and time-stretching.</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/10 border border-indigo-500/20 rounded-full">
                       <Zap className="w-3 h-3 text-indigo-400" />
                       <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Active Processing</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-10 space-y-10">
                    <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
                    
                    <div className="space-y-6">
                      <div className="flex justify-between text-[10px] font-mono font-black text-slate-500 uppercase">
                        <span>{new Date((progress/100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                        <span>Transport Position</span>
                        <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
                      </div>
                      <Slider value={[progress]} max={100} step={0.1} onValueChange={(v) => {
                        const p = v[0];
                        setProgress(p);
                        const offset = (p / 100) * duration;
                        playbackOffsetRef.current = offset;
                        if (isPlaying && playerRef.current) {
                          playerRef.current.stop();
                          playbackStartTimeRef.current = Tone.now();
                          playerRef.current.start(0, offset);
                        }
                      }} />
                    </div>

                    <div className="flex items-center justify-center gap-8">
                       <Button variant="ghost" size="icon" onClick={stopPlayback} className="h-14 w-14 rounded-full border border-white/5 hover:bg-white/5">
                         <RotateCcw className="w-6 h-6" />
                       </Button>
                       <Button 
                         size="lg" 
                         disabled={!formData.previewUrl}
                         onClick={togglePlayback}
                         className="h-24 w-24 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-2xl shadow-indigo-600/40 transition-all hover:scale-105"
                       >
                         {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1.5 fill-current" />}
                       </Button>
                       <div className="h-14 w-14" /> {/* Spacer */}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-8 bg-white/5 p-8 rounded-[2rem] border border-white/5">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pitch Processor</Label>
                          <span className="text-sm font-mono font-black text-indigo-400">{(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span>
                        </div>
                        <Slider 
                          value={[formData.pitch || 0]} 
                          min={-12} 
                          max={12} 
                          step={1} 
                          onValueChange={(v) => {
                            setFormData(prev => ({ ...prev, pitch: v[0] }));
                            if (playerRef.current) playerRef.current.detune = (v[0] * 100) + fineTune;
                            if (song) onSave(song.id, { pitch: v[0] });
                          }} 
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fine Tune</Label>
                          <span className="text-sm font-mono font-black text-slate-500">{fineTune > 0 ? '+' : ''}{fineTune} Cents</span>
                        </div>
                        <Slider 
                          value={[fineTune]} 
                          min={-100} 
                          max={100} 
                          step={1} 
                          onValueChange={(v) => {
                            setFineTune(v[0]);
                            if (playerRef.current) playerRef.current.detune = ((formData.pitch || 0) * 100) + v[0];
                          }} 
                        />
                      </div>
                    </div>

                    <div className="space-y-8 bg-white/5 p-8 rounded-[2rem] border border-white/5">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Time Stretch (Tempo)</Label>
                          <span className="text-sm font-mono font-black text-indigo-400">{tempo.toFixed(2)}x</span>
                        </div>
                        <Slider 
                          value={[tempo]} 
                          min={0.5} 
                          max={1.5} 
                          step={0.01} 
                          onValueChange={(v) => {
                            setTempo(v[0]);
                            if (playerRef.current) playerRef.current.playbackRate = v[0];
                          }} 
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Output Gain</Label>
                          <span className="text-sm font-mono font-black text-slate-500">{Math.round((volume + 60) * 1.66)}%</span>
                        </div>
                        <Slider 
                          value={[volume]} 
                          min={-60} 
                          max={0} 
                          step={1} 
                          onValueChange={(v) => {
                            setVolume(v[0]);
                            if (playerRef.current) playerRef.current.volume.value = v[0];
                          }} 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-900 rounded-[2rem] border border-white/5 flex items-center justify-between">
                     <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Library BPM</span>
                           <div className="flex items-center gap-3">
                             <Input 
                               value={formData.bpm || ""}
                               onChange={(e) => handleAutoSave({ bpm: e.target.value })}
                               className="bg-transparent border-none p-0 h-auto text-xl font-black font-mono text-indigo-400 focus-visible:ring-0 w-16"
                             />
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               onClick={toggleMetronome}
                               className={cn(
                                 "h-8 w-8 rounded-lg transition-all",
                                 isMetronomeActive ? "bg-indigo-600 text-white shadow-lg" : "bg-white/5 text-slate-400"
                               )}
                             >
                               {isMetronomeActive ? <Volume2 className="w-4 h-4 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
                             </Button>
                           </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleDetectBPM}
                            disabled={isAnalyzing || !formData.previewUrl}
                            className="h-10 px-4 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white font-black uppercase tracking-widest text-[10px] gap-2 rounded-xl"
                          >
                            {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Disc className="w-3.5 h-3.5" />}
                            Scan Master Tempo
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => window.open('https://www.beatsperminuteonline.com/', '_blank')}
                            className="h-10 px-4 bg-white/5 text-slate-400 hover:bg-white/10 font-black uppercase tracking-widest text-[10px] gap-2 rounded-xl"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Tap BPM Tool
                          </Button>
                        </div>
                     </div>
                     <div className="flex items-center gap-10 pr-4">
                        <div className="flex flex-col items-end">
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sample Rate</span>
                           <span className="text-xs font-mono font-bold text-slate-400">44.1 kHz</span>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Latency Mode</span>
                           <span className="text-xs font-mono font-bold text-emerald-500 uppercase">Interactive</span>
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {activeTab === 'details' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Performance Title</Label>
                      <Input 
                        value={formData.name || ""} 
                        onChange={(e) => handleAutoSave({ name: e.target.value })}
                        className="bg-white/5 border-white/10 text-xl font-black h-14"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Primary Artist</Label>
                      <Input 
                        value={formData.artist || ""} 
                        onChange={(e) => handleAutoSave({ artist: e.target.value })}
                        className="bg-white/5 border-white/10 text-xl font-black h-14"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sheet Music Link (PDF/Web)</Label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Paste sheet music URL..." 
                          value={formData.pdfUrl || ""}
                          onChange={(e) => handleAutoSave({ pdfUrl: e.target.value })}
                          className="bg-white/5 border-white/10 font-bold"
                        />
                        <Button variant="ghost" className="bg-white/5 h-10 w-10 p-0" onClick={() => window.open(formData.pdfUrl, '_blank')}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ultimate Guitar Pro Link</Label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Paste Direct Official Tab URL..." 
                          value={formData.ugUrl || ""}
                          onChange={(e) => handleAutoSave({ ugUrl: e.target.value })}
                          className="bg-white/5 border-white/10 font-bold text-orange-400"
                        />
                        <Button variant="ghost" className="bg-white/5 h-10 w-10 p-0 text-orange-400" onClick={handleUgAction}>
                          <Link2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rehearsal & Dynamics Notes</Label>
                    <Textarea 
                      placeholder="Cues, transitions, dynamics..."
                      value={formData.notes || ""}
                      onChange={(e) => handleAutoSave({ notes: e.target.value })}
                      className="min-h-[250px] bg-white/5 border-white/10 text-sm leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'visual' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400">Reference Media Link</h3>
                    <div className="flex gap-2">
                       <Input 
                         placeholder="YouTube URL..." 
                         value={formData.youtubeUrl || ""}
                         onChange={(e) => handleAutoSave({ youtubeUrl: e.target.value })}
                         className="bg-white/5 border-white/10 text-xs w-96 h-10"
                       />
                    </div>
                  </div>

                  {videoId ? (
                    <div className="space-y-6">
                      <div className="aspect-video w-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 bg-black">
                        <iframe 
                          width="100%" 
                          height="100%" 
                          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`}
                          title="Reference Video" 
                          frameBorder="0" 
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                          allowFullScreen
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-32 bg-white/5 rounded-[3rem] border border-dashed border-white/10 space-y-6">
                      <div className="h-20 w-20 bg-white/5 rounded-full flex items-center justify-center">
                        <Youtube className="w-10 h-10 text-slate-700" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black uppercase tracking-widest text-slate-500">Visual Engine Standby</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'library' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400">Resource Matrix</h3>
                      <p className="text-xs text-slate-500 mt-1">Centralized management for all song assets and links.</p>
                    </div>
                    <Button onClick={handleDownloadAll} className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-10 gap-2 px-6">
                      <Download className="w-3.5 h-3.5" /> Download All
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className={cn(
                      "group p-6 rounded-[2rem] border transition-all relative flex flex-col justify-between h-56",
                      formData.previewUrl ? "bg-white/5 border-white/10" : "bg-white/5 border-white/5 opacity-40 border-dashed"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-indigo-600 p-3 rounded-2xl">
                          <Music className="w-6 h-6" />
                        </div>
                      </div>
                      <div className="space-y-1 mt-4">
                        <Label className="text-[9px] font-black uppercase text-indigo-400">Master Performance Audio</Label>
                        <p className="text-lg font-black tracking-tight">{formData.previewUrl ? "Audio_Stream_Master" : "Not Linked"}</p>
                      </div>
                    </div>

                    <div className={cn(
                      "group p-6 rounded-[2rem] border transition-all relative flex flex-col justify-between h-56",
                      formData.ugUrl || (formData.artist && formData.name) ? "bg-white/5 border-white/10" : "bg-white/5 border-white/5 opacity-40 border-dashed"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-orange-600 p-3 rounded-2xl">
                          <Link2 className="w-6 h-6" />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-orange-400" 
                          onClick={handleUgAction}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-1 mt-4">
                        <Label className="text-[9px] font-black uppercase text-orange-400">Ultimate Guitar Pro</Label>
                        <p className="text-lg font-black tracking-tight">{formData.ugUrl ? "Verified Official Link" : "Auto-Search Active"}</p>
                        <p className="text-[8px] text-slate-500 font-mono">{formData.ugUrl || "Targeting Official Tab Type 600"}</p>
                      </div>
                    </div>

                    <div className={cn(
                      "group p-6 rounded-[2rem] border transition-all relative flex flex-col justify-between h-56",
                      formData.pdfUrl ? "bg-white/5 border-white/10" : "bg-white/5 border-white/5 opacity-40 border-dashed"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-emerald-600 p-3 rounded-2xl">
                          <FileText className="w-6 h-6" />
                        </div>
                      </div>
                      <div className="space-y-1 mt-4">
                        <Label className="text-[9px] font-black uppercase text-emerald-400">Stage Chart / PDF</Label>
                        <p className="text-lg font-black tracking-tight">{formData.pdfUrl ? "Performance_Chart" : "Not Linked"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SongStudioModal;
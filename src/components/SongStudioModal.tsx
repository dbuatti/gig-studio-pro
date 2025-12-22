"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { SetlistSong } from './SetlistManager';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, calculateSemitones, formatKey, transposeKey } from '@/utils/keyUtils';
import { 
  Music, FileText, Youtube, Settings2, 
  Sparkles, Waves, Activity, Play, Pause,
  Volume2, Gauge, ExternalLink, Library,
  Upload, Link2, X, Plus, Tag, Check, Loader2,
  FileDown, Headphones, Wand2, Download,
  Globe, Eye, Link as LinkIcon, RotateCcw,
  Zap, Disc, VolumeX, Smartphone, Printer, Search,
  ClipboardPaste, AlignLeft, Apple, Hash, Music2
} from 'lucide-react';
import { cn } from "@/lib/utils";
import AudioVisualizer from './AudioVisualizer';
import * as Tone from 'tone';
import { analyze } from 'web-audio-beat-detector';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Slider } from '@/components/ui/slider';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { RESOURCE_TYPES } from '@/utils/constants';
import { Progress } from "@/components/ui/progress";

interface SongStudioModalProps {
  song: SetlistSong | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onSyncProData?: (song: SetlistSong) => Promise<void>;
  onPerform?: (song: SetlistSong) => void;
}

const SongStudioModal: React.FC<SongStudioModalProps> = ({ 
  song, 
  isOpen, 
  onClose, 
  onSave, 
  onUpdateKey,
  onSyncProData,
  onPerform 
}) => {
  const { keyPreference: globalPreference } = useSettings();
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<'details' | 'audio' | 'visual' | 'lyrics' | 'library' | 'chart'>('audio');
  const [newTag, setNewTag] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFormattingLyrics, setIsFormattingLyrics] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  
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

  // Use song-specific preference if it exists, otherwise global
  const currentKeyPreference = formData.key_preference || globalPreference;
  const keysToUse = currentKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  // Calculate Readiness Score
  const readiness = useMemo(() => {
    let score = 0;
    const isItunes = formData.previewUrl?.includes('apple.com') || formData.previewUrl?.includes('itunes-assets');
    
    if (formData.previewUrl && !isItunes) score += 25; // Master Audio
    if (formData.isKeyConfirmed) score += 20; // Key Confirmed
    if (formData.lyrics?.length && formData.lyrics.length > 20) score += 15; // Lyrics
    if (formData.pdfUrl || formData.leadsheetUrl) score += 15; // Charts
    if (formData.ugUrl) score += 10; // UG Link
    if (formData.bpm) score += 5; // BPM Set
    if (formData.notes?.length && formData.notes.length > 10) score += 5; // Notes
    if (formData.artist && formData.artist !== "Unknown Artist") score += 5; // Artist metadata

    return Math.min(100, score);
  }, [formData]);

  const readinessColor = readiness === 100 ? 'bg-emerald-500' : readiness > 60 ? 'bg-indigo-500' : 'bg-slate-500';

  useEffect(() => {
    if (song && isOpen) {
      // Reset navigation state when switching songs
      setActiveTab('audio');
      setPreviewPdfUrl(null);

      setFormData({
        name: song.name || "",
        artist: song.artist || "",
        bpm: song.bpm || "",
        originalKey: song.originalKey || "C",
        targetKey: song.targetKey || "C",
        notes: song.notes || "",
        lyrics: song.lyrics || "",
        youtubeUrl: song.youtubeUrl || "",
        previewUrl: song.previewUrl || "",
        appleMusicUrl: song.appleMusicUrl || "",
        pdfUrl: song.pdfUrl || "",
        leadsheetUrl: song.leadsheetUrl || "",
        ugUrl: song.ugUrl || "",
        resources: song.resources || [],
        pitch: song.pitch || 0,
        user_tags: song.user_tags || [],
        isKeyLinked: song.isKeyLinked ?? true,
        isKeyConfirmed: song.isKeyConfirmed ?? false,
        duration_seconds: song.duration_seconds || 0,
        key_preference: song.key_preference
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

  // Update progress during playback
  useEffect(() => {
    if (isPlaying) {
      const updateProgress = () => {
        if (!playerRef.current || duration === 0) return;
        const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
        const currentPos = playbackOffsetRef.current + elapsed;
        const p = (currentPos / duration) * 100;
        
        if (p >= 100) {
          setIsPlaying(false);
          setProgress(0);
          playbackOffsetRef.current = 0;
        } else {
          setProgress(p);
          requestRef.current = requestAnimationFrame(updateProgress);
        }
      };
      requestRef.current = requestAnimationFrame(updateProgress);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, duration, tempo]);

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

  const togglePlayback = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.stop();
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      playbackOffsetRef.current += elapsed;
      setIsPlaying(false);
    } else {
      const startTime = (progress / 100) * duration;
      playbackOffsetRef.current = startTime;
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
      playbackOffsetRef.current = 0;
    }
  };

  const handleAutoSave = (updates: Partial<SetlistSong>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    if (song) onSave(song.id, updates);
  };

  const updateHarmonics = (updates: Partial<SetlistSong>) => {
    if (!song) return;
    setFormData(prev => {
      const next = { ...prev, ...updates };
      if (updates.hasOwnProperty('isKeyLinked') || updates.hasOwnProperty('originalKey') || updates.hasOwnProperty('targetKey')) {
        if (next.isKeyLinked) {
          const diff = calculateSemitones(next.originalKey || "C", next.targetKey || "C");
          next.pitch = diff;
        }
      }
      if (playerRef.current) {
        playerRef.current.detune = ((next.pitch || 0) * 100) + fineTune;
      }
      onSave(song.id, next);
      return next;
    });
  };

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const currentPitch = formData.pitch || 0;
    const shift = direction === 'up' ? 12 : -12;
    const newPitch = currentPitch + shift;
    if (newPitch > 24 || newPitch < -24) return;
    setFormData(prev => ({ ...prev, pitch: newPitch }));
    if (playerRef.current) playerRef.current.detune = (newPitch * 100) + fineTune;
    if (song) onSave(song.id, { pitch: newPitch });
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!song) return null;
  const videoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[95vw] w-[1400px] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white rounded-[2rem]"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); /* Handle drop... */ }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-50 overflow-hidden rounded-t-[2rem]">
          <div className={cn("h-full transition-all duration-1000", readinessColor)} style={{ width: `${readiness}%` }} />
        </div>

        <DialogHeader className="sr-only">
          <DialogTitle>{formData.name || "Song Studio"}</DialogTitle>
          <DialogDescription>Configure song metadata, assets, and harmonic settings.</DialogDescription>
        </DialogHeader>

        {/* FULL SCREEN PDF OVERLAY (from library preview) */}
        {previewPdfUrl && (
          <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-xl animate-in fade-in zoom-in duration-300 flex flex-col p-12">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black uppercase tracking-tight">Stage Chart Preview</h3>
              <Button variant="ghost" size="icon" onClick={() => setPreviewPdfUrl(null)} className="h-12 w-12 rounded-full hover:bg-white/10">
                <X className="w-8 h-8" />
              </Button>
            </div>
            <iframe 
              src={`${previewPdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
              className="flex-1 w-full rounded-2xl bg-white"
              title="PDF Preview"
            />
          </div>
        )}

        <div className="flex h-[90vh] min-h-[800px] overflow-hidden">
          {/* LEFT SIDEBAR - Persistent */}
          <div className="w-96 bg-slate-900/50 border-r border-white/5 flex flex-col shrink-0">
            <div className="p-8 border-b border-white/5 bg-black/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-600 p-1.5 rounded-lg">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-black uppercase tracking-tighter text-xs">Pro Studio Config</span>
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-full border border-white/10">
                   <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", readinessColor)} />
                   <span className="text-[9px] font-black font-mono text-slate-400">{readiness}% READY</span>
                </div>
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight leading-none mb-1 truncate">{formData.name || ""}</h2>
              <p className="text-xs font-black text-indigo-400 uppercase tracking-widest truncate">{formData.artist || "Unknown Artist"}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              {/* Harmonic Engine Side Controls */}
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Harmonic Engine</Label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Original Key</Label>
                    <Select value={formData.originalKey || "C"} onValueChange={(val) => updateHarmonics({ originalKey: val })}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white font-bold font-mono h-12 text-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
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
                      <SelectTrigger className={cn(
                        "border-none text-white font-bold font-mono h-12 shadow-xl text-lg transition-colors",
                        formData.isKeyConfirmed ? "bg-emerald-600 shadow-emerald-500/20" : "bg-indigo-600 shadow-indigo-500/20"
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Tagging */}
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Custom Tags</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(formData.user_tags || []).map(t => (
                    <Badge key={t} variant="secondary" className="bg-white/5 text-indigo-300 border-white/10 px-3 py-1.5 gap-2 text-[10px] font-bold uppercase rounded-lg">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="h-20 border-b border-white/5 flex items-center px-12 justify-between bg-black/20 shrink-0">
              <div className="flex gap-8">
                {['audio', 'chart', 'details', 'lyrics', 'visual', 'library'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={cn(
                      "text-[10px] font-black uppercase tracking-[0.4em] h-20 transition-all border-b-4",
                      activeTab === tab ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white"
                    )}
                  >
                    {tab === 'chart' ? 'Chart' : tab} ENGINE
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white font-black uppercase tracking-[0.3em] text-[10px]">Exit Studio</Button>
            </div>

            <div className="flex-1 overflow-y-auto relative">
              {activeTab === 'chart' && formData.pdfUrl ? (
                <div className="h-full w-full flex flex-col p-8 gap-8 animate-in fade-in duration-500 relative">
                  <div className="flex-1 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-white">
                    <iframe 
                      src={`${formData.pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                      className="w-full h-full"
                      title="Studio Sheet View"
                    />
                  </div>

                  {/* STUDIO MINI PLAYER OVERLAY */}
                  <div className="absolute bottom-16 right-16 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-500 flex items-center gap-6 min-w-[360px]">
                    <Button 
                      onClick={togglePlayback}
                      className={cn(
                        "h-16 w-16 rounded-full transition-all active:scale-95 shadow-xl shrink-0",
                        isPlaying ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
                      )}
                    >
                      {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                    </Button>
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-between items-baseline">
                         <span className="text-[9px] font-black font-mono text-indigo-400 uppercase tracking-[0.2em]">Studio Sync Feed</span>
                         <span className="text-xs font-black font-mono text-white">{formatTime((progress/100)*duration)} / {formatTime(duration)}</span>
                      </div>
                      <Progress value={progress} className="h-1.5 bg-white/10" />
                    </div>
                    
                    <div className="h-12 w-px bg-white/5 mx-2" />
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-slate-500 hover:text-white h-12 w-12 rounded-full"
                      onClick={stopPlayback}
                    >
                      <RotateCcw className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ) : activeTab === 'chart' ? (
                <div className="h-full flex flex-col items-center justify-center space-y-6">
                   <div className="p-8 bg-white/5 rounded-full border border-dashed border-white/10">
                      <FileText className="w-16 h-16 text-slate-700" />
                   </div>
                   <p className="text-slate-500 font-black uppercase tracking-widest text-xs">No Sheet Music Linked</p>
                   <Button variant="outline" className="border-white/10 hover:bg-white/5" onClick={() => setActiveTab('details')}>Link Assets</Button>
                </div>
              ) : null}

              {activeTab === 'audio' && (
                <div className="p-12 space-y-12 animate-in fade-in duration-500">
                  <div className="h-40 bg-slate-900/50 rounded-[2rem] border border-white/5 p-8">
                     <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
                  </div>
                  {/* Standard Audio Controls... */}
                  <div className="flex items-center justify-center gap-12 py-12">
                     <Button size="lg" onClick={togglePlayback} className="h-32 w-32 rounded-full bg-indigo-600">
                        {isPlaying ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12 ml-2" />}
                     </Button>
                  </div>
                </div>
              )}

              {activeTab === 'lyrics' && (
                <div className="p-12 h-full flex flex-col animate-in fade-in duration-500">
                  <Textarea 
                    value={formData.lyrics || ""}
                    onChange={(e) => handleAutoSave({ lyrics: e.target.value })}
                    className="flex-1 bg-white/5 border-white/10 text-xl p-10 rounded-[2rem] resize-none"
                    placeholder="Paste lyrics here..."
                  />
                </div>
              )}

              {/* Other tabs remain similar... */}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SongStudioModal;
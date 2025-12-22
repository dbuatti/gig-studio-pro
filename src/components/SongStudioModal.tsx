"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SetlistSong } from './SetlistManager';
import { ALL_KEYS } from '@/utils/keyUtils';
import { 
  Music, FileText, Youtube, Settings2, 
  Sparkles, Waves, Activity, Play, Pause,
  Volume2, Gauge, ExternalLink, Library,
  Upload, Link2, X, Plus, Tag, Check, Loader2,
  FileDown, FileType, Headphones, Wand2, Download,
  MoreVertical, Copy, Globe, Eye
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
  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const analyzerRef = useRef<Tone.Analyser | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);
  const requestRef = useRef<number>();
  
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);

  useEffect(() => {
    if (song) {
      setFormData({
        name: song.name || "",
        artist: song.artist || "",
        bpm: song.bpm || "",
        originalKey: song.originalKey || "C",
        targetKey: song.targetKey || "C",
        notes: song.notes || "",
        youtubeUrl: song.youtubeUrl || "",
        pdfUrl: song.pdfUrl || "",
        resources: song.resources || [],
        pitch: song.pitch || 0,
        user_tags: song.user_tags || []
      });
      
      if (song.previewUrl) {
        prepareAudio(song.previewUrl, song.pitch || 0);
      }
    }
    return () => cleanupAudio();
  }, [song, isOpen]);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    if (!song || !isOpen) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      onSave(song.id, formData);
    }, 1000);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [formData, song?.id, isOpen]);

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

  const prepareAudio = async (url: string, pitch: number) => {
    try {
      cleanupAudio();
      if (Tone.getContext().state !== 'running') await Tone.start();
      
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      
      currentBufferRef.current = buffer;
      
      if (!analyzerRef.current) {
        analyzerRef.current = new Tone.Analyser("fft", 256);
      }

      playerRef.current = new Tone.GrainPlayer(buffer).toDestination();
      playerRef.current.connect(analyzerRef.current);
      playerRef.current.detune = pitch * 100;
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
      setFormData(prev => ({ ...prev, bpm: roundedBpm.toString() }));
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
      const elapsed = Tone.now() - playbackStartTimeRef.current;
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

  const animate = () => {
    if (playerRef.current && isPlaying) {
      const elapsed = Tone.now() - playbackStartTimeRef.current;
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

      const { error } = await supabase.storage.from('audio_tracks').upload(fileName, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('audio_tracks').getPublicUrl(fileName);
      
      const update = isAudio ? { previewUrl: publicUrl } : { pdfUrl: publicUrl };
      setFormData(prev => ({ ...prev, ...update }));
      if (isAudio) prepareAudio(publicUrl, formData.pitch || 0);
      showSuccess(`Uploaded ${file.name}`);
    } catch (err) {
      showError("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    const currentTags = formData.user_tags || [];
    if (!currentTags.includes(newTag.trim())) {
      setFormData(prev => ({ ...prev, user_tags: [...currentTags, newTag.trim()] }));
    }
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({ 
      ...prev, 
      user_tags: (prev.user_tags || []).filter(t => t !== tag) 
    }));
  };

  const toggleResource = (id: string) => {
    const current = formData.resources || [];
    const updated = current.includes(id) ? current.filter(rid => rid !== id) : [...current, id];
    setFormData(prev => ({ ...prev, resources: updated }));
  };

  const handleDownloadAll = () => {
    const links = [
      { url: formData.previewUrl, name: `${formData.name}_Audio` },
      { url: formData.pdfUrl, name: `${formData.name}_Chart` },
      { url: formData.youtubeUrl, name: `${formData.name}_Reference` }
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

  if (!song) return null;
  const videoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-5xl p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white rounded-[2rem]"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        aria-describedby="song-studio-description"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{formData.name || "Song Studio"}</DialogTitle>
          <DialogDescription id="song-studio-description">
            Configure song metadata, assets, and harmonic settings.
          </DialogDescription>
        </DialogHeader>

        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-indigo-600/20 backdrop-blur-sm border-4 border-dashed border-indigo-500 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-indigo-400 animate-bounce" />
              <p className="text-xl font-black uppercase tracking-tighter">Drop Audio or PDF to Link</p>
            </div>
          </div>
        )}

        <div className="flex h-[800px]">
          {/* Left Sidebar: Settings */}
          <div className="w-80 bg-slate-900/50 border-r border-white/5 flex flex-col">
            <div className="p-8 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-indigo-600 p-1.5 rounded-lg">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="font-black uppercase tracking-tighter text-xs">Pro Studio Config</span>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{formData.name || ""}</h2>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{formData.artist || "Unknown Artist"}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              {/* Harmonic Engine */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Harmonic Engine</Label>
                  {isUploading && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Original Key</Label>
                    <Select value={formData.originalKey || "C"} onValueChange={(val) => setFormData(prev => ({ ...prev, originalKey: val }))}>
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
                      setFormData(prev => ({ ...prev, targetKey: val }));
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

              {/* Resources */}
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Library Matrix</Label>
                <div className="grid grid-cols-1 gap-2">
                  {RESOURCE_TYPES.map(res => {
                    const isActive = formData.resources?.includes(res.id);
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

              {/* Custom Tags */}
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
                Auto-Save Active
              </div>
              <span>v2.0 PRO</span>
            </div>
          </div>

          {/* Main Area: Dynamic Studio View */}
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
                <div className="space-y-10 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400">Audio Transposition Matrix</h3>
                      <p className="text-xs text-slate-500 mt-1">Real-time pitch and time-stretching processing.</p>
                    </div>
                    {formData.previewUrl ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-500 text-[10px] font-black uppercase">
                        <Waves className="w-3 h-3" /> Processor Connected
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-500 text-[10px] font-black uppercase">
                        <Headphones className="w-3 h-3" /> No Audio Linked
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-10 space-y-10">
                    <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
                    
                    <div className="flex flex-col items-center gap-6">
                       <Button 
                         size="lg" 
                         disabled={!formData.previewUrl}
                         onClick={togglePlayback}
                         className="h-24 w-24 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-2xl shadow-indigo-600/40 transition-all hover:scale-105"
                       >
                         {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1.5 fill-current" />}
                       </Button>
                       
                       <div className="w-full max-w-md space-y-3">
                         <div className="flex justify-between text-[10px] font-mono font-black text-indigo-400 uppercase">
                           <span>Pitch Processor</span>
                           <span>{(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span>
                         </div>
                         <Slider 
                           value={[formData.pitch || 0]} 
                           min={-12} 
                           max={12} 
                           step={1} 
                           onValueChange={(v) => {
                             setFormData(prev => ({ ...prev, pitch: v[0] }));
                             if (playerRef.current) playerRef.current.detune = v[0] * 100;
                           }} 
                         />
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                          <Gauge className="w-3.5 h-3.5 text-indigo-400" /> BPM Engine
                        </Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleDetectBPM}
                          disabled={isAnalyzing || !formData.previewUrl}
                          className="h-7 px-3 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white font-black uppercase tracking-widest text-[8px] gap-1.5"
                        >
                          {isAnalyzing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Wand2 className="w-2.5 h-2.5" />}
                          Scan Tempo
                        </Button>
                      </div>
                      <Input 
                        placeholder="Manual override BPM..." 
                        value={formData.bpm || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, bpm: e.target.value }))}
                        className="bg-white/5 border-white/10 font-mono text-indigo-400 h-12"
                      />
                    </div>
                    <div 
                      className="p-6 bg-indigo-600/5 rounded-3xl border border-dashed border-indigo-500/30 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-600/10 transition-all"
                      onClick={() => document.getElementById('audio-upload')?.click()}
                    >
                      <Upload className="w-6 h-6 text-indigo-400 mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Update Master Track</p>
                      <p className="text-[8px] text-slate-500 mt-1">MP3, WAV, AIFF Supported</p>
                      <input id="audio-upload" type="file" className="hidden" accept="audio/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDrop({ preventDefault: () => {}, dataTransfer: { files: [file] } } as any);
                      }} />
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
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-white/5 border-white/10 text-xl font-black h-14"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Primary Artist</Label>
                      <Input 
                        value={formData.artist || ""} 
                        onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
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
                          onChange={(e) => setFormData(prev => ({ ...prev, pdfUrl: e.target.value }))}
                          className="bg-white/5 border-white/10 font-bold"
                        />
                        <Button variant="ghost" className="bg-white/5 h-10 w-10 p-0" onClick={() => window.open(formData.pdfUrl, '_blank')}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Performance Status Notes</Label>
                      <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                         <div className="flex flex-col items-center flex-1 gap-1">
                            <span className="text-[8px] font-black text-slate-500 uppercase">Audio</span>
                            {formData.previewUrl ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-red-500" />}
                         </div>
                         <div className="flex flex-col items-center flex-1 gap-1">
                            <span className="text-[8px] font-black text-slate-500 uppercase">Charts</span>
                            {formData.pdfUrl ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-red-500" />}
                         </div>
                         <div className="flex flex-col items-center flex-1 gap-1">
                            <span className="text-[8px] font-black text-slate-500 uppercase">Verified</span>
                            {formData.isMetadataConfirmed ? <Check className="w-4 h-4 text-emerald-500" /> : <Activity className="w-4 h-4 text-amber-500" />}
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rehearsal & Dynamcis Notes</Label>
                    <Textarea 
                      placeholder="Cues, transitions, dynamics..."
                      value={formData.notes || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
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
                         onChange={(e) => setFormData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
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
                      <div className="flex items-center justify-between p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl">
                        <div className="flex items-center gap-4">
                           <Sparkles className="w-6 h-6 text-indigo-400" />
                           <div>
                             <p className="text-xs font-black uppercase tracking-widest">Stage Sync Connected</p>
                             <p className="text-[10px] text-slate-400 mt-1">This video will be available as a visual reference during live sets.</p>
                           </div>
                        </div>
                        <Button variant="ghost" onClick={() => setFormData(prev => ({ ...prev, youtubeUrl: "" }))} className="text-red-400 text-[10px] font-black uppercase hover:bg-red-500/10">Disconnect Link</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-32 bg-white/5 rounded-[3rem] border border-dashed border-white/10 space-y-6">
                      <div className="h-20 w-20 bg-white/5 rounded-full flex items-center justify-center">
                        <Youtube className="w-10 h-10 text-slate-700" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black uppercase tracking-widest text-slate-500">Visual Engine Standby</p>
                        <p className="text-xs text-slate-600 mt-2 max-w-[300px]">Paste a YouTube link above to enable visual references during performance.</p>
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
                    <Button 
                      onClick={handleDownloadAll}
                      className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-10 gap-2 px-6 shadow-lg shadow-indigo-600/20"
                    >
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
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {formData.previewUrl && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild><a href={formData.previewUrl} download><Download className="w-3.5 h-3.5" /></a></Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => document.getElementById('audio-upload')?.click()}><Upload className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1 mt-4">
                        <Label className="text-[9px] font-black uppercase text-indigo-400">Master Performance Audio</Label>
                        <Input 
                          placeholder="Filename / Caption..."
                          className="bg-transparent border-none p-0 h-auto text-lg font-black tracking-tight focus-visible:ring-0"
                          defaultValue={formData.previewUrl ? "Audio_Stream_Master" : "Not Linked"}
                        />
                        <p className="text-[8px] text-slate-500 font-mono truncate">{formData.previewUrl || "No source connected"}</p>
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
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {formData.pdfUrl && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(formData.pdfUrl, '_blank')}><Eye className="w-3.5 h-3.5" /></Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveTab('details')}><Settings2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1 mt-4">
                        <Label className="text-[9px] font-black uppercase text-emerald-400">Stage Chart / PDF</Label>
                        <Input 
                          placeholder="Filename / Caption..."
                          className="bg-transparent border-none p-0 h-auto text-lg font-black tracking-tight focus-visible:ring-0"
                          defaultValue={formData.pdfUrl ? "Performance_Chart" : "Not Linked"}
                        />
                        <p className="text-[8px] text-slate-500 font-mono truncate">{formData.pdfUrl || "No source connected"}</p>
                      </div>
                    </div>

                    <div className={cn(
                      "group p-6 rounded-[2rem] border transition-all relative flex flex-col justify-between h-56",
                      formData.youtubeUrl ? "bg-white/5 border-white/10" : "bg-white/5 border-white/5 opacity-40 border-dashed"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-red-600 p-3 rounded-2xl">
                          <Youtube className="w-6 h-6" />
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(formData.youtubeUrl, '_blank')}><Globe className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveTab('visual')}><Settings2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1 mt-4">
                        <Label className="text-[9px] font-black uppercase text-red-400">Visual Reference</Label>
                        <Input 
                          placeholder="Filename / Caption..."
                          className="bg-transparent border-none p-0 h-auto text-lg font-black tracking-tight focus-visible:ring-0"
                          defaultValue={formData.youtubeUrl ? "YouTube_Reference" : "Not Linked"}
                        />
                        <p className="text-[8px] text-slate-500 font-mono truncate">{formData.youtubeUrl || "No link provided"}</p>
                      </div>
                    </div>

                    <div className="group p-6 rounded-[2rem] border bg-white/5 border-white/10 transition-all relative flex flex-col justify-between h-56">
                      <div className="flex items-center justify-between">
                        <div className="bg-orange-600 p-3 rounded-2xl">
                          <Link2 className="w-6 h-6" />
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`https://www.ultimate-guitar.com/search.php?value=${formData.artist} ${formData.name}`, '_blank')}><ExternalLink className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <div className="space-y-1 mt-4">
                        <Label className="text-[9px] font-black uppercase text-orange-400">External Pro Link</Label>
                        <Input 
                          placeholder="Caption..."
                          className="bg-transparent border-none p-0 h-auto text-lg font-black tracking-tight focus-visible:ring-0"
                          defaultValue="Ultimate_Guitar_Chords"
                          readOnly
                        />
                        <p className="text-[8px] text-slate-500 font-mono truncate">Automatic Search Link Enabled</p>
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
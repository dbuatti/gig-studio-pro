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
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, calculateSemitones, formatKey, transposeKey } from '@/utils/keyUtils';
import { 
  Music, FileText, Youtube, Settings2, 
  Sparkles, Waves, Activity, Play, Pause, Square,
  Volume2, Gauge, ExternalLink, Library,
  Upload, Link2, X, Plus, Tag, Check, Loader2,
  FileDown, Headphones, Wand2, Download,
  Globe, Eye, Link as LinkIcon, RotateCcw,
  Zap, Disc, VolumeX, Smartphone, Printer, Search,
  ClipboardPaste, AlignLeft, Apple, Hash, Music2,
  Type, Layout, BookOpen
} from 'lucide-react';
import { cn } from "@/lib/utils";
import AudioVisualizer from './AudioVisualizer';
import * as Tone from 'tone';
import { analyze } from 'web-audio-beat-detector';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Slider } from '@/components/ui/slider';
import { useSettings, KeyPreference } from '@/hooks/use-settings';

interface SongStudioModalProps {
  song: SetlistSong | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onSyncProData?: (song: SetlistSong) => Promise<void>;
  onPerform?: (song: SetlistSong) => void;
}

const RESOURCE_TYPES = [
  { id: 'UG', label: 'Ultimate Guitar', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'LYRICS', label: 'Has Lyrics', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { id: 'LEAD', label: 'Lead Sheet', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { id: 'UGP', label: 'UG Playlist', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'FS', label: 'ForScore', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'PDF', label: 'Stage PDF', color: 'bg-red-100 text-red-700 border-red-200' },
];

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
  const [activeTab, setActiveTab] = useState<'details' | 'audio' | 'visual' | 'lyrics' | 'library'>('audio');
  const [newTag, setNewTag] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFormattingLyrics, setIsFormattingLyrics] = useState(false);
  
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

  const currentKeyPreference = formData.key_preference || globalPreference;
  const keysToUse = currentKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  const initEngine = async () => {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    if (!analyzerRef.current) {
      analyzerRef.current = new Tone.Analyser("fft", 256);
    }
    return true;
  };

  // Real-time progress loop
  useEffect(() => {
    const updateProgress = () => {
      if (isPlaying && playerRef.current && duration > 0) {
        const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
        const currentPos = playbackOffsetRef.current + elapsed;
        const newProgress = (currentPos / duration) * 100;
        
        if (newProgress >= 100) {
          stopPlayback();
        } else {
          setProgress(newProgress);
          requestRef.current = requestAnimationFrame(updateProgress);
        }
      }
    };

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, duration, tempo]);

  useEffect(() => {
    if (song && isOpen) {
      setFormData({
        name: song.name || "",
        artist: song.artist || "",
        bpm: song.bpm || "",
        genre: song.genre || "",
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
      await initEngine();
      if (!metronomeSynthRef.current) {
        metronomeSynthRef.current = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, oscillator: { type: "sine" } }).toDestination();
      }
      const bpmValue = parseInt(formData.bpm);
      if (isNaN(bpmValue) || bpmValue <= 0) return;
      Tone.getTransport().bpm.value = bpmValue;
      if (!metronomeLoopRef.current) {
        metronomeLoopRef.current = new Tone.Loop((time) => { metronomeSynthRef.current?.triggerAttackRelease("C4", "32n", time); }, "4n").start(0);
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
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      currentBufferRef.current = buffer;
      if (!analyzerRef.current) analyzerRef.current = new Tone.Analyser("fft", 256);
      if (playerRef.current) playerRef.current.dispose();
      playerRef.current = new Tone.GrainPlayer(buffer).toDestination();
      playerRef.current.connect(analyzerRef.current);
      playerRef.current.detune = (pitch * 100) + fineTune;
      playerRef.current.playbackRate = tempo;
      playerRef.current.volume.value = volume;
      playerRef.current.grainSize = 0.18;
      playerRef.current.overlap = 0.1;
      setDuration(buffer.duration);
    } catch (err) {}
  };

  const handleDetectBPM = async () => {
    if (!currentBufferRef.current) return;
    setIsAnalyzing(true);
    try {
      const bpm = await analyze(currentBufferRef.current);
      handleAutoSave({ bpm: Math.round(bpm).toString() });
      showSuccess(`Detected BPM: ${Math.round(bpm)}`);
    } catch (err) {
      showError("BPM detection failed.");
    } finally { setIsAnalyzing(false); }
  };

  const togglePlayback = async () => {
    await initEngine();
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
      playerRef.current.start(Tone.now(), startTime);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !song) return;
    setIsUploading(true);
    try {
      const isAudio = file.type.startsWith('audio/');
      const isPDF = file.type === 'application/pdf';
      const isLeadSheet = isPDF && file.name.toLowerCase().includes('leadsheet');
      const folder = isAudio ? 'tracks' : 'sheets';
      const fileName = `${folder}/${song.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('audio_tracks').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('audio_tracks').getPublicUrl(fileName);
      let update: Partial<SetlistSong> = {};
      if (isAudio) update.previewUrl = publicUrl;
      else if (isLeadSheet) update.leadsheetUrl = publicUrl;
      else if (isPDF) update.pdfUrl = publicUrl;
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
      handleAutoSave({ user_tags: [...currentTags, newTag.trim()] });
    }
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    if (!song) return;
    handleAutoSave({ user_tags: (formData.user_tags || []).filter(t => t !== tag) });
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
      if (updates.hasOwnProperty('isKeyLinked')) {
        next.pitch = next.isKeyLinked ? calculateSemitones(next.originalKey || "C", next.targetKey || "C") : 0;
      } else if (next.isKeyLinked) {
        next.pitch = calculateSemitones(next.originalKey || "C", next.targetKey || "C");
      }
      if (playerRef.current) playerRef.current.detune = ((next.pitch || 0) * 100) + fineTune;
      onSave(song.id, next);
      return next;
    });
  };

  const handleProSync = async () => { if (song && onSyncProData) await onSyncProData(song); };
  const handleUgAction = () => { if (formData.ugUrl) window.open(formData.ugUrl, '_blank'); else if (formData.name && formData.artist) window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(formData.artist + ' ' + formData.name + ' official tab')}`, '_blank'); };
  const handlePdfAction = () => { if (formData.pdfUrl) window.open(formData.pdfUrl, '_blank'); else if (formData.name && formData.artist) window.open(`https://www.google.com/search?q=${encodeURIComponent(formData.name + ' ' + formData.artist + ' sheet music pdf free')}`, '_blank'); };
  const handleLyricsSearch = () => window.open(`https://www.google.com/search?q=${encodeURIComponent(formData.artist + ' ' + formData.name + ' lyrics')}`, '_blank');
  
  const handleMagicFormatLyrics = async () => {
    if (!formData.lyrics?.trim()) return;
    setIsFormattingLyrics(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', { body: { queries: [formData.lyrics], mode: 'lyrics' } });
      if (data?.lyrics) handleAutoSave({ lyrics: data.lyrics });
      showSuccess("Lyrics formatted by AI");
    } catch (err) {
      showError("AI formatting failed.");
    } finally { setIsFormattingLyrics(false); }
  };

  const handlePasteUgUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.includes('ultimate-guitar.com')) { handleAutoSave({ ugUrl: text }); showSuccess("UG Link saved"); }
    } catch (err) {}
  };

  const handleUgPrint = () => {
    if (!formData.ugUrl) return;
    window.open(formData.ugUrl.includes('?') ? formData.ugUrl.replace('?', '') : `${formData.ugUrl}/print`, '_blank');
  };

  const handleYoutubeSearch = () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent((formData.artist || "") + " " + (formData.name || "") + " studio version audio")}`, '_blank');

  const handleDownloadAll = async () => {
    const assets = [
      { url: formData.previewUrl, name: `${formData.name}_audio` },
      { url: formData.pdfUrl, name: `${formData.name}_sheet` },
      { url: formData.leadsheetUrl, name: `${formData.name}_leadsheet` }
    ].filter(a => !!a.url);
    for (const asset of assets) {
      try {
        const response = await fetch(asset.url!);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = asset.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {}
    }
  };

  if (!song) return null;
  const videoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[95vw] w-[1400px] p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white rounded-[2rem]"
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

        <div className="flex h-[90vh] min-h-[800px]">
          {/* Left Sidebar */}
          <div className="w-96 bg-slate-900/50 border-r border-white/5 flex flex-col">
            <div className="p-8 border-b border-white/5 bg-black/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-600 p-1.5 rounded-lg">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-black uppercase tracking-tighter text-xs">Pro Studio Config</span>
                </div>
                <Button 
                  onClick={handleProSync} 
                  className="bg-indigo-600 hover:bg-indigo-700 h-8 px-3 text-[9px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-indigo-600/20"
                >
                  <Sparkles className="w-3 h-3" /> Pro Sync
                </Button>
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight leading-none mb-1 truncate">{formData.name || ""}</h2>
              <p className="text-xs font-black text-indigo-400 uppercase tracking-widest truncate">{formData.artist || "Unknown Artist"}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Harmonic Engine</Label>
                  <TooltipProvider>
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            onClick={() => {
                              const nextPref = currentKeyPreference === 'sharps' ? 'flats' : 'sharps';
                              handleAutoSave({ key_preference: nextPref });
                            }}
                            className={cn(
                              "p-1.5 rounded-lg border transition-all flex items-center gap-2 px-3",
                              formData.key_preference ? "bg-indigo-600 border-indigo-500 text-white shadow-lg" : "bg-white/5 border-white/10 text-slate-500"
                            )}
                          >
                            {currentKeyPreference === 'sharps' ? <Hash className="w-3.5 h-3.5" /> : <Music2 className="w-3.5 h-3.5" />}
                            <span className="text-[9px] font-black uppercase">{currentKeyPreference}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px] font-black uppercase">Toggle Notation</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => updateHarmonics({ isKeyConfirmed: !formData.isKeyConfirmed })} className={cn("p-1.5 rounded-lg border transition-all", formData.isKeyConfirmed ? "bg-emerald-600 border-emerald-500 text-white shadow-lg" : "bg-white/5 border-white/10 text-slate-500")}><Check className="w-3.5 h-3.5" /></button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px] font-black uppercase">Verify Key</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => updateHarmonics({ isKeyLinked: !formData.isKeyLinked })} className={cn("p-1.5 rounded-lg border transition-all", formData.isKeyLinked ? "bg-indigo-600 border-indigo-500 text-white shadow-lg" : "bg-white/5 border-white/10 text-slate-500")}><LinkIcon className="w-3.5 h-3.5" /></button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px] font-black uppercase">Link Pitch</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Original Key</Label>
                    <Select value={formData.originalKey || "C"} onValueChange={(val) => updateHarmonics({ originalKey: val })}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white font-bold font-mono h-12 text-lg"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">{keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-[9px] font-bold text-indigo-400 uppercase">Stage Key</Label>
                      <span className="text-[9px] font-mono text-slate-500">{(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span>
                    </div>
                    <Select value={formData.targetKey || "C"} onValueChange={(val) => { updateHarmonics({ targetKey: val }); onUpdateKey(song.id, val); }}>
                      <SelectTrigger className={cn("border-none text-white font-bold font-mono h-12 shadow-xl text-lg transition-colors", formData.isKeyConfirmed ? "bg-emerald-600" : "bg-indigo-600")}><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">{keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Library Matrix</Label>
                <div className="grid grid-cols-1 gap-2.5">
                  {RESOURCE_TYPES.map(res => {
                    const isActive = formData.resources?.includes(res.id) || 
                                   (res.id === 'UG' && formData.ugUrl) || 
                                   (res.id === 'LYRICS' && formData.lyrics) ||
                                   (res.id === 'PDF' && formData.pdfUrl) ||
                                   (res.id === 'LEAD' && formData.leadsheetUrl);
                    return (
                      <button key={res.id} onClick={() => toggleResource(res.id)} className={cn("flex items-center justify-between p-4 rounded-xl border transition-all text-left group", isActive ? "bg-indigo-600/20 border-indigo-500 text-indigo-400" : "bg-white/5 text-slate-500 border-white/5 hover:border-white/10")}>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{res.label}</span>
                        {isActive ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4 opacity-30 group-hover:opacity-100" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Custom Tags</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(formData.user_tags || []).map(t => (
                    <Badge key={t} variant="secondary" className="bg-white/5 text-indigo-300 border-white/10 px-3 py-1.5 gap-2 text-[10px] font-bold uppercase rounded-lg">
                      {t} <button onClick={() => removeTag(t)}><X className="w-3 h-3 hover:text-white" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add tag..." value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} className="h-10 text-xs bg-white/5 border-white/10 font-bold uppercase" />
                  <Button size="icon" variant="ghost" className="h-10 w-10 bg-white/5" onClick={addTag}><Tag className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Workspace */}
          <div className="flex-1 flex flex-col">
            <div className="h-20 border-b border-white/5 flex items-center px-12 justify-between bg-black/20 shrink-0">
              <div className="flex gap-12">
                {['audio', 'details', 'lyrics', 'visual', 'library'].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab as any)} className={cn("text-xs font-black uppercase tracking-[0.4em] h-20 transition-all border-b-4", activeTab === tab ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white")}>
                    {tab.toUpperCase()} ENGINE
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white font-black uppercase tracking-[0.3em] text-xs">Close Studio</Button>
            </div>

            <div className="flex-1 overflow-y-auto p-12">
              {activeTab === 'audio' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-[0.2em] text-indigo-400">Audio Transposition Matrix</h3>
                      <p className="text-sm text-slate-500 mt-2">Direct stream processing with real-time pitch and time-stretching.</p>
                    </div>
                    <Button variant="outline" onClick={handleYoutubeSearch} className="bg-red-600/10 border-red-600/20 text-red-600 hover:bg-red-600 hover:text-white font-black uppercase tracking-widest text-[9px] h-10 gap-2 px-6 rounded-xl transition-all">
                      <Youtube className="w-3.5 h-3.5" /> Discovery Mode
                    </Button>
                  </div>
                  <div className="bg-slate-900/50 rounded-[3rem] border border-white/5 p-12 space-y-12">
                    <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
                    {formData.previewUrl ? (
                      <div className="space-y-8">
                        <div className="flex justify-between text-xs font-mono font-black text-slate-500 uppercase tracking-widest">
                          <span className="text-indigo-400">{new Date((progress/100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                          <span>Transport Master Clock</span>
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
                            playerRef.current.start(Tone.now(), offset);
                          }
                        }} />
                        <div className="flex items-center justify-center gap-12">
                           <Button variant="ghost" size="icon" onClick={() => { stopPlayback(); setProgress(0); }} className="h-20 w-20 rounded-full border border-white/5 hover:scale-110 transition-all"><RotateCcw className="w-8 h-8" /></Button>
                           <Button size="lg" onClick={togglePlayback} className="h-32 w-32 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_60px_rgba(79,70,229,0.4)] transition-all hover:scale-105 active:scale-95">{isPlaying ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12 ml-2 fill-current" />}</Button>
                           <Button variant="ghost" size="icon" onClick={stopPlayback} className="h-20 w-20 rounded-full border border-white/5 hover:scale-110 transition-all"><Square className="w-8 h-8" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 space-y-6">
                        <div className="bg-indigo-600/10 p-6 rounded-full border border-indigo-500/20"><Music className="w-12 h-12 text-indigo-400" /></div>
                        <p className="text-sm text-slate-500 max-w-sm text-center">No performance track is linked. Upload a master file to start transposing.</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-10 bg-white/5 p-10 rounded-[2.5rem] border border-white/5">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pitch Processor</Label><span className="text-lg font-mono font-black text-indigo-400">{(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span></div>
                        <Slider value={[formData.pitch || 0]} min={-12} max={12} step={1} onValueChange={(v) => {
                          const newPitch = v[0];
                          const newTargetKey = transposeKey(formData.originalKey || "C", newPitch);
                          setFormData(prev => ({ ...prev, pitch: newPitch, targetKey: newTargetKey }));
                          if (playerRef.current) playerRef.current.detune = (newPitch * 100) + fineTune;
                          if (song) { onSave(song.id, { pitch: newPitch, targetKey: newTargetKey }); onUpdateKey(song.id, newTargetKey); }
                        }} />
                      </div>
                    </div>
                    <div className="space-y-10 bg-white/5 p-10 rounded-[2.5rem] border border-white/5">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Time Stretch</Label><span className="text-lg font-mono font-black text-indigo-400">{tempo.toFixed(2)}x</span></div>
                        <Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={(v) => { setTempo(v[0]); if (playerRef.current) playerRef.current.playbackRate = v[0]; }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'details' && (
                <div className="space-y-10 animate-in fade-in duration-500">
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Primary Artist</Label>
                        <Input value={formData.artist || ""} onChange={(e) => handleAutoSave({ artist: e.target.value })} className="bg-white/5 border-white/10 font-bold h-12 rounded-xl" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Tempo (BPM)</Label>
                          <div className="flex gap-2">
                            <Input type="number" value={formData.bpm || ""} onChange={(e) => handleAutoSave({ bpm: e.target.value })} className="bg-white/5 border-white/10 font-bold h-12 rounded-xl" />
                            <Button variant="ghost" size="icon" className="h-12 w-12 bg-white/5 rounded-xl text-indigo-400" onClick={handleDetectBPM} disabled={isAnalyzing}>
                              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Headphones className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Genre / Style</Label>
                          <Input value={formData.genre || ""} onChange={(e) => handleAutoSave({ genre: e.target.value })} className="bg-white/5 border-white/10 font-bold h-12 rounded-xl" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Sheet Music Link (PDF)</Label>
                        <div className="flex gap-3">
                          <Input placeholder="Paste URL..." value={formData.pdfUrl || ""} onChange={(e) => handleAutoSave({ pdfUrl: e.target.value })} className="bg-white/5 border-white/10 font-bold h-12 rounded-xl" />
                          <Button variant="ghost" className="bg-white/5 h-12 w-12 p-0 rounded-xl" onClick={handlePdfAction}>
                            {formData.pdfUrl ? <FileDown className="w-5 h-5 text-red-400" /> : <Search className="w-5 h-5" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Leadsheet Matrix (Link)</Label>
                        <div className="flex gap-3">
                          <Input placeholder="Paste Leadsheet URL..." value={formData.leadsheetUrl || ""} onChange={(e) => handleAutoSave({ leadsheetUrl: e.target.value })} className="bg-white/5 border-white/10 font-bold h-12 rounded-xl" />
                          <Button variant="ghost" className="bg-white/5 h-12 w-12 p-0 rounded-xl">
                            <Upload className="w-5 h-5 text-indigo-400" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Stage Memo / Technical Notes</Label>
                    <Textarea value={formData.notes || ""} onChange={(e) => handleAutoSave({ notes: e.target.value })} className="min-h-[200px] bg-white/5 border-white/10 rounded-2xl p-6 text-base" />
                  </div>
                </div>
              )}

              {activeTab === 'lyrics' && (
                <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-[0.2em] text-pink-400">Lyric Management Engine</h3>
                      <p className="text-sm text-slate-500 mt-2">Professional formatting for stage teleprompters.</p>
                    </div>
                    <div className="flex gap-4">
                      <Button variant="outline" onClick={handleLyricsSearch} className="bg-slate-800 border-white/5 h-10 px-6 font-black uppercase text-[10px] gap-2 rounded-xl">
                        <Search className="w-3.5 h-3.5" /> Find Online
                      </Button>
                      <Button onClick={handleMagicFormatLyrics} disabled={isFormattingLyrics || !formData.lyrics} className="bg-pink-600 hover:bg-pink-700 h-10 px-6 font-black uppercase text-[10px] gap-2 rounded-xl shadow-lg shadow-pink-600/20">
                        {isFormattingLyrics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Magic Format
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 bg-white/5 rounded-[2.5rem] border border-white/5 p-10">
                    <Textarea 
                      placeholder="Paste your lyrics here..." 
                      value={formData.lyrics || ""} 
                      onChange={(e) => handleAutoSave({ lyrics: e.target.value })}
                      className="h-full min-h-[500px] bg-transparent border-none text-2xl font-black uppercase tracking-tight leading-relaxed focus-visible:ring-0 p-0 text-white/80"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'library' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                      <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Ultimate Guitar Integration</h4>
                          <button onClick={handleUgPrint} className="text-[10px] font-black text-slate-500 hover:text-white uppercase">Open Print View</button>
                        </div>
                        <div className="flex gap-3">
                          <Input placeholder="UG Tab URL" value={formData.ugUrl || ""} onChange={(e) => handleAutoSave({ ugUrl: e.target.value })} className="bg-slate-950 border-white/10 text-xs font-bold" />
                          <Button variant="ghost" size="icon" className="bg-slate-950" onClick={handlePasteUgUrl}><ClipboardPaste className="w-4 h-4" /></Button>
                        </div>
                        <Button onClick={handleUgAction} className="w-full h-12 bg-orange-600 hover:bg-orange-700 font-black uppercase tracking-widest text-[10px] gap-2 rounded-xl shadow-lg shadow-orange-600/20">
                          <ExternalLink className="w-4 h-4" /> Load External Tab
                        </Button>
                      </div>

                      <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 space-y-6">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-red-500">YouTube Reference Engine</h4>
                        <div className="flex gap-3">
                          <Input placeholder="YouTube URL" value={formData.youtubeUrl || ""} onChange={(e) => handleAutoSave({ youtubeUrl: e.target.value })} className="bg-slate-950 border-white/10 text-xs font-bold" />
                          <Button variant="ghost" size="icon" className="bg-slate-950" onClick={handleYoutubeSearch}><Search className="w-4 h-4" /></Button>
                        </div>
                        {videoId && (
                          <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-xl bg-black">
                            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}`} frameBorder="0" allowFullScreen />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="p-8 bg-indigo-600/10 rounded-[2rem] border border-indigo-600/20 space-y-6">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Asset Management Matrix</h4>
                        <div className="grid grid-cols-1 gap-4">
                           <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-white/5">
                             <div className="flex items-center gap-3">
                               <div className={cn("p-2 rounded-lg", formData.previewUrl ? "bg-green-600" : "bg-slate-800")}>
                                 <Headphones className="w-4 h-4 text-white" />
                               </div>
                               <div>
                                 <p className="text-[10px] font-black uppercase">Master Audio</p>
                                 <p className="text-[9px] text-slate-500 truncate max-w-[150px]">{formData.previewUrl ? "Synchronized" : "Empty Slot"}</p>
                               </div>
                             </div>
                             <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase" onClick={handleDownloadAll}>Verify</Button>
                           </div>
                           <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-white/5">
                             <div className="flex items-center gap-3">
                               <div className={cn("p-2 rounded-lg", formData.pdfUrl ? "bg-red-600" : "bg-slate-800")}>
                                 <FileText className="w-4 h-4 text-white" />
                               </div>
                               <div>
                                 <p className="text-[10px] font-black uppercase">Sheet Music</p>
                                 <p className="text-[9px] text-slate-500 truncate max-w-[150px]">{formData.pdfUrl ? "Linked" : "Empty Slot"}</p>
                               </div>
                             </div>
                             <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase">Link</Button>
                           </div>
                        </div>
                        <Button onClick={handleDownloadAll} className="w-full h-12 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] gap-2 rounded-xl">
                          <Download className="w-4 h-4" /> Export All Assets (.zip)
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'visual' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-[0.2em] text-indigo-400">Visual Performance Matrix</h3>
                      <p className="text-sm text-slate-500 mt-2">Cues and visual triggers for stage performance.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     <div className="bg-white/5 rounded-[2.5rem] p-10 border border-white/5 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="h-24 w-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-600/20">
                          <Layout className="w-12 h-12" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black uppercase tracking-tighter">Stage HUD Configuration</h4>
                          <p className="text-xs text-slate-500 mt-2">Visual cues are automatically derived from metadata and performance state.</p>
                        </div>
                     </div>
                     <div className="bg-white/5 rounded-[2.5rem] p-10 border border-white/5 space-y-6">
                        <div className="flex items-center gap-3 mb-4">
                          <Eye className="w-5 h-5 text-indigo-400" />
                          <span className="text-xs font-black uppercase tracking-widest">Visibility Preview</span>
                        </div>
                        <div className="space-y-4">
                           <div className="p-4 bg-indigo-600 rounded-xl">
                             <span className="text-[8px] font-black uppercase text-indigo-200">Stage Key</span>
                             <p className="text-2xl font-black">{formData.targetKey || formData.originalKey}</p>
                           </div>
                           <div className="p-4 bg-slate-900 rounded-xl border border-white/5">
                             <span className="text-[8px] font-black uppercase text-slate-500">Tempo Confidence</span>
                             <p className="text-2xl font-black">{formData.bpm ? "100%" : "0%"}</p>
                           </div>
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
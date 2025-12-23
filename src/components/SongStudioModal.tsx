"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
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
  ClipboardPaste, AlignLeft, Apple, Hash, Music2,
  FileSearch, ChevronRight, Layers, LayoutGrid, ListPlus,
  Globe2, ShieldCheck, Timer, FileMusic, Copy, BrainCircuit, Star
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
import ProSyncSearch from './ProSyncSearch';
import { useAuth } from './AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { calculateReadiness } from '@/utils/repertoireSync';

// Sub-component for inputs to prevent modal-wide re-renders
const StudioInput = memo(({ label, value, onChange, placeholder, className, isTextarea = false, type = "text" }: any) => {
  const [localValue, setLocalValue] = useState(value || "");

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  const handleChange = (val: string) => {
    setLocalValue(val);
    onChange(val);
  };

  const Comp = isTextarea ? Textarea : Input;

  return (
    <div className={cn("space-y-4", isTextarea && "flex-1 flex flex-col h-full")}>
      {label && <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{label}</Label>}
      <Comp
        type={type}
        placeholder={placeholder}
        value={localValue}
        onChange={(e: any) => handleChange(e.target.value)}
        className={cn(className, isTextarea && "flex-1")}
      />
    </div>
  );
});

StudioInput.displayName = 'StudioInput';

interface SongStudioModalProps {
  song: SetlistSong | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onSyncProData?: (song: SetlistSong) => Promise<void>;
  onPerform?: (song: SetlistSong) => void;
}

type StudioTab = 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library';

const SongStudioModal: React.FC<SongStudioModalProps> = ({ 
  song, 
  isOpen, 
  onClose, 
  onSave, 
  onUpdateKey,
  onSyncProData,
  onPerform 
}) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { keyPreference: globalPreference } = useSettings();
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<StudioTab>('audio');
  const [newTag, setNewTag] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFormattingLyrics, setIsFormattingLyrics] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isProSyncSearchOpen, setIsProSyncSearchOpen] = useState(false);
  const [isProSyncing, setIsProSyncing] = useState(false);
  const [isInRepertoire, setIsInRepertoire] = useState(false);
  
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');

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
  const touchStartX = useRef<number>(0);

  const tabOrder: StudioTab[] = isMobile 
    ? ['audio', 'config', 'details', 'charts', 'lyrics', 'visual', 'library']
    : ['audio', 'details', 'charts', 'lyrics', 'visual', 'library'];

  // Initialization & cleanup
  useEffect(() => {
    if (song && isOpen) {
      const initialData = {
        name: song.name || "",
        artist: song.artist || "",
        bpm: song.bpm || "",
        originalKey: song.originalKey || "C",
        targetKey: song.targetKey || "C",
        comfort_level: song.comfort_level || 0,
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
        key_preference: song.key_preference,
        isMetadataConfirmed: song.isMetadataConfirmed,
        master_id: song.master_id
      };
      setFormData(initialData);
      checkRepertoireStatus();
      if (song.previewUrl) prepareAudio(song.previewUrl, song.pitch || 0);
    }
    return () => { cleanupAudio(); stopMetronome(); };
  }, [song?.id, isOpen]);

  const currentKeyPreference = formData.key_preference || globalPreference;
  const keysToUse = currentKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;
  const readiness = useMemo(() => calculateReadiness(formData), [formData]);
  const readinessColor = readiness === 100 ? 'bg-emerald-500' : readiness > 60 ? 'bg-indigo-500' : 'bg-slate-500';

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const handleAutoSave = useCallback((updates: Partial<SetlistSong>) => {
    setFormData(prev => {
      const next = { ...prev, ...updates };
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        if (song) onSave(song.id, updates);
      }, 800);
      return next;
    });
  }, [song, onSave]);

  // Audio Engine Core
  const cleanupAudio = () => {
    if (playerRef.current) { playerRef.current.stop(); playerRef.current.dispose(); playerRef.current = null; }
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setIsPlaying(false); setProgress(0); playbackOffsetRef.current = 0; currentBufferRef.current = null;
  };

  const stopMetronome = () => { Tone.getTransport().stop(); metronomeLoopRef.current?.stop(); setIsMetronomeActive(false); };

  const toggleMetronome = async () => {
    if (!formData.bpm) { showError("Set a BPM first."); return; }
    if (isMetronomeActive) { stopMetronome(); } 
    else {
      if (Tone.getContext().state !== 'running') await Tone.start();
      if (!metronomeSynthRef.current) {
        metronomeSynthRef.current = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, oscillator: { type: "sine" } }).toDestination();
      }
      const bpmValue = parseInt(formData.bpm);
      if (isNaN(bpmValue) || bpmValue <= 0) return;
      Tone.getTransport().bpm.value = bpmValue;
      if (!metronomeLoopRef.current) {
        metronomeLoopRef.current = new Tone.Loop((time) => { metronomeSynthRef.current?.triggerAttackRelease("C4", "32n", time); }, "4n").start(0);
      } else metronomeLoopRef.current.start(0);
      Tone.getTransport().start(); setIsMetronomeActive(true);
    }
  };

  const handleDetectBPM = async () => {
    if (!currentBufferRef.current) return;
    setIsAnalyzing(true);
    try {
      const bpm = await analyze(currentBufferRef.current);
      const roundedBpm = Math.round(bpm);
      handleAutoSave({ bpm: roundedBpm.toString() });
      showSuccess(`BPM Detected: ${roundedBpm}`);
    } catch (err) { showError("BPM detection failed."); } finally { setIsAnalyzing(false); }
  };

  const prepareAudio = async (url: string, pitch: number) => {
    if (!url) return;
    try {
      if (Tone.getContext().state !== 'running') await Tone.start();
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      currentBufferRef.current = buffer;
      if (!analyzerRef.current) analyzerRef.current = new Tone.Analyser("fft", 256);
      if (playerRef.current) playerRef.current.dispose();
      playerRef.current = new Tone.GrainPlayer(buffer).toDestination();
      playerRef.current.connect(analyzerRef.current!);
      playerRef.current.detune = (pitch * 100) + fineTune;
      playerRef.current.playbackRate = tempo;
      playerRef.current.volume.value = volume;
      setDuration(buffer.duration);
    } catch (err) { showError("Could not link audio engine."); }
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

  const updateHarmonics = (updates: Partial<SetlistSong>) => {
    if (!song) return;
    setFormData(prev => {
      const next = { ...prev, ...updates };
      if (next.isKeyLinked && (updates.originalKey || updates.targetKey)) {
        next.pitch = calculateSemitones(next.originalKey || "C", next.targetKey || "C");
      }
      if (playerRef.current) playerRef.current.detune = ((next.pitch || 0) * 100) + fineTune;
      onSave(song.id, next);
      return next;
    });
  };

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const currentPitch = formData.pitch || 0;
    const shift = direction === 'up' ? 12 : -12;
    const newPitch = currentPitch + shift;
    if (newPitch > 24 || newPitch < -24) { showError("Max range reached."); return; }
    handleAutoSave({ pitch: newPitch });
    if (playerRef.current) playerRef.current.detune = (newPitch * 100) + fineTune;
  };

  const handleMagicFormatLyrics = async () => {
    if (!formData.lyrics?.trim()) { showError("Paste lyrics first."); return; }
    setIsFormattingLyrics(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', { body: { queries: [formData.lyrics], mode: 'lyrics' } });
      if (data?.lyrics) { handleAutoSave({ lyrics: data.lyrics }); showSuccess("Lyrics Formatted"); }
    } catch (err) { showError("Lyrics Engine Error."); } finally { setIsFormattingLyrics(false); }
  };

  const handleUgPrint = () => {
    if (!formData.ugUrl) return;
    const printUrl = formData.ugUrl.includes('?') ? formData.ugUrl.replace('?', '/print?') : `${formData.ugUrl}/print`;
    window.open(printUrl, '_blank');
  };

  const handleDownloadAsset = async (url: string | undefined, filename: string) => {
    if (!url) return;
    window.open(url, '_blank');
    showSuccess(`Opening: ${filename}`);
  };

  const checkRepertoireStatus = async () => {
    if (!song || !user) return;
    const { data } = await supabase.from('repertoire').select('id').eq('user_id', user.id).eq('title', formData.name || song.name).maybeSingle();
    setIsInRepertoire(!!data);
  };

  const addToPublicRepertoire = async () => {
    if (!song) return;
    onSave(song.id, { is_active: true });
    setIsInRepertoire(true);
    showSuccess("Added to Repertoire");
  };

  const videoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] : null;

  const renderSidebarContent = (noScroll?: boolean) => (
    <div className={cn("flex-1 p-6 md:p-8 space-y-8 md:space-y-10", noScroll ? "" : "overflow-y-auto")}>
      {/* Comfort Meter */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Performance Readiness</Label>
          <div className="flex items-center gap-2">
             <BrainCircuit className="w-4 h-4 text-indigo-500" />
             <span className="text-[11px] font-black text-white">{formData.comfort_level || 0}/10</span>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
           <div className="flex justify-between items-center">
             <Label className="text-[9px] font-bold text-slate-400 uppercase">Proficiency / Comfort</Label>
             <div className="flex gap-0.5">
               {Array.from({ length: 10 }).map((_, i) => (
                 <div key={i} className={cn("h-3 w-1.5 rounded-full", (formData.comfort_level || 0) > i ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" : "bg-white/5")} />
               ))}
             </div>
           </div>
           <Slider value={[formData.comfort_level || 0]} min={0} max={10} step={1} onValueChange={([v]) => handleAutoSave({ comfort_level: v })} />
           <p className="text-[9px] text-slate-500 italic">Adjust based on melody/structure knowledge.</p>
        </div>
      </div>

      {/* Harmonic Engine */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Harmonic Engine</Label>
          <div className="flex gap-2">
            <button onClick={() => handleAutoSave({ key_preference: currentKeyPreference === 'sharps' ? 'flats' : 'sharps' })} className="p-1.5 rounded-lg border bg-white/5 border-white/10 text-slate-500 flex items-center gap-2 px-3">
              <Hash className="w-3.5 h-3.5" /> <span className="text-[9px] font-black uppercase">{currentKeyPreference}</span>
            </button>
            <button onClick={() => updateHarmonics({ isKeyConfirmed: !formData.isKeyConfirmed })} className={cn("p-1.5 rounded-lg border", formData.isKeyConfirmed ? "bg-emerald-600 border-emerald-500" : "bg-white/5 border-white/10")}>
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[9px] font-bold text-slate-400 uppercase">Original Key</Label>
            <Select value={formatKey(formData.originalKey || "C", currentKeyPreference)} onValueChange={(val) => updateHarmonics({ originalKey: val })}>
              <SelectTrigger className="bg-white/5 border-white/10 h-12 text-lg font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>{keysToUse.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[9px] font-bold text-indigo-400 uppercase">Stage Key</Label>
            <Select value={formatKey(formData.targetKey || formData.originalKey || "C", currentKeyPreference)} onValueChange={(val) => { updateHarmonics({ targetKey: val }); if(song) onUpdateKey(song.id, val); }}>
              <SelectTrigger className={cn("h-12 text-lg font-mono border-none", formData.isKeyConfirmed ? "bg-emerald-600" : "bg-indigo-600")}><SelectValue /></SelectTrigger>
              <SelectContent>{keysToUse.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("max-w-[95vw] w-[1400px] max-h-[95vh] p-0 overflow-hidden bg-slate-950 text-white md:rounded-[2rem] z-[200]", isMobile && "h-[100dvh] rounded-none")}>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-50 overflow-hidden">
          <div className={cn("h-full transition-all duration-1000", readinessColor)} style={{ width: `${readiness}%` }} />
        </div>
        
        <div className="flex h-full">
          {!isMobile && (
            <div className="w-96 bg-slate-900/50 border-r border-white/5 flex flex-col shrink-0">
              <div className="p-8 border-b border-white/5 bg-black/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-1.5 rounded-lg"><Activity className="w-5 h-5" /></div>
                    <span className="font-black uppercase text-xs">Pro Studio Config</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-full border border-white/10">
                     <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", readinessColor)} />
                     <span className="text-[9px] font-black font-mono text-slate-400">{readiness}% READY</span>
                  </div>
                </div>
                <h2 className="text-3xl font-black uppercase truncate">{formData.name}</h2>
                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">{formData.artist}</p>
                <div className="flex flex-col gap-2 mt-6">
                  <Button onClick={() => setIsProSyncSearchOpen(true)} className={cn("w-full font-black text-[10px] h-10 rounded-xl", formData.isMetadataConfirmed ? "bg-emerald-600" : "bg-indigo-600")}>
                    {formData.isMetadataConfirmed ? <Check className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {formData.isMetadataConfirmed ? "SYNCED" : "PRO SYNC"}
                  </Button>
                </div>
              </div>
              {renderSidebarContent()}
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0">
            <div className="border-b border-white/5 flex items-center bg-black/20 h-20 px-12 justify-between">
              <div className="flex gap-8">
                {tabOrder.map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={cn("text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-4 h-20", activeTab === tab ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent")}>
                    {tab.toUpperCase()} ENGINE
                  </button>
                ))}
              </div>
              <Button variant="ghost" onClick={onClose} className="text-slate-400 font-black uppercase text-xs">Close Studio</Button>
            </div>

            <div className="flex-1 overflow-y-auto p-12">
              {activeTab === 'audio' && (
                <div className="space-y-12 animate-in fade-in">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="text-lg font-black uppercase text-indigo-400">Audio Transposition Matrix</h3>
                      <p className="text-sm text-slate-500">Discovery 00:00 | Transport Master Clock 03:00</p>
                    </div>
                    <Button variant="outline" onClick={handleDetectBPM} className="bg-white/5 border-white/10 text-[10px] font-black uppercase px-6 rounded-xl">Scan BPM</Button>
                  </div>

                  <div className="bg-slate-900/50 border border-white/5 p-12 rounded-[3rem] space-y-12">
                    <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
                    <Slider value={[progress]} max={100} step={0.1} onValueChange={(v) => {
                       const p = v[0]; setProgress(p);
                       if (playerRef.current) { playerRef.current.stop(); playerRef.current.start(0, (p/100)*duration); }
                    }} />
                    <div className="flex items-center justify-center gap-12">
                       <Button variant="ghost" size="icon" onClick={() => { setProgress(0); stopPlayback(); }} className="h-20 w-20 rounded-full border border-white/5"><RotateCcw /></Button>
                       <Button size="lg" onClick={togglePlayback} className="h-32 w-32 rounded-full bg-indigo-600 shadow-2xl">
                         {isPlaying ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12 ml-2 fill-current" />}
                       </Button>
                       <Button onClick={toggleMetronome} className={cn("h-20 w-20 rounded-full", isMetronomeActive ? "bg-indigo-600" : "bg-white/5")}>
                         {isMetronomeActive ? <Volume2 /> : <VolumeX />}
                       </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-10">
                    <div className="p-10 bg-white/5 border border-white/5 rounded-[2.5rem] space-y-6">
                      <div className="flex justify-between font-black uppercase text-[10px] text-slate-500">
                        <span>Pitch Processor</span>
                        <span className="text-indigo-400">{(formData.pitch || 0)} ST</span>
                      </div>
                      <Slider value={[formData.pitch || 0]} min={-24} max={24} step={1} onValueChange={(v) => updateHarmonics({ pitch: v[0] })} />
                      <div className="flex gap-2">
                        <Button onClick={() => handleOctaveShift('down')} variant="ghost" className="flex-1 bg-white/5 text-[10px] font-black uppercase">- oct</Button>
                        <Button onClick={() => handleOctaveShift('up')} variant="ghost" className="flex-1 bg-white/5 text-[10px] font-black uppercase">+ oct</Button>
                      </div>
                    </div>
                    <div className="p-10 bg-white/5 border border-white/5 rounded-[2.5rem] space-y-6">
                      <div className="flex justify-between font-black uppercase text-[10px] text-slate-500">
                        <span>Tempo Stretch</span>
                        <span className="text-indigo-400">{tempo.toFixed(2)}x</span>
                      </div>
                      <Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={([v]) => { setTempo(v); if(playerRef.current) playerRef.current.playbackRate = v; }} />
                      <div className="flex justify-between font-black uppercase text-[10px] text-slate-500 pt-4">
                        <span>Master Gain</span>
                        <span>{Math.round((volume + 60) * 1.66)}%</span>
                      </div>
                      <Slider value={[volume]} min={-60} max={0} onValueChange={([v]) => { setVolume(v); if(playerRef.current) playerRef.current.volume.value = v; }} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'details' && (
                <div className="space-y-10 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-10">
                    <StudioInput label="Performance Title" value={formData.name} onChange={(v:any) => handleAutoSave({name: v})} className="bg-white/5 h-16 rounded-2xl text-2xl font-black" />
                    <StudioInput label="Primary Artist" value={formData.artist} onChange={(v:any) => handleAutoSave({artist: v})} className="bg-white/5 h-16 rounded-2xl text-2xl font-black" />
                  </div>
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Sheet Music Link</Label>
                      <div className="flex gap-3">
                        <Input value={formData.pdfUrl} onChange={(e) => handleAutoSave({ pdfUrl: e.target.value })} className="bg-white/5 h-12 rounded-xl" />
                        <Button variant="outline" className="h-12 rounded-xl px-6 font-black uppercase text-[10px]" onClick={() => window.open(`https://google.com/search?q=${formData.name} sheet music`, '_blank')}><Search className="w-4 h-4 mr-2"/> Find</Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Ultimate Guitar Link</Label>
                      <div className="flex gap-3">
                        <Input value={formData.ugUrl} onChange={(e) => handleAutoSave({ ugUrl: e.target.value })} className="bg-white/5 h-12 rounded-xl text-orange-400" />
                        <Button variant="outline" className="h-12 rounded-xl px-6 font-black uppercase text-[10px] text-orange-400" onClick={() => window.open(`https://ultimate-guitar.com/search.php?value=${formData.name}`, '_blank')}><Search className="w-4 h-4 mr-2"/> Find</Button>
                      </div>
                    </div>
                  </div>
                  <StudioInput isTextarea label="Rehearsal & Dynamics Notes" value={formData.notes} onChange={(v:any) => handleAutoSave({notes: v})} className="bg-white/5 min-h-[300px] rounded-[2rem] p-8 text-lg" />
                </div>
              )}

              {activeTab === 'lyrics' && (
                <div className="h-full flex flex-col space-y-6">
                  <div className="flex justify-between items-center shrink-0">
                    <h3 className="text-lg font-black uppercase text-pink-400">Lyrics Engine</h3>
                    <Button onClick={handleMagicFormatLyrics} className="bg-indigo-600 font-black uppercase text-[10px] h-10 px-6 rounded-xl">
                      <Sparkles className="w-4 h-4 mr-2" /> Magic Format
                    </Button>
                  </div>
                  <Textarea value={formData.lyrics} onChange={(e) => handleAutoSave({ lyrics: e.target.value })} placeholder="Paste lyrics..." className="flex-1 bg-white/5 rounded-[2.5rem] p-10 text-xl font-medium leading-relaxed" />
                </div>
              )}

              {activeTab === 'visual' && (
                <div className="space-y-8 animate-in fade-in">
                  <div className="flex gap-4">
                    <Input value={formData.youtubeUrl} onChange={(e) => handleAutoSave({ youtubeUrl: e.target.value })} placeholder="YouTube Link..." className="bg-white/5 h-12 rounded-xl flex-1" />
                    <Button onClick={() => window.open(`https://youtube.com/results?search_query=${formData.name} ${formData.artist}`, '_blank')} className="bg-red-600 h-12 px-8 rounded-xl font-black uppercase text-[10px]">
                      <Youtube className="w-4 h-4 mr-2" /> Discover
                    </Button>
                  </div>
                  {videoId ? (
                    <div className="aspect-video w-full rounded-[3rem] overflow-hidden border border-white/10 bg-black">
                      <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}`} frameBorder="0" allowFullScreen />
                    </div>
                  ) : (
                    <div className="py-48 bg-white/5 border border-dashed border-white/10 rounded-[4rem] flex flex-col items-center justify-center text-slate-500">
                      <Youtube className="w-16 h-16 mb-4 opacity-20" />
                      <p className="font-black uppercase tracking-widest">Visual Engine Standby</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'library' && (
                <div className="space-y-12 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black uppercase">Resource Matrix</h3>
                    <Button onClick={() => showSuccess("Downloading All Assets")} className="bg-indigo-600 h-14 px-10 rounded-2xl font-black uppercase text-xs shadow-xl"><Download className="mr-2"/> Download All</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    {/* Audio Card */}
                    <div className={cn("p-10 border flex flex-col justify-between h-[350px] rounded-[2.5rem] transition-all", formData.previewUrl ? "bg-slate-900 border-indigo-500/30" : "bg-white/5 border-dashed opacity-40")}>
                      <div className="flex justify-between items-start">
                        <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg"><Music className="w-8 h-8" /></div>
                        {formData.previewUrl && <Button onClick={() => handleDownloadAsset(formData.previewUrl, 'Master')} variant="ghost" className="bg-white/5 rounded-xl"><Download className="w-4 h-4"/></Button>}
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Master Performance Audio</span>
                        <p className="text-3xl font-black truncate">{formData.previewUrl ? "Performance_Master_HQ" : "Not Linked"}</p>
                      </div>
                    </div>

                    {/* Apple Music Card */}
                    <div className={cn("p-10 border flex flex-col justify-between h-[350px] rounded-[2.5rem] transition-all", formData.appleMusicUrl ? "bg-slate-900 border-red-500/30" : "bg-white/5 border-dashed opacity-40")}>
                      <div className="bg-red-600 w-fit p-4 rounded-2xl shadow-lg"><Apple className="w-8 h-8" /></div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Apple Music Link</span>
                        <p className="text-3xl font-black">{formData.appleMusicUrl ? "Integrated App Link" : "Offline"}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Launch directly in Apple Music</p>
                      </div>
                    </div>

                    {/* UG Card */}
                    <div className={cn("p-10 border flex flex-col justify-between h-[350px] rounded-[2.5rem] transition-all", formData.ugUrl ? "bg-slate-900 border-orange-500/30" : "bg-white/5 border-dashed opacity-40")}>
                      <div className="flex justify-between items-start">
                        <div className="bg-orange-600 p-4 rounded-2xl shadow-lg"><Link2 className="w-8 h-8" /></div>
                        {formData.ugUrl && (
                          <div className="flex gap-2">
                            <Button onClick={handleUgPrint} variant="ghost" className="bg-white/5 rounded-xl"><Printer className="w-4 h-4"/></Button>
                            <Button onClick={() => window.open(formData.ugUrl, '_blank')} variant="ghost" className="bg-white/5 rounded-xl"><ExternalLink className="w-4 h-4"/></Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Ultimate Guitar Pro</span>
                        <p className="text-3xl font-black">Verified Official Link</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Mobile App Integration Ready</p>
                      </div>
                    </div>

                    {/* PDF Card */}
                    <div className={cn("p-10 border flex flex-col justify-between h-[350px] rounded-[2.5rem] transition-all", formData.pdfUrl ? "bg-slate-900 border-emerald-500/30" : "bg-white/5 border-dashed opacity-40")}>
                      <div className="flex justify-between items-start">
                        <div className="bg-emerald-600 p-4 rounded-2xl shadow-lg"><FileText className="w-8 h-8" /></div>
                        {formData.pdfUrl && <Button onClick={() => window.open(formData.pdfUrl, '_blank')} variant="ghost" className="bg-white/5 rounded-xl"><Eye className="w-4 h-4"/></Button>}
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Stage Chart / PDF</span>
                        <p className="text-3xl font-black">Ready for Stage View</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      <ProSyncSearch isOpen={isProSyncSearchOpen} onClose={() => setIsProSyncSearchOpen(false)} onSelect={(data:any) => handleAutoSave({name: data.trackName, artist: data.artistName, isMetadataConfirmed: true})} initialQuery={`${formData.artist} ${formData.name}`} />
    </Dialog>
  );
};

export default SongStudioModal;
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
  ClipboardPaste, AlignLeft, Apple, Hash, Music2,
  FileSearch, ChevronRight, Layers, LayoutGrid, ListPlus,
  Globe2, ShieldCheck, Timer, FileMusic
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
  const [isProSyncSearchOpen, setIsProSyncSearchOpen] = useState(false);
  const [isProSyncing, setIsProSyncing] = useState(false);
  const [isInRepertoire, setIsInRepertoire] = useState(false);
  
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'url'>('pdf');

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

  const tabOrder: StudioTab[] = isMobile 
    ? ['audio', 'config', 'details', 'charts', 'lyrics', 'visual', 'library']
    : ['audio', 'details', 'charts', 'lyrics', 'visual', 'library'];

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !isNaN(Number(e.key))) {
        const index = Number(e.key) - 1;
        if (index >= 0 && index < tabOrder.length) {
          e.preventDefault();
          setActiveTab(tabOrder[index]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tabOrder]);

  const currentKeyPreference = formData.key_preference || globalPreference;
  const keysToUse = currentKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  const readiness = useMemo(() => {
    let score = 0;
    const isItunes = formData.previewUrl?.includes('apple.com') || formData.previewUrl?.includes('itunes-assets');
    if (formData.previewUrl && !isItunes) score += 25;
    if (formData.isKeyConfirmed) score += 20;
    if (formData.lyrics?.length && formData.lyrics.length > 20) score += 15;
    if (formData.pdfUrl || formData.leadsheetUrl) score += 15;
    if (formData.ugUrl) score += 10;
    if (formData.bpm) score += 5;
    if (formData.notes?.length && formData.notes.length > 10) score += 5;
    if (formData.artist && formData.artist !== "Unknown Artist") score += 5;
    return Math.min(100, score);
  }, [formData]);

  useEffect(() => {
    if (song && isOpen) {
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
        key_preference: song.key_preference,
        isMetadataConfirmed: song.isMetadataConfirmed
      });
      checkRepertoireStatus();
      if (song.previewUrl) prepareAudio(song.previewUrl, song.pitch || 0);
    }
    return () => {
      cleanupAudio();
      stopMetronome();
    };
  }, [song?.id, isOpen]);

  const checkRepertoireStatus = async () => {
    if (!song || !user) return;
    const { data } = await supabase
      .from('repertoire')
      .select('id')
      .eq('user_id', user.id)
      .eq('title', song.name)
      .eq('artist', song.artist || 'Unknown Artist')
      .maybeSingle();
    setIsInRepertoire(!!data);
  };

  const addToPublicRepertoire = async () => {
    if (!song || !user) return;
    try {
      const { error } = await supabase
        .from('repertoire')
        .insert({
          user_id: user.id,
          title: formData.name || song.name,
          artist: formData.artist || song.artist || 'Unknown Artist',
          original_key: formData.originalKey,
          bpm: formData.bpm,
          genre: formData.genre || (formData.user_tags?.[0])
        });
      if (error) throw error;
      setIsInRepertoire(true);
      showSuccess("Added to Master Repertoire");
    } catch (err) {
      showError("Failed to add to repertoire");
    }
  };

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

  const handleMagicFormatLyrics = async () => {
    if (!formData.lyrics?.trim()) return;
    setIsFormattingLyrics(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: [formData.lyrics], mode: 'lyrics' }
      });
      if (error) throw error;
      if (data?.lyrics) handleAutoSave({ lyrics: data.lyrics });
    } catch (err) {
      showError("Lyrics Engine Error.");
    } finally {
      setIsFormattingLyrics(false);
    }
  };

  const handleProSync = async () => setIsProSyncSearchOpen(true);

  const handleSelectProSync = async (itunesData: any) => {
    setIsProSyncSearchOpen(false);
    setIsProSyncing(true);
    try {
      const basicUpdates: Partial<SetlistSong> = {
        name: itunesData.trackName,
        artist: itunesData.artistName,
        genre: itunesData.primaryGenreName,
        appleMusicUrl: itunesData.trackViewUrl,
        isMetadataConfirmed: true
      };
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: [`${itunesData.trackName} by ${itunesData.artistName}`] }
      });
      if (error) throw error;
      const aiResult = Array.isArray(data) ? data[0] : data;
      const finalUpdates = {
        ...basicUpdates,
        originalKey: aiResult?.originalKey || formData.originalKey,
        targetKey: aiResult?.originalKey || formData.targetKey,
        bpm: aiResult?.bpm?.toString() || formData.bpm,
        pitch: 0
      };
      handleAutoSave(finalUpdates);
    } catch (err) {
      showError("Pro Sync failed.");
    } finally {
      setIsProSyncing(false);
    }
  };

  const renderSidebarContent = () => (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 md:space-y-10">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Harmonic Map</Label>
          <div className="flex bg-white/5 rounded-lg border border-white/10 p-1">
             <Button variant="ghost" size="sm" onClick={() => handleAutoSave({ key_preference: 'flats' })} className={cn("h-6 px-2 text-[8px] font-black uppercase", currentKeyPreference === 'flats' && "bg-white text-indigo-600")}>Flats</Button>
             <Button variant="ghost" size="sm" onClick={() => handleAutoSave({ key_preference: 'sharps' })} className={cn("h-6 px-2 text-[8px] font-black uppercase", currentKeyPreference === 'sharps' && "bg-white text-indigo-600")}>Sharps</Button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
          <div className="space-y-2">
            <Label className="text-[9px] font-bold text-slate-500 uppercase">Original Key</Label>
            <Select value={formData.originalKey} onValueChange={(val) => handleAutoSave({ originalKey: val })}>
              <SelectTrigger className="bg-slate-900 border-white/10 h-10 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white">
                {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[9px] font-bold text-slate-500 uppercase">Target Key</Label>
            <Select value={formData.targetKey} onValueChange={(val) => onUpdateKey(song!.id, val)}>
              <SelectTrigger className="bg-indigo-600 border-none h-10 font-mono text-xs text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white">
                {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Performance Resources</Label>
        <div className="grid grid-cols-3 gap-2">
          {RESOURCE_TYPES.map(res => (
            <button
              key={res.id}
              onClick={() => toggleResource(res.id)}
              className={cn(
                "h-10 border rounded-xl flex items-center justify-center text-[10px] font-black uppercase transition-all",
                formData.resources?.includes(res.id) 
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg" 
                  : "bg-white/5 border-white/5 text-slate-500 hover:text-white"
              )}
            >
              {res.id}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Stage Tags</Label>
          <div className="flex gap-2">
            <Input 
              placeholder="Tag..." 
              value={newTag} 
              onChange={(e) => setNewTag(e.target.value)}
              className="h-8 w-24 bg-white/5 border-white/10 text-[10px] uppercase font-bold"
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
            />
            <Button size="sm" onClick={addTag} className="h-8 w-8 bg-indigo-600 p-0 rounded-lg"><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(formData.user_tags || []).map(tag => (
            <Badge key={tag} className="bg-white/5 text-slate-400 hover:bg-red-600/20 hover:text-red-400 cursor-pointer text-[9px] font-black uppercase px-2 py-0.5" onClick={() => removeTag(tag)}>
              {tag} <X className="w-2.5 h-2.5 ml-1" />
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );

  if (!song) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("max-w-[95vw] w-[1400px] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white md:rounded-[2rem]", isMobile && "w-full max-w-none h-screen max-h-none rounded-none")}>
        <div className={cn("flex overflow-hidden", isMobile ? "flex-col h-screen" : "h-[90vh] min-h-[800px]")}>
          {!isMobile && (
            <div className="w-[400px] border-r border-white/5 bg-slate-900/40 flex flex-col shrink-0">
              <div className="p-8 border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
                    <Music className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight truncate max-w-[200px]">{formData.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{formData.artist}</span>
                      <div className={cn("w-1.5 h-1.5 rounded-full", readiness === 100 ? "bg-emerald-500" : "bg-indigo-500")} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase">Readiness</span>
                    <span className="text-xs font-black text-indigo-400">{readiness}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={cn("h-full transition-all duration-1000", readinessColor)} style={{ width: `${readiness}%` }} />
                  </div>
                </div>
              </div>
              {renderSidebarContent()}
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0">
            <div className={cn("border-b border-white/5 flex items-center bg-black/20 shrink-0", isMobile ? "h-20 px-6 overflow-x-auto no-scrollbar" : "h-20 px-12 justify-between")}>
              <div className={cn("flex", isMobile ? "gap-8 min-w-max" : "gap-12")}>
                {tabOrder.map((tab, idx) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={cn("flex flex-col items-center justify-center gap-2 transition-all", isMobile ? "h-20 px-4 py-2 text-sm font-black uppercase tracking-widest" : "h-20 text-xs tracking-[0.4em]", activeTab === tab ? "text-indigo-400 border-b-4 border-indigo-500" : "text-slate-500 hover:text-white")}>
                    <span>{tab.toUpperCase()}</span>
                    <span className="text-[8px] font-mono font-bold opacity-40">{!isMobile && `⌘${idx + 1}`}</span>
                  </button>
                ))}
              </div>
              {!isMobile && (
                <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white font-black uppercase tracking-[0.3em] text-xs">Close Studio</Button>
              )}
            </div>

            <div className={cn("flex-1 overflow-y-auto", isMobile ? "p-6" : "p-12")}>
              {activeTab === 'audio' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="bg-slate-900/50 p-12 rounded-[3rem] border border-white/5">
                    <div className="h-40 mb-8">
                      <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
                    </div>
                    <div className="flex items-center justify-center gap-8">
                      <Button size="lg" onClick={togglePlayback} className="w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-2xl">
                        {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setIsMetronomeActive(!isMetronomeActive)} className={cn("h-12 w-12 rounded-xl", isMetronomeActive && "bg-indigo-600 border-none")}>
                        <Timer className="w-6 h-6" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'lyrics' && (
                <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black uppercase tracking-widest text-pink-400">Lyrics Engine</h3>
                    <Button onClick={handleMagicFormatLyrics} disabled={isFormattingLyrics} className="bg-pink-600 hover:bg-pink-700 font-black uppercase tracking-widest text-[10px] h-10 gap-2">
                      {isFormattingLyrics ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      AI Structure
                    </Button>
                  </div>
                  <Textarea 
                    value={formData.lyrics} 
                    onChange={(e) => handleAutoSave({ lyrics: e.target.value })}
                    placeholder="Paste lyrics with [0:00] timestamps..."
                    className="flex-1 bg-slate-900/50 border-white/5 font-mono text-lg p-8 rounded-[2rem] resize-none"
                  />
                </div>
              )}

              {activeTab === 'config' && isMobile && renderSidebarContent()}
            </div>
          </div>
        </div>
      </DialogContent>
      <ProSyncSearch isOpen={isProSyncSearchOpen} onClose={() => setIsProSyncSearchOpen(false)} onSelect={handleSelectProSync} initialQuery={`${formData.artist} ${formData.name}`} />
    </Dialog>
  );
};

export default SongStudioModal;
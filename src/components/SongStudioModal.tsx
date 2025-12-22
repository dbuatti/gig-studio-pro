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
  FileSearch, ChevronRight, Layers, RefreshCw
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
import { ScrollArea } from './ui/scroll-area';

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
  const [activeTab, setActiveTab] = useState<'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'link'>('link');
  const [newTag, setNewTag] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFormattingLyrics, setIsFormattingLyrics] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  
  // Search & Link State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
        key_preference: song.key_preference
      });
      
      setSearchQuery(song.name + (song.artist ? ` ${song.artist}` : ""));
      
      if (song.previewUrl) {
        prepareAudio(song.previewUrl, song.pitch || 0);
      }
    }
    return () => {
      cleanupAudio();
      stopMetronome();
    };
  }, [song?.id, isOpen]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=song&limit=10`);
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      showError("Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const linkSongData = (result: any) => {
    if (!song) return;
    
    const updates: Partial<SetlistSong> = {
      name: result.trackName,
      artist: result.artistName,
      previewUrl: result.previewUrl,
      appleMusicUrl: result.trackViewUrl,
      genre: result.primaryGenreName,
      isMetadataConfirmed: true // Marked as confirmed because the user manually picked it
    };

    setFormData(prev => ({ ...prev, ...updates }));
    onSave(song.id, updates);
    prepareAudio(result.previewUrl, formData.pitch || 0);
    showSuccess(`Linked to ${result.trackName} by ${result.artistName}`);
    setActiveTab('audio'); // Move to audio engine after linking
  };

  const handleAutoSave = (updates: Partial<SetlistSong>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    if (song) onSave(song.id, updates);
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

  const animateProgress = () => {
    if (isPlaying && playerRef.current) {
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
      requestRef.current = requestAnimationFrame(animateProgress);
    }
  };

  useEffect(() => {
    if (isPlaying) requestRef.current = requestAnimationFrame(animateProgress);
    else if (requestRef.current) cancelAnimationFrame(requestRef.current);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, tempo]);

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const currentPitch = formData.pitch || 0;
    const shift = direction === 'up' ? 12 : -12;
    const newPitch = currentPitch + shift;
    
    if (newPitch > 24 || newPitch < -24) {
      showError("Maximum transposition range reached.");
      return;
    }

    setFormData(prev => ({ ...prev, pitch: newPitch }));
    if (playerRef.current) {
      playerRef.current.detune = (newPitch * 100) + fineTune;
    }
    if (song) onSave(song.id, { pitch: newPitch });
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
      if (playerRef.current) playerRef.current.detune = ((next.pitch || 0) * 100) + fineTune;
      onSave(song.id, next);
      return next;
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !song) return;

    setIsUploading(true);
    try {
      const isAudio = file.type.startsWith('audio/');
      const extension = file.name.split('.').pop();
      const folder = isAudio ? 'tracks' : 'sheets';
      const fileName = `${folder}/${song.id}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from('audio_tracks').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('audio_tracks').getPublicUrl(fileName);
      
      let update: Partial<SetlistSong> = {};
      if (isAudio) update.previewUrl = publicUrl;
      else if (file.type === 'application/pdf') update.pdfUrl = publicUrl;
      
      setFormData(prev => ({ ...prev, ...update }));
      onSave(song.id, update);
      if (isAudio) prepareAudio(publicUrl, formData.pitch || 0);
      showSuccess(`Linked: ${file.name}`);
    } catch (err) {
      showError("Asset upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!song) return null;
  const videoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[95vw] w-[1400px] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white rounded-[2rem]"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{formData.name || "Song Studio"}</DialogTitle>
          <DialogDescription>Link audio and metadata to your performance.</DialogDescription>
        </DialogHeader>

        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-indigo-600/20 backdrop-blur-sm border-4 border-dashed border-indigo-500 flex items-center justify-center">
            <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-indigo-400 animate-bounce" />
              <p className="text-xl font-black uppercase tracking-tighter">Drop Asset to Link</p>
            </div>
          </div>
        )}

        <div className="flex h-[90vh] min-h-[800px] overflow-hidden">
          <div className="w-96 bg-slate-900/50 border-r border-white/5 flex flex-col shrink-0">
            <div className="p-8 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-indigo-600 p-1.5 rounded-lg">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="font-black uppercase tracking-tighter text-xs">Studio Engine</span>
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight leading-none mb-1 truncate">{formData.name}</h2>
              <p className="text-xs font-black text-indigo-400 uppercase tracking-widest truncate">{formData.artist || "Unknown"}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Stage Key Control</Label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Original</Label>
                    <Select value={formData.originalKey || "C"} onValueChange={(val) => updateHarmonics({ originalKey: val })}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white font-bold font-mono h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-bold text-indigo-400 uppercase">Stage</Label>
                    <Select value={formData.targetKey || "C"} onValueChange={(val) => {
                      updateHarmonics({ targetKey: val });
                      onUpdateKey(song.id, val);
                    }}>
                      <SelectTrigger className="bg-indigo-600 border-none text-white font-bold font-mono h-12 shadow-lg shadow-indigo-600/20">
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
                <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {(formData.user_tags || []).map(t => (
                    <Badge key={t} variant="secondary" className="bg-white/5 text-indigo-300 border-white/10 px-3 py-1 text-[10px] font-bold uppercase">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="h-20 border-b border-white/5 flex items-center px-12 justify-between bg-black/20 shrink-0">
              <div className="flex gap-12">
                {['link', 'audio', 'charts', 'lyrics', 'details'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={cn(
                      "text-xs font-black uppercase tracking-[0.4em] h-20 transition-all border-b-4",
                      activeTab === tab ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white"
                    )}
                  >
                    {tab === 'link' ? 'SEARCH & LINK' : tab.toUpperCase()}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white font-black uppercase tracking-[0.3em] text-xs">Close</Button>
            </div>

            <div className="flex-1 overflow-y-auto p-12 relative">
              {activeTab === 'link' && (
                <div className="space-y-10 animate-in fade-in duration-500 max-w-4xl mx-auto">
                  <div className="text-center space-y-4 mb-12">
                    <div className="bg-indigo-600/10 h-20 w-20 rounded-3xl flex items-center justify-center mx-auto border border-indigo-500/20">
                      <RefreshCw className={cn("w-10 h-10 text-indigo-500", isSearching && "animate-spin")} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tight">Search & Link Master Audio</h3>
                      <p className="text-slate-500">Find the professional version of this song to populate the studio data.</p>
                    </div>
                  </div>

                  <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <Input 
                        placeholder="Song name or artist..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-14 pl-12 text-lg bg-white/5 border-white/10 rounded-2xl focus-visible:ring-indigo-600"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={isSearching}
                      className="h-14 px-10 bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest rounded-2xl gap-3 shadow-xl shadow-indigo-600/20"
                    >
                      {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />} Search
                    </Button>
                  </form>

                  <div className="space-y-3 mt-8">
                    {searchResults.length > 0 ? (
                      <div className="bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden divide-y divide-white/5">
                        {searchResults.map((result) => (
                          <div key={result.trackId} className="flex items-center gap-4 p-5 hover:bg-white/5 transition-all group">
                            <img src={result.artworkUrl60} className="w-12 h-12 rounded-xl shadow-lg" alt="" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black truncate text-lg uppercase tracking-tight">{result.trackName}</h4>
                              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{result.artistName}</p>
                            </div>
                            <div className="flex items-center gap-2">
                               <Button 
                                 variant="ghost" 
                                 size="sm" 
                                 onClick={() => {
                                   prepareAudio(result.previewUrl, formData.pitch || 0);
                                   showSuccess(`Previewing ${result.trackName}`);
                                 }}
                                 className="h-10 w-10 p-0 rounded-xl text-indigo-400 hover:bg-indigo-600 hover:text-white"
                               >
                                 <Play className="w-4 h-4 fill-current" />
                               </Button>
                               <Button 
                                 onClick={() => linkSongData(result)}
                                 className="h-10 bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] px-6 rounded-xl"
                               >
                                 Link this Version
                               </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : !isSearching && searchQuery && (
                      <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                         <Music className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                         <p className="text-slate-500 font-black uppercase tracking-widest">Search results will appear here</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'audio' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="bg-slate-900/50 rounded-[3rem] border border-white/5 p-12 space-y-12">
                    <div className="h-40">
                      <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
                    </div>
                    
                    {formData.previewUrl ? (
                      <div className="space-y-8">
                        <div className="flex justify-between text-xs font-mono font-black text-slate-500 uppercase">
                          <span className="text-indigo-400">{new Date((progress/100 * duration) * 1000).toISOString().substr(14, 5)}</span>
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
                        <div className="flex items-center justify-center gap-12">
                           <Button variant="ghost" size="icon" onClick={stopPlayback} className="h-20 w-20 rounded-full border border-white/5 hover:bg-white/5">
                             <RotateCcw className="w-8 h-8" />
                           </Button>
                           <Button 
                             size="lg" 
                             onClick={togglePlayback}
                             className="h-32 w-32 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-600/40"
                           >
                             {isPlaying ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12 ml-2 fill-current" />}
                           </Button>
                           <div className="h-20 w-20" /> 
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                         <Button onClick={() => setActiveTab('link')} className="bg-indigo-600 h-14 px-10 rounded-2xl font-black uppercase">
                           Link Master Audio First
                         </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-10 bg-white/5 p-10 rounded-[2.5rem] border border-white/5">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Transposition</Label>
                          <span className="text-lg font-mono font-black text-indigo-400">{(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span>
                        </div>
                        <Slider 
                          value={[formData.pitch || 0]} 
                          min={-24} 
                          max={24} 
                          step={1} 
                          onValueChange={(v) => {
                            const p = v[0];
                            setFormData(prev => ({ ...prev, pitch: p }));
                            if (playerRef.current) playerRef.current.detune = (p * 100) + fineTune;
                            if (song) onSave(song.id, { pitch: p });
                          }} 
                        />
                      </div>
                    </div>

                    <div className="space-y-10 bg-white/5 p-10 rounded-[2.5rem] border border-white/5">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Tempo Stretch</Label>
                          <span className="text-lg font-mono font-black text-indigo-400">{tempo.toFixed(2)}x</span>
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
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'charts' && (
                <div className="h-full flex flex-col gap-8 animate-in fade-in duration-500">
                   {formData.pdfUrl ? (
                     <iframe 
                       src={`${formData.pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                       className="flex-1 w-full rounded-[3rem] bg-white shadow-2xl"
                       title="Sheet Music"
                     />
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center p-12 bg-white/5 rounded-[4rem] border-4 border-dashed border-white/5">
                        <FileSearch className="w-16 h-16 text-slate-700 mb-6" />
                        <h4 className="text-2xl font-black uppercase tracking-tight">Drop Chart PDF Here</h4>
                        <p className="text-slate-500 mt-2">or search online to link a digital sheet.</p>
                     </div>
                   )}
                </div>
              )}

              {activeTab === 'lyrics' && (
                <div className="space-y-10 animate-in fade-in duration-500 h-full flex flex-col">
                  <Textarea 
                    placeholder="Paste lyrics here..."
                    value={formData.lyrics || ""}
                    onChange={(e) => handleAutoSave({ lyrics: e.target.value })}
                    className="flex-1 bg-white/5 border-white/10 text-xl leading-relaxed rounded-[2.5rem] p-10 font-medium"
                  />
                </div>
              )}

              {activeTab === 'details' && (
                <div className="space-y-10 animate-in fade-in duration-500">
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Performance Title</Label>
                      <Input 
                        value={formData.name || ""} 
                        onChange={(e) => handleAutoSave({ name: e.target.value })}
                        className="bg-white/5 border-white/10 text-2xl font-black h-16 rounded-2xl"
                      />
                    </div>
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Artist</Label>
                      <Input 
                        value={formData.artist || ""} 
                        onChange={(e) => handleAutoSave({ artist: e.target.value })}
                        className="bg-white/5 border-white/10 text-2xl font-black h-16 rounded-2xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Cues & Memo</Label>
                    <Textarea 
                      placeholder="Transitions, dynamics, cues..."
                      value={formData.notes || ""}
                      onChange={(e) => handleAutoSave({ notes: e.target.value })}
                      className="min-h-[300px] bg-white/5 border-white/10 text-lg leading-relaxed rounded-[2rem] p-8"
                    />
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
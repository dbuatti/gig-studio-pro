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
  }, [isOpen, isMobile, tabOrder]);

  // Mobile Swipe logic
  useEffect(() => {
    if (!isOpen || !isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const distance = touchEndX - touchStartX.current;
      
      // If swipe right > 150px and not inside a textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
      
      if (distance > 150 && !isInput) {
        onClose();
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, isMobile, onClose]);

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
        if (song) {
          onSave(song.id, updates);
        }
      }, 800);

      return next;
    });
  }, [song, onSave]);

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

  const handleDetectBPM = async () => {
    if (!currentBufferRef.current) return;
    setIsAnalyzing(true);
    try {
      const bpm = await analyze(currentBufferRef.current);
      const roundedBpm = Math.round(bpm);
      handleAutoSave({ bpm: roundedBpm.toString() });
      showSuccess(`BPM Detected: ${roundedBpm}`);
    } catch (err) {
      showError("BPM detection failed.");
    } finally {
      setIsAnalyzing(false);
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
      playerRef.current.connect(analyzerRef.current!);
      playerRef.current.detune = (pitch * 100) + fineTune;
      playerRef.current.playbackRate = tempo;
      playerRef.current.volume.value = volume;
      playerRef.current.grainSize = 0.18;
      playerRef.current.overlap = 0.1;
      
      setDuration(buffer.duration);
      
      if (song && Math.abs((song.duration_seconds || 0) - buffer.duration) > 1) {
        handleAutoSave({ duration_seconds: buffer.duration });
      }
    } catch (err) {
      console.error("Audio Load Error:", err);
      showError("Could not link audio engine.");
    }
  };

  const animateProgress = useCallback(() => {
    if (playerRef.current && playerRef.current.state === "started") {
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      const currentSeconds = playbackOffsetRef.current + elapsed;
      
      if (duration > 0) {
        const newProgress = Math.min(100, (currentSeconds / duration) * 100);
        setProgress(newProgress);
        
        if (currentSeconds >= duration) {
          setIsPlaying(false);
          setProgress(0);
          playbackOffsetRef.current = 0;
          return;
        }
      }
      requestRef.current = requestAnimationFrame(animateProgress);
    }
  }, [duration, tempo]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animateProgress);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, animateProgress]);

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
    
    if (newPitch > 24 || newPitch < -24) {
      showError("Maximum transposition range reached.");
      return;
    }
    setFormData(prev => ({ ...prev, pitch: newPitch }));
    if (playerRef.current) {
      playerRef.current.detune = (newPitch * 100) + fineTune;
    }
    if (song) {
      onSave(song.id, { pitch: newPitch });
    }
    showSuccess(`Octave Shift Applied: ${newPitch > 0 ? '+' : ''}${newPitch} ST`);
  };

  const handleProSync = async () => {
    setIsProSyncSearchOpen(true);
  };

  const handleSelectProSync = async (itunesData: any) => {
    setIsProSyncSearchOpen(false);
    setIsProSyncing(true);
    
    try {
      const basicUpdates: Partial<SetlistSong> = {
        name: itunesData.trackName,
        artist: itunesData.artistName,
        genre: itunesData.primaryGenreName,
        appleMusicUrl: itunesData.trackViewUrl,
        user_tags: [...(formData.user_tags || []), itunesData.primaryGenreName, new Date(itunesData.releaseDate).getFullYear().toString()],
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
      showSuccess(`Successfully Synced "${itunesData.trackName}"`);
    } catch (err) {
      showError("Pro Sync failed to complete technical analysis.");
    } finally {
      setIsProSyncing(false);
    }
  };

  const handleMagicFormatLyrics = async () => {
    if (!formData.lyrics?.trim()) {
      showError("Paste lyrics first.");
      return;
    }
    setIsFormattingLyrics(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: [formData.lyrics], mode: 'lyrics' }
      });
      if (error) throw error;
      if (data?.lyrics) {
        handleAutoSave({ lyrics: data.lyrics });
        showSuccess("Lyrics Structuring Complete");
      }
    } catch (err) {
      showError("Lyrics Engine Error.");
    } finally {
      setIsFormattingLyrics(false);
    }
  };

  const handleLyricsSearch = () => {
    const query = encodeURIComponent(`${formData.artist || ""} ${formData.name || ""} lyrics`);
    window.open(`https://www.google.com/search?q=${query}`, '_blank');
  };

  const handleUgPrint = () => {
    if (!formData.ugUrl) {
      showError("Link a tab first.");
      return;
    }
    const printUrl = formData.ugUrl.includes('?') 
      ? formData.ugUrl.replace('?', '/print?') 
      : `${formData.ugUrl}/print`;
    window.open(printUrl, '_blank');
    showSuccess("Opening Print Assistant.");
  };

  const handleYoutubeSearch = () => {
    const query = encodeURIComponent(`${formData.artist || ""} ${formData.name || ""} studio version audio`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
  };

  const handleDownloadAsset = async (url: string | undefined, filename: string) => {
    if (!url) return;
    const isSupabaseUrl = url.includes('supabase.co/storage/v1/object/public');
    if (isSupabaseUrl) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        showSuccess(`Downloading ${filename}`);
      } catch (err) {
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
      showSuccess(`Opening External Asset: ${filename}`);
    }
  };

  const handleDownloadAll = async () => {
    const assets = [
      { url: formData.previewUrl, name: `${formData.name}_audio` },
      { url: formData.pdfUrl, name: `${formData.name}_sheet` },
      { url: formData.leadsheetUrl, name: `${formData.name}_leadsheet` }
    ].filter(a => !!a.url);
    
    if (assets.length === 0) {
      showError("No assets linked to download.");
      return;
    }
    for (const asset of assets) {
      await handleDownloadAsset(asset.url, asset.name);
    }
    showSuccess("All assets queued for download");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (!file || !user || !song) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const isAudio = ['mp3', 'wav', 'm4a', 'aac'].includes(fileExt?.toLowerCase() || '');
      const isPdf = fileExt?.toLowerCase() === 'pdf';
      
      if (!isAudio && !isPdf) {
        showError("Only audio or PDF files are supported.");
        return;
      }
      const fileName = `${user.id}/${song.id}/${Date.now()}.${fileExt}`;
      const bucket = 'public_assets';
      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true
        });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);
      
      if (isAudio) {
        const nextData = { ...formData, previewUrl: publicUrl };
        setFormData(nextData);
        handleAutoSave({ previewUrl: publicUrl });
        await prepareAudio(publicUrl, formData.pitch || 0);
        showSuccess("Master Audio Linked");
      } else {
        handleAutoSave({ pdfUrl: publicUrl });
        showSuccess("Stage Chart Linked");
      }
    } catch (err: any) {
      console.error("Upload Error:", err);
      showError(`Upload failed: ${err.message || "Unknown Error"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const currentChartUrl = useMemo(() => {
    switch(activeChartType) {
      case 'pdf': return formData.pdfUrl ? `${formData.pdfUrl}#toolbar=0&navpanes=0&view=FitH` : null;
      case 'leadsheet': return formData.leadsheetUrl ? `${formData.leadsheetUrl}#toolbar=0&navpanes=0&view=FitH` : null;
      case 'web': return formData.pdfUrl;
      case 'ug': return formData.ugUrl;
      default: return null;
    }
  }, [activeChartType, formData.pdfUrl, formData.leadsheetUrl, formData.ugUrl]);

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
      if (song.previewUrl) {
        prepareAudio(song.previewUrl, song.pitch || 0);
      }
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
      .eq('title', formData.name || song.name)
      .maybeSingle();
    setIsInRepertoire(!!data);
  };

  const addToPublicRepertoire = async () => {
    if (!song || !user) return;
    try {
      onSave(song.id, { is_active: true });
      setIsInRepertoire(true);
      showSuccess("Added to Master Repertoire");
    } catch (err) {
      showError("Failed to add to repertoire");
    }
  };

  const videoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] : null;

  const isFramable = (url: string | null) => {
    if (!url) return true;
    const blockedSites = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blockedSites.some(site => url.includes(site));
  };

  const renderSidebarContent = (noScroll?: boolean) => (
    <div className={cn("flex-1 p-6 md:p-8 space-y-8 md:space-y-10", noScroll ? "" : "overflow-y-auto")}>
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
                 <div 
                   key={i} 
                   className={cn(
                     "h-3 w-1.5 rounded-full transition-all",
                     (formData.comfort_level || 0) > i ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" : "bg-white/5"
                   )} 
                 />
               ))}
             </div>
           </div>
           <Slider 
             value={[formData.comfort_level || 0]} 
             min={0} 
             max={10} 
             step={1} 
             onValueChange={([v]) => handleAutoSave({ comfort_level: v })}
           />
           <p className="text-[9px] text-slate-500 font-medium leading-relaxed italic">
             Adjust this based on how well you know the melody and structure. This heavily weights the readiness score.
           </p>
        </div>
      </div>

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
                      const updates: Partial<SetlistSong> = { key_preference: nextPref };
                      if (formData.originalKey) updates.originalKey = formatKey(formData.originalKey, nextPref);
                      if (formData.targetKey) {
                        const newTarget = formatKey(formData.targetKey, nextPref);
                        updates.targetKey = newTarget;
                        if (newTarget !== formData.targetKey && song) onUpdateKey(song.id, newTarget);
                      }
                      handleAutoSave(updates);
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
                <TooltipContent className="text-[10px] font-black uppercase">Notation Preference</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => updateHarmonics({ isKeyConfirmed: !formData.isKeyConfirmed })}
                    className={cn(
                      "p-1.5 rounded-lg border transition-all",
                      formData.isKeyConfirmed ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20" : "bg-white/5 border-white/10 text-slate-500"
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px] font-black uppercase">Confirm Stage Key</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[9px] font-bold text-slate-400 uppercase">Original Key</Label>
            <Select 
              value={formatKey(formData.originalKey || "C", currentKeyPreference)} 
              onValueChange={(val) => updateHarmonics({ originalKey: val })}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white font-bold font-mono h-12 text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-[9px] font-bold text-indigo-400 uppercase">Stage Key</Label>
              <span className="text-[9px] font-mono text-slate-500">{(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span>
            </div>
            <Select 
              value={formatKey(formData.targetKey || formData.originalKey || "C", currentKeyPreference)} 
              onValueChange={(val) => {
                updateHarmonics({ targetKey: val });
                if (song) onUpdateKey(song.id, val);
              }}
            >
              <SelectTrigger className={cn(
                "border-none text-white font-bold font-mono h-12 shadow-xl text-lg transition-colors",
                formData.isKeyConfirmed ? "bg-emerald-600 shadow-emerald-500/20" : "bg-indigo-600 shadow-indigo-500/20"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
              </SelectContent>
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
                           (res.id === 'LEAD' && formData.leadsheetUrl);
            return (
              <button
                key={res.id}
                onClick={() => toggleResource(res.id)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border transition-all text-left group",
                  isActive
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
                    : "bg-white/5 text-slate-500 border-white/5 hover:border-white/10"
                )}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{res.label}</span>
                {isActive ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4 opacity-30 group-hover:opacity-100" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "max-w-[95vw] w-[1400px] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white md:rounded-[2rem] z-[200]",
          isMobile ? "w-full max-w-none h-[100dvh] max-h-none rounded-none" : ""
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-50 overflow-hidden md:rounded-t-[2rem]">
          <div
            className={cn("h-full transition-all duration-1000", readinessColor)}
            style={{ width: `${readiness}%` }}
          />
        </div>
        <DialogHeader className="sr-only">
          <DialogTitle>{formData.name || "Song Studio"}</DialogTitle>
          <DialogDescription>Configure song metadata, assets, and harmonic settings.</DialogDescription>
        </DialogHeader>
        <div className={cn("flex overflow-hidden", isMobile ? "flex-col h-[100dvh]" : "h-[90vh] min-h-[800px]")}>
          {!isMobile && (
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
                <div className="flex flex-col gap-2 mt-6">
                  <Button
                    onClick={handleProSync}
                    className={cn(
                      "w-full font-black uppercase tracking-[0.2em] text-[10px] h-10 rounded-xl shadow-lg gap-2 transition-all active:scale-95",
                      formData.isMetadataConfirmed ? "bg-emerald-600" : "bg-indigo-600"
                    )}
                  >
                    {formData.isMetadataConfirmed ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    {formData.isMetadataConfirmed ? "SYNCED" : "PRO SYNC"}
                  </Button>
                </div>
              </div>
              {renderSidebarContent()}
            </div>
          )}
          <div className="flex-1 flex flex-col min-w-0">
            <div className={cn("border-b border-white/5 flex items-center bg-black/20 shrink-0", isMobile ? "h-16 px-4 overflow-x-auto no-scrollbar" : "h-20 px-12 justify-between")}>
              <div className={cn("flex", isMobile ? "gap-4 min-w-max" : "gap-12")}>
                {tabOrder.map((tab, idx) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-4 flex flex-col items-center justify-center gap-1",
                      isMobile ? "h-16 px-2" : "text-xs tracking-[0.4em] h-20",
                      activeTab === tab ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white"
                    )}
                  >
                    <span>{tab === 'config' ? 'CONFIG' : `${tab.toUpperCase()} ENGINE`}</span>
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white font-black uppercase tracking-[0.3em] text-xs">Close Studio</Button>
            </div>
            <div className={cn("flex-1 overflow-y-auto relative flex flex-col", isMobile ? "p-4" : "p-12")}>
              {activeTab === 'config' && isMobile && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                    <h2 className="text-2xl font-black uppercase tracking-tight">{formData.name}</h2>
                    <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">{formData.artist}</p>
                    <Button onClick={handleProSync} className="w-full bg-indigo-600 font-black text-[10px] uppercase h-11 rounded-xl">Pro Sync</Button>
                  </div>
                  <div className="bg-slate-900/50 rounded-3xl border border-white/5 p-2">
                    {renderSidebarContent(true)}
                  </div>
                </div>
              )}
              {activeTab === 'audio' && (
                <div className={cn("space-y-6 md:space-y-12 animate-in fade-in duration-500")}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm md:text-lg font-black uppercase tracking-[0.2em] text-indigo-400">Audio Transposition Matrix</h3>
                      <p className="text-xs md:text-sm text-slate-500 mt-1 md:mt-2">Real-time pitch and time-stretching processing.</p>
                    </div>
                  </div>
                  <div className={cn("bg-slate-900/50 border border-white/5 space-y-6 md:space-y-12", isMobile ? "p-6 rounded-3xl" : "p-12 rounded-[3rem]")}>
                    <div className={cn(isMobile ? "h-24" : "h-40")}>
                      <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
                    </div>
                    {formData.previewUrl ? (
                      <>
                        <div className="space-y-4 md:space-y-8">
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
                        <div className="flex items-center justify-center gap-8 md:gap-12">
                           <Button variant="ghost" size="icon" onClick={stopPlayback} className="h-12 w-12 md:h-20 md:w-20 rounded-full border border-white/5">
                             <RotateCcw className="w-5 h-5 md:w-8 md:h-8" />
                           </Button>
                           <Button size="lg" onClick={togglePlayback} className="h-20 w-20 md:h-32 md:w-32 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-2xl">
                             {isPlaying ? <Pause className="w-8 h-8 md:w-12 md:h-12" /> : <Play className="w-8 h-8 md:w-12 md:h-12 ml-1 md:ml-2 fill-current" />}
                           </Button>
                           <div className="h-12 w-12 md:h-20 md:w-20" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 md:py-12 space-y-6">
                        <div className="bg-indigo-600/10 p-6 rounded-full border border-indigo-500/20">
                           <Music className="w-8 h-8 md:w-12 md:h-12 text-indigo-400" />
                        </div>
                        <p className="text-base md:text-lg font-black uppercase tracking-tight">Audio Engine Offline</p>
                      </div>
                    )}
                  </div>
                  <div className={cn("grid gap-6 md:gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div className={cn("space-y-6 md:space-y-10 bg-white/5 border border-white/5", isMobile ? "p-6 rounded-3xl" : "p-10 rounded-[2.5rem]")}>
                      <div className="space-y-4 md:space-y-6">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pitch Processor</Label>
                          <span className="text-sm md:text-lg font-mono font-black text-indigo-400">{(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span>
                        </div>
                        <Slider value={[formData.pitch || 0]} min={-24} max={24} step={1} onValueChange={(v) => {
                          const newPitch = v[0];
                          const newTargetKey = transposeKey(formData.originalKey || "C", newPitch);
                          setFormData(prev => ({ ...prev, pitch: newPitch, targetKey: newTargetKey }));
                          if (playerRef.current) playerRef.current.detune = (newPitch * 100) + fineTune;
                          if (song) {
                            onSave(song.id, { pitch: newPitch, targetKey: newTargetKey });
                            onUpdateKey(song.id, newTargetKey);
                          }
                        }} />
                      </div>
                    </div>
                    <div className={cn("space-y-6 md:space-y-10 bg-white/5 border border-white/5", isMobile ? "p-6 rounded-3xl" : "p-10 rounded-[2.5rem]")}>
                      <div className="space-y-4 md:space-y-6">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Tempo Stretch</Label>
                          <span className="text-sm md:text-lg font-mono font-black text-indigo-400">{tempo.toFixed(2)}x</span>
                        </div>
                        <Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={(v) => {
                          setTempo(v[0]);
                          if (playerRef.current) playerRef.current.playbackRate = v[0];
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'details' && (
                <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
                  <div className={cn("grid gap-6 md:gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <StudioInput label="Performance Title" value={formData.name} onChange={(val: string) => handleAutoSave({ name: val })} className="bg-white/5 border-white/10 text-xl md:text-2xl font-black h-12 md:h-16 rounded-xl md:rounded-2xl" />
                    <StudioInput label="Primary Artist" value={formData.artist} onChange={(val: string) => handleAutoSave({ artist: val })} className="bg-white/5 border-white/10 text-xl md:text-2xl font-black h-12 md:h-16 rounded-xl md:rounded-2xl" />
                  </div>
                  <StudioInput label="Rehearsal & Dynamics Notes" isTextarea value={formData.notes} onChange={(val: string) => handleAutoSave({ notes: val })} placeholder="Cues, transitions, dynamics..." className={cn("bg-white/5 border-white/10 text-base md:text-lg leading-relaxed p-6 md:p-8 whitespace-pre-wrap", isMobile ? "min-h-[200px] rounded-2xl" : "min-h-[350px] rounded-[2rem]")} />
                </div>
              )}
              {activeTab === 'charts' && (
                <div className="h-full flex flex-col gap-6 md:gap-8 animate-in fade-in duration-500">
                  <div className={cn("flex-1 min-h-[300px] bg-white overflow-hidden shadow-2xl relative", isMobile ? "rounded-3xl" : "rounded-[3rem]")}>
                    {currentChartUrl ? (
                      isFramable(currentChartUrl) ? (
                        <iframe src={currentChartUrl} className="w-full h-full" title="Chart Viewer" />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
                          <ShieldCheck className="w-12 h-12 text-indigo-400 mb-6" />
                          <h4 className="text-xl md:text-3xl font-black uppercase mb-4 text-white">Asset Protected</h4>
                          <Button onClick={() => window.open(currentChartUrl, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-12 md:h-14 px-8 md:px-10 font-black uppercase tracking-widest text-[10px] rounded-2xl gap-3">Launch Source</Button>
                        </div>
                      )
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-100 text-center">
                        <FileSearch className="w-12 h-12 md:w-16 md:h-16 text-indigo-400 mb-6" />
                        <h4 className="text-lg md:text-2xl font-black text-slate-900 uppercase">No Active Chart</h4>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'lyrics' && (
                <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500 h-full flex flex-col flex-1">
                  <div className="flex-1 min-h-0">
                    <StudioInput isTextarea placeholder="Paste lyrics here..." value={formData.lyrics} onChange={(val: string) => handleAutoSave({ lyrics: val })} className={cn("bg-white/5 border-white/10 text-lg md:text-xl leading-relaxed p-6 md:p-10 font-medium whitespace-pre-wrap h-full", isMobile ? "rounded-2xl" : "rounded-[2.5rem]")} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      <ProSyncSearch isOpen={isProSyncSearchOpen} onClose={() => setIsProSyncSearchOpen(false)} onSelect={handleSelectProSync} initialQuery={`${formData.artist} ${formData.name}`} />
    </Dialog>
  );
};

export default SongStudioModal;
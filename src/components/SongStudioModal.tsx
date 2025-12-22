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
  Globe2
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

interface SongStudioModalProps {
  song: SetlistSong | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onSyncProData?: (song: SetlistSong) => Promise<void>;
  onPerform?: (song: SetlistSong) => void;
}

type StudioTab = 'audio' | 'details' | 'charts' | 'lyrics' | 'visual' | 'library';

const SongStudioModal: React.FC<SongStudioModalProps> = ({ 
  song, 
  isOpen, 
  onClose, 
  onSave, 
  onUpdateKey,
  onSyncProData,
  onPerform 
}) => {
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
  
  // Chart Engine State
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');
  const [isChartMenuOpen, setIsChartMenuOpen] = useState(false);

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

  const readinessColor = readiness === 100 ? 'bg-emerald-500' : readiness > 60 ? 'bg-indigo-500' : 'bg-slate-500';

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLInputElement || 
                             activeElement instanceof HTMLTextAreaElement || 
                             activeElement?.getAttribute('role') === 'combobox';
      
      if (isInputFocused) return;

      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier) return;

      // Numerical shortcuts 1-6
      const tabMap: StudioTab[] = ['audio', 'details', 'charts', 'lyrics', 'visual', 'library'];
      const keyNum = parseInt(e.key);

      if (keyNum >= 1 && keyNum <= 6) {
        e.preventDefault();
        if (e.shiftKey && activeTab === 'charts') {
          // Sub-shortcuts for charts
          if (keyNum === 1) setActiveChartType('pdf');
          if (keyNum === 2) setActiveChartType('leadsheet');
          if (keyNum === 3) setActiveChartType('web');
        } else if (!e.shiftKey) {
          setActiveTab(tabMap[keyNum - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab]);

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
      const extension = file.name.split('.').pop();
      let customFileName = `${song.id}-${Date.now()}.${extension}`;
      if (isPDF) {
        if (isLeadSheet) customFileName = `${song.id}-${file.name}`;
        else {
          const safeTitle = (formData.name || "Untitled").replace(/[/\\?%*:|"<>]/g, '-');
          const safeArtist = (formData.artist || "Unknown").replace(/[/\\?%*:|"<>]/g, '-');
          customFileName = `${song.id}-${safeTitle} - ${safeArtist}.${extension}`;
        }
      }
      const fileName = `${folder}/${customFileName}`;
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
      showSuccess(`Linked: ${isPDF && !isLeadSheet ? `${formData.name} - ${formData.artist}` : file.name}`);
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

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const currentPitch = formData.pitch || 0;
    const shift = direction === 'up' ? 12 : -12;
    const newPitch = currentPitch + shift;
    if (newPitch > 24 || newPitch < -24) {
      showError("Maximum transposition range reached.");
      return;
    }
    setFormData(prev => ({ ...prev, pitch: newPitch }));
    if (playerRef.current) playerRef.current.detune = (newPitch * 100) + fineTune;
    if (song) onSave(song.id, { pitch: newPitch });
    showSuccess(`Octave Shift Applied: ${newPitch > 0 ? '+' : ''}${newPitch} ST`);
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

  const handleUgAction = () => {
    if (formData.ugUrl) window.open(formData.ugUrl, '_blank');
    else if (formData.name && formData.artist) {
      const query = encodeURIComponent(`${formData.artist} ${formData.name} official tab`);
      window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`, '_blank');
    }
  };

  const handlePdfAction = () => {
    if (formData.pdfUrl) window.open(formData.pdfUrl, '_blank');
    else if (formData.name && formData.artist) {
      const query = encodeURIComponent(`${formData.name} ${formData.artist} sheet music pdf free`);
      window.open(`https://www.google.com/search?q=${query}`, '_blank');
    }
  };

  const handleLyricsSearch = () => {
    const query = encodeURIComponent(`${formData.artist} ${formData.name} lyrics`);
    window.open(`https://www.google.com/search?q=${query}`, '_blank');
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

  const handlePasteUgUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.includes('ultimate-guitar.com')) {
        handleAutoSave({ ugUrl: text });
        showSuccess("Ultimate Guitar link updated");
      } else showError("Clipboard does not contain a valid Ultimate Guitar link");
    } catch (err) { showError("Could not access clipboard"); }
  };

  const handleUgPrint = () => {
    if (!formData.ugUrl) { showError("Link a tab first."); return; }
    const printUrl = formData.ugUrl.includes('?') ? formData.ugUrl.replace('?', '/print?') : `${formData.ugUrl}/print`;
    window.open(printUrl, '_blank');
    showSuccess("Opening Print Assistant.");
  };

  const handleYoutubeSearch = () => {
    const query = encodeURIComponent(`${formData.artist || ""} ${formData.name || ""} studio version audio`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
  };

  const handleDownloadAsset = async (url: string | undefined, filename: string) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl; link.download = filename;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); window.URL.revokeObjectURL(blobUrl);
      showSuccess(`Downloading ${filename}`);
    } catch (err) { showError("Download failed."); }
  };

  const handleDownloadAll = async () => {
    const assets = [
      { url: formData.previewUrl, name: `${formData.name}_audio` },
      { url: formData.pdfUrl, name: `${formData.name}_sheet` },
      { url: formData.leadsheetUrl, name: `${formData.name}_leadsheet` }
    ].filter(a => !!a.url);
    if (assets.length === 0) { showError("No assets linked to download."); return; }
    for (const asset of assets) await handleDownloadAsset(asset.url, asset.name);
    showSuccess("All assets queued for download");
  };

  const videoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] : null;

  const currentChartUrl = useMemo(() => {
    switch(activeChartType) {
      case 'pdf': return formData.pdfUrl ? `${formData.pdfUrl}#toolbar=0&navpanes=0&view=FitH` : null;
      case 'leadsheet': return formData.leadsheetUrl ? `${formData.leadsheetUrl}#toolbar=0&navpanes=0&view=FitH` : null;
      case 'web': return formData.pdfUrl;
      case 'ug': return formData.ugUrl;
      default: return null;
    }
  }, [activeChartType, formData.pdfUrl, formData.leadsheetUrl, formData.ugUrl]);

  const TABS: { id: StudioTab; label: string; title: string }[] = [
    { id: 'audio', label: 'Audio', title: 'Audio Transposition Matrix' },
    { id: 'details', label: 'Details', title: 'Details Performance Engine' },
    { id: 'charts', label: 'Charts', title: 'Chart Rendering Engine' },
    { id: 'lyrics', label: 'Lyrics', title: 'Lyrics Projection Engine' },
    { id: 'visual', label: 'Visual', title: 'Visual Reference Engine' },
    { id: 'library', label: 'Library', title: 'Library Asset Matrix' },
  ];

  if (!song) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[95vw] w-[1400px] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white rounded-[2rem]"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-50 overflow-hidden rounded-t-[2rem]">
          <div className={cn("h-full transition-all duration-1000", readinessColor)} style={{ width: `${readiness}%` }} />
        </div>

        <DialogHeader className="sr-only">
          <DialogTitle>{formData.name || "Song Studio"}</DialogTitle>
          <DialogDescription>Configure song metadata, assets, and harmonic settings.</DialogDescription>
        </DialogHeader>

        {previewPdfUrl && (
          <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-xl animate-in fade-in zoom-in duration-300 flex flex-col p-12">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black uppercase tracking-tight">Stage Chart Preview</h3>
              <Button variant="ghost" size="icon" onClick={() => setPreviewPdfUrl(null)} className="h-12 w-12 rounded-full hover:bg-white/10">
                <X className="w-8 h-8" />
              </Button>
            </div>
            <iframe src={`${previewPdfUrl}#toolbar=0&navpanes=0&view=FitH`} className="flex-1 w-full rounded-2xl bg-white" title="PDF Preview" />
          </div>
        )}

        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-indigo-600/20 backdrop-blur-sm border-4 border-dashed border-indigo-500 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-indigo-400 animate-bounce" />
              <p className="text-xl font-black uppercase tracking-tighter">Drop Audio or PDF to Link</p>
            </div>
          </div>
        )}

        {(isUploading || isProSyncing) && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4">
             <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
             <p className="text-sm font-black uppercase tracking-[0.2em] text-white">{isUploading ? 'Syncing Master Asset...' : 'Analyzing Global Library Data...'}</p>
          </div>
        )}

        <div className="flex h-[90vh] min-h-[800px] overflow-hidden">
          {/* Sidebar */}
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
              
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all duration-700", readinessColor)} style={{ width: `${readiness}%` }} />
                </div>
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Stability Index</span>
              </div>

              <div className="flex flex-col gap-2 mt-6">
                <Button 
                  onClick={handleProSync}
                  className={cn(
                    "w-full font-black uppercase tracking-[0.2em] text-[10px] h-10 rounded-xl shadow-lg gap-2 transition-all active:scale-95",
                    formData.isMetadataConfirmed ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                  )}
                >
                  {formData.isMetadataConfirmed ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  {formData.isMetadataConfirmed ? "SYNCED FROM ITUNES" : "PRO SYNC ENGINE"}
                </Button>
                <Button 
                  onClick={addToPublicRepertoire}
                  disabled={isInRepertoire}
                  className={cn(
                    "w-full font-black uppercase tracking-[0.2em] text-[10px] h-10 rounded-xl gap-2 transition-all",
                    isInRepertoire ? "bg-emerald-600/10 text-emerald-400 border border-emerald-600/20" : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  )}
                >
                  {isInRepertoire ? <Check className="w-4 h-4" /> : <ListPlus className="w-4 h-4" />}
                  {isInRepertoire ? "IN PUBLIC REPERTOIRE" : "ADD TO PUBLIC LIST"}
                </Button>
              </div>
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
                        <TooltipContent className="text-[10px] font-black uppercase">Toggle Notation</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => updateHarmonics({ isKeyConfirmed: !formData.isKeyConfirmed })} className={cn("p-1.5 rounded-lg border transition-all", formData.isKeyConfirmed ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20" : "bg-white/5 border-white/10 text-slate-500")}>
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px] font-black uppercase">{formData.isKeyConfirmed ? "Key is Verified" : "Confirm Stage Key"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => updateHarmonics({ isKeyLinked: !formData.isKeyLinked })} className={cn("p-1.5 rounded-lg border transition-all", formData.isKeyLinked ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-emerald-600/20" : "bg-white/5 border-white/10 text-slate-500")}>
                            <LinkIcon className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px] font-black uppercase">{formData.isKeyLinked ? "Keys are Linked to Pitch" : "Pitch is Independent"}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>
                
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
                    <Select value={formData.targetKey || "C"} onValueChange={(val) => { updateHarmonics({ targetKey: val }); onUpdateKey(song.id, val); }}>
                      <SelectTrigger className={cn("border-none text-white font-bold font-mono h-12 shadow-xl text-lg transition-colors", formData.isKeyConfirmed ? "bg-emerald-600 shadow-emerald-500/20" : "bg-indigo-600 shadow-indigo-500/20")}>
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
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Library Matrix</Label>
                <div className="grid grid-cols-1 gap-2.5">
                  {RESOURCE_TYPES.map(res => {
                    const isActive = formData.resources?.includes(res.id) || (res.id === 'UG' && formData.ugUrl) || (res.id === 'LYRICS' && formData.lyrics) || (res.id === 'LEAD' && formData.leadsheetUrl);
                    return (
                      <button key={res.id} onClick={() => toggleResource(res.id)} className={cn("flex items-center justify-between p-4 rounded-xl border transition-all text-left group", isActive ? "bg-indigo-600/20 border-indigo-500 text-indigo-400" : "bg-white/5 text-slate-500 border-white/5 hover:border-white/10")}>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{res.label}</span>
                        {isActive ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4 opacity-30 group-hover:opacity-100" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-600 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Live Sync: ON
              </div>
              <Button variant="ghost" size="sm" onClick={handleProSync} className="h-6 px-2 text-[8px] font-black uppercase text-indigo-400 hover:text-indigo-300">PRO V2.5-AUTO</Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Navigation Bar */}
            <div className="h-20 border-b border-white/5 flex items-center px-12 justify-between bg-black/20 shrink-0">
              <div className="flex gap-10 h-full">
                <TooltipProvider>
                  {TABS.map((tab, idx) => (
                    <Tooltip key={tab.id}>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            "text-xs font-bold uppercase tracking-[0.4em] h-20 transition-all border-b-4 flex items-center gap-2 px-2",
                            activeTab === tab.id ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white"
                          )}
                        >
                          <span className="text-sm font-black text-white/90 mr-1">{idx + 1}</span>
                          <span className="hidden md:inline">{tab.label.toUpperCase()} ENGINE</span>
                          <span className="text-[8px] bg-white/10 px-1 rounded ml-1 font-mono">{navigator.platform.includes('Mac') ? '⌘' : '⌃'}{idx + 1}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px] font-black uppercase">{tab.label} Engine ({navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'} + {idx + 1})</TooltipContent>
                    </Tooltip>
                  ))}
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-6">
                 <div className="h-10 w-px bg-white/5" />
                 <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white font-black uppercase tracking-[0.3em] text-xs">Close Studio</Button>
              </div>
            </div>

            {/* Content Divider Title */}
            <div className="px-12 py-3 bg-white/5 border-b border-white/5 flex items-center gap-3">
              <span className="text-xs font-black text-indigo-400 font-mono">{TABS.findIndex(t => t.id === activeTab) + 1}</span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                {TABS.find(t => t.id === activeTab)?.title.toUpperCase()}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-12 relative">
              {activeTab === 'audio' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-[0.2em] text-indigo-400">Audio Transposition Matrix</h3>
                      <p className="text-sm text-slate-500 mt-2">Direct stream processing with real-time pitch and time-stretching.</p>
                    </div>
                    <Button variant="outline" onClick={handleYoutubeSearch} className="bg-red-600/10 border-red-600/20 text-red-600 hover:bg-red-600 hover:text-white font-black uppercase tracking-widest text-[9px] h-10 gap-2 px-6 rounded-xl">
                      <Youtube className="w-3.5 h-3.5" /> Discovery Mode
                    </Button>
                  </div>
                  <div className="bg-slate-900/50 rounded-[3rem] border border-white/5 p-12 space-y-12">
                    <div className="h-40">
                      <AudioVisualizer analyzer={analyzerRef.current} isActive={isPlaying} />
                    </div>
                    {formData.previewUrl ? (
                      <>
                        <div className="space-y-8">
                          <div className="flex justify-between text-xs font-mono font-black text-slate-500 uppercase tracking-widest">
                            <span className="text-indigo-400">{new Date((progress/100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                            <span>Transport Master Clock</span>
                            <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
                          </div>
                          <Slider value={[progress]} max={100} step={0.1} onValueChange={(v) => {
                            const p = v[0]; setProgress(p);
                            const offset = (p / 100) * duration;
                            playbackOffsetRef.current = offset;
                            if (isPlaying && playerRef.current) {
                              playerRef.current.stop(); playbackStartTimeRef.current = Tone.now(); playerRef.current.start(0, offset);
                            }
                          }} />
                        </div>
                        <div className="flex items-center justify-center gap-12">
                           <Button variant="ghost" size="icon" onClick={stopPlayback} className="h-20 w-20 rounded-full border border-white/5 hover:bg-white/5 hover:scale-110 transition-all">
                             <RotateCcw className="w-8 h-8" />
                           </Button>
                           <Button size="lg" onClick={togglePlayback} className="h-32 w-32 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_60px_rgba(79,70,229,0.4)]">
                             {isPlaying ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12 ml-2 fill-current" />}
                           </Button>
                           <div className="h-20 w-20" /> 
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 space-y-6">
                        <div className="bg-indigo-600/10 p-6 rounded-full border border-indigo-500/20"><Music className="w-12 h-12 text-indigo-400" /></div>
                        <div className="text-center space-y-2">
                           <p className="text-lg font-black uppercase tracking-tight">Audio Engine Offline</p>
                           <p className="text-sm text-slate-500 max-w-sm">No track is linked. Upload a master file or discover on YouTube.</p>
                        </div>
                        <Button onClick={handleYoutubeSearch} className="bg-red-600 hover:bg-red-700 font-black uppercase tracking-widest text-xs h-12 gap-3 px-8 rounded-2xl shadow-xl shadow-red-600/20">
                          <Search className="w-4 h-4" /> Discover on YouTube
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'details' && (
                <div className="space-y-10 animate-in fade-in duration-500">
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Performance Title</Label>
                      <Input value={formData.name || ""} onChange={(e) => handleAutoSave({ name: e.target.value })} className="bg-white/5 border-white/10 text-2xl font-black h-16 rounded-2xl" />
                    </div>
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Primary Artist</Label>
                      <Input value={formData.artist || ""} onChange={(e) => handleAutoSave({ artist: e.target.value })} className="bg-white/5 border-white/10 text-2xl font-black h-16 rounded-2xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Sheet Music Link</Label>
                      <div className="flex gap-3">
                        <Input placeholder="Paste URL..." value={formData.pdfUrl || ""} onChange={(e) => handleAutoSave({ pdfUrl: e.target.value })} className="bg-white/5 border-white/10 font-bold h-12 rounded-xl" />
                        <Button variant="ghost" className="bg-white/5 h-12 w-12 p-0 rounded-xl" onClick={handlePdfAction}>{formData.pdfUrl ? <LinkIcon className="w-5 h-5" /> : <ExternalLink className="w-5 h-5" />}</Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">UG Pro Link</Label>
                      <div className="flex gap-3">
                        <Input placeholder="Paste URL..." value={formData.ugUrl || ""} onChange={(e) => handleAutoSave({ ugUrl: e.target.value })} className="bg-white/5 border-white/10 font-bold text-orange-400 h-12 rounded-xl" />
                        <Button variant="ghost" className="bg-white/5 h-12 w-12 p-0 text-orange-400 rounded-xl" onClick={handleUgAction}>{formData.ugUrl ? <LinkIcon className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}</Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Rehearsal Dynamics</Label>
                    <Textarea placeholder="Cues, transitions..." value={formData.notes || ""} onChange={(e) => handleAutoSave({ notes: e.target.value })} className="min-h-[350px] bg-white/5 border-white/10 text-lg rounded-[2rem] p-8" />
                  </div>
                </div>
              )}

              {activeTab === 'charts' && (
                <div className="h-full flex flex-col gap-8 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-[0.3em] text-emerald-400">Chart Rendering Engine</h3>
                      <p className="text-sm text-slate-500 mt-2">Multi-layer performance chart rendering.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button 
                                onClick={() => setActiveChartType('pdf')}
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-lg transition-all flex items-center gap-2",
                                  activeChartType === 'pdf' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-white"
                                )}
                              >
                                <span className="text-xs">1</span> STAGE PDF
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px] font-black uppercase">Shift + 1</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button 
                                onClick={() => setActiveChartType('leadsheet')}
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-lg transition-all flex items-center gap-2",
                                  activeChartType === 'leadsheet' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-white"
                                )}
                              >
                                <span className="text-xs">2</span> SHEET
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px] font-black uppercase">Shift + 2</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button 
                                onClick={() => setActiveChartType('web')}
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-widest h-9 px-4 rounded-lg transition-all flex items-center gap-2",
                                  activeChartType === 'web' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-white"
                                )}
                              >
                                <span className="text-xs">3</span> URL PREVIEW
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px] font-black uppercase">Shift + 3</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Button variant="outline" onClick={handlePdfAction} className="bg-emerald-600/10 border-emerald-600/20 text-emerald-600 font-black text-[9px] h-10 px-6 rounded-xl"><Search className="w-3.5 h-3.5 mr-2" /> Discovery</Button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 bg-white rounded-[3rem] overflow-hidden shadow-2xl relative">
                    {currentChartUrl ? <iframe src={currentChartUrl} className="w-full h-full" title="Chart Viewer" /> : (
                      <div className="h-full flex flex-col items-center justify-center p-12 bg-slate-100">
                        <FileSearch className="w-16 h-16 text-indigo-400 mb-8" />
                        <h4 className="text-2xl font-black text-slate-900 uppercase mb-2">No Active Chart</h4>
                        <div className="flex gap-4 mt-8">
                           <Button className="bg-indigo-600 font-black text-[10px] h-12 px-8 rounded-2xl">Upload Asset</Button>
                           <Button variant="outline" onClick={handlePdfAction} className="border-indigo-200 text-indigo-600 font-black text-[10px] h-12 px-8 rounded-2xl">Web Search</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'lyrics' && (
                <div className="space-y-10 animate-in fade-in duration-500 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <div><h3 className="text-lg font-black uppercase tracking-[0.3em] text-pink-400">Lyrics Projection Engine</h3><p className="text-sm text-slate-500 mt-2">Stage teleprompter configuration.</p></div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={handleMagicFormatLyrics} disabled={isFormattingLyrics || !formData.lyrics} className="bg-indigo-600/10 text-indigo-600 font-black text-[9px] h-10 px-6 rounded-xl">{isFormattingLyrics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Magic Format</Button>
                      <Button variant="outline" onClick={handleLyricsSearch} className="bg-pink-600/10 text-pink-600 font-black text-[9px] h-10 px-6 rounded-xl"><Search className="w-3.5 h-3.5" /> Find Online</Button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <Textarea placeholder="Paste lyrics..." value={formData.lyrics || ""} onChange={(e) => handleAutoSave({ lyrics: e.target.value })} className="h-full bg-white/5 border-white/10 text-xl rounded-[2.5rem] p-10" />
                  </div>
                </div>
              )}

              {activeTab === 'visual' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <div><h3 className="text-lg font-black uppercase tracking-[0.3em] text-indigo-400">Visual Reference Engine</h3><p className="text-sm text-slate-500 mt-2">Performance master video feed.</p></div>
                    <Button variant="outline" onClick={handleYoutubeSearch} className="bg-red-600/10 text-red-600 font-black text-[9px] h-10 px-6 rounded-xl"><Youtube className="w-3.5 h-3.5" /> Discovery</Button>
                  </div>
                  <Input placeholder="YouTube URL..." value={formData.youtubeUrl || ""} onChange={(e) => handleAutoSave({ youtubeUrl: e.target.value })} className="bg-white/5 border-white/10 h-12 rounded-xl" />
                  {videoId ? <div className="aspect-video w-full rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 bg-black"><iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`} title="Reference" frameBorder="0" allowFullScreen /></div> : (
                    <div className="flex flex-col items-center justify-center py-48 bg-white/5 rounded-[4rem] border border-dashed border-white/10"><Youtube className="w-12 h-12 text-slate-700 mb-4" /><p className="text-lg font-black uppercase text-slate-500">Visual Engine Standby</p></div>
                  )}
                </div>
              )}

              {activeTab === 'library' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-[0.3em] text-indigo-400">Library Asset Matrix</h3>
                      <p className="text-sm text-slate-500 mt-2">Centralized stage resource management.</p>
                    </div>
                    <Button 
                      onClick={handleDownloadAll} 
                      className="bg-indigo-600 hover:bg-indigo-700 font-black text-[10px] h-12 px-8 rounded-2xl shadow-xl shadow-indigo-600/20 gap-3"
                    >
                      <Download className="w-4 h-4" /> Export All Master Assets
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Audio Asset */}
                    <div className={cn(
                      "p-6 rounded-[2rem] border flex flex-col justify-between h-56 transition-all",
                      formData.previewUrl ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 border-dashed opacity-50"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-indigo-600 p-3 rounded-xl"><Music className="w-5 h-5" /></div>
                        {formData.previewUrl && (
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadAsset(formData.previewUrl, `${formData.name}_audio`)} className="text-slate-500 hover:text-white">
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Master Audio</Label>
                        <p className="text-lg font-black truncate">{formData.previewUrl ? "Active_Stream" : "Engine_Offline"}</p>
                        <p className="text-[10px] font-mono text-slate-500 mt-1">{formData.previewUrl ? "Verified Direct Link" : "No asset attached"}</p>
                      </div>
                    </div>

                    {/* Chart Asset */}
                    <div className={cn(
                      "p-6 rounded-[2rem] border flex flex-col justify-between h-56 transition-all",
                      formData.pdfUrl ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 border-dashed opacity-50"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-emerald-600 p-3 rounded-xl"><FileText className="w-5 h-5" /></div>
                        {formData.pdfUrl && (
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadAsset(formData.pdfUrl, `${formData.name}_chart`)} className="text-slate-500 hover:text-white">
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Stage Chart</Label>
                        <p className="text-lg font-black truncate">{formData.pdfUrl ? "Verified_PDF" : "Engine_Offline"}</p>
                        <p className="text-[10px] font-mono text-slate-500 mt-1">{formData.pdfUrl ? "Full Resolution Scan" : "No asset attached"}</p>
                      </div>
                    </div>

                    {/* Lead Sheet Asset */}
                    <div className={cn(
                      "p-6 rounded-[2rem] border flex flex-col justify-between h-56 transition-all",
                      formData.leadsheetUrl ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 border-dashed opacity-50"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-indigo-400 p-3 rounded-xl"><Layers className="w-5 h-5" /></div>
                        {formData.leadsheetUrl && (
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadAsset(formData.leadsheetUrl, `${formData.name}_leadsheet`)} className="text-slate-500 hover:text-white">
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Lead Sheet</Label>
                        <p className="text-lg font-black truncate">{formData.leadsheetUrl ? "Pro_Arrangement" : "Engine_Offline"}</p>
                        <p className="text-[10px] font-mono text-slate-500 mt-1">{formData.leadsheetUrl ? "Melody & Chords Linked" : "No asset attached"}</p>
                      </div>
                    </div>

                    {/* Lyrics Asset */}
                    <div className={cn(
                      "p-6 rounded-[2rem] border flex flex-col justify-between h-56 transition-all",
                      formData.lyrics ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 border-dashed opacity-50"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-pink-600 p-3 rounded-xl"><AlignLeft className="w-5 h-5" /></div>
                      </div>
                      <div>
                        <Label className="text-[9px] font-black uppercase tracking-widest text-pink-400">Lyrics Data</Label>
                        <p className="text-lg font-black truncate">{formData.lyrics ? "Verified_Text" : "Engine_Offline"}</p>
                        <p className="text-[10px] font-mono text-slate-500 mt-1">{formData.lyrics ? "Formatted & Ready" : "No asset attached"}</p>
                      </div>
                    </div>

                    {/* Video Asset */}
                    <div className={cn(
                      "p-6 rounded-[2rem] border flex flex-col justify-between h-56 transition-all",
                      formData.youtubeUrl ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 border-dashed opacity-50"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-red-600 p-3 rounded-xl"><Youtube className="w-5 h-5" /></div>
                        {formData.youtubeUrl && (
                          <Button variant="ghost" size="icon" onClick={() => window.open(formData.youtubeUrl, '_blank')} className="text-slate-500 hover:text-white">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className="text-[9px] font-black uppercase tracking-widest text-red-500">Visual Ref</Label>
                        <p className="text-lg font-black truncate">{formData.youtubeUrl ? "YT_Stream_Ready" : "Engine_Offline"}</p>
                        <p className="text-[10px] font-mono text-slate-500 mt-1">{formData.youtubeUrl ? "Reference Feed Linked" : "No asset attached"}</p>
                      </div>
                    </div>

                    {/* Tab Asset */}
                    <div className={cn(
                      "p-6 rounded-[2rem] border flex flex-col justify-between h-56 transition-all",
                      formData.ugUrl ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 border-dashed opacity-50"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-orange-600 p-3 rounded-xl"><FileSearch className="w-5 h-5" /></div>
                        {formData.ugUrl && (
                          <Button variant="ghost" size="icon" onClick={() => window.open(formData.ugUrl, '_blank')} className="text-slate-500 hover:text-white">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className="text-[9px] font-black uppercase tracking-widest text-orange-400">UG Tab Link</Label>
                        <p className="text-lg font-black truncate">{formData.ugUrl ? "Interactive_Tab" : "Engine_Offline"}</p>
                        <p className="text-[10px] font-mono text-slate-500 mt-1">{formData.ugUrl ? "Official Chords Matrix" : "No asset attached"}</p>
                      </div>
                    </div>
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
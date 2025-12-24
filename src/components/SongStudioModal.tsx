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
  Globe2, ShieldCheck, Timer, FileMusic, Copy, SearchCode, Cloud,
  AlertTriangle, Wrench
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
import YoutubeResultsShelf from './YoutubeResultsShelf';
import { useAuth } from './AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { calculateReadiness } from '@/utils/repertoireSync';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { detectKeyFromBuffer, KeyCandidate } from '@/utils/keyDetector';
import { cleanYoutubeUrl } from '@/utils/youtubeUtils';

// Helper to parse ISO 8601 duration
const parseISO8601Duration = (duration: string): string => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

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
  onOpenAdmin?: () => void;
}

type StudioTab = 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library';

const SongStudioModal: React.FC<SongStudioModalProps> = ({ 
  song, 
  isOpen, 
  onClose, 
  onSave, 
  onUpdateKey,
  onSyncProData,
  onPerform,
  onOpenAdmin
}) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { keyPreference: globalPreference } = useSettings();
  const audio = useToneAudio();
  
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<StudioTab>('audio');
  const [newTag, setNewTag] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetectingKey, setIsDetectingKey] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isSyncingAudio, setIsSyncingAudio] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [engineError, setEngineError] = useState<string | null>(null);
  const [keyCandidates, setKeyCandidates] = useState<KeyCandidate[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFormattingLyrics, setIsFormattingLyrics] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isProSyncSearchOpen, setIsProSyncSearchOpen] = useState(false);
  
  const [ytApiKey, setYtApiKey] = useState("");
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);
  const [ytResults, setYtResults] = useState<any[]>([]);
  
  const [isProSyncing, setIsProSyncing] = useState(false);
  const [isInRepertoire, setIsInRepertoire] = useState(false);
  
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');

  const { 
    isPlaying, progress, duration, pitch, tempo, volume, fineTune, analyzer, currentBuffer,
    setPitch, setTempo, setVolume, setFineTune, setProgress,
    loadFromUrl, togglePlayback, stopPlayback, resetEngine
  } = audio;

  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const metronomeSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const metronomeLoopRef = useRef<Tone.Loop | null>(null);

  const tabOrder: StudioTab[] = isMobile 
    ? ['audio', 'config', 'details', 'charts', 'lyrics', 'visual', 'library']
    : ['audio', 'details', 'charts', 'lyrics', 'visual', 'library'];

  useEffect(() => {
    if (isOpen && user) {
      fetchYtKey();
    }
  }, [isOpen, user]);

  const fetchYtKey = async () => {
    const { data } = await supabase.from('profiles').select('youtube_api_key').eq('id', user?.id).single();
    if (data?.youtube_api_key) setYtApiKey(data.youtube_api_key);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if ((e.metaKey || e.ctrlKey) && !isNaN(Number(e.key))) {
        e.preventDefault();
        const index = Number(e.key) - 1;
        if (index >= 0 && index < tabOrder.length) {
          setActiveTab(tabOrder[index]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMobile, tabOrder]);

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
    if (!currentBuffer) return;
    setIsAnalyzing(true);
    try {
      const bpm = await analyze(currentBuffer);
      const roundedBpm = Math.round(bpm);
      handleAutoSave({ bpm: roundedBpm.toString() });
      showSuccess(`BPM Detected: ${roundedBpm}`);
    } catch (err) {
      showError("BPM detection failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDetectKey = async () => {
    if (!currentBuffer) {
      showError("Load audio first.");
      return;
    }
    setIsDetectingKey(true);
    setKeyCandidates([]);
    try {
      const candidates = await detectKeyFromBuffer(currentBuffer);
      const normalizedCandidates = candidates.map(c => ({
        ...c,
        key: formatKey(c.key, currentKeyPreference)
      }));
      setKeyCandidates(normalizedCandidates);
      showSuccess(`Harmonic Matrix: ${normalizedCandidates.length} potential matches found.`);
    } catch (err) {
      showError("Key detection failed.");
    } finally {
      setIsDetectingKey(false);
    }
  };

  const handleCloudKeySync = async () => {
    if (!formData.name || !formData.artist) {
      showError("Song Title and Artist required for Cloud Sync.");
      return;
    }
    setIsCloudSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: [`${formData.name} by ${formData.artist}`] }
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.originalKey) {
        const normalized = formatKey(result.originalKey, currentKeyPreference);
        updateHarmonics({ 
          originalKey: normalized, 
          isKeyConfirmed: true,
          bpm: result.bpm?.toString() || formData.bpm,
          genre: result.genre || formData.genre
        });
        showSuccess(`Cloud AI Verified: Song is in ${normalized}`);
      } else {
        showError("Cloud AI could not find definitive metadata.");
      }
    } catch (err) {
      showError("Cloud Sync Error.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // --- REFINED EXTRACTION ENGINE ---
  const handleSyncYoutubeAudio = async (videoUrl?: string) => {
    const targetUrl = videoUrl || formData.youtubeUrl;
    if (!targetUrl || !user || !song) {
      showError("Paste a YouTube URL first.");
      return;
    }

    // HANDSHAKE TOKEN: Proof of Origin bypass
    const PO_TOKEN = "MlOlJlvLa_FSHqUaxD-0Ire5U3D6imQycOxu7mX6MSjKzYm7Ik9RJl9Tdp7oKgaNbwXlp0ePbT07u0taw07-P4CK9n0IF2LEVfem5zaJQBsXRwW2ig==";

    const cleanedUrl = cleanYoutubeUrl(targetUrl);
    const apiBase = "https://yt-audio-api-docker.onrender.com"; 

    setIsSyncingAudio(true);
    setSyncStatus("Initializing Engine...");
    setEngineError(null);
    
    try {
      setSyncStatus("Handshaking with Render...");
      const tokenUrl = `${apiBase}/?url=${encodeURIComponent(cleanedUrl)}&po_token=${encodeURIComponent(PO_TOKEN)}`;
      
      // FIX: Scope variable properly
      const tokenRes = await fetch(tokenUrl);
      const errBody = await tokenRes.json().catch(() => ({}));

      if (!tokenRes.ok) {
        const specificError = errBody.detail || errBody.error || tokenRes.statusText;
        if (specificError.includes("format is not available") || 
            specificError.includes("Signature") || 
            specificError.includes("Sign in")) {
          setEngineError(`YouTube Protection Triggered. Backend session expired. Upload fresh cookies in Admin Panel.`);
        } else {
          setEngineError(`Engine Error: ${specificError}`);
        }
        throw new Error(`Engine Error: ${specificError}`);
      }
      
      const { token } = errBody;
      setSyncStatus("Extracting Audio Stream...");

      const downloadUrl = `${apiBase}/download?token=${token}`;
      const downloadRes = await fetch(downloadUrl);
      
      if (!downloadRes.ok) throw new Error("Extraction failed at source.");
      const blob = await downloadRes.blob();

      setSyncStatus("Syncing to Cloud Vault...");
      const fileName = `${user.id}/${song.id}/extracted-${Date.now()}.mp3`;
      
      const { error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(fileName, blob, { contentType: 'audio/mpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public_assets')
        .getPublicUrl(fileName);

      const updates = { previewUrl: publicUrl, youtubeUrl: cleanedUrl };
      handleAutoSave(updates);
      await loadFromUrl(publicUrl, formData.pitch || 0);
      showSuccess("YT-Master Audio Linked to Engine");
      
    } catch (err: any) {
      console.error("YT Sync Error:", err);
      showError(err.message || "Extraction engine unreachable.");
    } finally {
      setIsSyncingAudio(false);
      setSyncStatus("");
    }
  };

  const confirmCandidateKey = (key: string) => {
    if (!song) return;
    updateHarmonics({ originalKey: key, isKeyConfirmed: true });
    setKeyCandidates([]);
    showSuccess(`Original Key set to ${key}`);
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
          setPitch(next.pitch);
        }
      }
      onSave(song.id, next);
      return next;
    });
  };

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const currentPitch = formData.pitch || 0;
    const shift = direction === 'up' ? 12 : -12;
    const newPitch = currentPitch + shift;
    if (newPitch > 24 || newPitch < -24) return showError("Range reached.");
    setFormData(prev => ({ ...prev, pitch: newPitch }));
    setPitch(newPitch);
    if (song) onSave(song.id, { pitch: newPitch });
  };

  const handleProSync = async () => setIsProSyncSearchOpen(true);

  const handleSelectProSync = async (itunesData: any) => {
    setIsProSyncSearchOpen(false);
    setIsProSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: [`${itunesData.trackName} by ${itunesData.artistName}`] }
      });
      if (error) throw error;
      const ai = Array.isArray(data) ? data[0] : data;
      handleAutoSave({
        name: itunesData.trackName,
        artist: itunesData.artistName,
        genre: itunesData.primaryGenreName,
        originalKey: ai?.originalKey || formData.originalKey,
        bpm: ai?.bpm?.toString() || formData.bpm,
        isMetadataConfirmed: true
      });
      showSuccess("Metadata Synced");
    } finally {
      setIsProSyncing(false);
    }
  };

  const handleMagicFormatLyrics = async () => {
    if (!formData.lyrics?.trim()) return showError("Paste lyrics first.");
    setIsFormattingLyrics(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: [formData.lyrics], mode: 'lyrics' }
      });
      if (data?.lyrics) {
        handleAutoSave({ lyrics: data.lyrics });
        showSuccess("Lyrics Structuring Complete");
      }
    } finally {
      setIsFormattingLyrics(false);
    }
  };

  const handleLyricsSearch = () => {
    const query = encodeURIComponent(`${formData.artist || ""} ${formData.name || ""} lyrics`);
    window.open(`https://www.google.com/search?q=${query}`, '_blank');
  };

  const handleUgPrint = () => {
    if (!formData.ugUrl) return showError("Link a tab first.");
    const printUrl = formData.ugUrl.includes('?') ? formData.ugUrl.replace('?', '/print?') : `${formData.ugUrl}/print`;
    window.open(printUrl, '_blank');
  };

  const performYoutubeDiscovery = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    if (searchTerm.startsWith('http')) {
      handleAutoSave({ youtubeUrl: searchTerm });
      showSuccess("YouTube URL Linked");
      return;
    }
    setIsSearchingYoutube(true);
    setYtResults([]);
    try {
      const proxies = ["https://api.allorigins.win/get?url=", "https://corsproxy.io/?"];
      const instances = ['https://iv.ggtyler.dev', 'https://yewtu.be'];
      let success = false;
      for (const proxy of proxies) {
        if (success) break;
        for (const instance of instances) {
          try {
            const target = encodeURIComponent(`${instance}/api/v1/search?q=${encodeURIComponent(searchTerm)}`);
            const res = await fetch(`${proxy}${target}`);
            const raw = await res.json();
            const data = typeof raw.contents === 'string' ? JSON.parse(raw.contents) : raw;
            const videos = data?.filter?.((i: any) => i.type === "video").slice(0, 10);
            if (videos?.length > 0) {
              setYtResults(videos.map((v: any) => ({
                videoId: v.videoId, title: v.title, author: v.author, videoThumbnails: v.videoThumbnails,
                duration: v.durationSeconds ? `${Math.floor(v.durationSeconds/60)}:${(v.durationSeconds%60).toString().padStart(2, '0')}` : '0:00'
              })));
              success = true;
            }
          } catch (err) {}
        }
      }
    } finally {
      setIsSearchingYoutube(false);
    }
  };

  const handleYoutubeSearch = () => {
    const query = `${formData.artist} ${formData.name} official video`;
    performYoutubeDiscovery(query);
  };

  const handleSelectYoutubeVideo = (url: string) => handleAutoSave({ youtubeUrl: url });

  const handleDownloadAsset = async (url: string | undefined, filename: string) => {
    if (!url) return;
    window.open(url, '_blank');
  };

  const handleDownloadAll = async () => {
    const assets = [formData.previewUrl, formData.pdfUrl, formData.leadsheetUrl].filter(Boolean);
    assets.forEach(url => window.open(url!, '_blank'));
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !user || !song) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${song.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('public_assets').upload(fileName, file, { contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('public_assets').getPublicUrl(fileName);
      if (['mp3', 'wav', 'm4a'].includes(fileExt?.toLowerCase() || '')) {
        handleAutoSave({ previewUrl: publicUrl });
        await loadFromUrl(publicUrl, formData.pitch || 0);
      } else {
        handleAutoSave({ pdfUrl: publicUrl });
      }
      showSuccess("Asset Linked");
    } finally {
      setIsUploading(false);
    }
  };

  const currentChartUrl = useMemo(() => {
    if (activeChartType === 'pdf') return formData.pdfUrl ? `${formData.pdfUrl}#toolbar=0&navpanes=0&view=FitH` : null;
    if (activeChartType === 'ug') return formData.ugUrl;
    return null;
  }, [activeChartType, formData.pdfUrl, formData.ugUrl]);

  useEffect(() => {
    if (song && isOpen) {
      setFormData({
        name: song.name || "", artist: song.artist || "", bpm: song.bpm || "", originalKey: song.originalKey || "C",
        targetKey: song.targetKey || "C", notes: song.notes || "", lyrics: song.lyrics || "", youtubeUrl: song.youtubeUrl || "",
        previewUrl: song.previewUrl || "", pdfUrl: song.pdfUrl || "", leadsheetUrl: song.leadsheetUrl || "", ugUrl: song.ugUrl || "",
        pitch: song.pitch || 0, user_tags: song.user_tags || [], isKeyLinked: song.isKeyLinked ?? true, isKeyConfirmed: song.isKeyConfirmed ?? false
      });
      resetEngine();
      if (song.previewUrl) loadFromUrl(song.previewUrl, song.pitch || 0);
    }
    return () => { resetEngine(); stopMetronome(); };
  }, [song?.id, isOpen]);

  const currentVideoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] || null : null;

  const renderSidebarContent = (noScroll?: boolean) => (
    <div className={cn("flex-1 p-8 space-y-10", noScroll ? "" : "overflow-y-auto")}>
      <div className="space-y-4">
        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Harmonic Engine</Label>
        <div className="flex gap-2">
           <button onClick={() => updateHarmonics({ isKeyConfirmed: !formData.isKeyConfirmed })} className={cn("p-1.5 rounded-lg border transition-all", formData.isKeyConfirmed ? "bg-emerald-600 border-emerald-500 text-white" : "bg-white/5 border-white/10 text-slate-500")}>
             <Check className="w-3.5 h-3.5" />
           </button>
           <button onClick={() => updateHarmonics({ isKeyLinked: !formData.isKeyLinked })} className={cn("p-1.5 rounded-lg border transition-all", formData.isKeyLinked ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white/5 border-white/10 text-slate-500")}>
             <LinkIcon className="w-3.5 h-3.5" />
           </button>
        </div>
        <div className="space-y-4">
           <div className="space-y-2">
             <Label className="text-[9px] font-bold text-slate-400 uppercase">Original Key</Label>
             <Select value={formData.originalKey} onValueChange={(val) => updateHarmonics({ originalKey: val })}>
               <SelectTrigger className="bg-white/5 border-white/10 text-white font-bold h-12 text-lg"><SelectValue /></SelectTrigger>
               <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">{keysToUse.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
             </Select>
           </div>
           <div className="space-y-2">
             <Label className="text-[9px] font-bold text-indigo-400 uppercase">Stage Key</Label>
             <Select value={formData.targetKey} onValueChange={(val) => { updateHarmonics({ targetKey: val }); if (song) onUpdateKey(song.id, val); }}>
               <SelectTrigger className={cn("border-none text-white font-bold h-12 text-lg", formData.isKeyConfirmed ? "bg-emerald-600" : "bg-indigo-600")}><SelectValue /></SelectTrigger>
               <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">{keysToUse.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
             </Select>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("max-w-[95vw] w-[1400px] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white md:rounded-[2rem] z-[200]", isMobile ? "w-full h-[100dvh] rounded-none" : "")}>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-50 overflow-hidden md:rounded-t-[2rem]">
          <div className={cn("h-full transition-all duration-1000", readinessColor)} style={{ width: `${readiness}%` }} />
        </div>
        <DialogHeader className="sr-only"><DialogTitle>{formData.name || "Song Studio"}</DialogTitle></DialogHeader>
        
        {(isUploading || isProSyncing || isCloudSyncing || isSyncingAudio) && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4">
             {engineError ? (
                <div className="max-w-md bg-slate-900 border border-red-500/30 p-8 rounded-[2rem] shadow-2xl text-center space-y-6 animate-in zoom-in-95">
                   <div className="bg-red-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-red-500"><AlertTriangle className="w-8 h-8" /></div>
                   <div className="space-y-2"><p className="text-lg font-black uppercase text-white">Extraction Engine Blocked</p><p className="text-xs text-slate-400 leading-relaxed">{engineError}</p></div>
                   <div className="pt-2 flex flex-col gap-3"><Button onClick={() => setEngineError(null)} className="bg-white/5 text-white h-11 rounded-xl">Clear Error</Button></div>
                </div>
             ) : (
               <><Loader2 className="w-12 h-12 text-indigo-500 animate-spin" /><p className="text-sm font-black uppercase text-white">{syncStatus || 'Initializing Engine...'}</p></>
             )}
          </div>
        )}

        <div className={cn("flex overflow-hidden", isMobile ? "flex-col h-[100dvh]" : "h-[90vh] min-h-[800px]")}>
          {!isMobile && (
            <div className="w-96 bg-slate-900/50 border-r border-white/5 flex flex-col shrink-0">
              <div className="p-8 border-b border-white/5 bg-black/20 text-center">
                <h2 className="text-3xl font-black uppercase truncate">{formData.name}</h2>
                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">{formData.artist}</p>
                <div className="flex flex-col gap-2 mt-6">
                  <Button onClick={handleProSync} className="w-full bg-indigo-600 font-black h-10 rounded-xl">PRO SYNC</Button>
                </div>
              </div>
              {renderSidebarContent()}
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0">
            <div className={cn("border-b border-white/5 flex items-center bg-black/20 shrink-0", isMobile ? "h-16 px-4" : "h-20 px-12 justify-between")}>
              <div className="flex gap-8">
                {tabOrder.map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={cn("text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-4 h-20", activeTab === tab ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white")}>{tab}</button>
                ))}
              </div>
              <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white font-black uppercase text-xs">Close</Button>
            </div>

            <div className={cn("flex-1 overflow-y-auto relative flex flex-col", isMobile ? "p-4" : "p-12")}>
              {activeTab === 'audio' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <div><h3 className="text-lg font-black uppercase text-indigo-400">Audio Transposition Matrix</h3><p className="text-sm text-slate-500">Pitch and tempo stretching.</p></div>
                    <Button variant="outline" onClick={handleYoutubeSearch} disabled={isSearchingYoutube} className="bg-red-600/10 text-red-600 h-10 px-6 rounded-xl font-black uppercase text-[9px] gap-2"><Youtube className="w-3.5 h-3.5" /> Discovery</Button>
                  </div>
                  <div className="bg-slate-900/50 border border-white/5 p-12 rounded-[3rem] space-y-12">
                    <div className="h-40"><AudioVisualizer analyzer={analyzer} isActive={isPlaying} /></div>
                    {formData.previewUrl ? (
                      <div className="space-y-8 text-center">
                        <Slider value={[progress]} max={100} onValueChange={([v]) => setProgress(v)} />
                        <Button onClick={togglePlayback} className="h-32 w-32 rounded-full bg-indigo-600 shadow-2xl">{isPlaying ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12 ml-2 fill-current" />}</Button>
                      </div>
                    ) : (
                      <div className="text-center py-12 space-y-6"><div className="bg-indigo-600/10 p-6 rounded-full inline-block"><Music className="w-12 h-12 text-indigo-400" /></div><p className="text-lg font-black text-slate-500 uppercase">Engine Offline</p></div>
                    )}
                  </div>
                  <div className="bg-slate-900 p-10 rounded-[2.5rem] border border-white/5 grid grid-cols-2 gap-10">
                     <div className="space-y-6"><Label className="text-[10px] font-black uppercase text-slate-500">Pitch Processor</Label><Slider value={[pitch || 0]} min={-24} max={24} onValueChange={([v]) => updateHarmonics({ pitch: v })} /></div>
                     <div className="space-y-6"><Label className="text-[10px] font-black uppercase text-slate-500">Tempo Stretch</Label><Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={([v]) => setTempo(v)} /></div>
                  </div>
                </div>
              )}
              
              {activeTab === 'details' && (
                <div className="space-y-10 animate-in fade-in duration-500">
                  <div className="grid grid-cols-2 gap-10">
                    <StudioInput label="Title" value={formData.name} onChange={(v: string) => handleAutoSave({ name: v })} className="bg-white/5 h-16 text-2xl font-black rounded-2xl" />
                    <StudioInput label="Artist" value={formData.artist} onChange={(v: string) => handleAutoSave({ artist: v })} className="bg-white/5 h-16 text-2xl font-black rounded-2xl" />
                  </div>
                  <StudioInput label="Rehearsal Notes" isTextarea value={formData.notes} onChange={(v: string) => handleAutoSave({ notes: v })} className="bg-white/5 p-8 text-lg rounded-[2rem] min-h-[350px]" />
                </div>
              )}

              {activeTab === 'visual' && (
                <div className="space-y-10 h-full flex flex-col">
                  <div className="flex gap-4">
                    <Input placeholder="Reference URL or Search..." value={formData.youtubeUrl} onChange={(e) => handleAutoSave({ youtubeUrl: e.target.value })} className="bg-slate-900 h-14 rounded-xl" />
                    <Button onClick={() => handleSyncYoutubeAudio()} className="bg-indigo-600 h-14 px-8 rounded-xl font-black text-[10px]">EXTRACT AUDIO</Button>
                  </div>
                  <div className="flex-1 bg-slate-900 rounded-[2.5rem] border-4 border-white/5 overflow-hidden">
                    {currentVideoId ? (
                      <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${currentVideoId}`} frameBorder="0" allowFullScreen />
                    ) : (
                      <div className="h-full flex items-center justify-center opacity-20"><Youtube className="w-32 h-32" /></div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'library' && (
                <div className="space-y-12">
                   <div className="flex justify-between items-center"><h3 className="text-2xl font-black uppercase text-white">Asset Matrix</h3><Button onClick={handleDownloadAll} className="bg-indigo-600 h-10 px-8 rounded-xl font-black text-xs">DOWNLOAD ALL</Button></div>
                   <div className="grid grid-cols-2 gap-8">
                      <div className="p-10 bg-slate-900 border border-white/10 rounded-[2.5rem] flex flex-col justify-between h-[350px]">
                         <Music className="w-12 h-12 text-indigo-400" />
                         <div><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">MASTER AUDIO</p><p className="text-3xl font-black truncate">{formData.previewUrl ? 'Synced' : 'Not Linked'}</p></div>
                      </div>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      <ProSyncSearch 
        isOpen={isProSyncSearchOpen} 
        onClose={() => setIsProSyncSearchOpen(false)} 
        onSelect={handleSelectProSync} 
        initialQuery={`${formData.artist} ${formData.name}`} 
      />
    </Dialog>
  );
};

export default SongStudioModal;
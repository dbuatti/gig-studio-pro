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

  const handleAutoSave = useCallback((updates: Partial<SetlistSong>) => {
    setFormData(prev => {
      const next = { ...prev, ...updates };
      if (song) onSave(song.id, updates);
      return next;
    });
  }, [song, onSave]);

  const handleSyncYoutubeAudio = async (videoUrl?: string) => {
    const targetUrl = videoUrl || formData.youtubeUrl;
    if (!targetUrl || !user || !song) {
      showError("Paste a YouTube URL first.");
      return;
    }

    const cleanedUrl = cleanYoutubeUrl(targetUrl);
    const apiBase = "https://yt-audio-api-docker.onrender.com"; 
    
    // CRITICAL INTEGRITY TOKEN
    const poToken = "MlOlJlvLa_FSHqUaxD-0Ire5U3D6imQycOxu7mX6MSjKzYm7Ik9RJl9Tdp7oKgaNbwXlp0ePbT07u0taw07-P4CK9n0IF2LEVfem5zaJQBsXRwW2ig==";

    setIsSyncingAudio(true);
    setSyncStatus("Initializing Engine...");
    setEngineError(null);
    
    try {
      setSyncStatus("Handshaking with Proof of Origin...");
      // Injecting the PO Token into the request
      const tokenUrl = `${apiBase}/?url=${encodeURIComponent(cleanedUrl)}&po_token=${encodeURIComponent(poToken)}`;
      
      const tokenRes = await fetch(tokenUrl);
      const errBody = await tokenRes.json().catch(() => ({}));
      
      if (!tokenRes.ok) {
        const specificError = errBody.detail || errBody.error || tokenRes.statusText;
        setEngineError(`Integrity Block: ${specificError}. Please find a new PO Token in your browser console.`);
        throw new Error(specificError);
      }
      
      const { token } = errBody;
      setSyncStatus("Extracting authorized stream...");

      const downloadUrl = `${apiBase}/download?token=${token}`;
      const downloadRes = await fetch(downloadUrl);
      if (!downloadRes.ok) throw new Error("Stream capture failed.");
      
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

      handleAutoSave({ previewUrl: publicUrl, youtubeUrl: cleanedUrl });
      await loadFromUrl(publicUrl, formData.pitch || 0);
      showSuccess("YT-Master Authorized & Linked");
      
    } catch (err: any) {
      console.error("Integrity Sync Error:", err);
      showError(err.message || "Integrity check rejected.");
    } finally {
      setIsSyncingAudio(false);
      setSyncStatus("");
    }
  };

  const stopMetronome = () => {
    Tone.getTransport().stop();
    metronomeLoopRef.current?.stop();
    setIsMetronomeActive(false);
  };

  const toggleMetronome = async () => {
    if (!formData.bpm) { showError("Set a BPM first."); return; }
    if (isMetronomeActive) { stopMetronome(); } else {
      if (Tone.getContext().state !== 'running') await Tone.start();
      if (!metronomeSynthRef.current) metronomeSynthRef.current = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, oscillator: { type: "sine" } }).toDestination();
      const bpmValue = parseInt(formData.bpm);
      if (isNaN(bpmValue) || bpmValue <= 0) return;
      Tone.getTransport().bpm.value = bpmValue;
      if (!metronomeLoopRef.current) metronomeLoopRef.current = new Tone.Loop((time) => metronomeSynthRef.current?.triggerAttackRelease("C4", "32n", time), "4n").start(0);
      else metronomeLoopRef.current.start(0);
      Tone.getTransport().start();
      setIsMetronomeActive(true);
    }
  };

  const handleDetectBPM = async () => {
    if (!currentBuffer) return;
    setIsAnalyzing(true);
    try {
      const bpm = await analyze(currentBuffer);
      handleAutoSave({ bpm: Math.round(bpm).toString() });
      showSuccess(`BPM Detected: ${Math.round(bpm)}`);
    } catch (err) { showError("BPM detection failed."); } finally { setIsAnalyzing(false); }
  };

  const handleDetectKey = async () => {
    if (!currentBuffer) { showError("Load audio first."); return; }
    setIsDetectingKey(true);
    setKeyCandidates([]);
    try {
      const candidates = await detectKeyFromBuffer(currentBuffer);
      setKeyCandidates(candidates.map(c => ({ ...c, key: formatKey(c.key, currentKeyPreference) })));
      showSuccess(`Harmonic Matrix analyzed.`);
    } catch (err) { showError("Key detection failed."); } finally { setIsDetectingKey(false); }
  };

  const handleCloudKeySync = async () => {
    if (!formData.name || !formData.artist) { showError("Details required."); return; }
    setIsCloudSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', { body: { queries: [`${formData.name} by ${formData.artist}`] } });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.originalKey) {
        const normalized = formatKey(result.originalKey, currentKeyPreference);
        updateHarmonics({ originalKey: normalized, isKeyConfirmed: true, bpm: result.bpm?.toString() || formData.bpm, genre: result.genre || formData.genre });
        showSuccess(`Cloud AI Verified: ${normalized}`);
      }
    } catch (err) { showError("Cloud Sync Error."); } finally { setIsCloudSyncing(false); }
  };

  const confirmCandidateKey = (key: string) => {
    updateHarmonics({ originalKey: key, isKeyConfirmed: true });
    setKeyCandidates([]);
    showSuccess(`Key set to ${key}`);
  };

  const addTag = () => {
    if (!newTag.trim() || !song) return;
    const currentTags = formData.user_tags || [];
    if (!currentTags.includes(newTag.trim())) handleAutoSave({ user_tags: [...currentTags, newTag.trim()] });
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    handleAutoSave({ user_tags: (formData.user_tags || []).filter(t => t !== tag) });
  };

  const toggleResource = (id: string) => {
    const current = formData.resources || [];
    handleAutoSave({ resources: current.includes(id) ? current.filter(rid => rid !== id) : [...current, id] });
  };

  const updateHarmonics = (updates: Partial<SetlistSong>) => {
    if (!song) return;
    setFormData(prev => {
      const next = { ...prev, ...updates };
      if (next.isKeyLinked) {
        next.pitch = calculateSemitones(next.originalKey || "C", next.targetKey || "C");
        setPitch(next.pitch);
      }
      onSave(song.id, next);
      return next;
    });
  };

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const newPitch = (formData.pitch || 0) + (direction === 'up' ? 12 : -12);
    if (newPitch > 24 || newPitch < -24) { showError("Limit reached."); return; }
    setFormData(prev => ({ ...prev, pitch: newPitch }));
    setPitch(newPitch);
    if (song) onSave(song.id, { pitch: newPitch });
  };

  const handleProSync = () => setIsProSyncSearchOpen(true);

  const handleSelectProSync = async (itunesData: any) => {
    setIsProSyncSearchOpen(false);
    setIsProSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', { body: { queries: [`${itunesData.trackName} by ${itunesData.artistName}`] } });
      if (error) throw error;
      const aiResult = Array.isArray(data) ? data[0] : data;
      handleAutoSave({ name: itunesData.trackName, artist: itunesData.artistName, genre: itunesData.primaryGenreName, appleMusicUrl: itunesData.trackViewUrl, originalKey: aiResult?.originalKey, targetKey: aiResult?.originalKey, bpm: aiResult?.bpm?.toString(), pitch: 0, isMetadataConfirmed: true });
      setPitch(0);
      showSuccess(`Synced "${itunesData.trackName}"`);
    } catch (err) { showError("Pro Sync failed."); } finally { setIsProSyncing(false); }
  };

  const handleMagicFormatLyrics = async () => {
    if (!formData.lyrics?.trim()) return;
    setIsFormattingLyrics(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', { body: { queries: [formData.lyrics], mode: 'lyrics' } });
      if (error) throw error;
      if (data?.lyrics) { handleAutoSave({ lyrics: data.lyrics }); showSuccess("Formatted."); }
    } catch (err) { showError("Error."); } finally { setIsFormattingLyrics(false); }
  };

  const performYoutubeDiscovery = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    if (searchTerm.startsWith('http')) { handleAutoSave({ youtubeUrl: searchTerm }); return; }
    setIsSearchingYoutube(true);
    try {
      const proxies = ["https://api.allorigins.win/get?url=", "https://corsproxy.io/?"];
      const instances = ['https://iv.ggtyler.dev', 'https://yewtu.be'];
      let success = false;
      for (const proxy of proxies) {
        if (success) break;
        for (const instance of instances) {
          if (success) break;
          try {
            const res = await fetch(`${proxy}${encodeURIComponent(`${instance}/api/v1/search?q=${encodeURIComponent(searchTerm)}`)}`);
            if (!res.ok) continue;
            const raw = await res.json();
            const data = typeof raw.contents === 'string' ? JSON.parse(raw.contents) : raw;
            const videos = data?.filter?.((i: any) => i.type === "video").slice(0, 10);
            if (videos?.length > 0) {
              setYtResults(videos.map((v: any) => ({ videoId: v.videoId, title: v.title, author: v.author, videoThumbnails: v.videoThumbnails, duration: v.durationSeconds ? `${Math.floor(v.durationSeconds/60)}:${(v.durationSeconds%60).toString().padStart(2, '0')}` : '0:00', viewCountText: v.viewCountText })));
              success = true;
            }
          } catch (err) {}
        }
      }
    } finally { setIsSearchingYoutube(false); }
  };

  const handleYoutubeSearch = () => performYoutubeDiscovery(`${formData.artist} ${formData.name} official video`);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !user || !song) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const isAudio = ['mp3', 'wav', 'm4a'].includes(fileExt?.toLowerCase() || '');
      const fileName = `${user.id}/${song.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('public_assets').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('public_assets').getPublicUrl(fileName);
      if (isAudio) { handleAutoSave({ previewUrl: publicUrl }); await loadFromUrl(publicUrl, formData.pitch || 0); }
      else handleAutoSave({ pdfUrl: publicUrl });
      showSuccess("Linked.");
    } catch (err) { showError("Failed."); } finally { setIsUploading(false); }
  };

  const currentKeyPreference = formData.key_preference || globalPreference;
  const keysToUse = currentKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;
  const readiness = useMemo(() => calculateReadiness(formData), [formData]);
  const readinessColor = readiness === 100 ? 'bg-emerald-500' : readiness > 60 ? 'bg-indigo-500' : 'bg-slate-500';

  useEffect(() => {
    if (song && isOpen) {
      setFormData({ ...song, originalKey: song.originalKey || "C", targetKey: song.targetKey || "C", pitch: song.pitch || 0, isKeyLinked: song.isKeyLinked ?? true });
      if (song.previewUrl) loadFromUrl(song.previewUrl, song.pitch || 0);
    }
    return () => { resetEngine(); stopMetronome(); };
  }, [song?.id, isOpen]);

  const addToPublicRepertoire = () => { if (song) onSave(song.id, { is_active: true }); setIsInRepertoire(true); };
  const currentVideoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] || null : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("max-w-[95vw] w-[1400px] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white md:rounded-[2rem] z-[200]", isMobile ? "w-full h-[100dvh] rounded-none" : "")} onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-50 overflow-hidden md:rounded-t-[2rem]"><div className={cn("h-full transition-all duration-1000", readinessColor)} style={{ width: `${readiness}%` }} /></div>
        {(isUploading || isProSyncing || isCloudSyncing || isSyncingAudio) && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4">
             {engineError ? (
                <div className="max-w-md bg-slate-900 border border-red-500/30 p-8 rounded-[2rem] shadow-2xl text-center space-y-6 animate-in zoom-in-95">
                   <div className="bg-red-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-red-500"><AlertTriangle className="w-8 h-8" /></div>
                   <div className="space-y-2"><p className="text-lg font-black uppercase text-white">Integrity Block</p><p className="text-xs text-slate-400 font-medium">{engineError}</p></div>
                   <div className="pt-2 flex flex-col gap-3"><Button onClick={() => setEngineError(null)} className="bg-white/5 text-white font-black uppercase text-[10px] h-11 rounded-xl">Dismiss</Button></div>
                </div>
             ) : (
               <>
                 <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                 <div className="text-center space-y-2 px-6"><p className="text-sm font-black uppercase text-white">{isSyncingAudio ? (syncStatus || 'Extracting...') : 'Syncing...'}</p></div>
               </>
             )}
          </div>
        )}
        <div className={cn("flex overflow-hidden", isMobile ? "flex-col h-[100dvh]" : "h-[90vh] min-h-[800px]")}>
          {!isMobile && (
            <div className="w-96 bg-slate-900/50 border-r border-white/5 flex flex-col shrink-0">
              <div className="p-8 border-b border-white/5 bg-black/20">
                <div className="flex items-center justify-between mb-4"><div className="bg-indigo-600 p-1.5 rounded-lg"><Activity className="w-5 h-5 text-white" /></div><span className="text-[9px] font-black font-mono text-slate-400 uppercase">{readiness}% READY</span></div>
                <h2 className="text-3xl font-black uppercase tracking-tight leading-none mb-1 truncate">{formData.name}</h2>
                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest truncate">{formData.artist}</p>
                <div className="flex flex-col gap-2 mt-6">
                  <Button onClick={handleProSync} className={cn("w-full font-black uppercase text-[10px] h-10 rounded-xl shadow-lg gap-2", formData.isMetadataConfirmed ? "bg-emerald-600" : "bg-indigo-600")}>{formData.isMetadataConfirmed ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />} {formData.isMetadataConfirmed ? "SYNCED" : "PRO SYNC"}</Button>
                  <Button onClick={addToPublicRepertoire} disabled={isInRepertoire} className="w-full font-black uppercase text-[10px] h-10 rounded-xl gap-2 bg-white/5 text-white border border-white/10">{isInRepertoire ? <Check className="w-4 h-4" /> : <ListPlus className="w-4 h-4" />} {isInRepertoire ? "IN PUBLIC LIST" : "ADD TO PUBLIC"}</Button>
                </div>
              </div>
              <div className="flex-1 p-8 space-y-10 overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex justify-between"><Label className="text-[9px] font-bold text-slate-400 uppercase">Original Key</Label><button onClick={() => updateHarmonics({ isKeyConfirmed: !formData.isKeyConfirmed })} className={cn("p-1.5 rounded-lg border", formData.isKeyConfirmed ? "bg-emerald-600 border-emerald-500" : "bg-white/5 border-white/10")}><Check className="w-3.5 h-3.5" /></button></div>
                  <Select value={formatKey(formData.originalKey || "C", currentKeyPreference)} onValueChange={(val) => updateHarmonics({ originalKey: val })}><SelectTrigger className="bg-white/5 border-white/10 font-bold font-mono h-12 text-lg"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">{keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}</SelectContent></Select>
                  <Label className="text-[9px] font-bold text-indigo-400 uppercase">Stage Key</Label>
                  <Select value={formatKey(formData.targetKey || formData.originalKey || "C", currentKeyPreference)} onValueChange={(val) => { updateHarmonics({ targetKey: val }); if (song) onUpdateKey(song.id, val); }}><SelectTrigger className={cn("border-none text-white font-bold font-mono h-12 shadow-xl text-lg", formData.isKeyConfirmed ? "bg-emerald-600" : "bg-indigo-600")}><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">{keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 flex flex-col min-w-0">
            <div className={cn("border-b border-white/5 flex items-center bg-black/20 shrink-0", isMobile ? "h-16 px-4 overflow-x-auto" : "h-20 px-12 justify-between")}>
              <div className="flex gap-12">{tabOrder.map((tab) => (<button key={tab} onClick={() => setActiveTab(tab)} className={cn("text-xs font-black uppercase tracking-[0.4em] transition-all border-b-4 h-20", activeTab === tab ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent")}>{tab.toUpperCase()}</button>))}</div>
              {!isMobile && <Button variant="ghost" onClick={onClose} className="text-slate-400 font-black uppercase text-xs">Close Studio</Button>}
            </div>
            <div className={cn("flex-1 overflow-y-auto", isMobile ? "p-4" : "p-12")}>
              {activeTab === 'audio' && (
                <div className="space-y-12 animate-in fade-in">
                  <div className="flex justify-between items-center"><div><h3 className="text-lg font-black uppercase tracking-[0.2em] text-indigo-400">Audio Transposition Matrix</h3><p className="text-sm text-slate-500">Real-time pitch processing.</p></div><Button onClick={handleYoutubeSearch} disabled={isSearchingYoutube} className="bg-red-600 text-white font-black uppercase text-[9px] h-10 gap-2 px-6 rounded-xl">{isSearchingYoutube ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Youtube className="w-3.5 h-3.5" />} Discovery</Button></div>
                  <div className="bg-slate-900/50 p-12 rounded-[3rem] border border-white/5 space-y-12">
                    <div className="h-40"><AudioVisualizer analyzer={analyzer} isActive={isPlaying} /></div>
                    {formData.previewUrl ? (<><Slider value={[progress]} max={100} step={0.1} onValueChange={([v]) => setProgress(v)} /><div className="flex items-center justify-center gap-12"><Button variant="ghost" onClick={stopPlayback} className="h-20 w-20 rounded-full"><RotateCcw /></Button><Button onClick={togglePlayback} className="h-32 w-32 rounded-full bg-indigo-600"><Pause /></Button><div className="h-20 w-20" /></div></>) : (<div className="text-center py-12"><Music className="w-12 h-12 mx-auto text-slate-800" /><p className="mt-4 text-slate-500 uppercase font-black">Audio Engine Offline</p></div>)}
                  </div>
                  <div className="grid grid-cols-2 gap-10">
                    <div className="p-10 bg-white/5 rounded-[2.5rem] space-y-6"><Label className="text-[10px] font-black uppercase text-slate-500">Pitch Processor</Label><div className="flex justify-between"><span className="text-lg font-mono font-black text-indigo-400">{pitch} ST</span><div className="flex gap-2"><button onClick={() => handleOctaveShift('down')} className="text-xs font-black uppercase">- oct</button><button onClick={() => handleOctaveShift('up')} className="text-xs font-black uppercase">+ oct</button></div></div><Slider value={[pitch]} min={-24} max={24} step={1} onValueChange={(v) => { setPitch(v[0]); handleAutoSave({ pitch: v[0] }); }} /></div>
                    <div className="p-10 bg-white/5 rounded-[2.5rem] space-y-6"><Label className="text-[10px] font-black uppercase text-slate-500">Tempo Stretch</Label><span className="text-lg font-mono font-black text-indigo-400">{tempo.toFixed(2)}x</span><Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={([v]) => setTempo(v)} /></div>
                  </div>
                </div>
              )}
              {activeTab === 'visual' && (
                <div className="space-y-10 animate-in fade-in h-full flex flex-col">
                  <div className="flex gap-4"><Input placeholder="Paste YouTube URL..." value={formData.youtubeUrl} onChange={(e) => handleAutoSave({ youtubeUrl: e.target.value })} className="bg-slate-900 border-white/10 h-14 rounded-xl" /><Button onClick={() => handleSyncYoutubeAudio()} disabled={isSyncingAudio} className="bg-indigo-600 h-14 px-8 rounded-xl font-black uppercase text-[10px]">EXTRACT AUDIO</Button></div>
                  <div className="flex-1 bg-slate-900 rounded-[2.5rem] border-4 border-white/5 overflow-hidden">{currentVideoId ? <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${currentVideoId}`} frameBorder="0" allowFullScreen /> : <div className="h-full flex items-center justify-center opacity-20"><Youtube className="w-32 h-32" /></div>}</div>
                </div>
              )}
              {activeTab === 'details' && (<div className="space-y-10 animate-in fade-in"><div className="grid grid-cols-2 gap-10"><StudioInput label="Title" value={formData.name} onChange={(v:any) => handleAutoSave({name:v})} /><StudioInput label="Artist" value={formData.artist} onChange={(v:any) => handleAutoSave({artist:v})} /></div><StudioInput label="Notes" isTextarea value={formData.notes} onChange={(v:any) => handleAutoSave({notes:v})} className="min-h-[300px] rounded-[2rem]" /></div>)}
              {activeTab === 'lyrics' && (<div className="h-full flex flex-col gap-6 animate-in fade-in"><div className="flex justify-end gap-4"><Button variant="outline" onClick={handleMagicFormatLyrics} className="gap-2"><Sparkles className="w-4 h-4" /> Format</Button></div><StudioInput isTextarea value={formData.lyrics} onChange={(v:any) => handleAutoSave({lyrics:v})} className="flex-1 rounded-[2.5rem]" /></div>)}
            </div>
          </div>
        </div>
      </DialogContent>
      <ProSyncSearch isOpen={isProSyncSearchOpen} onClose={() => setIsProSyncSearchOpen(false)} onSelect={handleSelectProSync} initialQuery={`${formData.artist} ${formData.name}`} />
    </Dialog>
  );
};

export default SongStudioModal;
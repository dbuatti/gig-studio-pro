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
  AlertTriangle, Wrench, Monitor, Anchor
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

const StudioInput = memo(({ label, value, onChange, placeholder, className, isTextarea = false, type = "text" }: any) => {
  const [localValue, setLocalValue] = useState(value || "");
  useEffect(() => { setLocalValue(value || ""); }, [value]);
  const handleChange = (val: string) => { setLocalValue(val); onChange(val); };
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
  onPerform 
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
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug' | 'chords'>('pdf');

  const { 
    isPlaying, progress, duration, pitch, tempo, volume, fineTune, analyzer, currentBuffer,
    setPitch, setTempo, setVolume, setFineTune, setProgress,
    loadFromUrl, togglePlayback, stopPlayback, resetEngine
  } = audio;

  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const metronomeSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const metronomeLoopRef = useRef<Tone.Loop | null>(null);

  const tabOrder: StudioTab[] = ['audio', 'details', 'charts', 'lyrics', 'visual', 'library'];

  useEffect(() => {
    if (isOpen && user) {
      fetchYtKey();
    }
  }, [isOpen, user]);

  const fetchYtKey = async () => {
    const { data } = await supabase.from('profiles').select('youtube_api_key').eq('id', user?.id).single();
    if (data?.youtube_api_key) setYtApiKey(data.youtube_api_key);
  };

  const currentKeyPreference = formData.key_preference || globalPreference;
  const keysToUse = currentKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;
  const readiness = useMemo(() => calculateReadiness(formData), [formData]);
  const readinessColor = readiness === 100 ? 'bg-emerald-500' : readiness > 60 ? 'bg-indigo-500' : 'bg-slate-500';

  const currentVideoId = useMemo(() => {
    if (!formData.youtubeUrl) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = formData.youtubeUrl.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }, [formData.youtubeUrl]);

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
    if (!formData.bpm) { showError("Set a BPM first."); return; }
    if (isMetronomeActive) { stopMetronome(); } else {
      if (Tone.getContext().state !== 'running') await Tone.start();
      if (!metronomeSynthRef.current) {
        metronomeSynthRef.current = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, oscillator: { type: "sine" } }).toDestination();
      }
      const bpmValue = parseInt(formData.bpm);
      if (isNaN(bpmValue) || bpmValue <= 0) return;
      Tone.getTransport().bpm.value = bpmValue;
      if (!metronomeLoopRef.current) {
        metronomeLoopRef.current = new Tone.Loop((time) => { metronomeSynthRef.current?.triggerAttackRelease("C4", "32n", time); }, "4n").start(0);
      } else { metronomeLoopRef.current.start(0); }
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
      showSuccess(`Analysis complete.`);
    } catch (err) { showError("Key detection failed."); } finally { setIsDetectingKey(false); }
  };

  const handleSyncYoutubeAudio = async (videoUrl?: string) => {
    const targetUrl = videoUrl || formData.youtubeUrl;
    if (!targetUrl || !user || !song) { showError("Paste a YouTube URL first."); return; }
    const cleanedUrl = cleanYoutubeUrl(targetUrl);
    const apiBase = "https://yt-audio-api-docker.onrender.com"; 
    setIsSyncingAudio(true);
    setSyncStatus("Initializing...");
    try {
      const tokenUrl = `${apiBase}/?url=${encodeURIComponent(cleanedUrl)}`;
      const tokenRes = await fetch(tokenUrl);
      const errBody = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok) throw new Error(errBody.detail || tokenRes.statusText);
      const { token } = errBody;
      setSyncStatus("Extracting...");
      const downloadRes = await fetch(`${apiBase}/download?token=${token}`);
      if (!downloadRes.ok) throw new Error("Source failed.");
      const blob = await downloadRes.blob();
      setSyncStatus("Syncing...");
      const fileName = `${user.id}/${song.id}/extracted-${Date.now()}.mp3`;
      const { error: uploadError } = await supabase.storage.from('public_assets').upload(fileName, blob, { contentType: 'audio/mpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('public_assets').getPublicUrl(fileName);
      handleAutoSave({ previewUrl: publicUrl, youtubeUrl: cleanedUrl });
      await loadFromUrl(publicUrl, formData.pitch || 0);
      showSuccess("Audio Linked");
    } catch (err: any) { showError(err.message || "Engine offline."); } finally { setIsSyncingAudio(false); setSyncStatus(""); }
  };

  const updateHarmonics = (updates: Partial<SetlistSong>) => {
    if (!song) return;
    setFormData(prev => {
      const next = { ...prev, ...updates };
      if (next.isKeyLinked) {
        const diff = calculateSemitones(next.originalKey || "C", next.targetKey || "C");
        next.pitch = diff;
        setPitch(next.pitch);
      }
      onSave(song.id, next);
      return next;
    });
  };

  const handleProSync = async () => setIsProSyncSearchOpen(true);

  const handleSelectProSync = async (itunesData: any) => {
    setIsProSyncSearchOpen(false);
    setIsProSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', { body: { queries: [`${itunesData.trackName} by ${itunesData.artistName}`] } });
      if (error) throw error;
      const aiResult = Array.isArray(data) ? data[0] : data;
      handleAutoSave({
        name: itunesData.trackName, artist: itunesData.artistName, genre: itunesData.primaryGenreName,
        appleMusicUrl: itunesData.trackViewUrl, isMetadataConfirmed: true,
        originalKey: aiResult?.originalKey || formData.originalKey,
        targetKey: aiResult?.originalKey || formData.targetKey,
        bpm: aiResult?.bpm?.toString() || formData.bpm, pitch: 0
      });
      setPitch(0);
      showSuccess(`Synced "${itunesData.trackName}"`);
    } catch (err) { showError("Pro Sync failed."); } finally { setIsProSyncing(false); }
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
      const fileName = `${user.id}/${song.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('public_assets').upload(fileName, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('public_assets').getPublicUrl(fileName);
      if (isAudio) {
        handleAutoSave({ previewUrl: publicUrl });
        await loadFromUrl(publicUrl, formData.pitch || 0);
      } else { handleAutoSave({ pdfUrl: publicUrl }); }
      showSuccess("Asset Linked");
    } catch (err: any) { showError("Upload failed."); } finally { setIsUploading(false); }
  };

  useEffect(() => {
    if (song && isOpen) {
      setFormData({
        name: song.name, artist: song.artist, bpm: song.bpm, originalKey: song.originalKey || "C",
        targetKey: song.targetKey || "C", notes: song.notes, lyrics: song.lyrics,
        youtubeUrl: song.youtubeUrl, previewUrl: song.previewUrl, appleMusicUrl: song.appleMusicUrl,
        pdfUrl: song.pdfUrl, leadsheetUrl: song.leadsheetUrl, ugUrl: song.ugUrl,
        chord_content: song.chord_content || "", preferred_view: song.preferred_view || 'visualizer',
        resources: song.resources || [], pitch: song.pitch || 0, user_tags: song.user_tags || [],
        isKeyLinked: song.isKeyLinked ?? true, isKeyConfirmed: song.isKeyConfirmed ?? false,
        duration_seconds: song.duration_seconds || 0, key_preference: song.key_preference,
        isMetadataConfirmed: song.isMetadataConfirmed, master_id: song.master_id,
        is_confirmed_for_set: song.is_confirmed_for_set
      });
      setActiveChartType(song.preferred_view === 'chords' ? 'chords' : 'pdf');
      resetEngine();
      if (song.previewUrl) loadFromUrl(song.previewUrl, song.pitch || 0);
    }
  }, [song?.id, isOpen]);

  const renderSidebarContent = () => (
    <div className="flex-1 p-6 md:p-8 space-y-8 md:space-y-10 overflow-y-auto custom-scrollbar">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Stage Configuration</Label>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleAutoSave({ is_confirmed_for_set: !formData.is_confirmed_for_set })}
                    className={cn(
                      "p-1.5 rounded-lg border transition-all flex items-center gap-2 px-3",
                      formData.is_confirmed_for_set ? "bg-emerald-600 border-emerald-500 text-white shadow-lg" : "bg-white/5 border-white/10 text-slate-500"
                    )}
                  >
                    <Anchor className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase">{formData.is_confirmed_for_set ? "Confirmed" : "Tentative"}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px] font-black uppercase">Only Confirmed + Audio tracks count toward Goal Time</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-[9px] font-bold text-slate-400 uppercase">Default Stage View</Label>
          <Select 
            value={formData.preferred_view || 'visualizer'} 
            onValueChange={(val: any) => handleAutoSave({ preferred_view: val })}
          >
            <SelectTrigger className="bg-white/5 border-white/10 text-xs font-bold uppercase tracking-widest h-10">
              <SelectValue placeholder="Select Default View" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
              <SelectItem value="visualizer" className="text-[10px] font-black">MATRIX (VISUALIZER)</SelectItem>
              <SelectItem value="lyrics" className="text-[10px] font-black">TELEPROMPTER (LYRICS)</SelectItem>
              <SelectItem value="pdf" className="text-[10px] font-black">CHART (PDF)</SelectItem>
              <SelectItem value="leadsheet" className="text-[10px] font-black">LEADSHEET (IMAGE/PDF)</SelectItem>
              <SelectItem value="chords" className="text-[10px] font-black">PRO CHORDS (CLIPBOARD)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Harmonic Engine</Label>
        <div className="grid grid-cols-1 gap-4">
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
        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Custom Tags</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {(formData.user_tags || []).map(t => (
            <Badge key={t} variant="secondary" className="bg-white/5 text-indigo-300 border-white/10 px-3 py-1.5 gap-2 text-[10px] font-bold uppercase rounded-lg">
              {t} <button onClick={() => {
                const updated = (formData.user_tags || []).filter(tag => tag !== t);
                handleAutoSave({ user_tags: updated });
              }}><X className="w-3 h-3 hover:text-white" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (newTag.trim() && handleAutoSave({ user_tags: [...(formData.user_tags || []), newTag.trim()] }), setNewTag(""))}
            className="h-10 text-xs bg-white/5 border-white/10 font-bold uppercase"
          />
          <Button size="icon" variant="ghost" className="h-10 w-10 bg-white/5" onClick={() => (newTag.trim() && handleAutoSave({ user_tags: [...(formData.user_tags || []), newTag.trim()] }), setNewTag(""))}><Tag className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("max-w-[95vw] w-[1400px] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white md:rounded-[2rem] z-[200]", isMobile ? "w-full max-w-none h-[100dvh] max-h-none rounded-none" : "")} onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-50 overflow-hidden md:rounded-t-[2rem]">
          <div className={cn("h-full transition-all duration-1000", readinessColor)} style={{ width: `${readiness}%` }} />
        </div>
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-indigo-600/20 backdrop-blur-sm border-4 border-dashed border-indigo-500 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-indigo-400 animate-bounce" />
              <p className="text-xl font-black uppercase tracking-tighter">Drop Audio or PDF to Link</p>
            </div>
          </div>
        )}
        {(isUploading || isProSyncing || isCloudSyncing || isSyncingAudio) && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4">
             <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
             <p className="text-sm font-black uppercase tracking-[0.2em] text-white">{isUploading ? 'Syncing...' : isSyncingAudio ? (syncStatus || 'Extracting...') : 'Processing...'}</p>
          </div>
        )}
        <div className={cn("flex overflow-hidden", isMobile ? "flex-col h-[100dvh]" : "h-[90vh] min-h-[800px]")}>
          {!isMobile && (
            <div className="w-96 bg-slate-900/50 border-r border-white/5 flex flex-col shrink-0">
              <div className="p-8 border-b border-white/5 bg-black/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><div className="bg-indigo-600 p-1.5 rounded-lg"><Activity className="w-5 h-5 text-white" /></div><span className="font-black uppercase tracking-tighter text-xs">Studio Engine</span></div>
                  <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-full border border-white/10"><div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", readinessColor)} /><span className="text-[9px] font-black font-mono text-slate-400">{readiness}% READY</span></div>
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tight leading-none mb-1 truncate">{formData.name || ""}</h2>
                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest truncate">{formData.artist || "Unknown Artist"}</p>
                <div className="flex flex-col gap-2 mt-6">
                  <Button onClick={handleProSync} className={cn("w-full font-black uppercase tracking-[0.2em] text-[10px] h-10 rounded-xl shadow-lg gap-2 transition-all active:scale-95", formData.isMetadataConfirmed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700")}>{formData.isMetadataConfirmed ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />} {formData.isMetadataConfirmed ? "SYNCED" : "PRO SYNC"}</Button>
                </div>
              </div>
              {renderSidebarContent()}
            </div>
          )}
          <div className="flex-1 flex flex-col min-w-0">
            <div className={cn("border-b border-white/5 flex items-center bg-black/20 shrink-0", isMobile ? "h-16 px-4 overflow-x-auto no-scrollbar" : "h-20 px-12 justify-between")}>
              <div className={cn("flex", isMobile ? "gap-4 min-w-max" : "gap-12")}>
                {tabOrder.map((tab, idx) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={cn("text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-4 flex flex-col items-center justify-center gap-1", isMobile ? "h-16 px-2" : "text-xs tracking-[0.4em] h-20", activeTab === tab ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white")}>
                    <span className="flex items-center gap-1.5">{tab.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className={cn("flex-1 overflow-y-auto p-12 custom-scrollbar")}>
              {activeTab === 'audio' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black uppercase tracking-[0.2em] text-indigo-400">Audio Transposition Matrix</h3>
                  </div>
                  <div className="bg-slate-900/50 border border-white/5 p-12 rounded-[3rem] space-y-12">
                    <div className="h-40"><AudioVisualizer analyzer={analyzer} isActive={isPlaying} /></div>
                    {formData.previewUrl ? (
                      <div className="space-y-8 text-center">
                        <Slider value={[progress]} max={100} step={0.1} onValueChange={([v]) => setProgress(v)} />
                        <div className="flex items-center justify-center gap-12">
                           <Button variant="ghost" size="icon" onClick={stopPlayback} className="h-20 w-20 rounded-full border border-white/5"><RotateCcw className="w-8 h-8" /></Button>
                           <Button size="lg" onClick={togglePlayback} className="h-32 w-32 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-2xl">{isPlaying ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12 ml-2 fill-current" />}</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 space-y-6 opacity-40">
                        <Music className="w-16 h-16 text-indigo-400" />
                        <p className="text-lg font-black uppercase tracking-tight">Audio Engine Offline</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-10 bg-white/5 border border-white/5 p-10 rounded-[2.5rem]">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase text-slate-500">Pitch Processor</Label><span className="text-lg font-mono font-black text-indigo-400">{(pitch || 0) > 0 ? '+' : ''}{pitch || 0} ST</span></div>
                        <Slider value={[pitch || 0]} min={-24} max={24} step={1} onValueChange={(v) => { const np = v[0]; setPitch(np); updateHarmonics({ pitch: np, targetKey: transposeKey(formData.originalKey, np) }); }} />
                      </div>
                    </div>
                    <div className="space-y-10 bg-white/5 border border-white/5 p-10 rounded-[2.5rem]">
                      <div className="space-y-6">
                        <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase text-slate-500">Tempo Stretch</Label><span className="text-lg font-mono font-black text-indigo-400">{tempo.toFixed(2)}x</span></div>
                        <Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={([v]) => setTempo(v)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'charts' && (
                <div className="h-full flex flex-col gap-8 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between shrink-0">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-[0.3em] text-emerald-400">Harmonic Chart Matrix</h3>
                      <p className="text-sm text-slate-500 mt-1">Designate reading materials for the stage.</p>
                    </div>
                    <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
                      <Button variant="ghost" onClick={() => setActiveChartType('pdf')} className={cn("text-[10px] font-black uppercase h-9 px-4 rounded-lg", activeChartType === 'pdf' ? "bg-indigo-600 text-white" : "text-slate-500")}>PDF</Button>
                      <Button variant="ghost" onClick={() => setActiveChartType('chords')} className={cn("text-[10px] font-black uppercase h-9 px-4 rounded-lg", activeChartType === 'chords' ? "bg-indigo-600 text-white" : "text-slate-500")}>Pro Chords</Button>
                    </div>
                  </div>
                  {activeChartType === 'chords' ? (
                    <div className="flex-1 flex flex-col gap-4">
                       <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500">Pro Chord Importer (Paste Clipboard)</Label>
                       <Textarea 
                        placeholder="Paste Chord Pro or raw Ultimate Guitar content here..."
                        className="flex-1 bg-white/5 border-white/10 p-10 font-mono text-lg rounded-[2rem] resize-none focus:ring-orange-500/20"
                        value={formData.chord_content}
                        onChange={(e) => handleAutoSave({ chord_content: e.target.value })}
                       />
                    </div>
                  ) : (
                    <div className="flex-1 bg-slate-900 rounded-[3rem] border-4 border-white/5 shadow-2xl overflow-hidden relative">
                      {formData.pdfUrl ? (
                        <iframe src={`${formData.pdfUrl}#toolbar=0`} className="w-full h-full bg-white" title="Chart" />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center p-8 opacity-40"><FileSearch className="w-16 h-16 mb-4" /><h4 className="text-2xl font-black uppercase">No Chart Linked</h4></div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'details' && (
                <div className="space-y-10 animate-in fade-in duration-500">
                  <div className="grid grid-cols-2 gap-10">
                    <StudioInput label="Performance Title" value={formData.name} onChange={(val: string) => handleAutoSave({ name: val })} className="bg-white/5 border-white/10 text-2xl font-black h-16 rounded-2xl" />
                    <StudioInput label="Primary Artist" value={formData.artist} onChange={(val: string) => handleAutoSave({ artist: val })} className="bg-white/5 border-white/10 text-2xl font-black h-16 rounded-2xl" />
                  </div>
                  <StudioInput label="Rehearsal & Dynamics Notes" isTextarea value={formData.notes} onChange={(val: string) => handleAutoSave({ notes: val })} className="bg-white/5 border-white/10 text-lg leading-relaxed p-8 min-h-[350px] rounded-[2rem]" />
                </div>
              )}
              {activeTab === 'lyrics' && (
                <div className="space-y-10 animate-in fade-in duration-500 h-full flex flex-col">
                  <div className="flex items-center justify-between shrink-0">
                    <h3 className="text-lg font-black uppercase tracking-[0.3em] text-pink-400">Stage Teleprompter Source</h3>
                  </div>
                  <Textarea placeholder="Paste lyrics..." value={formData.lyrics} onChange={(e) => handleAutoSave({ lyrics: e.target.value })} className="flex-1 bg-white/5 border-white/10 text-xl leading-relaxed p-10 font-medium rounded-[2.5rem] resize-none h-full" />
                </div>
              )}
              {activeTab === 'visual' && (
                <div className="space-y-10 animate-in fade-in duration-500 h-full flex flex-col">
                  <div className="flex items-center justify-between shrink-0"><h3 className="text-2xl font-black uppercase tracking-tight text-indigo-400">REFERENCE MEDIA</h3></div>
                  <div className="flex gap-4 shrink-0">
                     <Input placeholder="Search master record..." value={formData.youtubeUrl} onChange={(e) => handleAutoSave({ youtubeUrl: e.target.value })} className="bg-slate-900 border-white/10 text-white h-14 px-6 rounded-xl" />
                     <Button onClick={() => handleSyncYoutubeAudio()} disabled={isSyncingAudio || !formData.youtubeUrl} className="bg-indigo-600 hover:bg-indigo-700 h-14 px-8 rounded-xl shadow-lg gap-3">EXTRACT AUDIO</Button>
                  </div>
                  <div className="flex-1 bg-slate-900 rounded-[2.5rem] border-4 border-white/5 shadow-2xl overflow-hidden relative">
                    {currentVideoId ? (
                      <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${currentVideoId}?modestbranding=1&rel=0`} title="Ref" frameBorder="0" allowFullScreen className="w-full h-full" />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-20"><Youtube className="w-32 h-32" /></div>
                    )}
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
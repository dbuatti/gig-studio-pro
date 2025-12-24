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
  Globe2, ShieldCheck, Timer, FileMusic, Copy, SearchCode, Cloud
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
import { useToneAudio } from '@/hooks/use-tone-audio';
import { detectKeyFromBuffer, KeyCandidate } from '@/utils/keyDetector';
import { cleanYoutubeUrl } from '@/utils/youtubeUtils';

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
  const [keyCandidates, setKeyCandidates] = useState<KeyCandidate[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFormattingLyrics, setIsFormattingLyrics] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isProSyncSearchOpen, setIsProSyncSearchOpen] = useState(false);
  const [isProSyncing, setIsProSyncing] = useState(false);
  const [isInRepertoire, setIsInRepertoire] = useState(false);
  
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');

  // Audio Engine State from hook
  const { 
    isPlaying, progress, duration, pitch, tempo, volume, fineTune, analyzer, currentBuffer,
    setPitch, setTempo, setVolume, setFineTune, setProgress,
    loadFromUrl, togglePlayback, stopPlayback, resetEngine
  } = audio;

  // Metronome State (separate from main audio engine)
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const metronomeSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const metronomeLoopRef = useRef<Tone.Loop | null>(null);

  const tabOrder: StudioTab[] = isMobile 
    ? ['audio', 'config', 'details', 'charts', 'lyrics', 'visual', 'library']
    : ['audio', 'details', 'charts', 'lyrics', 'visual', 'library'];

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

  // Mobile Swipe logic
  const touchStartX = useRef<number>(0);
  useEffect(() => {
    if (!isOpen || !isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const distance = touchEndX - touchStartX.current;
      
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
        showError("Cloud AI could not find definitive metadata for this track.");
      }
    } catch (err) {
      showError("Cloud Sync Error.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleSyncYoutubeAudio = async () => {
    if (!formData.youtubeUrl || !user || !song) {
      showError("Paste a YouTube URL first.");
      return;
    }

    const cleanedUrl = cleanYoutubeUrl(formData.youtubeUrl);
    const apiBase = "https://yt-audio-api-docker.onrender.com"; 

    setIsSyncingAudio(true);
    setSyncStatus("Initializing Engine...");
    
    try {
      // Small intentional delay to avoid immediate race conditions if server is cycling
      await new Promise(r => setTimeout(r, 2000));
      
      setSyncStatus("Waking up Render Service...");
      const tokenUrl = `${apiBase}/?url=${encodeURIComponent(cleanedUrl)}`;
      
      let tokenRes;
      try {
        tokenRes = await fetch(tokenUrl);
      } catch (e) {
        throw new Error("Render service is currently deploying or unreachable. Try again in 60s.");
      }
      
      if (!tokenRes.ok) {
        if (tokenRes.status === 500) {
          throw new Error("System cookies expired. Please use the Admin Panel to refresh YouTube cookies.");
        }
        throw new Error("Engine initialization failed. The service might be starting up.");
      }
      
      const { token } = await tokenRes.json();
      setSyncStatus("Extracting Audio Stream...");

      const downloadUrl = `${apiBase}/download?token=${token}`;
      const downloadRes = await fetch(downloadUrl);
      
      if (!downloadRes.ok) throw new Error("Audio extraction failed at the source.");
      const blob = await downloadRes.blob();

      setSyncStatus("Syncing to Cloud Vault...");
      const fileName = `${user.id}/${song.id}/extracted-${Date.now()}.mp3`;
      const bucket = 'public_assets';
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      handleAutoSave({ previewUrl: publicUrl });
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
    updateHarmonics({ 
      originalKey: key,
      isKeyConfirmed: true 
    });
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
    
    if (newPitch > 24 || newPitch < -24) {
      showError("Maximum transposition range reached.");
      return;
    }
    setFormData(prev => ({ ...prev, pitch: newPitch }));
    setPitch(newPitch);
    
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
      setPitch(0);
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
        await loadFromUrl(publicUrl, formData.pitch || 0);
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
      
      setKeyCandidates([]);
      checkRepertoireStatus();
      resetEngine();
      if (song.previewUrl) {
        loadFromUrl(song.previewUrl, song.pitch || 0);
      }
    }
    return () => {
      resetEngine();
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
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Harmonic Engine</Label>
          <TooltipProvider>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const nextPref = currentKeyPreference === 'sharps' ? 'flats' : 'sharps';
                      const updates: Partial<SetlistSong> = { key_preference: nextPref };
                      
                      if (formData.originalKey) {
                        updates.originalKey = formatKey(formData.originalKey, nextPref);
                      }
                      
                      if (formData.targetKey) {
                        const newTarget = formatKey(formData.targetKey, nextPref);
                        updates.targetKey = newTarget;
                        if (newTarget !== formData.targetKey && song) {
                          onUpdateKey(song.id, newTarget);
                        }
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
                <TooltipContent className="text-[10px] font-black uppercase">
                  Toggle Notation for this song
                </TooltipContent>
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
                <TooltipContent className="text-[10px] font-black uppercase">
                  {formData.isKeyConfirmed ? "Key is Verified" : "Confirm Stage Key"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => updateHarmonics({ isKeyLinked: !formData.isKeyLinked })}
                    className={cn(
                      "p-1.5 rounded-lg border transition-all",
                      formData.isKeyLinked ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-emerald-600/20" : "bg-white/5 border-white/10 text-slate-500"
                    )}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px] font-black uppercase">
                  {formData.isKeyLinked ? "Keys are Linked to Pitch" : "Pitch is Independent"}
                </TooltipContent>
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
      <div className="space-y-4">
        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Custom Tags</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {(formData.user_tags || []).map(t => (
            <Badge key={t} variant="secondary" className="bg-white/5 text-indigo-300 border-white/10 px-3 py-1.5 gap-2 text-[10px] font-bold uppercase rounded-lg">
              {t} <button onClick={() => removeTag(t)}><X className="w-3 h-3 hover:text-white" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            className="h-10 text-xs bg-white/5 border-white/10 font-bold uppercase"
          />
          <Button size="icon" variant="ghost" className="h-10 w-10 bg-white/5" onClick={addTag}><Tag className="w-4 h-4" /></Button>
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
        {previewPdfUrl && (
          <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-xl animate-in fade-in zoom-in duration-300 flex flex-col p-6 md:p-12">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">Stage Chart Preview</h3>
              <Button variant="ghost" size="icon" onClick={() => setPreviewPdfUrl(null)} className="h-10 w-10 md:h-12 md:w-12 rounded-full hover:bg-white/10">
                <X className="w-6 h-6 md:w-8 md:h-8" />
              </Button>
            </div>
            {isFramable(previewPdfUrl) ? (
              <iframe
                src={`${previewPdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                className="flex-1 w-full rounded-2xl bg-white"
                title="PDF Preview"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 rounded-2xl border border-white/5 p-6 text-center">
                <ShieldCheck className="w-12 h-12 md:w-16 md:h-16 text-indigo-400 mb-6" />
                <h4 className="text-xl md:text-2xl font-black uppercase mb-4 text-white">External Protection</h4>
                <p className="text-slate-500 mb-8 max-w-sm font-medium">This external provider blocks in-app previews. Use the button below to launch in a secure dedicated performance window.</p>
                <Button onClick={() => window.open(previewPdfUrl, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-indigo-600/20 gap-3">
                  <ExternalLink className="w-4 h-4" /> Open Official Source
                </Button>
              </div>
            )}
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
        {(isUploading || isProSyncing || isCloudSyncing || isSyncingAudio) && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4">
             <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
             <div className="text-center space-y-2">
               <p className="text-sm font-black uppercase tracking-[0.2em] text-white">
                 {isUploading ? 'Syncing Master Asset...' : 
                  isSyncingAudio ? (syncStatus || 'Extracting High-Fidelity Audio...') :
                  isCloudSyncing ? 'Accessing Cloud Knowledge Base...' : 
                  'Analyzing Global Library Data...'}
               </p>
               {isSyncingAudio && <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 animate-pulse">Stay in this window</p>}
             </div>
          </div>
        )}
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
                      formData.isMetadataConfirmed
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
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
                      isInRepertoire
                        ? "bg-emerald-600/10 text-emerald-400 border border-emerald-600/20"
                        : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    )}
                  >
                    {isInRepertoire ? <Check className="w-4 h-4" /> : <ListPlus className="w-4 h-4" />}
                    {isInRepertoire ? "IN PUBLIC REPERTOIRE" : "ADD TO PUBLIC LIST"}
                  </Button>
                </div>
              </div>
              {renderSidebarContent()}
              <div className="p-6 border-t border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-600 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Live Sync: ON
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleProSync}
                  className="h-6 px-2 text-[8px] font-black uppercase text-indigo-400 hover:text-indigo-300"
                >
                  PRO V2.5-AUTO
                </Button>
              </div>
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
                    {!isMobile && <span className="text-[8px] font-mono opacity-40 font-bold tracking-normal">⌘{idx + 1}</span>}
                  </button>
                ))}
              </div>
              {!isMobile && (
                <div className="flex items-center gap-6">
                   <div className="h-10 w-px bg-white/5" />
                   <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white font-black uppercase tracking-[0.3em] text-xs">Close Studio</Button>
                </div>
              )}
            </div>
            <div className={cn("flex-1 overflow-y-auto relative flex flex-col", isMobile ? "p-4" : "p-12")}>
              {activeTab === 'config' && isMobile && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
                    <h2 className="text-2xl font-black uppercase tracking-tight">{formData.name}</h2>
                    <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">{formData.artist}</p>
                    
                    <div className="flex flex-col gap-2 mt-4">
                      <Button
                        onClick={handleProSync}
                        className={cn(
                          "w-full font-black uppercase tracking-[0.2em] text-[10px] h-11 rounded-xl shadow-lg gap-2",
                          formData.isMetadataConfirmed ? "bg-emerald-600" : "bg-indigo-600"
                        )}
                      >
                        {formData.isMetadataConfirmed ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        {formData.isMetadataConfirmed ? "SYNCED" : "PRO SYNC"}
                      </Button>
                      <Button
                        onClick={addToPublicRepertoire}
                        disabled={isInRepertoire}
                        className={cn(
                          "w-full font-black uppercase tracking-[0.2em] text-[10px] h-11 rounded-xl gap-2",
                          isInRepertoire ? "bg-emerald-600/10 text-emerald-400" : "bg-white/5 text-white"
                        )}
                      >
                        {isInRepertoire ? <Check className="w-4 h-4" /> : <ListPlus className="w-4 h-4" />}
                        {isInRepertoire ? "IN REPERTOIRE" : "ADD TO PUBLIC"}
                      </Button>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-3xl border border-white/5 p-2">
                    {renderSidebarContent(true)}
                  </div>
                </div>
              )}
              {activeTab === 'audio' && (
                <div className={cn("space-y-6 md:space-y-12 animate-in fade-in duration-500")}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 md:gap-6">
                      <div>
                        <h3 className="text-sm md:text-lg font-black uppercase tracking-[0.2em] text-indigo-400">Audio Transposition Matrix</h3>
                        <p className="text-xs md:text-sm text-slate-500 mt-1 md:mt-2">Real-time pitch and time-stretching processing.</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleYoutubeSearch}
                      className="bg-red-600/10 border-red-600/20 text-red-600 hover:bg-red-600 hover:text-white font-black uppercase tracking-widest text-[9px] h-10 gap-2 px-4 md:px-6 rounded-xl min-w-[140px]"
                    >
                      <Youtube className="w-3.5 h-3.5" /> Discovery
                    </Button>
                  </div>
                  <div className={cn("bg-slate-900/50 border border-white/5 space-y-6 md:space-y-12", isMobile ? "p-6 rounded-3xl" : "p-12 rounded-[3rem]")}>
                    <div className={cn(isMobile ? "h-24" : "h-40")}>
                      <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
                    </div>
                    
                    {formData.previewUrl ? (
                      <>
                        <div className="space-y-4 md:space-y-8">
                          <div className="flex justify-between text-[10px] md:text-xs font-mono font-black text-slate-500 uppercase tracking-widest">
                            <span className="text-indigo-400">{new Date((progress/100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                            <span className="hidden md:inline">Transport Master Clock</span>
                            <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
                          </div>
                          <Slider value={[progress]} max={100} step={0.1} onValueChange={([v]) => setProgress(v)} />
                        </div>
                        <div className="flex items-center justify-center gap-8 md:gap-12">
                           <Button variant="ghost" size="icon" onClick={stopPlayback} className="h-12 w-12 md:h-20 md:w-20 rounded-full border border-white/5">
                             <RotateCcw className="w-5 h-5 md:w-8 md:h-8" />
                           </Button>
                           <Button
                             size="lg"
                             onClick={togglePlayback}
                             className="h-20 w-20 md:h-32 md:w-32 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-2xl"
                           >
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
                        <div className="text-center space-y-2">
                           <p className="text-base md:text-lg font-black uppercase tracking-tight">Audio Engine Offline</p>
                           <p className="text-xs md:text-sm text-slate-500 max-w-sm px-4">Upload a master file or discover a version on YouTube to start transposing.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={cn("bg-slate-900 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6", isMobile ? "p-6 rounded-3xl" : "p-8 rounded-[2.5rem]")}>
                     <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Library Metadata</span>
                           <div className="flex items-center gap-8 mt-2">
                             <div className="flex flex-col">
                               <span className="text-[8px] font-black text-slate-500 uppercase">Tempo</span>
                               <div className="flex items-center gap-3">
                                 <Input
                                   value={formData.bpm || ""}
                                   onChange={(e) => handleAutoSave({ bpm: e.target.value })}
                                   className="bg-transparent border-none p-0 h-auto text-xl md:text-2xl font-black font-mono text-indigo-400 focus-visible:ring-0 w-16"
                                 />
                                 <Button
                                   variant="ghost"
                                   size="icon"
                                   onClick={toggleMetronome}
                                   className={cn(
                                     "h-8 w-8 rounded-lg transition-all",
                                     isMetronomeActive ? "bg-indigo-600 text-white shadow-lg" : "bg-white/5 text-slate-400"
                                   )}
                                 >
                                   {isMetronomeActive ? <Volume2 className="w-4 h-4 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
                                 </Button>
                               </div>
                             </div>

                             <div className="h-10 w-px bg-white/5" />

                             <div className="flex flex-col">
                               <span className="text-[8px] font-black text-slate-500 uppercase">Detection Result Choice</span>
                               {keyCandidates.length > 0 ? (
                                 <div className="flex flex-wrap items-center gap-2 mt-1">
                                    {keyCandidates.map((c, i) => (
                                      <Button 
                                        key={i}
                                        onClick={() => confirmCandidateKey(c.key)}
                                        className={cn(
                                          "h-8 px-3 text-[10px] font-black uppercase rounded-lg gap-2 transition-all",
                                          i === 0 ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-white/5 hover:bg-white/10 text-slate-400"
                                        )}
                                      >
                                        {c.key} <span className="opacity-50 text-[8px] font-mono">{c.confidence}%</span>
                                      </Button>
                                    ))}
                                 </div>
                               ) : (
                                 <span className="text-xl md:text-2xl font-black font-mono text-slate-700">--</span>
                               )}
                             </div>
                           </div>
                        </div>

                        <div className="flex flex-wrap gap-2 md:gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDetectBPM}
                            disabled={isAnalyzing || !formData.previewUrl}
                            className="flex-1 md:flex-none h-10 px-4 bg-indigo-600/10 text-indigo-400 font-black uppercase tracking-widest text-[9px] gap-2 rounded-xl"
                          >
                            {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Disc className="w-3.5 h-3.5" />}
                            Scan BPM
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDetectKey}
                            disabled={isDetectingKey || !formData.previewUrl}
                            className="flex-1 md:flex-none h-10 px-4 bg-emerald-600/10 text-emerald-400 font-black uppercase tracking-widest text-[9px] gap-2 rounded-xl"
                          >
                            {isDetectingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SearchCode className="w-3.5 h-3.5" />}
                            Analyse Key
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCloudKeySync}
                            disabled={isCloudSyncing}
                            className="flex-1 md:flex-none h-10 px-4 bg-white/5 text-white font-black uppercase tracking-widest text-[9px] gap-2 rounded-xl border border-white/10 hover:bg-white/10"
                          >
                            {isCloudSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5 text-indigo-400" />}
                            Cloud Sync
                          </Button>
                        </div>
                     </div>
                  </div>

                  <div className={cn("grid gap-6 md:gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div className={cn("space-y-6 md:space-y-10 bg-white/5 border border-white/5", isMobile ? "p-6 rounded-3xl" : "p-10 rounded-[2.5rem]")}>
                      <div className="space-y-4 md:space-y-6">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pitch Processor</Label>
                          <div className="flex items-center gap-2 md:gap-3">
                            <span className="text-sm md:text-lg font-mono font-black text-indigo-400">{(pitch || 0) > 0 ? '+' : ''}{pitch || 0} ST</span>
                            <div className="flex bg-white/5 rounded-lg border border-white/10 p-0.5">
                              <button onClick={() => handleOctaveShift('down')} className="h-7 px-2 text-[8px] md:text-[10px] font-black uppercase text-slate-400 border-r border-white/5">- oct</button>
                              <button onClick={() => handleOctaveShift('up')} className="h-7 px-2 text-[8px] md:text-[10px] font-black uppercase text-slate-400">+ oct</button>
                            </div>
                          </div>
                        </div>
                        <Slider
                          value={[pitch || 0]}
                          min={-24}
                          max={24}
                          step={1}
                          onValueChange={(v) => {
                            const newPitch = v[0];
                            const newTargetKey = transposeKey(formData.originalKey || "C", newPitch);
                            setFormData(prev => ({ ...prev, pitch: newPitch, targetKey: newTargetKey }));
                            setPitch(newPitch);
                            if (song) {
                              onSave(song.id, { pitch: newPitch, targetKey: newTargetKey });
                              onUpdateKey(song.id, newTargetKey);
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-4 md:space-y-6">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Fine Tune Matrix</Label>
                          <span className="text-sm md:text-lg font-mono font-black text-slate-500">{fineTune > 0 ? '+' : ''}{fineTune} Cents</span>
                        </div>
                        <Slider
                          value={[fineTune]}
                          min={-100}
                          max={100}
                          step={1}
                          onValueChange={([v]) => setFineTune(v)}
                        />
                      </div>
                    </div>
                    <div className={cn("space-y-6 md:space-y-10 bg-white/5 border border-white/5", isMobile ? "p-6 rounded-3xl" : "p-10 rounded-[2.5rem]")}>
                      <div className="space-y-4 md:space-y-6">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tempo Stretch</Label>
                          <span className="text-sm md:text-lg font-mono font-black text-indigo-400">{tempo.toFixed(2)}x</span>
                        </div>
                        <Slider
                          value={[tempo]}
                          min={0.5}
                          max={1.5}
                          step={0.01}
                          onValueChange={([v]) => setTempo(v)}
                        />
                      </div>
                      <div className="space-y-4 md:space-y-6">
                        <div className="flex justify-between items-center">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                            <Volume2 className="w-3 h-3 text-indigo-500" /> Master Gain
                          </Label>
                          <span className="text-sm md:text-lg font-mono font-black text-slate-500">{Math.round((volume + 60) * 1.66)}%</span>
                        </div>
                        <Slider
                          value={[volume]}
                          min={-60}
                          max={0}
                          step={1}
                          onValueChange={([v]) => setVolume(v)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'details' && (
                <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
                  <div className={cn("grid gap-6 md:gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <StudioInput 
                      label="Performance Title"
                      value={formData.name}
                      onChange={(val: string) => handleAutoSave({ name: val })}
                      className="bg-white/5 border-white/10 text-xl md:text-2xl font-black h-12 md:h-16 rounded-xl md:rounded-2xl"
                    />
                    <StudioInput 
                      label="Primary Artist"
                      value={formData.artist}
                      onChange={(val: string) => handleAutoSave({ artist: val })}
                      className="bg-white/5 border-white/10 text-xl md:text-2xl font-black h-12 md:h-16 rounded-xl md:rounded-2xl"
                    />
                  </div>
                  <div className={cn("grid gap-6 md:gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Sheet Music Link</Label>
                      <div className="flex gap-2 md:gap-3">
                        <StudioInput 
                          value={formData.pdfUrl}
                          onChange={(val: string) => handleAutoSave({ pdfUrl: val })}
                          placeholder="Paste sheet music URL..."
                          className="bg-white/5 border-white/10 font-bold h-10 md:h-12 rounded-xl w-full"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-10 md:h-12 border-white/10 text-slate-400 hover:bg-white/10 px-4 rounded-xl font-bold text-[10px] uppercase gap-2 shrink-0 min-w-[120px]"
                          onClick={() => {
                            const query = encodeURIComponent(`${formData.artist} ${formData.name} sheet music pdf`);
                            window.open(`https://www.google.com/search?q=${query}`, '_blank');
                          }}
                        >
                          <Search className="w-3.5 h-3.5" /> Find
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Ultimate Guitar Link</Label>
                      <div className="flex gap-2 md:gap-3">
                        <StudioInput 
                          value={formData.ugUrl}
                          onChange={(val: string) => handleAutoSave({ ugUrl: val })}
                          placeholder="Paste URL..."
                          className="bg-white/5 border-white/10 font-bold text-orange-400 h-10 md:h-12 rounded-xl w-full"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-10 md:h-12 border-white/10 text-orange-400 hover:bg-orange-600/10 px-4 rounded-xl font-bold text-[10px] uppercase gap-2 shrink-0 min-w-[120px]"
                          onClick={() => {
                            const query = encodeURIComponent(`${formData.artist} ${formData.name} chords`);
                            window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`, '_blank');
                          }}
                        >
                          <Search className="w-3.5 h-3.5" /> Find
                        </Button>
                      </div>
                    </div>
                  </div>
                  <StudioInput 
                    label="Rehearsal & Dynamics Notes"
                    isTextarea
                    value={formData.notes}
                    onChange={(val: string) => handleAutoSave({ notes: val })}
                    placeholder="Cues, transitions, dynamics..."
                    className={cn("bg-white/5 border-white/10 text-base md:text-lg leading-relaxed p-6 md:p-8 whitespace-pre-wrap", isMobile ? "min-h-[200px] rounded-2xl" : "min-h-[350px] rounded-[2rem]")}
                  />
                </div>
              )}
              {activeTab === 'charts' && (
                <div className="h-full flex flex-col gap-6 md:gap-8 animate-in fade-in duration-500">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                    <div>
                      <h3 className="text-sm md:text-lg font-black uppercase tracking-[0.3em] text-emerald-400">Chart Engine V2</h3>
                      <p className="text-xs md:text-sm text-slate-500 mt-1">Multi-layer chart rendering engine active.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-4">
                      <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!formData.pdfUrl}
                          onClick={() => setActiveChartType('pdf')}
                          className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-widest h-8 md:h-9 px-3 md:px-4 rounded-lg", activeChartType === 'pdf' ? "bg-indigo-600 text-white" : "text-slate-500")}
                        >
                          PDF
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!formData.ugUrl}
                          onClick={() => setActiveChartType('ug')}
                          className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-widest h-8 md:h-9 px-3 md:px-4 rounded-lg", activeChartType === 'ug' ? "bg-indigo-600 text-white" : "text-slate-500")}
                        >
                          UG
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className={cn("flex-1 min-h-[300px] bg-white overflow-hidden shadow-2xl relative", isMobile ? "rounded-3xl" : "rounded-[3rem]")}>
                    {currentChartUrl ? (
                      isFramable(currentChartUrl) ? (
                        <iframe src={currentChartUrl} className="w-full h-full" title="Chart Viewer" />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
                          <ShieldCheck className="w-12 h-12 text-indigo-400 mb-6" />
                          <h4 className="text-xl md:text-3xl font-black uppercase mb-4 text-white">External Protection</h4>
                          <Button onClick={() => window.open(currentChartUrl, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-12 md:h-14 px-8 md:px-10 font-black uppercase tracking-widest text-[10px] rounded-2xl gap-3">
                            <ExternalLink className="w-4 h-4 md:w-5 md:h-5" /> Launch Source
                          </Button>
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
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                    <div>
                      <h3 className="text-sm md:text-lg font-black uppercase tracking-[0.3em] text-pink-400">Lyrics Engine</h3>
                      <p className="text-xs md:text-sm text-slate-500 mt-1">Stage teleprompter source data.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-4">
                      <Button
                        variant="outline"
                        onClick={handleLyricsSearch}
                        className="bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white font-black uppercase tracking-widest text-[9px] h-10 gap-2 px-4 md:px-6 rounded-xl min-w-[140px]"
                      >
                        <Search className="w-3.5 h-3.5" /> Find Lyrics
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleMagicFormatLyrics}
                        disabled={isFormattingLyrics || !formData.lyrics}
                        className="bg-indigo-600/10 border-indigo-600/20 text-indigo-600 hover:bg-indigo-600 hover:text-white font-black uppercase tracking-widest text-[9px] h-10 gap-2 px-4 md:px-6 rounded-xl min-w-[140px]"
                      >
                        {isFormattingLyrics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Magic Format
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <StudioInput 
                      isTextarea
                      placeholder="Paste lyrics here..."
                      value={formData.lyrics}
                      onChange={(val: string) => handleAutoSave({ lyrics: val })}
                      className={cn("bg-white/5 border-white/10 text-lg md:text-xl leading-relaxed p-6 md:p-10 font-medium whitespace-pre-wrap h-full", isMobile ? "rounded-2xl" : "rounded-[2.5rem]")}
                    />
                  </div>
                </div>
              )}
              {activeTab === 'visual' && (
                <div className="space-y-6 md:space-y-12 animate-in fade-in duration-500">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm md:text-lg font-black uppercase tracking-[0.2em] text-indigo-400">Reference Media</h3>
                      <p className="text-xs md:text-sm text-slate-500 mt-1">YouTube performance video or audio master link.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                     <StudioInput 
                       placeholder="YouTube URL..."
                       value={formData.youtubeUrl}
                       onChange={(val: string) => handleAutoSave({ youtubeUrl: val })}
                       className="bg-white/5 border-white/10 text-sm flex-1 h-10 md:h-12 rounded-xl w-full"
                     />
                     <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          onClick={handleSyncYoutubeAudio}
                          disabled={isSyncingAudio || !formData.youtubeUrl}
                          className="bg-indigo-600/10 border-indigo-600/20 text-indigo-600 hover:bg-indigo-600 hover:text-white font-black uppercase tracking-widest text-[9px] h-10 md:h-12 gap-2 px-4 md:px-6 rounded-xl min-w-[140px]"
                        >
                          {isSyncingAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                          Extract Audio
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleYoutubeSearch}
                            className="bg-red-600/10 border-red-600/20 text-red-600 hover:bg-red-600 hover:text-white font-black uppercase tracking-widest text-[9px] h-10 md:h-12 gap-2 px-4 md:px-6 rounded-xl min-w-[120px]"
                          >
                            <Youtube className="w-3.5 h-3.5" /> Discovery
                          </Button>
                     </div>
                  </div>
                  {videoId ? (
                    <div className="aspect-video w-full rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 bg-black">
                      <iframe
                        width="100%" height="100%"
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=0&mute=1`}
                        title="Reference Video"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className={cn("flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 space-y-6 md:space-y-8", isMobile ? "py-24 rounded-3xl" : "py-48 rounded-[4rem]")}>
                      <Youtube className="w-12 h-12 md:w-16 md:h-16 text-slate-700" />
                      <p className="text-sm md:text-lg font-black uppercase tracking-[0.4em] text-slate-500">Visual Engine Standby</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'library' && (
                <div className="space-y-8 md:space-y-12 animate-in fade-in duration-500">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-white">RESOURCE MATRIX</h3>
                      <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">Centralized management for all song assets and links.</p>
                    </div>
                    <Button 
                      onClick={handleDownloadAll} 
                      className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] md:text-xs h-12 md:h-14 gap-2 px-8 md:px-10 rounded-xl md:rounded-2xl shadow-xl shadow-indigo-600/20"
                    >
                      <Download className="w-4 h-4" /> DOWNLOAD ALL ASSETS
                    </Button>
                  </div>
                  <div className={cn("grid gap-4 md:gap-8", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    {/* Audio Module */}
                    <div className={cn(
                      "p-8 md:p-10 border transition-all flex flex-col justify-between h-[280px] md:h-[350px] relative group",
                      formData.previewUrl ? "bg-slate-900 border-white/10 shadow-2xl" : "bg-white/5 border-white/5 opacity-40 border-dashed",
                      isMobile ? "rounded-[2rem]" : "rounded-[2.5rem]"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-xl shadow-indigo-600/20">
                          <Music className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        {formData.previewUrl && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDownloadAsset(formData.previewUrl, `${formData.name}_master`)}
                            className="h-10 w-10 bg-white/5 rounded-xl hover:bg-indigo-600 transition-all"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">MASTER PERFORMANCE AUDIO</span>
                        <p className="text-xl md:text-3xl font-black tracking-tight truncate">{formData.previewUrl ? `${formData.name}_Stream_Master` : "Not Linked"}</p>
                      </div>
                    </div>

                    {/* Apple Music Module */}
                    <div className={cn(
                      "p-8 md:p-10 border transition-all flex flex-col justify-between h-[280px] md:h-[350px] relative group",
                      formData.appleMusicUrl ? "bg-slate-900 border-white/10 shadow-2xl" : "bg-white/5 border-white/5 opacity-40 border-dashed",
                      isMobile ? "rounded-[2rem]" : "rounded-[2.5rem]"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-red-600 p-4 rounded-2xl text-white shadow-xl shadow-red-600/20">
                          <Apple className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        {formData.appleMusicUrl && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => window.open(formData.appleMusicUrl, '_blank')}
                            className="h-10 w-10 bg-white/5 rounded-xl hover:bg-red-600 transition-all"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-red-400">APPLE MUSIC LINK</span>
                        <p className="text-xl md:text-3xl font-black tracking-tight truncate">{formData.appleMusicUrl ? "Integrated App Link" : "Offline"}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Launch directly in Apple Music</p>
                      </div>
                    </div>

                    {/* Ultimate Guitar Module */}
                    <div className={cn(
                      "p-8 md:p-10 border transition-all flex flex-col justify-between h-[280px] md:h-[350px] relative group",
                      formData.ugUrl ? "bg-slate-900 border-white/10 shadow-2xl" : "bg-white/5 border-white/5 opacity-40 border-dashed",
                      isMobile ? "rounded-[2rem]" : "rounded-[2.5rem]"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-orange-600 p-4 rounded-2xl text-white shadow-xl shadow-orange-600/20">
                          <Link2 className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        {formData.ugUrl && (
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={handleUgPrint}
                              className="h-10 w-10 bg-white/5 rounded-xl hover:bg-orange-600 transition-all"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                navigator.clipboard.writeText(formData.ugUrl || "");
                                showSuccess("UG Link Copied");
                              }}
                              className="h-10 w-10 bg-white/5 rounded-xl hover:bg-orange-600 transition-all"
                            >
                              <ClipboardPaste className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => window.open(formData.ugUrl || '', '_blank')}
                              className="h-10 w-10 bg-white/5 rounded-xl hover:bg-orange-600 transition-all"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">ULTIMATE GUITAR PRO</span>
                        <p className="text-xl md:text-3xl font-black tracking-tight truncate">{formData.ugUrl ? "Verified Official Link" : "Not Linked"}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Mobile App Integration Ready</p>
                      </div>
                    </div>

                    {/* Stage Chart Module */}
                    <div className={cn(
                      "p-8 md:p-10 border transition-all flex flex-col justify-between h-[280px] md:h-[350px] relative group",
                      formData.pdfUrl ? "bg-slate-900 border-white/10 shadow-2xl" : "bg-white/5 border-white/5 opacity-40 border-dashed",
                      isMobile ? "rounded-[2rem]" : "rounded-[2.5rem]"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="bg-emerald-600 p-4 rounded-2xl text-white shadow-xl shadow-emerald-600/20">
                          <FileText className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        {formData.pdfUrl && (
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setPreviewPdfUrl(formData.pdfUrl || null)}
                              className="h-10 w-10 bg-white/5 rounded-xl hover:bg-emerald-600 transition-all"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={async () => {
                                if (formData.pdfUrl) {
                                  const response = await fetch(formData.pdfUrl);
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = `${formData.name}_chart.pdf`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  window.URL.revokeObjectURL(url);
                                }
                              }}
                              className="h-10 w-10 bg-white/5 rounded-xl hover:bg-emerald-600 transition-all"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">STAGE CHART / PDF</span>
                        <p className="text-xl md:text-3xl font-black tracking-tight truncate">{formData.pdfUrl ? "Performance_Chart" : "No Asset Linked"}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Ready for Stage View</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'config' && isMobile && renderSidebarContent(true)}
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
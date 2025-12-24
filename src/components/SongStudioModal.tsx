"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { useAuth } from '@/components/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { calculateReadiness } from '@/utils/repertoireSync';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { detectKeyFromBuffer, KeyCandidate } from '@/utils/keyDetector';
import { cleanYoutubeUrl } from '@/utils/youtubeUtils';
import YoutubeMediaManager from './YoutubeMediaManager';
import SongDetailsTab from './SongDetailsTab';
import SongChartsTab from './SongChartsTab';
import LyricsEngine from './LyricsEngine';
import LibraryEngine from './LibraryEngine';
import SongConfigTab from './SongConfigTab'; 
import SongAudioPlaybackTab from './SongAudioPlaybackTab';
import StudioTabContent from './StudioTabContent'; // New import

// Helper to parse ISO 8601 duration (e.g., PT4M13S -> 4:13)
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
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isProSyncSearchOpen, setIsProSyncSearchOpen] = useState(false);
  
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
      // fetchYtKey(); // No longer needed here, moved to YoutubeMediaManager
    }
  }, [isOpen, user]);

  const currentVideoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] || null : null;

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
    
    const file = e.dataTransfer.files?.[0];
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
        master_id: song.master_id,
        fineTune: song.fineTune || 0, // Initialize fineTune
        tempo: song.tempo || 1, // Initialize tempo
        volume: song.volume || -6, // Initialize volume
      };
      setFormData(initialData);
      
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
      showSuccess("Added to Repertoire");
    } catch (err) {
      showError("Failed to add to repertoire");
    }
  };

  const isFramable = (url: string | null) => {
    if (!url) return true;
    const blockedSites = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blockedSites.some(site => url.includes(site));
  };

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
          <DialogDescription>Metadata, Assets, and Harmonics Engine.</DialogDescription>
        </DialogHeader>
        {previewPdfUrl && (
          <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-xl animate-in fade-in zoom-in duration-300 flex flex-col p-6 md:p-12">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">Stage Chart</h3>
              <Button variant="ghost" size="icon" onClick={() => setPreviewPdfUrl(null)} className="h-10 w-10 bg-white/5 rounded-full hover:bg-white/10">
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
              <div className="h-full flex flex-col items-center justify-center bg-slate-900 rounded-2xl border border-white/5 p-6 text-center">
                <ShieldCheck className="w-12 h-12 text-indigo-400 mb-6" />
                <Button onClick={() => window.open(previewPdfUrl, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-14 px-10 rounded-2xl gap-3"><ExternalLink className="w-5 h-5" /> Launch Source</Button>
              </div>
            )}
          </div>
        )}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-indigo-600/20 backdrop-blur-sm border-4 border-dashed border-indigo-500 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-indigo-400 animate-bounce" />
              <p className="text-xl font-black uppercase tracking-tighter">Drop Asset to Link</p>
            </div>
          </div>
        )}
        {(isUploading || isProSyncing) && ( 
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4">
               <>
                 <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                 <div className="text-center space-y-2 max-w-sm px-6">
                   <p className="text-sm font-black uppercase tracking-[0.2em] text-white">
                     {isUploading ? 'Linking Master...' : 
                      'Analyzing Library...'}
                   </p>
                 </div>
               </>
          </div>
        )}
        <div className={cn("flex overflow-hidden", isMobile ? "flex-col h-[100dvh]" : "h-[90vh] min-h-[800px]")}>
          {!isMobile && (
            <div className="w-96 bg-slate-900/50 border-r border-white/5 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
              <div className="p-8 border-b border-white/5 bg-black/20 shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-1.5 rounded-lg">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-black uppercase tracking-tighter text-xs">Studio Configuration</span>
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
                </div>
                <div className="flex flex-col gap-2 mt-6">
                  <Button
                    onClick={handleProSync}
                    className={cn(
                      "w-full font-black uppercase tracking-[0.2em] text-[10px] h-10 rounded-xl shadow-lg gap-2 transition-all",
                      formData.isMetadataConfirmed ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white"
                    )}
                  >
                    {formData.isMetadataConfirmed ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    {formData.isMetadataConfirmed ? "METADATA SYNCED" : "PRO SYNC ENGINE"}
                  </Button>
                  <Button
                    onClick={addToPublicRepertoire}
                    disabled={isInRepertoire}
                    className={cn(
                      "w-full font-black uppercase tracking-[0.2em] text-[10px] h-10 rounded-xl gap-2 transition-all",
                      isInRepertoire ? "bg-emerald-600/10 text-emerald-400 border border-emerald-600/20" : "bg-white/5 text-white border border-white/10"
                    )}
                  >
                    {isInRepertoire ? <Check className="w-4 h-4" /> : <ListPlus className="w-4 h-4" />}
                    {isInRepertoire ? "IN REPERTOIRE" : "ADD TO REPERTOIRE"}
                  </Button>
                </div>
              </div>
              {/* Render SongConfigTab directly here for desktop layout */}
              <SongConfigTab
                song={song}
                formData={formData}
                handleAutoSave={handleAutoSave}
                onUpdateKey={onUpdateKey}
                setPitch={setPitch}
                setTempo={setTempo}
                setVolume={setVolume}
                setFineTune={setFineTune}
                currentBuffer={currentBuffer}
                isMobile={isMobile}
              />
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
                    <span className="flex items-center gap-1.5">
                      {tab === 'config' ? 'CONFIG' : tab.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
              {!isMobile && (
                <div className="flex items-center gap-6">
                   <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white font-black uppercase tracking-[0.3em] text-xs">Close</Button>
                </div>
              )}
            </div>
            <div className={cn("flex-1 overflow-y-auto relative flex flex-col", isMobile ? "p-4" : "p-12")}>
              {/* Use the new StudioTabContent component here */}
              <StudioTabContent
                activeTab={activeTab}
                song={song}
                formData={formData}
                handleAutoSave={handleAutoSave}
                onUpdateKey={onUpdateKey}
                audioEngine={audio}
                isMobile={isMobile}
                onLoadAudioFromUrl={loadFromUrl}
                onOpenAdmin={onOpenAdmin}
                setPreviewPdfUrl={setPreviewPdfUrl}
                isFramable={isFramable}
                activeChartType={activeChartType}
                setActiveChartType={setActiveChartType}
                handleUgPrint={handleUgPrint}
                handleDownloadAll={handleDownloadAll}
              />
            </div>
          </div>
        </div>
      </DialogContent>
      <ProSyncSearch isOpen={isProSyncSearchOpen} onClose={() => setIsProSyncSearchOpen(false)} onSelect={handleSelectProSync} initialQuery={`${formData.artist} ${formData.name}`} />
    </Dialog>
  );
};

export default SongStudioModal;
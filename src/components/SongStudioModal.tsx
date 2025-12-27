"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { SetlistSong } from './SetlistManager';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, calculateSemitones, formatKey, transposeKey } from '@/utils/keyUtils';
import { Music, FileText, Youtube, Settings2, Sparkles, Waves, Activity, Play, Pause, Volume2, Gauge, ExternalLink, Library, Upload, Link2, X, Plus, Tag, Check, Loader2, FileDown, Headphones, Wand2, Download, Globe, Eye, Link as LinkIcon, RotateCcw, Zap, Disc, VolumeX, Smartphone, Printer, Search, ClipboardPaste, AlignLeft, Apple, Hash, Music2, FileSearch, ChevronRight, Layers, LayoutGrid, ListPlus, Globe2, ShieldCheck, Timer, FileMusic, Copy, SearchCode, Cloud, AlertTriangle, Wrench } from 'lucide-react';
import { cn } from "@/lib/utils";
import AudioVisualizer from './AudioVisualizer';
import * as Tone from 'tone';
import { analyze } from 'web-audio-beat-detector';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Slider } from '@/components/ui/slider';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { RESOURCE_TYPES, DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
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
import StudioTabContent from './StudioTabContent';

interface SongStudioModalProps {
  song: SetlistSong | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onSyncProData?: (song: SetlistSong) => Promise<void>;
  onPerform?: (song: SetlistSong) => void;
  onOpenAdmin?: () => void;
  currentList?: { id: string; name: string; songs: SetlistSong[] };
  onAddSongToGig?: (previewUrl: string, name: string, artist: string, yt?: string, ug?: string, apple?: string, gen?: string, pitch?: number) => void;
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
  onOpenAdmin,
  currentList,
  onAddSongToGig
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
    setPitch, setTempo, setVolume, setFineTune, setProgress, loadFromUrl, togglePlayback, stopPlayback, resetEngine 
  } = audio;
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const metronomeSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const metronomeLoopRef = useRef<Tone.Loop | null>(null);
  const tabOrder: StudioTab[] = isMobile ? ['audio', 'config', 'details', 'charts', 'lyrics', 'visual', 'library'] : ['audio', 'details', 'charts', 'lyrics', 'visual', 'library'];

  const currentVideoId = formData.youtubeUrl ? formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] || null : null;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if ((e.metaKey || e.ctrlKey) && !isNaN(Number(e.key))) {
        e.preventDefault();
        const index = Number(e.key) - 1;
        if (index >= 0 && index < tabOrder.length) setActiveTab(tabOrder[index]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMobile, tabOrder]);

  const currentKeyPreference = formData.key_preference || globalPreference;
  const readiness = useMemo(() => calculateReadiness(formData), [formData]);
  const readinessColor = readiness === 100 ? 'bg-emerald-500' : readiness > 60 ? 'bg-indigo-500' : 'bg-slate-500';
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  
  const handleAutoSave = useCallback((updates: Partial<SetlistSong>) => {
    setFormData(prev => {
      const next = { ...prev, ...updates };
      if ('ug_chords_text' in updates) {
        next.is_ug_chords_present = !!(updates.ug_chords_text && updates.ug_chords_text.trim().length > 0);
      }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        if (song) onSave(song.id, updates);
      }, 800);
      return next;
    });
  }, [song, onSave]);

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
      const { data, error } = await supabase.functions.invoke('enrich-metadata', { body: { queries: [`${itunesData.trackName} by ${itunesData.artistName}`] } });
      if (error) throw error;
      const aiResult = Array.isArray(data) ? data[0] : data;
      const finalUpdates = { ...basicUpdates, originalKey: aiResult?.originalKey || formData.originalKey, targetKey: aiResult?.originalKey || formData.targetKey, bpm: aiResult?.bpm?.toString() || formData.bpm, pitch: 0 };
      handleAutoSave(finalUpdates);
      setPitch(0);
      showSuccess(`Synced "${itunesData.trackName}"`);
    } catch (err) {
      showError("Pro Sync failed.");
    } finally {
      setIsProSyncing(false);
    }
  };

  const handleAddToGig = () => {
    if (!formData.name || !formData.artist) {
      showError("Metadata incomplete");
      return;
    }
    onAddSongToGig?.(formData.previewUrl || '', formData.name, formData.artist, formData.youtubeUrl, formData.ugUrl, formData.appleMusicUrl, formData.genre, formData.pitch);
  };

  const handleDownloadAll = async () => {
    const assets = [{ url: formData.previewUrl, name: `${formData.name}_audio` }, { url: formData.pdfUrl, name: `${formData.name}_sheet` }, { url: formData.leadsheetUrl, name: `${formData.name}_leadsheet` }].filter(a => !!a.url);
    if (assets.length === 0) return showError("No assets linked.");
    assets.forEach(asset => window.open(asset.url, '_blank'));
    showSuccess("Downloading all assets");
  };

  useEffect(() => {
    if (song && isOpen) {
      setFormData({
        name: song.name || "", artist: song.artist || "", bpm: song.bpm || "",
        originalKey: song.originalKey || "C", targetKey: song.targetKey || "C",
        notes: song.notes || "", lyrics: song.lyrics || "", youtubeUrl: song.youtubeUrl || "",
        previewUrl: song.previewUrl || "", appleMusicUrl: song.appleMusicUrl || "",
        pdfUrl: song.pdfUrl || "", leadsheetUrl: song.leadsheetUrl || "",
        ugUrl: song.ugUrl || "", resources: song.resources || [], pitch: song.pitch || 0,
        user_tags: song.user_tags || [], isKeyLinked: song.isKeyLinked ?? true,
        isKeyConfirmed: song.isKeyConfirmed ?? false, duration_seconds: song.duration_seconds || 0,
        key_preference: song.key_preference, isMetadataConfirmed: song.isMetadataConfirmed,
        master_id: song.master_id, fineTune: song.fineTune || 0, tempo: song.tempo || 1,
        volume: song.volume || -6, isApproved: song.isApproved ?? false,
        preferred_reader: song.preferred_reader || null, ug_chords_text: song.ug_chords_text || "",
        ug_chords_config: song.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: song.is_ug_chords_present ?? false
      });
      resetEngine();
      if (song.previewUrl) loadFromUrl(song.previewUrl, song.pitch || 0);
    }
    return () => { resetEngine(); };
  }, [song?.id, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn("max-w-[95vw] w-[1400px] max-h-[95vh] p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white md:rounded-[2rem] z-[200]", isMobile && "w-full max-w-none h-[100dvh] max-h-none rounded-none")}>
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-50 overflow-hidden md:rounded-t-[2rem]">
          <div className={cn("h-full transition-all duration-1000", readinessColor)} style={{ width: `${readiness}%` }} />
        </div>
        
        <div className={cn("flex overflow-hidden", isMobile ? "flex-col h-[100dvh]" : "h-[90vh] min-h-[800px]")}>
          {!isMobile && (
            <div className="w-96 bg-slate-900/50 border-r border-white/5 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
              <div className="p-8 border-b border-white/5 bg-black/20 shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-1.5 rounded-lg"><Activity className="w-5 h-5 text-white" /></div>
                    <span className="font-black uppercase tracking-tighter text-xs">Studio Config</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-full border border-white/10">
                      <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", readinessColor)} />
                      <span className="text-[9px] font-black font-mono text-slate-400">{readiness}%</span>
                    </div>
                    <button onClick={() => handleAutoSave({ isApproved: !formData.isApproved })} className={cn("rounded-full flex items-center justify-center transition-all w-9 h-9 border", formData.isApproved ? "bg-emerald-600 border-emerald-500 text-white" : "bg-white/5 border-slate-600 text-slate-500")}>
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tight leading-none mb-1 truncate">{formData.name || ""}</h2>
                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest truncate">{formData.artist || "Unknown Artist"}</p>
                <div className="flex flex-col gap-2 mt-6">
                  <Button onClick={handleProSync} className={cn("w-full font-black uppercase tracking-[0.2em] text-[10px] h-10 rounded-xl gap-2", formData.isMetadataConfirmed ? "bg-emerald-600" : "bg-indigo-600")}>
                    {formData.isMetadataConfirmed ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />} {formData.isMetadataConfirmed ? "SYNCED" : "PRO SYNC"}
                  </Button>
                  <Button onClick={() => handleAutoSave({ is_active: true })} className="w-full font-black uppercase tracking-[0.2em] text-[10px] h-10 rounded-xl gap-2 bg-white/5 text-white border border-white/10">
                    <ListPlus className="w-4 h-4" /> REPERTOIRE
                  </Button>
                </div>
              </div>
              <SongConfigTab song={song} formData={formData} handleAutoSave={handleAutoSave} onUpdateKey={onUpdateKey} setPitch={audio.setPitch} setTempo={audio.setTempo} setVolume={audio.setVolume} setFineTune={audio.setFineTune} currentBuffer={audio.currentBuffer} isPlaying={audio.isPlaying} progress={audio.progress} duration={audio.duration} togglePlayback={audio.togglePlayback} stopPlayback={audio.stopPlayback} isMobile={isMobile} />
            </div>
          )}
          
          <div className="flex-1 flex flex-col min-w-0">
            <div className={cn("border-b border-white/5 flex items-center bg-black/20 shrink-0", isMobile ? "h-16 px-4 overflow-x-auto no-scrollbar" : "h-20 px-12 justify-between")}>
              <div className={cn("flex", isMobile ? "gap-4 min-w-max" : "gap-12")}>
                {tabOrder.map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={cn("text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-4 flex flex-col items-center justify-center gap-1", isMobile ? "h-16 px-2" : "text-xs tracking-[0.4em] h-20", activeTab === tab ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white")}>
                    {tab === 'config' ? 'CONFIG' : tab.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            
            <div className={cn("flex-1 overflow-y-auto relative flex flex-col pb-24 md:pb-12", isMobile ? "p-4" : "p-12")}>
              <StudioTabContent activeTab={activeTab} song={song} formData={formData} handleAutoSave={handleAutoSave} onUpdateKey={onUpdateKey} audioEngine={audio} isMobile={isMobile} onLoadAudioFromUrl={loadFromUrl} onOpenAdmin={onOpenAdmin} setPreviewPdfUrl={setPreviewPdfUrl} isFramable={(url) => !!url} activeChartType={activeChartType} setActiveChartType={setActiveChartType} handleUgPrint={() => {}} handleDownloadAll={handleDownloadAll} onSwitchTab={setActiveTab} />
            </div>
          </div>
        </div>

        {isMobile && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-white/10 z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-500">
            <Button 
              onClick={handleAddToGig}
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-2xl gap-3 shadow-2xl"
            >
              <ListPlus className="w-6 h-6" />
              {currentList ? `ADD TO ${currentList.name.toUpperCase()}` : 'ADD TO CURRENT GIG'}
            </Button>
          </div>
        )}
      </DialogContent>
      <ProSyncSearch isOpen={isProSyncSearchOpen} onClose={() => setIsProSyncSearchOpen(false)} onSelect={handleSelectProSync} initialQuery={`${formData.artist} ${formData.name}`} />
    </Dialog>
  );
};

export default SongStudioModal;
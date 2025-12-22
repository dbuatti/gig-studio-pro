"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Play, Pause, SkipForward, SkipBack, X, Music, 
  Waves, Activity, ArrowRight, Volume2, 
  Settings2, Gauge, FileText, Save, Youtube,
  Monitor, Sparkles, Tag, AlignLeft, Hash, Music2
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import AudioVisualizer from './AudioVisualizer';
import Metronome from './Metronome';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { Badge } from './ui/badge';
import { useSettings } from '@/hooks/use-settings';

interface PerformanceOverlayProps {
  songs: SetlistSong[];
  currentIndex: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onTogglePlayback: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onUpdateSong: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  analyzer: any;
}

type ViewMode = 'visualizer' | 'video' | 'pdf' | 'lyrics';

const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  songs,
  currentIndex,
  isPlaying,
  progress,
  duration,
  onTogglePlayback,
  onNext,
  onPrevious,
  onClose,
  onUpdateSong,
  onUpdateKey,
  analyzer
}) => {
  const { keyPreference: globalPreference } = useSettings();
  const currentSong = songs[currentIndex];
  const nextSong = songs[currentIndex + 1];
  const [localNotes, setLocalNotes] = useState(currentSong?.notes || "");
  const [viewMode, setViewMode] = useState<ViewMode>('visualizer');

  // Per-song preference logic
  const currentPref = currentSong?.key_preference || globalPreference;
  const nextPref = nextSong?.key_preference || globalPreference;
  const keysToUse = currentPref === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  useEffect(() => {
    setLocalNotes(currentSong?.notes || "");
    if (currentSong?.lyrics) setViewMode('lyrics');
    else if (currentSong?.pdfUrl) setViewMode('pdf');
    else if (currentSong?.youtubeUrl) setViewMode('video');
    else setViewMode('visualizer');
  }, [currentSong]);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = currentSong?.youtubeUrl ? getYoutubeId(currentSong.youtubeUrl) : null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveNotes = () => {
    if (currentSong) {
      onUpdateSong(currentSong.id, { notes: localNotes });
    }
  };

  const displayCurrentKey = formatKey(currentSong?.targetKey || currentSong?.originalKey, currentPref);
  const displayNextKey = formatKey(nextSong?.targetKey || nextSong?.originalKey, nextPref);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col animate-in fade-in zoom-in duration-300">
      {/* Practice Header */}
      <div className="h-24 border-b border-white/10 px-10 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-6">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-600/20">
            <Activity className="w-8 h-8 animate-pulse text-white" />
          </div>
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-1 font-mono">Mission Control V2.5</h2>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-black uppercase tracking-tight">Active Performance</span>
              <div className="flex gap-1.5">
                {songs.map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "h-1.5 w-6 rounded-full transition-all duration-700",
                      i === currentIndex ? "bg-indigo-500 w-16" : i < currentIndex ? "bg-green-500/40" : "bg-white/10"
                    )} 
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Real-time HUD stats */}
        <div className="hidden lg:flex items-center gap-12 border-x border-white/5 px-12 mx-8 font-mono">
           <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Master Tempo</span>
              <span className="text-xl font-black text-indigo-400">{currentSong?.bpm || "--"} <span className="text-[10px] text-slate-600">BPM</span></span>
           </div>
           <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Vibe Profile</span>
              <span className="text-xl font-black text-white uppercase">{currentSong?.genre || "STD"}</span>
           </div>
           <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Pitch Offset</span>
              <span className="text-xl font-black text-indigo-400">{currentSong?.pitch > 0 ? '+' : ''}{currentSong?.pitch}ST</span>
           </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex bg-slate-800/50 p-1.5 rounded-2xl border border-white/10 shadow-inner font-mono">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setViewMode('visualizer')}
              className={cn("text-[10px] font-black uppercase tracking-widest h-9 px-5 gap-2 rounded-xl transition-all", viewMode === 'visualizer' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}
            >
              <Waves className="w-3.5 h-3.5" /> Wave
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={!currentSong?.lyrics}
              onClick={() => setViewMode('lyrics')}
              className={cn("text-[10px] font-black uppercase tracking-widest h-9 px-5 gap-2 rounded-xl transition-all", viewMode === 'lyrics' ? "bg-pink-600 text-white shadow-lg" : "text-slate-400 hover:text-white disabled:opacity-20")}
            >
              <AlignLeft className="w-3.5 h-3.5" /> Lyrics
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={!videoId}
              onClick={() => setViewMode('video')}
              className={cn("text-[10px] font-black uppercase tracking-widest h-9 px-5 gap-2 rounded-xl transition-all", viewMode === 'video' ? "bg-red-600 text-white shadow-lg" : "text-slate-400 hover:text-white disabled:opacity-20")}
            >
              <Youtube className="w-3.5 h-3.5" /> Video
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={!currentSong?.pdfUrl}
              onClick={() => setViewMode('pdf')}
              className={cn("text-[10px] font-black uppercase tracking-widest h-9 px-5 gap-2 rounded-xl transition-all", viewMode === 'pdf' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-white disabled:opacity-20")}
            >
              <FileText className="w-3.5 h-3.5" /> Chart
            </Button>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10 h-12 w-12 transition-all">
            <X className="w-8 h-8" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Workspace */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative overflow-hidden border-r border-white/5">
          <div className="absolute inset-0 opacity-10 pointer-events-none scale-150 blur-3xl transition-all">
            <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
          </div>

          <div className="max-w-6xl w-full h-full flex flex-col space-y-8 z-10">
            {/* HUD Status Matrix */}
            <div className={cn("text-center transition-all duration-500", (viewMode === 'pdf' || viewMode === 'lyrics') ? "space-y-1" : "space-y-6")}>
              <div className="inline-flex items-center gap-4 px-6 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full font-mono">
                <Music className="w-4 h-4 text-indigo-400" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Channel 01 Active Output</span>
              </div>
              
              <h1 className={cn("font-black uppercase tracking-tighter leading-none transition-all drop-shadow-2xl", (viewMode === 'pdf' || viewMode === 'lyrics') ? "text-4xl" : "text-8xl")}>
                {currentSong?.name}
              </h1>
              
              <div className={cn("flex flex-col items-center gap-4 transition-all", (viewMode === 'pdf' || viewMode === 'lyrics') ? "mt-2" : "mt-4")}>
                <div className="flex items-center gap-6 font-bold text-slate-400 text-2xl">
                  <span>{currentSong?.artist}</span>
                  <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
                  <span className="text-indigo-400 font-mono font-black">{displayCurrentKey}</span>
                </div>
              </div>
            </div>

            {/* Dynamic Viewport */}
            <div className="flex-1 w-full bg-slate-900/40 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-sm">
              {viewMode === 'visualizer' && (
                <div className="h-full flex flex-col items-center justify-center p-16 animate-in fade-in duration-500">
                  <div className="w-full h-64">
                    <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
                  </div>
                </div>
              )}

              {viewMode === 'lyrics' && currentSong?.lyrics && (
                <div className="h-full w-full overflow-y-auto p-20 animate-in fade-in duration-500 text-center custom-scrollbar">
                   <div className="max-w-2xl mx-auto whitespace-pre-wrap text-4xl font-black leading-relaxed uppercase tracking-tight text-white/90 drop-shadow-xl">
                      {currentSong.lyrics}
                   </div>
                </div>
              )}

              {viewMode === 'video' && videoId && (
                <div className="h-full w-full animate-in fade-in duration-500 bg-black">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1`}
                    title="Stage Reference" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    allowFullScreen
                  />
                </div>
              )}

              {viewMode === 'pdf' && currentSong?.pdfUrl && (
                <div className="h-full w-full animate-in zoom-in-95 duration-500">
                  <iframe 
                    src={`${currentSong.pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                    className="w-full h-full"
                    title="Sheet Music Matrix"
                  />
                </div>
              )}

              {/* Progress HUD */}
              <div className="absolute bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
                <div className="flex justify-between text-xs font-mono text-slate-400 font-black uppercase tracking-widest mb-3">
                  <div className="flex gap-6">
                    <span className="text-indigo-400">{formatTime((progress / 100) * duration)}</span>
                    <span className="text-slate-700">|</span>
                    <span className="text-emerald-500 flex items-center gap-2">
                       <Activity className="w-3.5 h-3.5 animate-pulse" /> PERFORMANCE ENGAGED
                    </span>
                  </div>
                  <div className="flex gap-6">
                    <span>{Math.round(progress)}% COMPLETE</span>
                    <span className="text-slate-700">|</span>
                    <span>{formatTime(duration)} TOTAL</span>
                  </div>
                </div>
                <Progress value={progress} className="h-4 bg-white/5 shadow-2xl" />
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex flex-col items-center gap-8 pb-8 shrink-0">
              <div className="flex items-center gap-12">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onPrevious}
                  className="h-20 w-20 rounded-full hover:bg-white/10 transition-all active:scale-90"
                >
                  <SkipBack className="w-10 h-10" />
                </Button>
                
                <Button 
                  size="lg" 
                  onClick={onTogglePlayback}
                  className="h-32 w-32 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_80px_rgba(79,70,229,0.5)] transition-all hover:scale-105 active:scale-95 group"
                >
                  {isPlaying ? <Pause className="w-16 h-16" /> : <Play className="w-16 h-16 ml-2 fill-current" />}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onNext}
                  className="h-20 w-20 rounded-full hover:bg-white/10 transition-all active:scale-90"
                >
                  <SkipForward className="w-10 h-10" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stage Sidebar */}
        <aside className="w-[450px] bg-slate-900/40 backdrop-blur-2xl p-10 space-y-10 overflow-y-auto shrink-0 border-l border-white/5 scrollbar-hide">
          {/* Metronome Utility */}
          <div className="space-y-5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2 font-mono">
              <Gauge className="w-4 h-4" /> Live Click Track
            </h3>
            <Metronome initialBpm={parseInt(currentSong?.bpm || "120")} />
          </div>

          {/* Harmonic HUD */}
          <div className="space-y-5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2 font-mono">
              <Settings2 className="w-4 h-4" /> Harmonic Processor
            </h3>
            <div className="bg-white/5 rounded-[2rem] p-6 border border-white/10 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Master Key</span>
                  <span className="text-2xl font-mono font-black text-indigo-400">{displayCurrentKey}</span>
                </div>
                <div className="h-10 w-px bg-white/5" />
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Shift Offset</span>
                  <span className="text-2xl font-mono font-black text-slate-300">{currentSong?.pitch > 0 ? '+' : ''}{currentSong?.pitch}ST</span>
                </div>
              </div>
              <Select 
                value={currentSong?.targetKey} 
                onValueChange={(val) => onUpdateKey(currentSong!.id, val)}
              >
                <SelectTrigger className="bg-slate-950 border-white/10 text-sm font-black font-mono h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  {keysToUse.map(k => (
                    <SelectItem key={k} value={k} className="font-mono font-bold">{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Artist Stage Cues */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2 font-mono">
                <FileText className="w-4 h-4" /> Stage Cues & Coda
              </h3>
              <Badge className="bg-indigo-600/10 text-indigo-400 text-[8px] border-indigo-600/20 font-mono">MEMO SYNCED</Badge>
            </div>
            <div className="space-y-4">
              <Textarea 
                placeholder="Add cues, transition details, or lyrics here..."
                className="bg-slate-950/30 border-white/5 min-h-[180px] text-base leading-relaxed resize-none focus-visible:ring-indigo-500 rounded-2xl whitespace-pre-wrap"
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
              />
              <Button 
                onClick={handleSaveNotes}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-[10px] h-12 gap-3 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 font-mono"
              >
                <Save className="w-4 h-4" /> Save Stage Memo
              </Button>
            </div>
          </div>

          {/* Next Deck Preview */}
          {nextSong && (
            <div className="pt-10 border-t border-white/5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 font-mono">On Deck: Next Sequence</div>
              <div 
                className="bg-white/5 border border-white/5 rounded-[2rem] p-6 flex items-center gap-6 group cursor-pointer hover:bg-white/10 transition-all hover:scale-[1.02] active:scale-98" 
                onClick={onNext}
              >
                <div className="bg-indigo-600/20 p-3 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <ArrowRight className="w-5 h-5 text-indigo-400 group-hover:text-white group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-lg font-black uppercase truncate">{nextSong.name}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono">{nextSong.artist}</span>
                    <span className="text-slate-700 text-xs">•</span>
                    <span className="text-[10px] font-mono font-bold text-indigo-500">{displayNextKey}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Stage Status Footer */}
      <div className="h-16 border-t border-white/10 px-10 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 bg-slate-900/30 shrink-0 font-mono">
        <div className="flex gap-12">
          <div className="flex items-center gap-3">
            <Monitor className="w-4 h-4 text-indigo-500" />
            <span className="opacity-60">View Matrix:</span> {viewMode.toUpperCase()}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
            <span className="opacity-60">Engine Status:</span> SYNCHRONIZED
          </div>
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-indigo-500" />
            <span className="opacity-60">Output:</span> HD MASTER L/R
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-slate-400">{currentSong?.name} <span className="text-slate-700">|</span> {currentIndex + 1} OF {songs.length}</span>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-indigo-400 tracking-[0.4em]">GIG STUDIO PRO v2.5</span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceOverlay;
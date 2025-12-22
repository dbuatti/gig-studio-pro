"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Play, Pause, SkipForward, SkipBack, X, Music, 
  Waves, ListMusic, Activity, ArrowRight, Volume2, 
  Settings2, Gauge, FileText, Save, Clock, Youtube,
  FileDown, Layout, Maximize2, Monitor
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import AudioVisualizer from './AudioVisualizer';
import Metronome from './Metronome';
import { ALL_KEYS } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";

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

type ViewMode = 'visualizer' | 'video' | 'pdf';

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
  const currentSong = songs[currentIndex];
  const nextSong = songs[currentIndex + 1];
  const [localNotes, setLocalNotes] = useState(currentSong?.notes || "");
  const [tempo, setTempo] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('visualizer');

  useEffect(() => {
    setLocalNotes(currentSong?.notes || "");
    // Default to PDF if available, otherwise Video, then Visualizer
    if (currentSong?.pdfUrl) setViewMode('pdf');
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

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col animate-in fade-in zoom-in duration-300">
      {/* Practice Header */}
      <div className="h-20 border-b border-white/10 px-8 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Stage Command Center</h2>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black uppercase tracking-tight">Performance Mode</span>
              <div className="flex gap-1 ml-4">
                {songs.map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "h-1.5 w-6 rounded-full transition-all duration-500",
                      i === currentIndex ? "bg-indigo-500 w-12" : i < currentIndex ? "bg-green-500" : "bg-white/10"
                    )} 
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-white/10">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setViewMode('visualizer')}
            className={cn("text-[10px] font-black uppercase tracking-widest gap-2", viewMode === 'visualizer' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400")}
          >
            <Waves className="w-3.5 h-3.5" /> Waveform
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            disabled={!videoId}
            onClick={() => setViewMode('video')}
            className={cn("text-[10px] font-black uppercase tracking-widest gap-2", viewMode === 'video' ? "bg-red-600 text-white shadow-lg" : "text-slate-400 disabled:opacity-20")}
          >
            <Youtube className="w-3.5 h-3.5" /> Video
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            disabled={!currentSong?.pdfUrl}
            onClick={() => setViewMode('pdf')}
            className={cn("text-[10px] font-black uppercase tracking-widest gap-2", viewMode === 'pdf' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 disabled:opacity-20")}
          >
            <FileText className="w-3.5 h-3.5" /> Chart
          </Button>
        </div>

        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
          <X className="w-8 h-8" />
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Workspace */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 relative overflow-hidden border-r border-white/5">
          <div className="absolute inset-0 opacity-10 pointer-events-none scale-150 blur-3xl">
            <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
          </div>

          <div className="max-w-6xl w-full h-full flex flex-col space-y-8 z-10">
            {/* Current Song Display (Compact when viewing PDF) */}
            <div className={cn("text-center transition-all duration-500", viewMode === 'pdf' ? "space-y-1" : "space-y-4")}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                <Music className="w-3 h-3" /> Live Channel 01
              </div>
              
              <h1 className={cn("font-black uppercase tracking-tighter leading-none transition-all", viewMode === 'pdf' ? "text-3xl" : "text-6xl")}>
                {currentSong?.name}
              </h1>
              
              <div className={cn("flex items-center justify-center gap-4 font-bold text-slate-400 transition-all", viewMode === 'pdf' ? "text-sm" : "text-xl")}>
                <span>{currentSong?.artist}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                <span className="text-indigo-400 font-mono">
                  {currentSong?.targetKey}
                  {currentSong?.pitch !== 0 && (
                    <span className="text-sm ml-2">({currentSong.pitch > 0 ? '+' : ''}{currentSong.pitch}ST)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Dynamic Viewport */}
            <div className="flex-1 w-full bg-slate-900/40 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
              {viewMode === 'visualizer' && (
                <div className="h-full flex flex-col items-center justify-center p-12 animate-in fade-in duration-500">
                  <div className="w-full h-48">
                    <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
                  </div>
                </div>
              )}

              {viewMode === 'video' && videoId && (
                <div className="h-full w-full animate-in fade-in duration-500 bg-black">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                    title="Reference Video" 
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
                    title="Sheet Music Chart"
                  />
                </div>
              )}

              {/* HUD Progress Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
                <div className="flex justify-between text-[10px] font-mono text-slate-400 font-bold mb-2">
                  <span>{formatTime((progress / 100) * duration)}</span>
                  <div className="flex gap-4">
                     <span className="text-indigo-500 tracking-[0.2em] font-black">MASTER OUTPUT ACTIVE</span>
                     <span className="text-slate-600">|</span>
                     <span>{Math.round(progress)}%</span>
                  </div>
                  <span>{formatTime(duration)}</span>
                </div>
                <Progress value={progress} className="h-2.5 bg-white/5" />
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex flex-col items-center gap-6 pb-4">
              <div className="flex items-center gap-10">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onPrevious}
                  className="h-14 w-14 rounded-full hover:bg-white/10"
                >
                  <SkipBack className="w-7 h-7" />
                </Button>
                
                <Button 
                  size="lg" 
                  onClick={onTogglePlayback}
                  className="h-24 w-24 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_50px_rgba(79,70,229,0.4)] transition-all hover:scale-110"
                >
                  {isPlaying ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12 ml-1" />}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onNext}
                  className="h-14 w-14 rounded-full hover:bg-white/10"
                >
                  <SkipForward className="w-7 h-7" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stage Sidebar */}
        <aside className="w-96 bg-slate-900/30 backdrop-blur-xl p-8 space-y-8 overflow-y-auto shrink-0 border-l border-white/5">
          {/* Metronome Utility */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5" /> Stage Click
            </h3>
            <Metronome initialBpm={parseInt(currentSong?.bpm || "120")} />
          </div>

          {/* Harmonic Controls */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5" /> Performance Key
            </h3>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Target Key</span>
                <span className="text-lg font-mono font-bold text-indigo-400">{currentSong?.targetKey}</span>
              </div>
              <Select 
                value={currentSong?.targetKey} 
                onValueChange={(val) => onUpdateKey(currentSong.id, val)}
              >
                <SelectTrigger className="bg-slate-950 border-white/10 text-xs font-bold font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  {ALL_KEYS.map(k => (
                    <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Performance Notes */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Artist Notes
            </h3>
            <div className="space-y-3">
              <Textarea 
                placeholder="Stage cues..."
                className="bg-slate-950/50 border-white/10 min-h-[120px] text-sm resize-none focus-visible:ring-indigo-500"
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
              />
              <Button 
                onClick={handleSaveNotes}
                className="w-full bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-600/30 font-black uppercase tracking-widest text-[9px] h-10 gap-2"
              >
                <Save className="w-3 h-3" /> Commit Memo
              </Button>
            </div>
          </div>

          {/* Up Next Preview */}
          {nextSong && (
            <div className="pt-8 border-t border-white/5">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">On Deck</div>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 group cursor-pointer hover:bg-white/10 transition-colors" onClick={onNext}>
                <ArrowRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-2 transition-transform" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold truncate">{nextSong.name}</span>
                  <span className="text-[9px] text-slate-500 uppercase font-black">{nextSong.artist}</span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Stage Status Footer */}
      <div className="h-14 border-t border-white/10 px-8 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-900/30">
        <div className="flex gap-8">
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-indigo-500" />
            Display: {viewMode.toUpperCase()} MODE
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            Engine: LOW LATENCY
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span>{currentSong?.name} - {currentIndex + 1} OF {songs.length}</span>
          <span className="text-indigo-400">GIG STUDIO PRO V1.5</span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceOverlay;
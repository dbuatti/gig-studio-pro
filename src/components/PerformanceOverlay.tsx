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
  Settings2, Gauge, FileText, Save, Clock, Youtube
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import AudioVisualizer from './AudioVisualizer';
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

  useEffect(() => {
    setLocalNotes(currentSong?.notes || "");
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
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Musician's Practice Studio</h2>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black uppercase tracking-tight">Practice Session</span>
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
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
          <X className="w-8 h-8" />
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Workspace */}
        <div className="flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden border-r border-white/5">
          <div className="absolute inset-0 opacity-10 pointer-events-none scale-150 blur-3xl">
            <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
          </div>

          <div className="max-w-4xl w-full space-y-8 z-10">
            {/* Current Song Display */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-black uppercase tracking-widest">
                <Music className="w-3 h-3" /> Practicing Now
              </div>
              
              <h1 className="text-6xl font-black uppercase tracking-tighter leading-none">
                {currentSong?.name}
              </h1>
              
              <div className="flex items-center justify-center gap-4 text-xl font-bold text-slate-400">
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

            {/* Visual Workspace: Visualizer OR Video */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="w-full bg-slate-900/40 rounded-3xl border border-white/5 p-6 shadow-2xl flex flex-col justify-center">
                <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
                <div className="mt-6 space-y-4">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 font-bold">
                    <span>{formatTime((progress / 100) * duration)}</span>
                    <span className="text-indigo-500">{(progress).toFixed(1)}% COMPLETE</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <Progress value={progress} className="h-3 bg-white/5" />
                </div>
              </div>

              {videoId ? (
                <div className="w-full aspect-video bg-black rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="Reference Video" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="w-full aspect-video bg-slate-900/20 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center text-slate-600">
                  <Youtube className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No Reference Video Linked</p>
                </div>
              )}
            </div>

            {/* Playback Controls */}
            <div className="flex flex-col items-center gap-6">
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

        {/* Practice Sidebar */}
        <aside className="w-96 bg-slate-900/30 backdrop-blur-xl p-8 space-y-8 overflow-y-auto">
          {/* Real-time Transposer */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <Settings2 className="w-3 h-3" /> Transpose Engine
            </h3>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">Target Performance Key</span>
                <span className="text-lg font-mono font-bold text-indigo-400">{currentSong?.targetKey}</span>
              </div>
              <Select 
                value={currentSong?.targetKey} 
                onValueChange={(val) => onUpdateKey(currentSong.id, val)}
              >
                <SelectTrigger className="bg-slate-950 border-white/10 text-xs font-bold font-mono">
                  <SelectValue placeholder="Select Key" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  {ALL_KEYS.map(k => (
                    <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Speed Control */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <Clock className="w-3 h-3" /> Practice Speed
            </h3>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">Playback Rate</span>
                <span className="text-lg font-mono font-bold text-indigo-400">{tempo.toFixed(2)}x</span>
              </div>
              <Slider 
                value={[tempo]} 
                min={0.5} 
                max={1.5} 
                step={0.01} 
                onValueChange={(v) => setTempo(v[0])}
                className="py-4"
              />
            </div>
          </div>

          {/* Musician's Notes */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <FileText className="w-3 h-3" /> Musician's Notes
            </h3>
            <div className="space-y-3">
              <Textarea 
                placeholder="Intro: 4 bars solo... Watch the bridge tempo..."
                className="bg-slate-950/50 border-white/10 min-h-[150px] text-sm resize-none focus-visible:ring-indigo-500"
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
              />
              <Button 
                onClick={handleSaveNotes}
                className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-widest text-[10px] gap-2"
              >
                <Save className="w-3 h-3" /> Save Note
              </Button>
            </div>
          </div>

          {/* Up Next Preview */}
          {nextSong && (
            <div className="pt-8 border-t border-white/5">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Up Next in Session</div>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 group cursor-pointer hover:bg-white/10 transition-colors" onClick={onNext}>
                <ArrowRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-2 transition-transform" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{nextSong.name}</span>
                  <span className="text-[10px] text-slate-500 uppercase font-black">{nextSong.artist}</span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Footer Status */}
      <div className="h-16 border-t border-white/10 px-8 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-900/30">
        <div className="flex gap-8">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3 h-3 text-indigo-500" />
            Output: Practice Monitors
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            Cloud Save: Active
          </div>
        </div>
        <div>
          Gig Studio Pro | Practice Mode v1.2
        </div>
      </div>
    </div>
  );
};

export default PerformanceOverlay;
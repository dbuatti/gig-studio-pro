"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Play, Pause, SkipForward, SkipBack, X, Music, 
  Waves, Activity, ArrowRight, Shuffle,
  Settings2, Gauge, FileText, Save, Youtube,
  Monitor, AlignLeft, RotateCcw, ShieldCheck, ExternalLink,
  Clock, Timer, ChevronRight, Zap, Minus, Plus, Edit3, Check, Keyboard,
  Music2
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import AudioVisualizer from './AudioVisualizer';
import Metronome from './Metronome';
import SongStudioModal from './SongStudioModal';
import ShortcutLegend from './ShortcutLegend';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { Badge } from './ui/badge';
import { useSettings } from '@/hooks/use-settings';
import { transposeTextContent } from '@/utils/chordUtils';

interface PerformanceOverlayProps {
  songs: SetlistSong[];
  currentIndex: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onTogglePlayback: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShuffle: () => void;
  onClose: () => void;
  onUpdateSong: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  analyzer: any;
}

const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  songs, currentIndex, isPlaying, progress, duration, onTogglePlayback, onNext, onPrevious, onShuffle, onClose, onUpdateSong, onUpdateKey, analyzer
}) => {
  const { keyPreference: globalPreference } = useSettings();
  const currentSong = songs[currentIndex];
  const nextSong = songs[currentIndex + 1];
  const [localNotes, setLocalNotes] = useState(currentSong?.notes || "");
  const [viewMode, setViewMode] = useState<string>(currentSong?.preferred_view || 'visualizer');
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [wallClock, setWallClock] = useState(new Date());
  const [setStartTime] = useState(new Date());
  const [elapsedSetTime, setElapsedSetTime] = useState("00:00:00");
  const swipeStartX = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') onClose();
      if (e.code === 'Space') { e.preventDefault(); onTogglePlayback(); }
      if (e.key === 'ArrowLeft') onPrevious();
      if (e.key === 'ArrowRight') onNext();
      if (e.key.toLowerCase() === 'e') setIsStudioOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onTogglePlayback, onPrevious, onNext]);

  useEffect(() => {
    const timer = setInterval(() => {
      setWallClock(new Date());
      const diff = new Date().getTime() - setStartTime.getTime();
      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      setElapsedSetTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [setStartTime]);

  useEffect(() => {
    setLocalNotes(currentSong?.notes || "");
    setViewMode(currentSong?.preferred_view || 'visualizer');
  }, [currentSong]);

  const transposedChords = useMemo(() => {
    if (!currentSong?.chord_content) return "";
    return transposeTextContent(currentSong.chord_content, currentSong.pitch || 0);
  }, [currentSong?.chord_content, currentSong?.pitch]);

  const handleTouchStart = (e: React.TouchEvent) => { swipeStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const diff = swipeStartX.current - endX;
    if (Math.abs(diff) > 100) {
      if (diff > 0) onNext(); else onPrevious();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col font-sans overflow-hidden h-screen w-screen"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="h-20 border-b border-white/10 px-10 flex items-center justify-between bg-slate-900/80 backdrop-blur-2xl shrink-0 shadow-2xl relative z-50">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-6"><div className="bg-indigo-600 p-2 rounded-2xl shadow-lg"><Activity className="w-8 h-8 animate-pulse text-white" /></div>
          <div><h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-1 font-mono">Performance Engine v3.5</h2><div className="flex items-center gap-4"><span className="text-2xl font-black uppercase tracking-tight">Active Stage</span></div></div></div>
          <div className="hidden xl:flex items-center gap-12 border-l border-white/10 pl-12 font-mono">
            <div className="flex items-center gap-4"><div className="p-2 bg-white/5 rounded-xl"><Clock className="w-5 h-5 text-slate-500" /></div><div className="flex flex-col"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Local Time</span><span className="text-xl font-black text-white">{wallClock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div>
            <div className="flex items-center gap-4"><div className="p-2 bg-indigo-600/10 rounded-xl"><Timer className="w-5 h-5 text-indigo-400" /></div><div className="flex flex-col"><span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Set Duration</span><span className="text-xl font-black text-white">{elapsedSetTime}</span></div></div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/10">
            {[
              { id: 'visualizer', label: 'Matrix', icon: Waves, color: 'bg-indigo-600' },
              { id: 'lyrics', label: 'Lyrics', icon: AlignLeft, color: 'bg-pink-600', disabled: !currentSong?.lyrics },
              { id: 'pdf', label: 'Chart', icon: FileText, color: 'bg-emerald-600', disabled: !currentSong?.pdfUrl },
              { id: 'chords', label: 'Chords', icon: Music2, color: 'bg-orange-600', disabled: !currentSong?.chord_content }
            ].map((m) => (
              <Button key={m.id} variant="ghost" size="sm" disabled={m.disabled} onClick={() => setViewMode(m.id)} className={cn("text-[9px] font-black uppercase tracking-widest h-8 px-4 gap-2 rounded-xl", viewMode === m.id ? `${m.color} text-white shadow-lg` : "text-slate-500")}>
                <m.icon className="w-3 h-3" /> {m.label}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-500/20 hover:text-red-400 h-12 w-12"><X className="w-8 h-8" /></Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden h-full">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="text-center px-6 pt-10 pb-6 transition-all duration-700 z-10 relative flex flex-col items-center justify-center shrink-0">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none drop-shadow-2xl uppercase truncate max-w-full px-4">{currentSong?.name}</h1>
            <div className="mt-4 flex items-center justify-center gap-6 font-black text-slate-400 uppercase tracking-tight text-2xl md:text-4xl">
              <span>{currentSong?.artist}</span><div className="w-1.5 h-1.5 rounded-full bg-slate-800" /><span className="text-indigo-400 font-mono">{formatKey(currentSong?.targetKey || currentSong?.originalKey, globalPreference)}</span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-8 relative z-10">
            {viewMode === 'visualizer' && <div className="h-full flex flex-col items-center justify-center"><div className="w-full max-w-5xl p-12 bg-white/5 rounded-[3rem] border border-white/5 shadow-2xl backdrop-blur-sm"><AudioVisualizer analyzer={analyzer} isActive={isPlaying} /></div></div>}
            {viewMode === 'lyrics' && <div className="h-full overflow-y-auto px-32 custom-scrollbar text-center py-24 whitespace-pre-wrap text-5xl md:text-7xl font-black uppercase tracking-tighter">{currentSong?.lyrics}</div>}
            {viewMode === 'chords' && (
              <div className="h-full overflow-y-auto px-16 custom-scrollbar text-left py-12 bg-slate-900/50 rounded-3xl border border-white/5 font-mono text-2xl md:text-4xl whitespace-pre-wrap text-orange-400 leading-relaxed">
                {transposedChords}
              </div>
            )}
            {viewMode === 'pdf' && currentSong?.pdfUrl && <div className="h-full w-full bg-slate-900 rounded-[4rem] overflow-hidden border-4 border-white/5"><iframe src={`${currentSong.pdfUrl}#toolbar=0`} className="w-full h-full bg-white" title="Chart" /></div>}
          </div>
        </div>

        <aside className="w-[450px] bg-slate-900/80 backdrop-blur-3xl p-10 flex flex-col space-y-8 overflow-y-auto border-l border-white/10 relative z-50 shrink-0">
          <div className="space-y-4"><h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 flex items-center gap-2 font-mono"><Gauge className="w-4 h-4" /> Live Timing Engine</h3><Metronome initialBpm={parseInt(currentSong?.bpm || "120")} /></div>
          <div className="space-y-4"><h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 flex items-center gap-2 font-mono"><Activity className="w-4 h-4" /> Stage Memo</h3><Textarea className="bg-slate-950 border-white/5 min-h-[140px] text-lg rounded-[1.5rem] p-6 focus:ring-indigo-500/20" value={localNotes} onChange={(e) => setLocalNotes(e.target.value)} onBlur={() => onUpdateSong(currentSong.id, { notes: localNotes })} /></div>
          {nextSong && <div className="pt-6 border-t border-white/10"><div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4 font-mono">Next Track</div><div className="bg-indigo-600/5 border border-indigo-500/20 rounded-[2rem] p-6 flex items-center gap-6 cursor-pointer hover:bg-indigo-600/10 transition-all group" onClick={onNext}><div className="bg-indigo-600 p-3 rounded-2xl group-hover:scale-110 transition-transform"><ArrowRight className="w-5 h-5 text-white" /></div><div className="min-w-0"><div className="text-xl font-black uppercase tracking-tight truncate">{nextSong.name}</div><div className="text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest">{nextSong.artist}</div></div></div></div>}
        </aside>
      </div>

      <div className="h-28 border-t border-white/10 bg-slate-900/90 backdrop-blur-2xl px-12 flex items-center justify-between shrink-0 relative z-50">
        <div className="flex items-center gap-10 text-sm font-mono min-w-[320px]"><span className="text-2xl font-black text-indigo-400">{Math.floor(((progress/100)*duration)/60)}:{Math.floor(((progress/100)*duration)%60).toString().padStart(2,'0')}</span><div className="flex-1 w-64 space-y-2"><Progress value={progress} className="h-3 bg-white/5" /></div><span className="text-2xl font-black text-slate-500">{Math.floor(duration/60)}:{Math.floor(duration%60).toString().padStart(2,'0')}</span></div>
        <div className="flex items-center gap-12 flex-1 justify-center"><Button variant="ghost" size="icon" onClick={onPrevious} className="h-16 w-16 rounded-full text-slate-400"><SkipBack className="w-10 h-10" /></Button><Button onClick={onTogglePlayback} className="h-24 w-24 rounded-full bg-indigo-600 shadow-[0_0_50px_rgba(79,70,229,0.3)] transition-all hover:scale-110 flex items-center justify-center p-0">{isPlaying ? <Pause className="w-12 h-12 text-white" /> : <Play className="w-12 h-12 ml-2 fill-current text-white" />}</Button><Button variant="ghost" size="icon" onClick={onNext} className="h-16 w-16 rounded-full text-slate-400"><SkipForward className="w-10 h-10" /></Button></div>
        <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 min-w-[320px] justify-end"><Button variant="ghost" onClick={onShuffle} className="h-10 px-4 bg-white/5 border border-white/5 text-indigo-400 gap-2 rounded-xl"><Shuffle className="w-4 h-4" /> Shuffle</Button></div>
      </div>
    </div>
  );
};

export default PerformanceOverlay;
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { 
  Play, Pause, SkipForward, SkipBack, X, Music, 
  Waves, Activity, ArrowRight, Volume2, 
  Settings2, Gauge, FileText, Save, Youtube,
  Monitor, AlignLeft
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
  const [scrollSpeed, setScrollSpeed] = useState(1.0);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricsLinesRef = useRef<HTMLDivElement[]>([]);

  const currentPref = currentSong?.key_preference || globalPreference;
  const nextPref = nextSong?.key_preference || globalPreference;
  const keysToUse = currentPref === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  const parseLyricsWithTimestamps = (lyrics: string) => {
    const lines = lyrics.split('\n');
    const sections: { time: number; text: string }[] = [];
    let currentText: string[] = [];

    for (const line of lines) {
      const timestampMatch = line.match(/^\[(\d+):(\d{2})\]\s*(.*)$/);
      if (timestampMatch) {
        if (currentText.length > 0) {
          sections.push({ time: -1, text: currentText.join('\n') });
          currentText = [];
        }
        const minutes = parseInt(timestampMatch[1]);
        const seconds = parseInt(timestampMatch[2]);
        sections.push({ time: minutes * 60 + seconds, text: timestampMatch[3] || '' });
      } else {
        currentText.push(line);
      }
    }
    if (currentText.length > 0) {
      sections.push({ time: -1, text: currentText.join('\n') });
    }
    return sections;
  };

  const lyricsSections = currentSong?.lyrics ? parseLyricsWithTimestamps(currentSong.lyrics) : [];
  const hasTimestamps = lyricsSections.some(s => s.time >= 0);

  const currentTime = (progress / 100) * duration;
  const adjustedTime = currentTime * scrollSpeed;

  useEffect(() => {
    if (viewMode !== 'lyrics' || !lyricsContainerRef.current || duration === 0) return;

    if (hasTimestamps) {
      let targetIndex = lyricsSections.findIndex(s => s.time > adjustedTime);
      if (targetIndex === -1) targetIndex = lyricsSections.length;
      targetIndex = Math.max(0, targetIndex - 1);

      const targetEl = lyricsLinesRef.current[targetIndex];
      if (targetEl && lyricsContainerRef.current) {
        const container = lyricsContainerRef.current;
        const offset = targetEl.offsetTop - container.offsetTop - container.clientHeight * 0.35;
        container.scrollTop = offset;
      }
    } else {
      const scrollHeight = lyricsContainerRef.current.scrollHeight - lyricsContainerRef.current.clientHeight;
      const targetScroll = (adjustedTime / duration) * scrollHeight - lyricsContainerRef.current.clientHeight * 0.35;
      lyricsContainerRef.current.scrollTop = Math.max(0, targetScroll);
    }
  }, [progress, duration, viewMode, hasTimestamps, scrollSpeed, lyricsSections]);

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
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <div className="h-24 border-b border-white/10 px-10 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-6">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-600/20">
            <Activity className="w-8 h-8 animate-pulse text-white" />
          </div>
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-1 font-mono">Mission Control V2.9</h2>
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

        <div className="hidden lg:flex items-center gap-12 border-x border-white/5 px-12 mx-8 font-mono">
           <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Tempo</span>
              <span className="text-xl font-black text-indigo-400">{currentSong?.bpm || "--"} BPM</span>
           </div>
           <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Genre</span>
              <span className="text-xl font-black text-white uppercase">{currentSong?.genre || "STD"}</span>
           </div>
           <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Pitch</span>
              <span className="text-xl font-black text-indigo-400">{currentSong?.pitch > 0 ? '+' : ''}{currentSong?.pitch || 0}ST</span>
           </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex bg-slate-800/50 p-1.5 rounded-2xl border border-white/10 shadow-inner font-mono">
            <Button variant="ghost" size="sm" onClick={() => setViewMode('visualizer')}
              className={cn("text-[10px] font-black uppercase tracking-widest h-9 px-5 gap-2 rounded-xl transition-all", viewMode === 'visualizer' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}>
              <Waves className="w-3.5 h-3.5" /> Wave
            </Button>
            <Button variant="ghost" size="sm" disabled={!currentSong?.lyrics} onClick={() => setViewMode('lyrics')}
              className={cn("text-[10px] font-black uppercase tracking-widest h-9 px-5 gap-2 rounded-xl transition-all", viewMode === 'lyrics' ? "bg-pink-600 text-white shadow-lg" : "text-slate-400 hover:text-white disabled:opacity-20")}>
              <AlignLeft className="w-3.5 h-3.5" /> Lyrics
            </Button>
            <Button variant="ghost" size="sm" disabled={!videoId} onClick={() => setViewMode('video')}
              className={cn("text-[10px] font-black uppercase tracking-widest h-9 px-5 gap-2 rounded-xl transition-all", viewMode === 'video' ? "bg-red-600 text-white shadow-lg" : "text-slate-400 hover:text-white disabled:opacity-20")}>
              <Youtube className="w-3.5 h-3.5" /> Video
            </Button>
            <Button variant="ghost" size="sm" disabled={!currentSong?.pdfUrl} onClick={() => setViewMode('pdf')}
              className={cn("text-[10px] font-black uppercase tracking-widest h-9 px-5 gap-2 rounded-xl transition-all", viewMode === 'pdf' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-white disabled:opacity-20")}>
              <FileText className="w-3.5 h-3.5" /> Chart
            </Button>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10 h-12 w-12 transition-all">
            <X className="w-8 h-8" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="absolute inset-0 opacity-10 pointer-events-none blur-3xl scale-150">
            <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
          </div>

          {/* Title & Artist */}
          <div className={cn("text-center pt-12 pb-8 px-12 transition-all duration-700 z-10", viewMode === 'lyrics' ? "pt-8 pb-6" : "pt-16")}>
            <h1 className={cn(
              "font-black tracking-tight leading-none drop-shadow-2xl transition-all duration-700",
              viewMode === 'lyrics' ? "text-5xl lg:text-7xl" : "text-7xl lg:text-9xl"
            )}>
              {currentSong?.name}
            </h1>
            <div className="mt-6 flex items-center justify-center gap-10 text-3xl lg:text-4xl font-bold text-slate-300">
              <span>{currentSong?.artist}</span>
              <span className="text-indigo-400 font-mono font-black">{displayCurrentKey}</span>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-hidden px-8 pb-32"> {/* Reserves space for compact controls */}
            {viewMode === 'visualizer' && (
              <div className="h-full flex items-center justify-center">
                <div className="w-full max-w-5xl">
                  <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
                </div>
              </div>
            )}

            {viewMode === 'lyrics' && currentSong?.lyrics && (
              <div ref={lyricsContainerRef} className="h-full overflow-y-auto px-8 lg:px-32 custom-scrollbar scroll-smooth">
                <div className="max-w-5xl mx-auto py-16 space-y-20">
                  {lyricsSections.map((section, i) => {
                    const isPast = hasTimestamps && section.time >= 0 && section.time < adjustedTime;
                    const isCurrent = hasTimestamps 
                      ? (i === lyricsSections.findIndex(s => s.time > adjustedTime) - 1 || 
                         (i === lyricsSections.length - 1 && adjustedTime >= section.time))
                      : false;

                    const isProportionalCurrent = !hasTimestamps && 
                      i / lyricsSections.length >= progress / 100 - 0.1 && 
                      i / lyricsSections.length <= progress / 100 + 0.1;

                    const active = isCurrent || isProportionalCurrent;

                    return (
                      <div
                        key={i}
                        ref={el => el && (lyricsLinesRef.current[i] = el)}
                        className={cn(
                          "transition-all duration-1000 text-center leading-loose whitespace-pre-wrap",
                          section.time >= 0
                            ? cn(
                                "text-6xl lg:text-8xl font-black tracking-tight",
                                active 
                                  ? "text-pink-400 scale-110 drop-shadow-2xl shadow-pink-500/70" 
                                  : isPast 
                                    ? "text-white/40" 
                                    : "text-white/25"
                              )
                            : "text-4xl lg:text-5xl font-medium text-white/50"
                        )}
                      >
                        {section.text || <span className="italic text-white/20">...</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'video' && videoId && (
              <div className="h-full w-full bg-black rounded-[3rem] overflow-hidden shadow-2xl mx-8">
                <iframe 
                  width="100%" height="100%" 
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1`}
                  title="Reference Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {viewMode === 'pdf' && currentSong?.pdfUrl && (
              <div className="h-full w-full bg-white rounded-[3rem] overflow-hidden shadow-2xl mx-8">
                <iframe 
                  src={`${currentSong.pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                  className="w-full h-full"
                  title="Sheet Music"
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-[450px] bg-slate-900/60 backdrop-blur-2xl p-10 space-y-10 overflow-y-auto border-l border-white/5">
          <div className="space-y-5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2 font-mono">
              <Gauge className="w-4 h-4" /> Live Click Track
            </h3>
            <Metronome initialBpm={parseInt(currentSong?.bpm || "120")} />
          </div>

          {viewMode === 'lyrics' && (
            <div className="space-y-5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-pink-400 flex items-center gap-2 font-mono">
                <Activity className="w-4 h-4" /> Scroll Speed
              </h3>
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <div className="flex justify-between mb-3">
                  <span className="text-sm font-mono text-slate-400">Speed</span>
                  <span className="text-lg font-black text-pink-400 font-mono">{scrollSpeed.toFixed(2)}x</span>
                </div>
                <Slider
                  value={[scrollSpeed]}
                  onValueChange={([v]) => setScrollSpeed(v)}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Other sidebar sections unchanged */}
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
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Shift</span>
                  <span className="text-2xl font-mono font-black text-slate-300">{currentSong?.pitch > 0 ? '+' : ''}{currentSong?.pitch || 0}ST</span>
                </div>
              </div>
              <Select value={currentSong?.targetKey} onValueChange={(val) => onUpdateKey(currentSong!.id, val)}>
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

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2 font-mono">
                <FileText className="w-4 h-4" /> Stage Cues
              </h3>
              <Badge className="bg-indigo-600/10 text-indigo-400 text-[8px] border-indigo-600/20 font-mono">SYNCED</Badge>
            </div>
            <Textarea 
              placeholder="Cues, transitions..."
              className="bg-slate-950/30 border-white/5 min-h-[180px] text-base leading-relaxed resize-none rounded-2xl"
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
            />
            <Button onClick={handleSaveNotes} className="w-full bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-12 rounded-2xl">
              <Save className="w-4 h-4 mr-2" /> Save Memo
            </Button>
          </div>

          {nextSong && (
            <div className="pt-10 border-t border-white/5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 font-mono">On Deck</div>
              <div className="bg-white/5 border border-white/5 rounded-[2rem] p-6 flex items-center gap-6 cursor-pointer hover:bg-white/10 transition-all" onClick={onNext}>
                <div className="bg-indigo-600/20 p-3 rounded-2xl">
                  <ArrowRight className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <div className="text-lg font-black uppercase">{nextSong.name}</div>
                  <div className="text-sm text-slate-400">{nextSong.artist} • {displayNextKey}</div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Compact Floating Playback Bar – No Longer Giant */}
      <div className="absolute bottom-0 left-0 right-0 px-8 pb-8 pointer-events-none">
        <div className="max-w-6xl mx-auto pointer-events-auto">
          <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-8 text-sm font-mono text-slate-400">
                <span className="text-indigo-400 font-bold">{formatTime(currentTime)}</span>
                <span className="text-emerald-400 flex items-center gap-2 text-xs">
                  <Activity className="w-3 h-3 animate-pulse" /> ENGAGED
                </span>
              </div>
              <div className="flex items-center gap-8 text-sm font-mono text-slate-400">
                <span>{Math.round(progress)}%</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <Progress value={progress} className="h-2 mb-6 bg-white/10" />

            <div className="flex items-center justify-center gap-10">
              <Button variant="ghost" size="icon" onClick={onPrevious} className="h-14 w-14 rounded-full hover:bg-white/10">
                <SkipBack className="w-8 h-8" />
              </Button>

              <Button 
                onClick={onTogglePlayback}
                className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-xl transition-all hover:scale-110 active:scale-95"
              >
                {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}
              </Button>

              <Button variant="ghost" size="icon" onClick={onNext} className="h-14 w-14 rounded-full hover:bg-white/10">
                <SkipForward className="w-8 h-8" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="h-12 border-t border-white/10 px-10 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.3em] text-slate-600 bg-slate-900/40 font-mono">
        <div className="flex gap-8">
          <span>{viewMode.toUpperCase()} MODE</span>
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" />SYNC</span>
        </div>
        <span className="text-indigo-400">GIG STUDIO PRO v2.9</span>
      </div>
    </div>
  );
};

export default PerformanceOverlay;
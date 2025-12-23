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
  Waves, Activity, ArrowRight, 
  Settings2, Gauge, FileText, Save, Youtube,
  Monitor, AlignLeft, RotateCcw, ShieldCheck, ExternalLink,
  Clock, Timer, ChevronRight, Zap, Minus, Plus
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import AudioVisualizer from './AudioVisualizer';
import Metronome from './Metronome';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, calculateSemitones, transposeKey } from '@/utils/keyUtils';
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
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  
  // Performance HUD State
  const [wallClock, setWallClock] = useState(new Date());
  const [setStartTime] = useState(new Date());
  const [elapsedSetTime, setElapsedSetTime] = useState("00:00:00");

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricsLinesRef = useRef<HTMLDivElement[]>([]);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const autoScrollRaf = useRef<number | null>(null);

  const currentPref = currentSong?.key_preference || globalPreference;
  const nextPref = nextSong?.key_preference || globalPreference;
  const keysToUse = currentPref === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  // Wall Clock and Set Timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setWallClock(now);
      
      const diff = now.getTime() - setStartTime.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsedSetTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [setStartTime]);

  const parseLyricsWithTimestamps = useCallback((lyrics: string) => {
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
  }, []);

  const lyricsSections = useMemo(() => 
    currentSong?.lyrics ? parseLyricsWithTimestamps(currentSong.lyrics) : [], 
    [currentSong?.lyrics, parseLyricsWithTimestamps]
  );
  
  const hasTimestamps = lyricsSections.some(s => s.time >= 0);
  const currentTime = (progress / 100) * duration;
  const adjustedTime = currentTime * scrollSpeed;

  useEffect(() => {
    const container = lyricsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      isUserScrolling.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrolling.current = false;
      }, 1500); 
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('touchmove', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('touchmove', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (viewMode !== 'lyrics' || !autoScrollEnabled || !lyricsContainerRef.current || duration === 0 || isUserScrolling.current) {
      if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current);
      return;
    }

    const container = lyricsContainerRef.current;

    const performScroll = () => {
      let targetScroll = 0;

      if (hasTimestamps) {
        let targetIndex = lyricsSections.findIndex(s => s.time > adjustedTime);
        if (targetIndex === -1) targetIndex = lyricsSections.length;
        targetIndex = Math.max(0, targetIndex - 1);

        const targetEl = lyricsLinesRef.current[targetIndex];
        if (targetEl) {
          targetScroll = targetEl.offsetTop - container.offsetTop - container.clientHeight * 0.35;
        }
      } else {
        const scrollHeight = container.scrollHeight - container.clientHeight;
        targetScroll = (adjustedTime / duration) * scrollHeight - container.clientHeight * 0.35;
      }

      const diff = targetScroll - container.scrollTop;
      if (Math.abs(diff) > 2) {
        container.scrollTop += diff * 0.15; 
        autoScrollRaf.current = requestAnimationFrame(performScroll);
      } else {
        container.scrollTop = Math.max(0, targetScroll);
      }
    };

    autoScrollRaf.current = requestAnimationFrame(performScroll);

    return () => {
      if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current);
    };
  }, [progress, duration, viewMode, autoScrollEnabled, hasTimestamps, scrollSpeed, adjustedTime, lyricsSections]);

  useEffect(() => {
    setLocalNotes(currentSong?.notes || "");
    setAutoScrollEnabled(true);
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

  const handleQuickTranspose = (direction: 'up' | 'down') => {
    if (!currentSong) return;
    const shift = direction === 'up' ? 1 : -1;
    const newPitch = (currentSong.pitch || 0) + shift;
    
    // Find new target key based on original key and new pitch
    const newTarget = transposeKey(currentSong.originalKey || "C", newPitch);
    onUpdateKey(currentSong.id, newTarget);
  };

  const isFramable = (url: string | null | undefined) => {
    if (!url) return true;
    const blockedSites = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blockedSites.some(site => url.includes(site));
  };

  const displayCurrentKey = formatKey(currentSong?.targetKey || currentSong?.originalKey, currentPref);
  const displayNextKey = formatKey(nextSong?.targetKey || nextSong?.originalKey, nextPref);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top HUD Header */}
      <div className="h-24 border-b border-white/10 px-10 flex items-center justify-between bg-slate-900/80 backdrop-blur-2xl shrink-0 shadow-2xl relative z-50">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-6">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-600/30">
              <Activity className="w-8 h-8 animate-pulse text-white" />
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-1 font-mono">Performance Engine v3.5</h2>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-black uppercase tracking-tight">Active Stage</span>
                <div className="flex gap-1.5">
                  {songs.map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "h-1.5 w-6 rounded-full transition-all duration-700",
                        i === currentIndex ? "bg-indigo-500 w-16 shadow-[0_0_10px_rgba(99,102,241,0.5)]" : i < currentIndex ? "bg-emerald-500/40" : "bg-white/10"
                      )} 
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-12 border-l border-white/10 pl-12 font-mono">
            <div className="flex items-center gap-4">
               <div className="p-2 bg-white/5 rounded-xl">
                 <Clock className="w-5 h-5 text-slate-500" />
               </div>
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Local Time</span>
                  <span className="text-xl font-black text-white">{wallClock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="p-2 bg-indigo-600/10 rounded-xl">
                 <Timer className="w-5 h-5 text-indigo-400" />
               </div>
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Set Duration</span>
                  <span className="text-xl font-black text-white">{elapsedSetTime}</span>
               </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-white/10 shadow-inner font-mono">
            {[
              { id: 'visualizer', label: 'Matrix', icon: Waves, color: 'bg-indigo-600' },
              { id: 'lyrics', label: 'Lyrics', icon: AlignLeft, color: 'bg-pink-600', disabled: !currentSong?.lyrics },
              { id: 'video', label: 'Video', icon: Youtube, color: 'bg-red-600', disabled: !videoId },
              { id: 'pdf', label: 'Chart', icon: FileText, color: 'bg-emerald-600', disabled: !currentSong?.pdfUrl }
            ].map((mode) => (
              <Button 
                key={mode.id}
                variant="ghost" 
                size="sm" 
                disabled={mode.disabled}
                onClick={() => setViewMode(mode.id as any)}
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest h-9 px-5 gap-2 rounded-xl transition-all", 
                  viewMode === mode.id ? `${mode.color} text-white shadow-lg` : "text-slate-500 hover:text-white disabled:opacity-10"
                )}
              >
                <mode.icon className="w-3.5 h-3.5" /> {mode.label}
              </Button>
            ))}
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-500/20 hover:text-red-400 h-12 w-12 transition-all">
            <X className="w-8 h-8" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col relative">
          {/* Background Ambient FX */}
          <div className="absolute inset-0 opacity-10 pointer-events-none blur-[120px] scale-150 overflow-hidden">
            <div className="w-full h-full bg-indigo-600/30 rounded-full animate-pulse" />
          </div>

          <div className={cn("text-center pt-12 pb-8 px-12 transition-all duration-700 z-10 relative", viewMode === 'lyrics' ? "pt-8 pb-6" : "pt-16")}>
            <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-indigo-600/10 border border-indigo-500/20 rounded-full mb-6">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
               <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono">Performance Status: Stable</span>
            </div>
            <h1 className={cn(
              "font-black tracking-tighter leading-none drop-shadow-2xl transition-all duration-700 uppercase",
              viewMode === 'lyrics' ? "text-5xl lg:text-7xl" : "text-8xl lg:text-[10rem]"
            )}>
              {currentSong?.name}
            </h1>
            <div className="mt-8 flex items-center justify-center gap-12 text-3xl lg:text-5xl font-black text-slate-400 uppercase tracking-tight">
              <span>{currentSong?.artist}</span>
              <div className="w-2 h-2 rounded-full bg-slate-800" />
              <span className="text-indigo-400 font-mono drop-shadow-[0_0_15px_rgba(129,140,248,0.3)]">{displayCurrentKey}</span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-8 relative z-10">
            {viewMode === 'visualizer' && (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-full max-w-6xl p-12 bg-white/5 rounded-[4rem] border border-white/5 shadow-2xl backdrop-blur-sm">
                  <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
                </div>
              </div>
            )}

            {viewMode === 'lyrics' && currentSong?.lyrics && (
              <div ref={lyricsContainerRef} className="h-full overflow-y-auto px-8 lg:px-32 custom-scrollbar scroll-smooth">
                <div className="max-w-6xl mx-auto py-24 space-y-24">
                  {lyricsSections.map((section, i) => {
                    const isPast = hasTimestamps && section.time >= 0 && section.time < adjustedTime;
                    const isCurrent = hasTimestamps 
                      ? (i === lyricsSections.findIndex(s => s.time > adjustedTime) - 1 || 
                         (i === lyricsSections.length - 1 && adjustedTime >= section.time))
                      : false;

                    const isProportionalCurrent = !hasTimestamps && 
                      Math.abs((i / (lyricsSections.length - 1)) - (progress / 100)) < 0.1;

                    const active = autoScrollEnabled && (isCurrent || isProportionalCurrent);

                    return (
                      <div
                        key={i}
                        ref={el => el && (lyricsLinesRef.current[i] = el)}
                        className={cn(
                          "transition-all duration-1000 text-center leading-tight whitespace-pre-wrap",
                          section.time >= 0
                            ? cn(
                                "text-6xl lg:text-9xl font-black tracking-tighter uppercase",
                                active 
                                  ? "text-white scale-110 drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] blur-none" 
                                  : isPast 
                                    ? "text-white/20 blur-[2px]" 
                                    : "text-white/10 blur-[4px]"
                              )
                            : "text-4xl lg:text-6xl font-bold text-indigo-500/40 uppercase tracking-widest italic"
                        )}
                      >
                        {section.text || <span className="italic text-white/10">...</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'video' && videoId && (
              <div className="h-full w-full bg-black rounded-[4rem] overflow-hidden shadow-2xl mx-8 border-4 border-white/5">
                <iframe 
                  width="100%" height="100%" 
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1&showinfo=0`}
                  title="Reference Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {viewMode === 'pdf' && currentSong?.pdfUrl && (
              <div className="h-full w-full bg-slate-900 rounded-[4rem] overflow-hidden shadow-2xl mx-8 relative border-4 border-white/5">
                {isFramable(currentSong.pdfUrl) ? (
                  <iframe 
                    src={`${currentSong.pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                    className="w-full h-full bg-white"
                    title="Sheet Music"
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center p-12 text-center bg-slate-950">
                    <ShieldCheck className="w-32 h-32 text-indigo-400 mb-10" />
                    <h4 className="text-5xl font-black uppercase tracking-tight mb-6">Asset Protected</h4>
                    <p className="text-slate-500 max-w-xl mb-16 text-xl font-medium leading-relaxed">
                      External security prevents in-app display. Use the button below to launch in a secure dedicated performance window.
                    </p>
                    <Button onClick={() => window.open(currentSong.pdfUrl, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-20 px-16 font-black uppercase tracking-[0.2em] text-sm rounded-3xl shadow-2xl shadow-indigo-600/30 gap-6">
                      <ExternalLink className="w-8 h-8" /> Launch Chart Window
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Performance Controls */}
        <aside className="w-[480px] bg-slate-900/80 backdrop-blur-3xl p-10 space-y-10 overflow-y-auto border-l border-white/10 relative z-50">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 flex items-center gap-2 font-mono">
                <Gauge className="w-4 h-4" /> Live Timing Engine
              </h3>
              <Badge className="bg-indigo-600/20 text-indigo-400 border-indigo-600/20 font-mono text-[9px]">LOCKED</Badge>
            </div>
            <Metronome initialBpm={parseInt(currentSong?.bpm || "120")} />
          </div>

          {viewMode === 'lyrics' && (
            <div className="space-y-6 animate-in slide-in-from-right duration-500">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-pink-400 flex items-center gap-2 font-mono">
                <AlignLeft className="w-4 h-4" /> Teleprompter Controls
              </h3>
              <div className="bg-white/5 rounded-3xl p-8 border border-white/10 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase text-white">Auto-Scroll</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Track Song Progress</span>
                  </div>
                  <Switch 
                    checked={autoScrollEnabled}
                    onCheckedChange={setAutoScrollEnabled}
                    className="data-[state=checked]:bg-pink-600 scale-125"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Velocity</span>
                    <span className="text-2xl font-black text-pink-400 font-mono">{scrollSpeed.toFixed(2)}x</span>
                  </div>
                  <Slider
                    value={[scrollSpeed]}
                    onValueChange={([v]) => setScrollSpeed(v)}
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    disabled={!autoScrollEnabled}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 flex items-center gap-2 font-mono">
              <Settings2 className="w-4 h-4" /> Harmonic Override
            </h3>
            <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/10 space-y-8">
              <div className="grid grid-cols-2 gap-8 relative">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono mb-2">Original</span>
                  <span className="text-3xl font-mono font-black text-slate-400">{currentSong?.originalKey || "TBC"}</span>
                </div>
                <div className="h-12 w-px bg-white/10 absolute left-1/2 -translate-x-1/2 top-2" />
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono mb-2">Stage Key</span>
                  <span className="text-3xl font-mono font-black text-white">{displayCurrentKey}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <Select value={currentSong?.targetKey} onValueChange={(val) => onUpdateKey(currentSong!.id, val)}>
                    <SelectTrigger className="bg-slate-950 border-white/10 text-sm font-black font-mono h-14 rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      {keysToUse.map(k => (
                        <SelectItem key={k} value={k} className="font-mono font-bold">{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex bg-slate-950 border border-white/10 rounded-2xl p-1">
                  <Button variant="ghost" size="icon" onClick={() => handleQuickTranspose('down')} className="h-12 w-12 rounded-xl hover:bg-white/5 text-slate-400">
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleQuickTranspose('up')} className="h-12 w-12 rounded-xl hover:bg-white/5 text-slate-400">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 flex items-center gap-2 font-mono">
                <Activity className="w-4 h-4" /> Stage Cues & Memo
              </h3>
            </div>
            <Textarea 
              placeholder="Live notes, cues..."
              className="bg-slate-950 border-white/5 min-h-[160px] text-lg font-medium leading-relaxed resize-none rounded-[2rem] p-8 focus:ring-indigo-500/20"
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleSaveNotes}
            />
          </div>

          {nextSong && (
            <div className="pt-10 border-t border-white/10">
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-8 font-mono">Transmission Sequence: Next</div>
              <div className="bg-indigo-600/5 border border-indigo-500/20 rounded-[2.5rem] p-8 flex items-center gap-8 cursor-pointer hover:bg-indigo-600/10 transition-all group" onClick={onNext}>
                <div className="bg-indigo-600 p-4 rounded-[1.5rem] shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">
                  <ArrowRight className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-black uppercase tracking-tight truncate leading-tight">{nextSong.name}</div>
                  <div className="text-sm font-bold text-indigo-400/60 uppercase tracking-widest mt-1">{nextSong.artist} • {displayNextKey}</div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Bottom Performance Footer */}
      <div className="h-28 border-t border-white/10 bg-slate-900/90 backdrop-blur-2xl px-12 flex items-center justify-between shrink-0 relative z-50">
        <div className="flex items-center gap-10 text-sm font-mono min-w-[320px]">
          <span className="text-2xl font-black text-indigo-400">{formatTime(currentTime)}</span>
          <div className="flex-1 w-64 space-y-2">
             <Progress value={progress} className="h-3 bg-white/5" />
             <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
               <span>Progression</span>
               <span>{Math.round(progress)}%</span>
             </div>
          </div>
          <span className="text-2xl font-black text-slate-500">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-12">
          <Button variant="ghost" size="icon" onClick={onPrevious} className="h-16 w-16 rounded-full hover:bg-white/5 text-slate-400">
            <SkipBack className="w-10 h-10" />
          </Button>

          <Button 
            onClick={onTogglePlayback}
            className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-[0_0_50px_rgba(79,70,229,0.3)] transition-all hover:scale-110 active:scale-90 flex items-center justify-center p-0"
          >
            {isPlaying ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12 ml-2 fill-current" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={onNext} className="h-16 w-16 rounded-full hover:bg-white/5 text-slate-400">
            <SkipForward className="w-10 h-10" />
          </Button>
        </div>

        <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 min-w-[320px] justify-end">
          <div className="flex flex-col items-end">
            <span className="text-indigo-400">{viewMode.toUpperCase()} FEED</span>
            <span className="flex items-center gap-2 text-emerald-500 mt-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
              LIVE DATA SYNC
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceOverlay;
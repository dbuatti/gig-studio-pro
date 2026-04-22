"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Clock, Timer, ChevronRight, Zap, Minus, Plus, Edit3, Check, Keyboard, CloudDownload, AlertTriangle, Loader2, Shield
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import AudioVisualizer from './AudioVisualizer';
import Metronome from './Metronome';
import ShortcutLegend from './ShortcutLegend';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { Badge } from './ui/badge';
import { useSettings } from '@/hooks/use-settings';
import { useWakeLock } from '@/hooks/use-wake-lock';

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
  onOpenAdmin?: () => void;
  gigId?: string | null;
  isLoadingAudio?: boolean;
}

type ViewMode = 'visualizer' | 'pdf' | 'lyrics';

const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  songs,
  currentIndex,
  isPlaying,
  progress,
  duration,
  onTogglePlayback,
  onNext,
  onPrevious,
  onShuffle,
  onClose,
  onUpdateSong,
  onUpdateKey,
  analyzer,
  onOpenAdmin,
  gigId,
  isLoadingAudio,
}) => {
  const navigate = useNavigate();
  const { keyPreference: globalPreference } = useSettings();
  const currentSong = songs[currentIndex];
  const nextSong = songs[currentIndex + 1];
  
  const { isActive: isWakeLockActive } = useWakeLock(true);

  const [localNotes, setLocalNotes] = useState(currentSong?.notes || "");
  const [viewMode, setViewMode] = useState<ViewMode>('visualizer');
  const [scrollSpeed, setScrollSpeed] = useState(1.0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [isShortcutLegendOpen, setIsShortcutLegendOpen] = useState(false);
  
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.key === 'Escape') {
        if (!isShortcutLegendOpen) {
          onClose();
        } else {
          setIsShortcutLegendOpen(false);
        }
      }
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlayback();
      }
      if (e.key === 'ArrowLeft') {
        onPrevious();
      }
      if (e.key === 'ArrowRight') {
        onNext();
      }
      if (e.key.toLowerCase() === 's') {
        setAutoScrollEnabled(prev => !prev);
      }
      if (e.key.toLowerCase() === 'e' && gigId && currentSong) {
        navigate(`/gig/${gigId}/song/${currentSong.id}`);
      }
      if (e.key.toLowerCase() === 'k') {
        setIsShortcutLegendOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onTogglePlayback, onPrevious, onNext, isShortcutLegendOpen, gigId, currentSong, navigate]);

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
  const currentTimeValue = (progress / 100) * duration;
  const adjustedTime = currentTimeValue * scrollSpeed;

  useEffect(() => {
    const container = lyricsContainerRef.current;
    if (!container) return;

    const handleUserInteractionStart = () => {
      isUserScrolling.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };

    const handleUserInteractionEnd = () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrolling.current = false;
      }, 3000); 
    };

    container.addEventListener('wheel', handleUserInteractionStart, { passive: true });
    container.addEventListener('touchstart', handleUserInteractionStart, { passive: true });
    container.addEventListener('touchend', handleUserInteractionEnd, { passive: true });
    container.addEventListener('mousedown', handleUserInteractionStart, { passive: true });
    container.addEventListener('mouseup', handleUserInteractionEnd, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleUserInteractionStart);
      container.removeEventListener('touchstart', handleUserInteractionStart);
      container.removeEventListener('touchend', handleUserInteractionEnd);
      container.removeEventListener('mousedown', handleUserInteractionStart);
      container.removeEventListener('mouseup', handleUserInteractionEnd);
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
      if (Math.abs(diff) > 1) {
        container.scrollTop += diff * 0.1; 
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
    else setViewMode('visualizer');
  }, [currentSong]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds %  60);
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

  const handleEditClick = () => {
    if (gigId && currentSong) {
      navigate(`/gig/${gigId}/song/${currentSong.id}`);
    }
  };

  const isProcessing = currentSong?.extraction_status === 'processing' || currentSong?.extraction_status === 'queued';
  const isExtractionFailed = currentSong?.extraction_status === 'failed';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col font-sans selection:bg-indigo-500/30 overflow-hidden h-screen w-screen">
      {/* Top HUD Header */}
      <div className="h-24 border-b border-white/10 px-6 md:px-10 flex items-center justify-between bg-slate-900/80 backdrop-blur-2xl shrink-0 shadow-2xl relative z-50">
        <div className="flex items-center gap-6 md:gap-12">
          <div className="flex items-center gap-4 md:gap-8">
            <div className="bg-indigo-600 p-3 rounded-[1.5rem] shadow-2xl shadow-indigo-600/30">
              <Activity className="w-8 h-8 md:w-10 md:h-10 animate-pulse text-white" />
            </div>
            <div>
              <h2 className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.5em] text-indigo-400 mb-1 md:mb-2 font-mono">Performance Engine v4.0</h2>
              <div className="flex items-center gap-3 md:gap-6">
                <span className="text-xl md:text-3xl font-black uppercase tracking-tighter">Active Stage</span>
                <div className="flex gap-1.5">
                  {songs.map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "h-1.5 w-4 md:h-2 md:w-8 rounded-full transition-all duration-700",
                        i === currentIndex ? "bg-indigo-500 w-10 md:w-20 shadow-[0_0_15px_rgba(99,102,241,0.6)]" : i < currentIndex ? "bg-emerald-500/40" : "bg-white/10"
                      )} 
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-16 border-l border-white/10 pl-16 font-mono">
            <div className="flex items-center gap-5">
               <div className="p-3 bg-white/5 rounded-2xl">
                 <Clock className="w-6 h-6 text-slate-500" />
               </div>
               <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Local Time</span>
                  <span className="text-2xl font-black text-white">{wallClock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
               </div>
            </div>
            <div className="flex items-center gap-5">
               <div className="p-3 bg-indigo-600/10 rounded-2xl">
                 <Timer className="w-6 h-6 text-indigo-400" />
               </div>
               <div className="flex flex-col">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Set Duration</span>
                  <span className="text-2xl font-black text-white">{elapsedSetTime}</span>
               </div>
            </div>
            {isWakeLockActive && (
              <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Stay Awake Active</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-10">
          <div className="hidden md:flex bg-slate-950 p-1.5 rounded-[1.5rem] border border-white/10 shadow-inner font-mono">
            {[
              { id: 'visualizer', label: 'Matrix', icon: Waves, color: 'bg-indigo-600' },
              { id: 'lyrics', label: 'Lyrics', icon: AlignLeft, color: 'bg-pink-600', disabled: !currentSong?.lyrics },
              { id: 'pdf', label: 'Chart', icon: FileText, color: 'bg-emerald-600', disabled: !currentSong?.pdfUrl }
            ].map((mode) => (
              <Button 
                key={mode.id}
                variant="ghost" 
                size="sm" 
                disabled={mode.disabled}
                onClick={() => setViewMode(mode.id as any)}
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest h-10 px-6 gap-2.5 rounded-xl transition-all", 
                  viewMode === mode.id ? `${mode.color} text-white shadow-lg` : "text-slate-500 hover:text-white disabled:opacity-10"
                )}
              >
                <mode.icon className="w-4 h-4" /> {mode.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsShortcutLegendOpen(true)}
              className="rounded-2xl bg-white/5 hover:bg-white/10 h-12 w-12 md:h-14 md:w-14 transition-all"
              title="Shortcuts (K)"
            >
              <Keyboard className="w-6 h-6 text-slate-400" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleEditClick}
              className="rounded-2xl bg-white/5 hover:bg-indigo-600 hover:text-white h-12 w-12 md:h-14 md:w-14 transition-all group"
              title="Edit Song (E)"
            >
              <Edit3 className="w-6 h-6 text-slate-400 group-hover:text-white" />
            </Button>

            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-2xl hover:bg-red-500/20 hover:text-red-400 h-12 w-12 md:h-14 md:w-14 transition-all">
              <X className="w-7 h-7 md:w-9 md:h-9" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Background Ambient FX */}
          <div className="absolute inset-0 opacity-10 pointer-events-none blur-[150px] scale-150 overflow-hidden">
            <div className="w-full h-full bg-indigo-600/30 rounded-full animate-pulse" />
          </div>

          <div className={cn("text-center px-6 transition-all duration-700 z-10 relative flex flex-col items-center justify-center shrink-0", viewMode === 'lyrics' ? "pt-8 pb-6" : "pt-12 pb-8")}>
            <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-indigo-600/10 border border-indigo-500/20 rounded-full mb-6">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.7)]" />
               <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest font-mono">Stage Locked: ESC to Exit</span>
            </div>
            <h1 className={cn(
              "font-black tracking-tighter leading-none drop-shadow-2xl transition-all duration-700 uppercase truncate max-w-full px-6",
              viewMode === 'lyrics' ? "text-5xl md:text-7xl" : "text-7xl md:text-9xl"
            )}>
              {currentSong?.name}
            </h1>
            <div className={cn(
              "mt-6 flex items-center justify-center gap-8 font-black text-slate-400 uppercase tracking-tight",
              viewMode === 'lyrics' ? "text-2xl md:text-4xl" : "text-3xl md:text-5xl"
            )}>
              <span className="truncate max-w-[400px]">{currentSong?.artist}</span>
              <div className="w-2 h-2 rounded-full bg-slate-800 shrink-0" />
              <div className="flex items-center gap-3">
                <span className="text-indigo-400 font-mono drop-shadow-[0_0_20px_rgba(129,140,248,0.4)]">{displayCurrentKey}</span>
                {currentSong?.isKeyConfirmed && <Check className="w-8 h-8 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]" />}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-4 md:px-10 relative z-10">
            {viewMode === 'visualizer' && (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-full max-w-6xl p-8 md:p-16 bg-white/5 rounded-[4rem] border border-white/5 shadow-2xl backdrop-blur-sm">
                  <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
                </div>
              </div>
            )}

            {viewMode === 'lyrics' && currentSong?.lyrics && (
              <div ref={lyricsContainerRef} className="h-full overflow-y-auto px-6 md:px-40 py-20 md:py-32 custom-scrollbar scroll-smooth">
                <div className="max-w-6xl mx-auto space-y-20 md:space-y-32">
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
                          "transition-all duration-1000 text-center leading-tight whitespace-pre-wrap px-6",
                          section.time >= 0
                            ? cn(
                                "text-6xl md:text-9xl font-black tracking-tighter uppercase",
                                active 
                                  ? "text-white scale-110 drop-shadow-[0_0_40px_rgba(255,255,255,0.5)] blur-none" 
                                  : isPast 
                                    ? "text-white/20 blur-[1px]" 
                                    : "text-white/10 blur-[3px]"
                              )
                            : "text-4xl md:text-6xl font-bold text-indigo-500/40 uppercase tracking-widest italic"
                        )}
                      >
                        {section.text || <span className="italic text-white/10">...</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'pdf' && currentSong?.pdfUrl && (
              <div className="h-full w-full bg-slate-900 rounded-[3rem] md:rounded-[5rem] overflow-hidden shadow-2xl relative border-2 md:border-4 border-white/5">
                {isFramable(currentSong.pdfUrl) ? (
                  <iframe 
                    src={`${currentSong.pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                    className="w-full h-full bg-white"
                    title="Sheet Music"
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center p-8 md:p-16 text-center bg-slate-950">
                    <ShieldCheck className="w-16 h-16 md:w-20 md:h-20 text-indigo-400 mb-8 md:mb-12" />
                    <h4 className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-6 md:mb-10 text-white">Asset Protected</h4>
                    <p className="text-slate-500 max-xl mb-10 md:mb-20 text-xl md:text-2xl font-medium leading-relaxed">
                      External security prevents in-app display. Use the button below to launch in a secure dedicated performance window.
                    </p>
                    <Button onClick={() => window.open(currentSong.pdfUrl, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-20 md:h-24 px-12 md:px-20 font-black uppercase tracking-[0.3em] text-sm md:text-base rounded-3xl md:rounded-[2.5rem] shadow-2xl shadow-indigo-600/30 gap-6 md:gap-8">
                      <ExternalLink className="w-8 h-8 md:w-10 md:h-10" /> Launch Chart Window
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Performance Controls */}
        <aside className="hidden lg:flex w-[450px] xl:w-[520px] bg-slate-900/80 backdrop-blur-3xl p-10 xl:p-12 flex-col space-y-10 overflow-y-auto border-l border-white/10 relative z-50 shrink-0">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-indigo-400 flex items-center gap-3 font-mono">
                <Gauge className="w-5 h-5" /> Live Timing Engine
              </h3>
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onShuffle}
                  className="h-8 px-4 bg-white/5 border border-white/5 hover:bg-white/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest gap-2.5 rounded-xl"
                >
                  <Shuffle className="w-4 h-4" /> Shuffle Remaining
                </Button>
                <Badge className="bg-indigo-600/20 text-indigo-400 border-indigo-600/20 font-mono text-[10px] px-3 py-1">LOCKED</Badge>
              </div>
            </div>
            <Metronome initialBpm={parseInt(currentSong?.bpm || "120")} />
          </div>

          {viewMode === 'lyrics' && (
            <div className="space-y-6 animate-in slide-in-from-right duration-500">
              <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-pink-400 flex items-center gap-3 font-mono">
                <AlignLeft className="w-5 h-5" /> Teleprompter Controls
              </h3>
              <div className="bg-white/5 rounded-[2.5rem] p-8 xl:p-10 border border-white/10 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-base font-black uppercase text-white">Auto-Scroll</span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">Track Song Progress (S)</span>
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
            <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-indigo-400 flex items-center gap-3 font-mono">
              <Settings2 className="w-5 h-5" /> Harmonic Override
            </h3>
            <div className="bg-white/5 rounded-[2.5rem] p-8 xl:p-10 border border-white/10 space-y-8">
              <div className="grid grid-cols-2 gap-8 relative">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono mb-2">Original</span>
                  <span className="text-3xl font-mono font-black text-slate-400">{currentSong?.originalKey || "TBC"}</span>
                </div>
                <div className="h-12 w-px bg-white/10 absolute left-1/2 -translate-x-1/2 top-2" />
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono mb-2">Stage Key</span>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-mono font-black text-white">{displayCurrentKey}</span>
                    {currentSong?.isKeyConfirmed && <Check className="w-6 h-6 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]" />}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <Select 
                    value={formatKey(currentSong?.targetKey || currentSong?.originalKey, currentPref)} 
                    onValueChange={(val) => onUpdateKey(currentSong!.id, val)}
                  >
                    <SelectTrigger className="bg-slate-950 border-white/10 text-sm font-black font-mono h-14 rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                      {keysToUse.map(k => (
                        <SelectItem key={k} value={k} className="font-mono text-sm font-bold">{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex bg-slate-950 border border-white/10 rounded-2xl p-1.5">
                  <Button variant="ghost" size="icon" onClick={() => handleQuickTranspose('down')} className="h-11 w-11 rounded-xl hover:bg-white/5 text-slate-400">
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleQuickTranspose('up')} className="h-11 w-11 rounded-xl hover:bg-white/5 text-slate-400">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-indigo-400 flex items-center gap-3 font-mono">
                <Activity className="w-5 h-5" /> Stage Cues & Memo
              </h3>
            </div>
            <Textarea 
              placeholder="Live notes, cues..."
              className="bg-slate-950 border-white/5 min-h-[180px] text-lg font-medium leading-relaxed resize-none rounded-[2rem] p-8 focus:ring-indigo-500/20 custom-scrollbar"
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleSaveNotes}
            />
          </div>

          {nextSong && (
            <div className="pt-10 border-t border-white/10">
              <div className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-500 mb-6 font-mono">Sequence: Next</div>
              <div className="bg-indigo-600/5 border border-indigo-500/20 rounded-[2.5rem] p-8 flex items-center gap-8 cursor-pointer hover:bg-indigo-600/10 transition-all group" onClick={onNext}>
                <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-600/30 group-hover:scale-110 transition-transform shrink-0">
                  <ArrowRight className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl font-black uppercase tracking-tight truncate leading-tight">{nextSong.name}</div>
                  <div className="text-[11px] font-bold text-indigo-400/60 uppercase tracking-widest mt-1.5">{nextSong.artist} • {displayNextKey}</div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Bottom Performance Footer */}
      <div className="h-28 md:h-32 border-t border-white/10 bg-slate-900/90 backdrop-blur-2xl px-6 md:px-16 flex items-center justify-between shrink-0 relative z-50">
        <div className="hidden sm:flex items-center gap-8 md:gap-12 text-sm font-mono min-w-[320px] md:min-w-[380px]">
          <span className="text-2xl md:text-3xl font-black text-indigo-400">{formatTime((progress / 100) * duration)}</span>
          <div className="flex-1 w-48 md:w-80 space-y-3">
             <Progress value={progress} className="h-3 md:h-4 bg-white/5" />
             <div className="flex justify-between text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest">
               <span>Progression</span>
               <span>{Math.round(progress)}%</span>
             </div>
          </div>
          <span className="text-2xl md:text-3xl font-black text-slate-500">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-8 md:gap-16 flex-1 justify-center sm:flex-none">
          <Button variant="ghost" size="icon" onClick={onPrevious} className="h-14 w-14 md:h-20 md:w-20 rounded-full hover:bg-white/5 text-slate-400">
            <SkipBack className="w-8 h-8 md:w-12 md:h-12" />
          </Button>

          <Button 
            onClick={onTogglePlayback}
            disabled={isLoadingAudio || isProcessing || isExtractionFailed} 
            className={cn(
              "h-20 w-20 md:h-28 md:w-28 rounded-[2.5rem] shadow-2xl flex items-center justify-center p-0 transition-all hover:scale-110 active:scale-90",
              isLoadingAudio || isProcessing || isExtractionFailed
                ? "bg-slate-600 cursor-not-allowed"
                : isPlaying
                  ? "bg-red-600 hover:bg-red-700 shadow-[0_0_60px_rgba(220,38,38,0.4)]"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_60px_rgba(79,70,229,0.4)]"
            )}
          >
            {isLoadingAudio || isProcessing ? (
              <Loader2 className="w-10 h-10 md:w-14 md:h-14 animate-spin text-white" />
            ) : isExtractionFailed ? (
              <AlertTriangle className="w-10 h-10 md:w-14 md:h-14 text-white" />
            ) : isPlaying ? (
              <Pause className="w-10 h-10 md:w-14 md:h-14 text-white" />
            ) : (
              <Play className="w-10 h-10 md:w-14 md:h-14 ml-1.5 md:ml-2.5 fill-current text-white" />
            )}
          </Button>

          <Button variant="ghost" size="icon" onClick={onNext} className="h-14 w-14 md:h-20 md:w-20 rounded-full hover:bg-white/5 text-slate-400">
            <SkipForward className="w-8 h-8 md:w-12 md:h-12" />
          </Button>
        </div>

        <div className="hidden sm:flex items-center gap-6 md:gap-10 text-[10px] md:text-[12px] font-black uppercase tracking-[0.3em] text-slate-500 min-w-[320px] md:min-w-[380px] justify-end">
          <div className="flex flex-col items-end">
            <span className="text-indigo-400">{viewMode.toUpperCase()} FEED</span>
            <span className="flex items-center gap-3 text-emerald-500 mt-1 md:mt-2">
              <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
              LIVE DATA SYNC
            </span>
          </div>
        </div>
      </div>

      {isShortcutLegendOpen && (
        <ShortcutLegend onClose={() => setIsShortcutLegendOpen(false)} />
      )}
    </div>
  );
};

export default PerformanceOverlay;
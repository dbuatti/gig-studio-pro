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
  Clock, Timer, ChevronRight, Zap, Minus, Plus, Edit3, Check, Keyboard, CloudDownload, AlertTriangle, Loader2
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import AudioVisualizer from './AudioVisualizer';
import Metronome from './Metronome';
import ShortcutLegend from './ShortcutLegend';
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
  onShuffle: () => void;
  onClose: () => void;
  onUpdateSong: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  analyzer: any;
  onOpenAdmin?: () => void;
  gigId?: string | null;
  isLoadingAudio?: boolean; // NEW PROP
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
  isLoadingAudio, // Destructure new prop
}) => {
  const navigate = useNavigate();
  const { keyPreference: globalPreference } = useSettings();
  const currentSong = songs[currentIndex];
  const nextSong = songs[currentIndex + 1];
  
  const [localNotes, setLocalNotes] = useState(currentSong?.notes || "");
  const [viewMode, setViewMode] = useState<ViewMode>('visualizer');
  const [scrollSpeed, setScrollSpeed] = useState(1.0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [isShortcutLegendOpen, setIsShortcutLegendOpen] = useState(false);
  
  // Performance HUD State
  const [wallClock, setWallClock] = useState(new Date());
  const [setStartTime] = useState(new Date());
  const [elapsedSetTime, setElapsedSetTime] = useState("00:00:00");

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricsLinesRef = useRef<HTMLDivElement[]>([]);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const autoScrollRaf = useRef<number | null>(null);
  
  const touchStartX = useRef<number>(0);

  const currentPref = currentSong?.key_preference || globalPreference;
  const nextPref = nextSong?.key_preference || globalPreference;
  const keysToUse = currentPref === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  // Key listener for shortcuts
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
      <div className="h-20 border-b border-white/10 px-6 md:px-10 flex items-center justify-between bg-slate-900/80 backdrop-blur-2xl shrink-0 shadow-2xl relative z-50">
        <div className="flex items-center gap-6 md:gap-10">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="bg-indigo-600 p-2 rounded-2xl shadow-lg shadow-indigo-600/30">
              <Activity className="w-6 h-6 md:w-8 md:h-8 animate-pulse text-white" />
            </div>
            <div>
              <h2 className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-0.5 md:mb-1 font-mono">Performance Engine v3.5</h2>
              <div className="flex items-center gap-2 md:gap-4">
                <span className="text-lg md:text-2xl font-black uppercase tracking-tight">Active Stage</span>
                <div className="flex gap-1">
                  {songs.map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "h-1 w-3 md:h-1.5 md:w-6 rounded-full transition-all duration-700",
                        i === currentIndex ? "bg-indigo-500 w-8 md:w-16 shadow-[0_0_10px_rgba(99,102,241,0.5)]" : i < currentIndex ? "bg-emerald-500/40" : "bg-white/10"
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

        <div className="flex items-center gap-4 md:gap-8">
          <div className="hidden md:flex bg-slate-950 p-1 rounded-2xl border border-white/10 shadow-inner font-mono">
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
                  "text-[9px] font-black uppercase tracking-widest h-8 px-4 gap-2 rounded-xl transition-all", 
                  viewMode === mode.id ? `${mode.color} text-white shadow-lg` : "text-slate-500 hover:text-white disabled:opacity-10"
                )}
              >
                <mode.icon className="w-3 h-3" /> {mode.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsShortcutLegendOpen(true)}
              className="rounded-full bg-white/5 hover:bg-white/10 h-10 w-10 md:h-12 md:w-12 transition-all"
              title="Shortcuts (K)"
            >
              <Keyboard className="w-5 h-5 text-slate-400" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleEditClick}
              className="rounded-full bg-white/5 hover:bg-indigo-600 hover:text-white h-10 w-10 md:h-12 md:w-12 transition-all group"
              title="Edit Song (E)"
            >
              <Edit3 className="w-5 h-5 text-slate-400 group-hover:text-white" />
            </Button>

            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-500/20 hover:text-red-400 h-10 w-10 md:h-12 md:w-12 transition-all">
              <X className="w-6 h-6 md:w-8 md:h-8" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Background Ambient FX */}
          <div className="absolute inset-0 opacity-10 pointer-events-none blur-[120px] scale-150 overflow-hidden">
            <div className="w-full h-full bg-indigo-600/30 rounded-full animate-pulse" />
          </div>

          <div className={cn("text-center px-6 transition-all duration-700 z-10 relative flex flex-col items-center justify-center shrink-0", viewMode === 'lyrics' ? "pt-6 pb-4" : "pt-10 pb-6")}>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600/10 border border-indigo-500/20 rounded-full mb-4">
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
               <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest font-mono">Stage Locked: ESC to Exit</span>
            </div>
            <h1 className={cn(
              "font-black tracking-tighter leading-none drop-shadow-2xl transition-all duration-700 uppercase truncate max-w-full px-4",
              viewMode === 'lyrics' ? "text-4xl md:text-6xl" : "text-6xl md:text-8xl"
            )}>
              {currentSong?.name}
            </h1>
            <div className={cn(
              "mt-4 flex items-center justify-center gap-6 font-black text-slate-400 uppercase tracking-tight",
              viewMode === 'lyrics' ? "text-xl md:text-3xl" : "text-2xl md:text-4xl"
            )}>
              <span className="truncate max-w-[300px]">{currentSong?.artist}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800 shrink-0" />
              <div className="flex items-center gap-2">
                <span className="text-indigo-400 font-mono drop-shadow-[0_0_15px_rgba(129,140,248,0.3)]">{displayCurrentKey}</span>
                {currentSong?.isKeyConfirmed && <Check className="w-6 h-6 text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-4 md:px-8 relative z-10">
            {viewMode === 'visualizer' && (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-full max-w-5xl p-6 md:p-12 bg-white/5 rounded-[3rem] border border-white/5 shadow-2xl backdrop-blur-sm">
                  <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
                </div>
              </div>
            )}

            {viewMode === 'lyrics' && currentSong?.lyrics && (
              <div ref={lyricsContainerRef} className="h-full overflow-y-auto px-4 md:px-32 py-16 md:py-24 custom-scrollbar scroll-smooth">
                <div className="max-w-5xl mx-auto space-y-16 md:space-y-24">
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
                          "transition-all duration-1000 text-center leading-tight whitespace-pre-wrap px-4",
                          section.time >= 0
                            ? cn(
                                "text-5xl md:text-8xl font-black tracking-tighter uppercase",
                                active 
                                  ? "text-white scale-110 drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] blur-none" 
                                  : isPast 
                                    ? "text-white/20 blur-[1px]" 
                                    : "text-white/10 blur-[2px]"
                              )
                            : "text-3xl md:text-5xl font-bold text-indigo-500/40 uppercase tracking-widest italic"
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
              <div className="h-full w-full bg-slate-900 rounded-[2rem] md:rounded-[4rem] overflow-hidden shadow-2xl relative border-2 md:border-4 border-white/5">
                {isFramable(currentSong.pdfUrl) ? (
                  <iframe 
                    src={`${currentSong.pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                    className="w-full h-full bg-white"
                    title="Sheet Music"
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center p-6 md:p-12 text-center bg-slate-950">
                    <ShieldCheck className="w-12 h-12 md:w-16 md:h-16 text-indigo-400 mb-6 md:mb-10" />
                    <h4 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4 md:mb-6 text-white">Asset Protected</h4>
                    <p className="text-slate-500 max-xl mb-8 md:mb-16 text-lg md:text-xl font-medium leading-relaxed">
                      External security prevents in-app display. Use the button below to launch in a secure dedicated performance window.
                    </p>
                    <Button onClick={() => window.open(currentSong.pdfUrl, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-16 md:h-20 px-10 md:px-16 font-black uppercase tracking-[0.2em] text-xs md:text-sm rounded-2xl md:rounded-3xl shadow-2xl shadow-indigo-600/30 gap-4 md:gap-6">
                      <ExternalLink className="w-6 h-6 md:w-8 md:h-8" /> Launch Chart Window
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Performance Controls */}
        <aside className="hidden lg:flex w-[400px] xl:w-[480px] bg-slate-900/80 backdrop-blur-3xl p-8 xl:p-10 flex-col space-y-8 overflow-y-auto border-l border-white/10 relative z-50 shrink-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 flex items-center gap-2 font-mono">
                <Gauge className="w-4 h-4" /> Live Timing Engine
              </h3>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onShuffle}
                  className="h-7 px-3 bg-white/5 border border-white/5 hover:bg-white/10 text-indigo-400 text-[9px] font-black uppercase tracking-widest gap-2 rounded-lg"
                >
                  <Shuffle className="w-3 h-3" /> Shuffle Remaining
                </Button>
                <Badge className="bg-indigo-600/20 text-indigo-400 border-indigo-600/20 font-mono text-[9px]">LOCKED</Badge>
              </div>
            </div>
            <Metronome initialBpm={parseInt(currentSong?.bpm || "120")} />
          </div>

          {viewMode === 'lyrics' && (
            <div className="space-y-4 animate-in slide-in-from-right duration-500">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-pink-400 flex items-center gap-2 font-mono">
                <AlignLeft className="w-4 h-4" /> Teleprompter Controls
              </h3>
              <div className="bg-white/5 rounded-3xl p-6 xl:p-8 border border-white/10 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase text-white">Auto-Scroll</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Track Song Progress (S)</span>
                  </div>
                  <Switch 
                    checked={autoScrollEnabled}
                    onCheckedChange={setAutoScrollEnabled}
                    className="data-[state=checked]:bg-pink-600 scale-110"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Velocity</span>
                    <span className="text-xl font-black text-pink-400 font-mono">{scrollSpeed.toFixed(2)}x</span>
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

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 flex items-center gap-2 font-mono">
              <Settings2 className="w-4 h-4" /> Harmonic Override
            </h3>
            <div className="bg-white/5 rounded-[2rem] p-6 xl:p-8 border border-white/10 space-y-6">
              <div className="grid grid-cols-2 gap-6 relative">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono mb-1">Original</span>
                  <span className="text-2xl font-mono font-black text-slate-400">{currentSong?.originalKey || "TBC"}</span>
                </div>
                <div className="h-10 w-px bg-white/10 absolute left-1/2 -translate-x-1/2 top-2" />
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest font-mono mb-1">Stage Key</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-mono font-black text-white">{displayCurrentKey}</span>
                    {currentSong?.isKeyConfirmed && <Check className="w-5 h-5 text-emerald-500" />}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <Select 
                    value={formatKey(currentSong?.targetKey || currentSong?.originalKey, currentPref)} 
                    onValueChange={(val) => onUpdateKey(currentSong!.id, val)}
                  >
                    <SelectTrigger className="bg-slate-950 border-white/10 text-xs font-black font-mono h-12 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                      {keysToUse.map(k => (
                        <SelectItem key={k} value={k} className="font-mono text-xs">{k}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex bg-slate-950 border border-white/10 rounded-xl p-1">
                  <Button variant="ghost" size="icon" onClick={() => handleQuickTranspose('down')} className="h-10 w-10 rounded-lg hover:bg-white/5 text-slate-400">
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleQuickTranspose('up')} className="h-10 w-10 rounded-lg hover:bg-white/5 text-slate-400">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 flex items-center gap-2 font-mono">
                <Activity className="w-4 h-4" /> Stage Cues & Memo
              </h3>
            </div>
            <Textarea 
              placeholder="Live notes, cues..."
              className="bg-slate-950 border-white/5 min-h-[140px] text-base font-medium leading-relaxed resize-none rounded-[1.5rem] p-6 focus:ring-indigo-500/20 custom-scrollbar"
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleSaveNotes}
            />
          </div>

          {nextSong && (
            <div className="pt-6 border-t border-white/10">
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4 font-mono">Sequence: Next</div>
              <div className="bg-indigo-600/5 border border-indigo-500/20 rounded-[2rem] p-6 flex items-center gap-6 cursor-pointer hover:bg-indigo-600/10 transition-all group" onClick={onNext}>
                <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform shrink-0">
                  <ArrowRight className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-black uppercase tracking-tight truncate leading-tight">{nextSong.name}</div>
                  <div className="text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest mt-0.5">{nextSong.artist} • {displayNextKey}</div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Bottom Performance Footer */}
      <div className="h-24 md:h-28 border-t border-white/10 bg-slate-900/90 backdrop-blur-2xl px-6 md:px-12 flex items-center justify-between shrink-0 relative z-50">
        <div className="hidden sm:flex items-center gap-6 md:gap-10 text-sm font-mono min-w-[280px] md:min-w-[320px]">
          <span className="text-lg md:text-2xl font-black text-indigo-400">{formatTime((progress / 100) * duration)}</span>
          <div className="flex-1 w-40 md:w-64 space-y-2">
             <Progress value={progress} className="h-2 md:h-3 bg-white/5" />
             <div className="flex justify-between text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">
               <span>Progression</span>
               <span>{Math.round(progress)}%</span>
             </div>
          </div>
          <span className="text-lg md:text-2xl font-black text-slate-500">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-6 md:gap-12 flex-1 justify-center sm:flex-none">
          <Button variant="ghost" size="icon" onClick={onPrevious} className="h-12 w-12 md:h-16 md:w-16 rounded-full hover:bg-white/5 text-slate-400">
            <SkipBack className="w-6 h-6 md:w-10 md:h-10" />
          </Button>

          <Button 
            onClick={onTogglePlayback}
            disabled={isLoadingAudio || isProcessing || isExtractionFailed} // Disable if loading, processing, or failed
            className={cn(
              "h-16 w-16 md:h-24 md:w-24 rounded-full shadow-2xl flex items-center justify-center p-0 transition-all hover:scale-110 active:scale-90",
              isLoadingAudio || isProcessing || isExtractionFailed
                ? "bg-slate-600 cursor-not-allowed"
                : isPlaying
                  ? "bg-red-600 hover:bg-red-700 shadow-[0_0_50px_rgba(220,38,38,0.3)]"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_50px_rgba(79,70,229,0.3)]"
            )}
          >
            {isLoadingAudio || isProcessing ? (
              <Loader2 className="w-8 h-8 md:w-12 md:h-12 animate-spin text-white" />
            ) : isExtractionFailed ? (
              <AlertTriangle className="w-8 h-8 md:w-12 md:h-12 text-white" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 md:w-12 md:h-12 text-white" />
            ) : (
              <Play className="w-8 h-8 md:w-12 md:h-12 ml-1 md:ml-2 fill-current text-white" />
            )}
          </Button>

          <Button variant="ghost" size="icon" onClick={onNext} className="h-12 w-12 md:h-16 md:w-16 rounded-full hover:bg-white/5 text-slate-400">
            <SkipForward className="w-6 h-6 md:w-10 md:h-10" />
          </Button>
        </div>

        <div className="hidden sm:flex items-center gap-4 md:gap-8 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 min-w-[280px] md:min-w-[320px] justify-end">
          <div className="flex flex-col items-end">
            <span className="text-indigo-400">{viewMode.toUpperCase()} FEED</span>
            <span className="flex items-center gap-2 text-emerald-500 mt-0.5 md:mt-1">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
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
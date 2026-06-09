"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { X, Waves, ShieldCheck, ExternalLink, Check, Menu } from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import AudioVisualizer from './AudioVisualizer';
import ShortcutLegend from './ShortcutLegend';
import { formatKey } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { useSettings } from '@/hooks/use-settings';
import { useWakeLock } from '@/hooks/use-wake-lock';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import PerformanceHUD from './performance/PerformanceHUD';
import PerformanceSidebar from './performance/PerformanceSidebar';
import PerformanceFooter from './performance/PerformanceFooter';
import PerformanceLyrics from './performance/PerformanceLyrics';

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
  songs, currentIndex, isPlaying, progress, duration,
  onTogglePlayback, onNext, onPrevious, onShuffle, onClose,
  onUpdateSong, onUpdateKey, analyzer, gigId, isLoadingAudio,
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { keyPreference: globalPreference } = useSettings();
  const currentSong = songs[currentIndex];
  const nextSong = songs[currentIndex + 1];
  
  const { isActive: isWakeLockActive } = useWakeLock(true);

  const [localNotes, setLocalNotes] = useState(currentSong?.notes || "");
  const [viewMode, setViewMode] = useState<ViewMode>('visualizer');
  const [scrollSpeed, setScrollSpeed] = useState(1.0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [isShortcutLegendOpen, setIsShortcutLegendOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  
  const [wallClock, setWallClock] = useState(new Date());
  const [setStartTime] = useState(new Date());
  const [elapsedSetTime, setElapsedSetTime] = useState("00:00:00");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') {
        if (isShortcutLegendOpen) setIsShortcutLegendOpen(false);
        else onClose();
      }
      if (e.code === 'Space') { e.preventDefault(); onTogglePlayback(); }
      if (e.key === 'ArrowLeft') onPrevious();
      if (e.key === 'ArrowRight') onNext();
      if (e.key.toLowerCase() === 's') setAutoScrollEnabled(prev => !prev);
      if (e.key.toLowerCase() === 'e' && gigId && currentSong) navigate(`/gig/${gigId}/song/${currentSong.id}`);
      if (e.key.toLowerCase() === 'k') setIsShortcutLegendOpen(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onTogglePlayback, onPrevious, onNext, isShortcutLegendOpen, gigId, currentSong, navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setWallClock(now);
      const diff = now.getTime() - setStartTime.getTime();
      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      setElapsedSetTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [setStartTime]);

  useEffect(() => {
    setLocalNotes(currentSong?.notes || "");
    setAutoScrollEnabled(true);
    if (currentSong?.lyrics) setViewMode('lyrics');
    else if (currentSong?.pdfUrl) setViewMode('pdf');
    else setViewMode('visualizer');
  }, [currentSong]);

  const handleSaveNotes = () => { if (currentSong) onUpdateSong(currentSong.id, { notes: localNotes }); };
  const isFramable = (url: string | null | undefined) => !url || !['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'].some(site => url.includes(site));
  const displayCurrentKey = formatKey(currentSong?.targetKey || currentSong?.originalKey, currentSong?.key_preference || globalPreference);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col font-sans selection:bg-indigo-500/30 overflow-hidden h-screen w-screen">
      {!isZenMode && (
        <PerformanceHUD 
          songs={songs} currentIndex={currentIndex} viewMode={viewMode} setViewMode={setViewMode} 
          onClose={onClose} onOpenShortcutLegend={() => setIsShortcutLegendOpen(true)} 
          onEditClick={() => gigId && currentSong && navigate(`/gig/${gigId}/song/${currentSong.id}`)}
          currentSong={currentSong} isWakeLockActive={isWakeLockActive} wallClock={wallClock} 
          elapsedSetTime={elapsedSetTime} isMobile={isMobile} onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none blur-[150px] scale-150 overflow-hidden">
            <div className="w-full h-full bg-indigo-600/30 rounded-full animate-pulse" />
          </div>

          <div className={cn("text-center px-4 transition-all duration-700 z-10 relative flex flex-col items-center justify-center shrink-0", viewMode === 'lyrics' ? "pt-4 pb-4" : "pt-8 pb-8")}>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600/10 border border-indigo-500/20 rounded-full mb-4">
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.7)]" />
               <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest font-mono">Stage Locked</span>
            </div>
            <h1 className={cn("font-black tracking-tighter leading-none drop-shadow-2xl transition-all duration-700 uppercase truncate max-w-full px-4", viewMode === 'lyrics' ? "text-3xl md:text-7xl" : "text-4xl md:text-9xl")}>
              {currentSong?.name}
            </h1>
            <div className={cn("mt-3 flex items-center justify-center gap-4 font-black text-slate-400 uppercase tracking-tight", viewMode === 'lyrics' ? "text-lg md:text-4xl" : "text-xl md:text-5xl")}>
              <span className="truncate max-w-[200px] md:max-w-[400px]">{currentSong?.artist}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800 shrink-0" />
              <div className="flex items-center gap-2">
                <span className="text-indigo-400 font-mono drop-shadow-[0_0_20px_rgba(129,140,248,0.4)]">{displayCurrentKey}</span>
                {currentSong?.isKeyConfirmed && <Check className="w-5 h-5 md:w-8 md:h-8 text-emerald-500" />}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-2 md:px-10 relative z-10">
            {viewMode === 'visualizer' && (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-full max-w-6xl p-4 md:p-16 bg-white/5 rounded-3xl md:rounded-[4rem] border border-white/5 shadow-2xl backdrop-blur-sm">
                  <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
                </div>
              </div>
            )}

            {viewMode === 'lyrics' && currentSong?.lyrics && (
              <PerformanceLyrics 
                lyrics={currentSong.lyrics} progress={progress} duration={duration} 
                scrollSpeed={scrollSpeed} autoScrollEnabled={autoScrollEnabled} 
                onToggleZenMode={() => setIsZenMode(!isZenMode)}
              />
            )}

            {viewMode === 'pdf' && currentSong?.pdfUrl && (
              <div className="h-full w-full bg-slate-900 rounded-2xl md:rounded-[5rem] overflow-hidden shadow-2xl relative border-2 border-white/5" onClick={() => setIsZenMode(!isZenMode)}>
                {isFramable(currentSong.pdfUrl) ? (
                  <iframe src={`${currentSong.pdfUrl}#toolbar=0&navpanes=0&view=FitH`} className="w-full h-full bg-white" title="Sheet Music" />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-slate-950">
                    <ShieldCheck className="w-12 h-12 text-indigo-400 mb-6" />
                    <h4 className="text-2xl md:text-6xl font-black uppercase tracking-tight mb-4 text-white">Asset Protected</h4>
                    <Button onClick={() => window.open(currentSong.pdfUrl, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-16 px-8 font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl gap-4">
                      <ExternalLink className="w-6 h-6" /> Launch Chart
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!isMobile && !isZenMode && (
          <aside className="w-[450px] xl:w-[520px] bg-slate-900/80 backdrop-blur-3xl p-10 flex flex-col space-y-10 overflow-y-auto border-l border-white/10 relative z-50 shrink-0">
            <PerformanceSidebar 
              currentSong={currentSong} nextSong={nextSong} onShuffle={onShuffle} 
              onUpdateSong={onUpdateSong} onUpdateKey={onUpdateKey} onNext={onNext}
              localNotes={localNotes} setLocalNotes={setLocalNotes} handleSaveNotes={handleSaveNotes}
              viewMode={viewMode} autoScrollEnabled={autoScrollEnabled} setAutoScrollEnabled={setAutoScrollEnabled}
              scrollSpeed={scrollSpeed} setScrollSpeed={setScrollSpeed} globalPreference={globalPreference}
            />
          </aside>
        )}
      </div>

      {!isZenMode && (
        <PerformanceFooter 
          progress={progress} duration={duration} isPlaying={isPlaying} 
          isLoadingAudio={isLoadingAudio} isExtractionFailed={currentSong?.extraction_status === 'failed'}
          onTogglePlayback={onTogglePlayback} onNext={onNext} onPrevious={onPrevious} viewMode={viewMode}
        />
      )}

      {isMobile && (
        <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
          <SheetContent side="right" className="w-[85vw] bg-slate-950 border-white/10 p-6 overflow-y-auto custom-scrollbar">
            <SheetHeader className="mb-8">
              <SheetTitle className="text-white font-black uppercase tracking-widest text-sm">Stage Controls</SheetTitle>
            </SheetHeader>
            <PerformanceSidebar 
              currentSong={currentSong} nextSong={nextSong} onShuffle={onShuffle} 
              onUpdateSong={onUpdateSong} onUpdateKey={onUpdateKey} onNext={onNext}
              localNotes={localNotes} setLocalNotes={setLocalNotes} handleSaveNotes={handleSaveNotes}
              viewMode={viewMode} autoScrollEnabled={autoScrollEnabled} setAutoScrollEnabled={setAutoScrollEnabled}
              scrollSpeed={scrollSpeed} setScrollSpeed={setScrollSpeed} globalPreference={globalPreference}
            />
          </SheetContent>
        </Sheet>
      )}

      {isShortcutLegendOpen && <ShortcutLegend onClose={() => setIsShortcutLegendOpen(false)} />}
    </div>
  );
};

export default PerformanceOverlay;
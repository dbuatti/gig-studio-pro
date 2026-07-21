"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Search, Sparkles, ShieldCheck, X, Settings, 
  Play, FileText, Pause, BookOpen, Volume2, ShieldAlert, Zap,
  ChevronRight, ChevronLeft, ChevronUp, ChevronDown, MoreHorizontal, Wrench,
  Rocket, Activity, Command, Shuffle, Terminal
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/hooks/use-settings';
import { compareNotes } from '@/utils/keyUtils';
import { showError } from '@/utils/toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface FloatingCommandDockProps {
  onOpenSearch: () => void;
  onOpenPractice: () => void;
  onOpenReader: (initialSongId?: string) => void;
  onOpenRandomReader: () => void;
  onOpenAdmin: () => void;
  onOpenPreferences: () => void;
  onOpenUserGuide: () => void;
  onToggleHeatmap: () => void;
  showHeatmap: boolean;
  viewMode: 'repertoire' | 'gigs';
  hasPlayableSong: boolean;
  hasReadableChart: boolean;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  currentSongHighestNote?: string;
  currentSongPitch?: number;
  onSafePitchToggle?: (active: boolean, safePitch: number) => void;
  isReaderMode?: boolean;
  activeSongId?: string | null;
  onSetMenuOpen?: (open: boolean) => void;
  isMenuOpen?: boolean;
  onOpenPerformance: () => void;
  onToggleLogViewer?: () => void;
}

type MenuDirection = 'up' | 'down' | 'left' | 'right';

const FloatingCommandDock: React.FC<FloatingCommandDockProps> = React.memo(({
  onOpenSearch,
  onOpenPractice,
  onOpenReader,
  onOpenRandomReader,
  onOpenAdmin,
  onOpenPreferences,
  onToggleHeatmap,
  onOpenUserGuide,
  showHeatmap,
  viewMode,
  hasPlayableSong,
  hasReadableChart,
  isPlaying,
  onTogglePlayback,
  currentSongHighestNote,
  currentSongPitch,
  onSafePitchToggle,
  isReaderMode = false,
  activeSongId,
  onSetMenuOpen,
  isMenuOpen: isMenuOpenProp,
  onOpenPerformance,
  onToggleLogViewer,
}) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('floating_dock_open') === 'true';
    return false;
  });

  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSafePitchActive, setIsSafePitchActive] = useState(false);
  const { safePitchMaxNote, isSafePitchEnabled } = useSettings();

  const direction = useMemo((): MenuDirection => {
    if (typeof window === 'undefined') return 'up';
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const dockSize = isMobile ? 56 : 64;
    const margin = isMobile ? 20 : 40;
    const currentLeft = margin + position.x;
    const currentBottom = margin - position.y;
    const centerX = currentLeft + dockSize / 2;
    const centerY = windowHeight - currentBottom - dockSize / 2;

    if (centerY > windowHeight / 2 && centerX < windowWidth / 2) return 'up';

    const spaceRight = windowWidth - (currentLeft + dockSize);
    const spaceLeft = currentLeft;
    const spaceDown = currentBottom;
    const spaceUp = windowHeight - (currentBottom + dockSize);

    const spaces = [
      { dir: 'right' as MenuDirection, space: spaceRight },
      { dir: 'left' as MenuDirection, space: spaceLeft },
      { dir: 'down' as MenuDirection, space: spaceDown },
      { dir: 'up' as MenuDirection, space: spaceUp },
    ];

    const validSpaces = spaces.filter(s => 
      (s.dir === 'left' || s.dir === 'right') ? s.space > 300 : s.space > 250
    );

    if (validSpaces.length > 0) {
      validSpaces.sort((a, b) => b.space - a.space);
      return validSpaces[0].dir;
    }

    spaces.sort((a, b) => b.space - a.space);
    return spaces[0].dir;
  }, [position, isMobile]);

  const internalIsMenuOpen = isReaderMode ? isMenuOpenProp : isOpen;
  
  const handleToggleMenu = useCallback(() => {
    const nextState = !internalIsMenuOpen;
    if (isReaderMode) onSetMenuOpen?.(nextState);
    else setIsOpen(nextState);
    if (!nextState) setIsSubMenuOpen(false);
    localStorage.setItem('floating_dock_open', nextState.toString());
  }, [internalIsMenuOpen, isReaderMode, onSetMenuOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && internalIsMenuOpen) handleToggleMenu();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [internalIsMenuOpen, handleToggleMenu]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number; y: number } }) => {
    const newPos = { x: position.x + info.offset.x, y: position.y + info.offset.y };
    setPosition(newPos);
    localStorage.setItem('floating_dock_position', JSON.stringify(newPos));
  };

  const safePitchLimit = useMemo(() => {
    if (!currentSongHighestNote || !safePitchMaxNote) return null;
    return compareNotes(safePitchMaxNote, currentSongHighestNote);
  }, [currentSongHighestNote, safePitchMaxNote]);

  useEffect(() => {
    if (isSafePitchEnabled && isSafePitchActive && safePitchLimit !== null) {
      const currentPitch = currentSongPitch || 0;
      if (currentPitch > safePitchLimit) {
        onSafePitchToggle?.(false, 0);
        setIsSafePitchActive(false);
        return;
      }
      onSafePitchToggle?.(true, safePitchLimit);
    } else if (!isSafePitchActive) {
      onSafePitchToggle?.(false, 0);
    }
  }, [isSafePitchEnabled, isSafePitchActive, safePitchLimit, currentSongPitch, onSafePitchToggle]);

  const primaryButtons = [
    {
      id: 'practice',
      icon: isPlaying ? <Pause className="w-6 h-6 md:w-7 md:h-7" /> : <Play className="w-6 h-6 md:w-7 md:h-7" />,
      onClick: onTogglePlayback, 
      disabled: false, 
      tooltip: isPlaying ? "Pause [Space]" : "Play [Space]",
      className: cn(
        "text-white shadow-2xl scale-110",
        isPlaying ? "bg-red-600 border-red-500 shadow-red-600/30" : "bg-indigo-600 border-indigo-500 shadow-indigo-600/30"
      ),
    },
    {
      id: 'performance',
      icon: <Rocket className="w-5 h-5 md:w-6 md:h-6" />,
      onClick: onOpenPerformance,
      disabled: !activeSongId,
      tooltip: "Stage Mode [P]",
      className: "bg-orange-600 text-white border-orange-500 shadow-orange-600/30",
    },
    {
      id: 'reader',
      icon: <FileText className="w-5 h-5 md:w-6 md:h-6" />,
      onClick: () => onOpenReader(activeSongId || undefined),
      disabled: false, 
      tooltip: "Sheet Reader [R]",
      className: "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30",
    },
    {
      id: 'search',
      icon: <Search className="w-5 h-5 md:w-6 md:h-6" />,
      onClick: onOpenSearch,
      disabled: false,
      tooltip: "Discovery Engine",
      className: "bg-slate-800 text-white border-white/10 hover:bg-indigo-600 shadow-slate-900/30",
    },
    {
      id: 'random-reader',
      icon: <Shuffle className="w-5 h-5 md:w-6 md:h-6" />,
      onClick: onOpenRandomReader,
      disabled: false,
      tooltip: "Random Reader",
      className: "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30",
    },
  ];

  const secondaryButtons = [
    { id: 'automation', icon: <Zap className="w-4 h-4 md:w-5 md:h-5" />, onClick: onOpenAdmin, tooltip: "Automation Hub", className: "bg-purple-600/20 text-purple-400 border-purple-500/30" },
    { id: 'admin', icon: <ShieldCheck className="w-4 h-4 md:w-5 md:h-5" />, onClick: onOpenAdmin, tooltip: "Audit Matrix", className: "bg-red-900/40 text-red-400 border-red-500/30" },
    { id: 'heatmap', icon: <Sparkles className="w-4 h-4 md:w-5 md:h-5" />, onClick: onToggleHeatmap, tooltip: "Toggle Heatmap [H]", className: cn(showHeatmap ? "bg-amber-500 text-black border-amber-400" : "bg-slate-800 text-amber-400 border-white/10") },
    ...(isSafePitchEnabled ? [{ id: 'safe-pitch', icon: <ShieldAlert className="w-4 h-4 md:w-5 md:h-5" />, onClick: () => setIsSafePitchActive(!isSafePitchActive), tooltip: "Safe Pitch Mode", className: cn(isSafePitchActive ? "bg-emerald-600 text-white border-emerald-400" : "bg-slate-800 text-emerald-400 border-white/10") }] : []),
    { id: 'preferences', icon: <Settings className="w-4 h-4 md:w-5 md:h-5" />, onClick: onOpenPreferences, tooltip: "Preferences", className: "bg-slate-800 text-slate-300 border-white/10" },
    { id: 'user-guide', icon: <BookOpen className="w-4 h-4 md:w-5 md:h-5" />, onClick: onOpenUserGuide, tooltip: "User Guide", className: "bg-blue-600/20 text-blue-400 border-blue-500/30" },
    { id: 'log-viewer', icon: <Terminal className="w-4 h-4 md:w-5 md:h-5" />, onClick: onToggleLogViewer, tooltip: "Console Logs", className: "bg-slate-800 text-slate-400 border-white/10 hover:bg-slate-700" },
  ];

  const getMenuClasses = (dir: MenuDirection) => {
    switch (dir) {
      case 'up': return "flex-col-reverse mb-3 md:mb-5";
      case 'down': return "flex-col mt-3 md:mt-5";
      case 'left': return "flex-row-reverse mr-3 md:mr-5";
      case 'right': return "flex-row ml-3 md:ml-5";
    }
  };

  return (
    <TooltipProvider>
      <motion.div
        drag
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x: position.x, y: position.y }}
        className={cn(
          "fixed bottom-6 left-6 md:bottom-10 md:left-10 z-[300] flex items-center gap-3 md:gap-5 touch-none cursor-grab active:cursor-grabbing",
          direction === 'up' && "flex-col-reverse",
          direction === 'down' && "flex-col",
          direction === 'left' && "flex-row-reverse",
          direction === 'right' && "flex-row"
        )}
      >
        <div className="bg-slate-950/90 backdrop-blur-3xl p-2 md:p-2.5 rounded-full border border-white/10 shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)] relative">
          <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-2xl animate-pulse" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleMenu}
                className={cn(
                  "h-12 w-12 md:h-16 md:w-16 rounded-full transition-all duration-500 border-2 shadow-2xl relative z-10",
                  internalIsMenuOpen ? "bg-indigo-600 text-white border-indigo-400 rotate-90" : "bg-slate-900 text-indigo-400 border-white/10"
                )}
              >
                {internalIsMenuOpen ? <X className="w-6 h-6 md:w-8 md:h-8" /> : <Command className="w-6 h-6 md:w-8 md:h-8" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={direction === 'left' ? 'right' : direction === 'right' ? 'left' : direction === 'up' ? 'bottom' : 'top'}>Command Hub</TooltipContent>
          </Tooltip>
        </div>

        <AnimatePresence>
          {internalIsMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: direction === 'up' ? 30 : -30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: direction === 'up' ? 30 : -30 }}
              className={cn("flex items-center gap-3 md:gap-5", getMenuClasses(direction))}
            >
              <div className={cn(
                "flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-slate-950/95 rounded-[2.5rem] md:rounded-[3.5rem] border border-white/10 shadow-2xl backdrop-blur-3xl",
                (direction === 'up' || direction === 'down') ? "flex-col" : "flex-row"
              )}>
                {primaryButtons.map((btn) => (
                  <Tooltip key={btn.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { btn.onClick?.(); if (btn.id !== 'practice') handleToggleMenu(); }}
                        className={cn("h-11 w-11 md:h-14 md:w-14 rounded-full border transition-all active:scale-90 disabled:opacity-10 hover:scale-110", btn.className)}
                        disabled={btn.disabled}
                        aria-label={btn.tooltip}
                      >
                        {btn.icon}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={direction === 'left' ? 'right' : direction === 'right' ? 'left' : direction === 'up' ? 'bottom' : 'top'} className="text-[11px] font-black uppercase tracking-widest">{btn.tooltip}</TooltipContent>
                  </Tooltip>
                ))}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSubMenuOpen(!isSubMenuOpen)}
                      className={cn(
                        "h-11 w-11 md:h-14 md:w-14 rounded-full border transition-all hover:scale-110",
                        isSubMenuOpen ? "bg-indigo-600 text-white border-indigo-400" : "bg-slate-900 text-slate-400 border-white/10"
                      )}
                      aria-label={isSubMenuOpen ? "Close Utilities" : "Open Utilities"}
                    >
                      {isSubMenuOpen ? <X className="w-5 h-5 md:w-6 md:h-6" /> : <Wrench className="w-5 h-5 md:w-6 md:h-6" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side={direction === 'left' ? 'right' : direction === 'right' ? 'left' : direction === 'up' ? 'bottom' : 'top'} className="text-[11px] font-black uppercase tracking-widest">Utilities</TooltipContent>
                </Tooltip>

              </div>

              <AnimatePresence>
                {isSubMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, x: direction === 'left' ? 30 : -30 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: direction === 'left' ? 30 : -30 }}
                    className={cn(
                      "grid grid-cols-2 gap-2 md:gap-3 p-3 md:p-4 bg-slate-950/95 rounded-[2rem] md:rounded-[2.5rem] border border-white/10 shadow-2xl backdrop-blur-3xl",
                      (direction === 'left' || direction === 'right') && "grid-flow-col"
                    )}
                  >
                    {secondaryButtons.map((btn) => (
                      <Tooltip key={btn.id}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { btn.onClick(); if (btn.id !== 'heatmap' && btn.id !== 'safe-pitch') handleToggleMenu(); }}
                            className={cn("h-9 w-9 md:h-12 md:w-12 rounded-full border transition-all hover:scale-110", btn.className)}
                          >
                            {btn.icon}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[11px] font-black uppercase">{btn.tooltip}</TooltipContent>
                      </Tooltip>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  );
});

FloatingCommandDock.displayName = 'FloatingCommandDock';

export default FloatingCommandDock;
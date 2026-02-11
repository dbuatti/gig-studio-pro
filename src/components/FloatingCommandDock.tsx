"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Search, Sparkles, ShieldCheck, X, Settings, 
  Play, FileText, Pause, BookOpen, Volume2, ShieldAlert, Zap,
  ChevronRight, ChevronLeft, ChevronUp, ChevronDown, MoreHorizontal, Wrench,
  Rocket, Activity, Command
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/hooks/use-settings';
import { compareNotes } from '@/utils/keyUtils';
import { showError } from '@/utils/toast';

interface FloatingCommandDockProps {
  onOpenSearch: () => void;
  onOpenPractice: () => void;
  onOpenReader: (initialSongId?: string) => void;
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
}

type MenuDirection = 'up' | 'down' | 'left' | 'right';

const FloatingCommandDock: React.FC<FloatingCommandDockProps> = React.memo(({
  onOpenSearch,
  onOpenPractice,
  onOpenReader,
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
}) => {
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
    const dockSize = 56;
    const margin = 32;
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
      (s.dir === 'left' || s.dir === 'right') ? s.space > 250 : s.space > 200
    );

    if (validSpaces.length > 0) {
      validSpaces.sort((a, b) => b.space - a.space);
      return validSpaces[0].dir;
    }

    spaces.sort((a, b) => b.space - a.space);
    return spaces[0].dir;
  }, [position]);

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

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement || 
        (e.target as HTMLElement).isContentEditable ||
        e.metaKey || 
        e.ctrlKey
      ) return;

      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onOpenPerformance();
      }
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onOpenReader(activeSongId || undefined);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onOpenPerformance, onOpenReader, activeSongId]);

  const handleDragEnd = (_: any, info: any) => {
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
      icon: isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />,
      onClick: onTogglePlayback, 
      disabled: false, 
      tooltip: isPlaying ? "Pause [Space]" : "Play [Space]",
      className: cn(
        "text-white shadow-xl scale-110",
        isPlaying ? "bg-red-600 border-red-500" : "bg-indigo-600 border-indigo-500"
      ),
    },
    {
      id: 'performance',
      icon: <Rocket className="w-5 h-5" />,
      onClick: onOpenPerformance,
      disabled: !activeSongId,
      tooltip: "Stage Mode [P]",
      className: "bg-orange-600 text-white border-orange-500",
    },
    {
      id: 'reader',
      icon: <FileText className="w-5 h-5" />,
      onClick: () => onOpenReader(activeSongId || undefined),
      disabled: false, 
      tooltip: "Sheet Reader [R]",
      className: "bg-emerald-600 text-white border-emerald-500",
    },
    {
      id: 'search',
      icon: <Search className="w-5 h-5" />,
      onClick: onOpenSearch,
      disabled: false,
      tooltip: "Discovery Engine",
      className: "bg-slate-800 text-white border-white/10 hover:bg-indigo-600",
    },
  ];

  const secondaryButtons = [
    { id: 'automation', icon: <Zap className="w-4 h-4" />, onClick: onOpenAdmin, tooltip: "Automation Hub", className: "bg-purple-600/20 text-purple-400 border-purple-500/30" },
    { id: 'admin', icon: <ShieldCheck className="w-4 h-4" />, onClick: onOpenAdmin, tooltip: "Audit Matrix", className: "bg-red-900/40 text-red-400 border-red-500/30" },
    { id: 'heatmap', icon: <Sparkles className="w-4 h-4" />, onClick: onToggleHeatmap, tooltip: "Toggle Heatmap [H]", className: cn(showHeatmap ? "bg-amber-500 text-black border-amber-400" : "bg-slate-800 text-amber-400 border-white/10") },
    ...(isSafePitchEnabled ? [{ id: 'safe-pitch', icon: <ShieldAlert className="w-4 h-4" />, onClick: () => setIsSafePitchActive(!isSafePitchActive), tooltip: "Safe Pitch Mode", className: cn(isSafePitchActive ? "bg-emerald-600 text-white border-emerald-400" : "bg-slate-800 text-emerald-400 border-white/10") }] : []),
    { id: 'preferences', icon: <Settings className="w-4 h-4" />, onClick: onOpenPreferences, tooltip: "Preferences", className: "bg-slate-800 text-slate-300 border-white/10" },
    { id: 'user-guide', icon: <BookOpen className="w-4 h-4" />, onClick: onOpenUserGuide, tooltip: "User Guide", className: "bg-blue-600/20 text-blue-400 border-blue-500/30" },
  ];

  const getMenuClasses = (dir: MenuDirection) => {
    switch (dir) {
      case 'up': return "flex-col-reverse mb-4";
      case 'down': return "flex-col mt-4";
      case 'left': return "flex-row-reverse mr-4";
      case 'right': return "flex-row ml-4";
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
          "fixed bottom-8 left-8 z-[300] flex items-center gap-4 touch-none cursor-grab active:cursor-grabbing",
          direction === 'up' && "flex-col-reverse",
          direction === 'down' && "flex-col",
          direction === 'left' && "flex-row-reverse",
          direction === 'right' && "flex-row"
        )}
      >
        <div className="bg-slate-950/80 backdrop-blur-2xl p-2 rounded-full border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleMenu}
                className={cn(
                  "h-14 w-14 rounded-full transition-all duration-500 border-2 shadow-xl",
                  internalIsMenuOpen ? "bg-indigo-600 text-white border-indigo-400 rotate-90" : "bg-slate-900 text-indigo-400 border-white/5"
                )}
              >
                {internalIsMenuOpen ? <X className="w-6 h-6" /> : <Command className="w-6 h-6" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={direction === 'left' ? 'right' : direction === 'right' ? 'left' : direction === 'up' ? 'bottom' : 'top'}>Command Hub</TooltipContent>
          </Tooltip>
        </div>

        <AnimatePresence>
          {internalIsMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: direction === 'up' ? 20 : -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: direction === 'up' ? 20 : -20 }}
              className={cn("flex items-center gap-4", getMenuClasses(direction))}
            >
              <div className={cn(
                "flex items-center gap-3 p-3 bg-slate-950/90 rounded-[2.5rem] border border-white/10 shadow-2xl backdrop-blur-xl",
                (direction === 'up' || direction === 'down') ? "flex-col" : "flex-row"
              )}>
                {primaryButtons.map((btn) => (
                  <Tooltip key={btn.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { btn.onClick?.(); if (btn.id !== 'practice') handleToggleMenu(); }}
                        className={cn("h-12 w-12 rounded-full border transition-all active:scale-90 disabled:opacity-10", btn.className)}
                        disabled={btn.disabled}
                      >
                        {btn.icon}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={direction === 'left' ? 'right' : direction === 'right' ? 'left' : direction === 'up' ? 'bottom' : 'top'}>{btn.tooltip}</TooltipContent>
                  </Tooltip>
                ))}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSubMenuOpen(!isSubMenuOpen)}
                      className={cn(
                        "h-12 w-12 rounded-full border transition-all",
                        isSubMenuOpen ? "bg-indigo-600 text-white border-indigo-400" : "bg-slate-900 text-slate-400 border-white/5"
                      )}
                    >
                      {isSubMenuOpen ? <X className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side={direction === 'left' ? 'right' : direction === 'right' ? 'left' : direction === 'up' ? 'bottom' : 'top'}>Utilities</TooltipContent>
                </Tooltip>
              </div>

              <AnimatePresence>
                {isSubMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, x: direction === 'left' ? 20 : -20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: direction === 'left' ? 20 : -20 }}
                    className={cn(
                      "grid grid-cols-2 gap-2 p-3 bg-slate-950/90 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl",
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
                            className={cn("h-10 w-10 rounded-full border transition-all hover:scale-110", btn.className)}
                          >
                            {btn.icon}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] font-black uppercase">{btn.tooltip}</TooltipContent>
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
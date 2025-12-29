"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Search, Sparkles, ShieldCheck, X, Settings, 
  Play, FileText, Pause, BookOpen, ShieldAlert, Zap,
  Wrench
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
  onToggleHeatmap: () => void;
  onOpenUserGuide: () => void;
  showHeatmap: boolean;
  viewMode: 'repertoire' | 'setlist';
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
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('floating_dock_open') === 'true';
    return false;
  });

  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('floating_dock_position');
      return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    }
    return { x: 0, y: 0 };
  });

  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [isSafePitchActive, setIsSafePitchActive] = useState(false);
  const { safePitchMaxNote } = useSettings();

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || 'ontouchstart' in window;
  }, []);

  // Must be declared BEFORE any useEffect that references it
  const internalIsMenuOpen = isReaderMode ? isMenuOpenProp : isOpen;

  // Follow cursor when menu is closed — always "behind" the cursor
  useEffect(() => {
    if (internalIsMenuOpen) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [internalIsMenuOpen]);

  // Intelligent direction based on available space
  const direction = useMemo((): MenuDirection => {
    if (typeof window === 'undefined') return isMobile ? 'up' : 'right';

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const dockSize = 64;
    const margin = 32;

    const currentX = windowWidth - margin - dockSize / 2 + position.x;
    const currentY = windowHeight - margin - dockSize / 2 + position.y;

    const spaceRight = windowWidth - currentX;
    const spaceLeft = currentX;
    const spaceDown = windowHeight - currentY;
    const spaceUp = currentY;

    const menuWidth = isMobile ? 120 : 320;
    const menuHeight = isMobile ? 420 : 180;

    const spaces = [
      { dir: 'right' as MenuDirection, space: spaceRight, needs: menuWidth },
      { dir: 'left' as MenuDirection, space: spaceLeft, needs: menuWidth },
      { dir: 'down' as MenuDirection, space: spaceDown, needs: menuHeight },
      { dir: 'up' as MenuDirection, space: spaceUp, needs: menuHeight },
    ];

    const valid = spaces.filter(s => s.space > s.needs + dockSize);
    if (valid.length > 0) {
      valid.sort((a, b) => b.space - a.space);
      return valid[0].dir;
    }

    spaces.sort((a, b) => b.space - a.space);
    return spaces[0].dir;
  }, [position, isMobile]);

  const handleToggleMenu = useCallback(() => {
    const nextState = !internalIsMenuOpen;
    if (isReaderMode) onSetMenuOpen?.(nextState);
    else setIsOpen(nextState);
    if (!nextState) setIsSubMenuOpen(false);
    localStorage.setItem('floating_dock_open', nextState.toString());
  }, [internalIsMenuOpen, isReaderMode, onSetMenuOpen]);

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && internalIsMenuOpen) handleToggleMenu();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [internalIsMenuOpen, handleToggleMenu]);

  // Drag handling — only when menu is closed
  const handleDragStart = () => {
    if (internalIsMenuOpen) return;
    setIsDragging(true);
  };

  const handleDragEnd = (_: any, info: any) => {
    if (internalIsMenuOpen) return;
    const newPos = { x: position.x + info.offset.x, y: position.y + info.offset.y };
    setPosition(newPos);
    localStorage.setItem('floating_dock_position', JSON.stringify(newPos));
    setIsDragging(false);
  };

  const safePitchLimit = useMemo(() => {
    if (!currentSongHighestNote || !safePitchMaxNote) return null;
    return compareNotes(safePitchMaxNote, currentSongHighestNote);
  }, [currentSongHighestNote, safePitchMaxNote]);

  useEffect(() => {
    if (isSafePitchActive && safePitchLimit !== null) {
      const currentPitch = currentSongPitch || 0;
      if (currentPitch > safePitchLimit) {
        onSafePitchToggle?.(false, 0);
        setIsSafePitchActive(false);
        showError("Pitch exceeds safe limit.");
        return;
      }
      onSafePitchToggle?.(true, safePitchLimit);
    } else if (!isSafePitchActive) {
      onSafePitchToggle?.(false, 0);
    }
  }, [isSafePitchActive, safePitchLimit, currentSongPitch, onSafePitchToggle]);

  const primaryButtons = [
    {
      id: 'practice',
      icon: isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />,
      onClick: onTogglePlayback,
      disabled: !hasPlayableSong,
      tooltip: isPlaying ? "Pause (Space)" : "Play (Space)",
      className: cn("text-white shadow-2xl scale-110", isPlaying ? "bg-red-600" : "bg-indigo-600"),
    },
    {
      id: 'reader',
      icon: <FileText className="w-7 h-7" />,
      onClick: () => onOpenReader(activeSongId || undefined),
      disabled: !hasReadableChart,
      tooltip: "Reader (R)",
      className: "bg-emerald-600 text-white",
    },
    {
      id: 'search',
      icon: <Search className="w-7 h-7" />,
      onClick: onOpenSearch,
      tooltip: "Discovery",
      className: "bg-slate-700 text-white hover:bg-indigo-600",
    },
  ];

  const secondaryButtons = [
    { id: 'automation', icon: <Zap className="w-5 h-5" />, onClick: onOpenAdmin, tooltip: "Automation Hub" },
    { id: 'admin', icon: <ShieldCheck className="w-5 h-5" />, onClick: onOpenAdmin, tooltip: "Audit Matrix" },
    { id: 'heatmap', icon: <Sparkles className="w-5 h-5" />, onClick: onToggleHeatmap, tooltip: "Heatmap (H)", active: showHeatmap },
    { id: 'safe-pitch', icon: <ShieldAlert className="w-5 h-5" />, onClick: () => setIsSafePitchActive(prev => !prev), tooltip: "Safe Pitch", active: isSafePitchActive },
    { id: 'preferences', icon: <Settings className="w-5 h-5" />, onClick: onOpenPreferences, tooltip: "Preferences" },
    { id: 'user-guide', icon: <BookOpen className="w-5 h-5" />, onClick: onOpenUserGuide, tooltip: "User Guide" },
  ];

  const getMenuAlignment = (dir: MenuDirection) => {
    switch (dir) {
      case 'up': return "items-end flex-col-reverse mb-4";
      case 'down': return "items-start flex-col mt-4";
      case 'left': return "items-end flex-row-reverse mr-4";
      case 'right': return "items-start flex-row ml-4";
    }
  };

  const dockX = internalIsMenuOpen ? position.x : mousePos.x - 32;
  const dockY = internalIsMenuOpen ? position.y : mousePos.y - 32;

  return (
    <TooltipProvider delayDuration={300}>
      <motion.div
        drag={!internalIsMenuOpen}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={{ x: dockX, y: dockY }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={cn(
          "fixed z-[9999] flex touch-none pointer-events-none", // container ignores events when closed
          isDragging && "cursor-grabbing",
          !isDragging && !internalIsMenuOpen && "cursor-none",
          internalIsMenuOpen && getMenuAlignment(direction)
        )}
      >
        {/* Main Hub Button — ONLY this part is clickable when menu is closed */}
        <div className="bg-slate-950/95 backdrop-blur-2xl p-3 rounded-full border border-white/20 shadow-2xl pointer-events-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleMenu}
                className={cn(
                  "h-16 w-16 rounded-full transition-all duration-500 border-4 shadow-2xl flex items-center justify-center",
                  internalIsMenuOpen 
                    ? "bg-slate-100 text-slate-950 border-white" 
                    : "bg-slate-900 text-indigo-400 border-white/20 hover:border-indigo-400 hover:scale-110"
                )}
              >
                {internalIsMenuOpen ? <X className="w-8 h-8" /> : <LayoutDashboard className="w-8 h-8" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Command Center</TooltipContent>
          </Tooltip>
        </div>

        <AnimatePresence>
          {internalIsMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: isMobile ? 20 : 0, x: isMobile ? 0 : 20 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className={cn("flex gap-4 pointer-events-auto", isMobile ? "flex-col" : "flex-row")} // re-enable events when open
            >
              {/* Primary Actions */}
              <div className={cn(
                "flex gap-4 p-4 bg-slate-950/95 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-2xl",
                isMobile ? "flex-col" : "flex-row"
              )}>
                {primaryButtons.map((btn) => (
                  <Tooltip key={btn.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={btn.disabled}
                        onClick={() => { btn.onClick(); if (btn.id !== 'practice') handleToggleMenu(); }}
                        className={cn(
                          "rounded-full border-2 transition-all hover:scale-110 active:scale-95 disabled:opacity-30",
                          isMobile ? "h-16 w-16" : "h-14 w-14",
                          btn.className
                        )}
                      >
                        {btn.icon}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{btn.tooltip}</TooltipContent>
                  </Tooltip>
                ))}

                {/* Utilities Toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSubMenuOpen(prev => !prev)}
                      className={cn(
                        "rounded-full border-2 transition-all",
                        isMobile ? "h-16 w-16" : "h-14 w-14",
                        isSubMenuOpen ? "bg-white text-slate-950" : "bg-slate-800 text-slate-400"
                      )}
                    >
                      {isSubMenuOpen ? <X className="w-7 h-7" /> : <Wrench className="w-7 h-7" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>More Tools</TooltipContent>
                </Tooltip>
              </div>

              {/* Secondary Utilities */}
              <AnimatePresence>
                {isSubMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={cn(
                      "p-4 bg-slate-900/95 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-2xl",
                      isMobile ? "grid grid-cols-3 gap-4" : "grid grid-cols-3 gap-3"
                    )}
                  >
                    {secondaryButtons.map((btn) => (
                      <Tooltip key={btn.id}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { 
                              btn.onClick(); 
                              if (!['heatmap', 'safe-pitch'].includes(btn.id)) handleToggleMenu(); 
                            }}
                            className={cn(
                              "rounded-full border transition-all hover:scale-110",
                              isMobile ? "h-14 w-14" : "h-12 w-12",
                              btn.active ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
                            )}
                          >
                            {btn.icon}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{btn.tooltip}</TooltipContent>
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
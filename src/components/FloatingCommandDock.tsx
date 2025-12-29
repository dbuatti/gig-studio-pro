"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Search, Sparkles, ShieldCheck, X, Settings, 
  Play, FileText, Pause, BookOpen, Volume2, ShieldAlert, Zap,
  ChevronRight, ChevronLeft, ChevronUp, ChevronDown, MoreHorizontal, Wrench
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

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('floating_dock_position');
      return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    }
    return { x: 0, y: 0 };
  });

  const [isSafePitchActive, setIsSafePitchActive] = useState(false);
  const { safePitchMaxNote } = useSettings();

  // Intelligent Direction Calculation
  const direction = useMemo((): MenuDirection => {
    if (typeof window === 'undefined') return 'up';
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Calculate the absolute position of the dock center relative to the viewport
    // The dock is initially positioned bottom-8 right-8, so its initial offset is negative.
    // We need to calculate the actual screen coordinates.
    const dockSize = 56; // Approximate size of the main button
    const margin = 32; // 8 units margin * 4 (tailwind default)
    
    // Calculate the current screen position (relative to top-left)
    const screenX = windowWidth - margin - dockSize + position.x;
    const screenY = windowHeight - margin - dockSize + position.y;

    // Determine available space
    const spaceRight = windowWidth - screenX;
    const spaceLeft = screenX;
    const spaceDown = windowHeight - screenY;
    const spaceUp = screenY;

    // Threshold for deciding direction (e.g., 200px needed for menu)
    const threshold = 200; 

    // Prioritize opening away from the closest edge
    if (spaceRight < threshold && spaceLeft > threshold) {
      return 'left';
    }
    if (spaceLeft < threshold && spaceRight > threshold) {
      return 'right';
    }
    if (spaceDown < threshold && spaceUp > threshold) {
      return 'up';
    }
    if (spaceUp < threshold && spaceDown > threshold) {
      return 'down';
    }

    // Default to bottom-right corner behavior (expand up and left)
    if (screenX > windowWidth / 2) return 'up';
    return 'right';
  }, [position]);

  const internalIsMenuOpen = isReaderMode ? isMenuOpenProp : isOpen;
  
  const handleToggleMenu = useCallback(() => {
    const nextState = !internalIsMenuOpen;
    if (isReaderMode) onSetMenuOpen?.(nextState);
    else setIsOpen(nextState);
    if (!nextState) setIsSubMenuOpen(false);
    localStorage.setItem('floating_dock_open', nextState.toString());
  }, [internalIsMenuOpen, isReaderMode, onSetMenuOpen]);

  // Global ESC listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && internalIsMenuOpen) handleToggleMenu();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [internalIsMenuOpen, handleToggleMenu]);

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
    if (isSafePitchActive && safePitchLimit !== null) {
      const currentPitch = currentSongPitch || 0;
      if (currentPitch > safePitchLimit) {
        onSafePitchToggle?.(false, 0);
        setIsSafePitchActive(false);
        showError("Pitch exceeds safe limit.");
        return;
      }
      onSafePitchToggle?.(true, safePitchLimit);
    } else if (!isSafePitchActive) onSafePitchToggle?.(false, 0);
  }, [isSafePitchActive, safePitchLimit, currentSongPitch, onSafePitchToggle]);

  const primaryButtons = [
    {
      id: 'practice',
      icon: isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />,
      onClick: onTogglePlayback,
      disabled: !hasPlayableSong,
      tooltip: isPlaying ? "Pause (Space)" : "Play (Space)",
      className: cn(
        "text-white shadow-xl scale-110",
        isPlaying ? "bg-red-600 border-red-500" : "bg-indigo-600 border-indigo-500"
      ),
    },
    {
      id: 'reader',
      icon: <FileText className="w-5 h-5" />,
      onClick: () => onOpenReader(activeSongId || undefined),
      disabled: !hasReadableChart,
      tooltip: "Reader (R)",
      className: "bg-emerald-600 text-white border-emerald-500",
    },
    {
      id: 'search',
      icon: <Search className="w-5 h-5" />,
      onClick: onOpenSearch,
      tooltip: "Discovery",
      className: "bg-slate-800 text-white border-white/10 hover:bg-indigo-600",
    },
  ];

  const secondaryButtons = [
    { id: 'automation', icon: <Zap className="w-4 h-4" />, onClick: onOpenAdmin, tooltip: "Automation Hub", className: "bg-purple-600/20 text-purple-400 border-purple-500/30" },
    { id: 'admin', icon: <ShieldCheck className="w-4 h-4" />, onClick: onOpenAdmin, tooltip: "Audit Matrix", className: "bg-red-900/40 text-red-400 border-red-500/30" },
    { id: 'heatmap', icon: <Sparkles className="w-4 h-4" />, onClick: onToggleHeatmap, tooltip: "Heatmap (H)", className: cn(showHeatmap ? "bg-amber-500 text-black border-amber-400" : "bg-slate-800 text-amber-400 border-white/10") },
    { id: 'safe-pitch', icon: <ShieldAlert className="w-4 h-4" />, onClick: () => setIsSafePitchActive(!isSafePitchActive), tooltip: "Safe Pitch", className: cn(isSafePitchActive ? "bg-emerald-600 text-white border-emerald-400" : "bg-slate-800 text-emerald-400 border-white/10") },
    { id: 'preferences', icon: <Settings className="w-4 h-4" />, onClick: onOpenPreferences, tooltip: "Prefs", className: "bg-slate-800 text-slate-300 border-white/10" },
    { id: 'user-guide', icon: <BookOpen className="w-4 h-4" />, onClick: onOpenUserGuide, tooltip: "Guide", className: "bg-blue-600/20 text-blue-400 border-blue-500/30" },
  ];

  const getMenuClasses = (dir: MenuDirection) => {
    switch (dir) {
      case 'up': return "flex-col-reverse mb-3";
      case 'down': return "flex-col mt-3";
      case 'left': return "flex-row-reverse mr-3";
      case 'right': return "flex-row ml-3";
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
          "fixed bottom-8 right-8 z-[300] flex items-center gap-3 touch-none cursor-grab active:cursor-grabbing",
          direction === 'up' && "flex-col-reverse",
          direction === 'down' && "flex-col",
          direction === 'left' && "flex-row-reverse",
          direction === 'right' && "flex-row"
        )}
      >
        {/* Hub Trigger Button */}
        <div className="bg-slate-950/90 backdrop-blur-2xl p-2 rounded-full border border-white/20 shadow-2xl">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleMenu}
                className={cn(
                  "h-14 w-14 rounded-full transition-all duration-500 border-2 shadow-xl",
                  internalIsMenuOpen ? "bg-slate-100 text-slate-950 border-white rotate-90" : "bg-slate-900 text-indigo-400 border-white/10"
                )}
              >
                {internalIsMenuOpen ? <X className="w-6 h-6" /> : <LayoutDashboard className="w-6 h-6" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={direction === 'left' ? 'right' : 'left'}>Command Hub</TooltipContent>
          </Tooltip>
        </div>

        <AnimatePresence>
          {internalIsMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={cn("flex items-center gap-3", getMenuClasses(direction))}
            >
              {/* Primary Slot Container */}
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
                        disabled={btn.disabled}
                        onClick={() => { btn.onClick(); if (btn.id !== 'practice') handleToggleMenu(); }}
                        className={cn("h-12 w-12 rounded-full border transition-all active:scale-90 disabled:opacity-10", btn.className)}
                      >
                        {btn.icon}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={direction === 'left' ? 'right' : 'left'}>{btn.tooltip}</TooltipContent>
                  </Tooltip>
                ))}

                {/* Sub-Menu Toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSubMenuOpen(!isSubMenuOpen)}
                      className={cn(
                        "h-12 w-12 rounded-full border transition-all",
                        isSubMenuOpen ? "bg-white text-slate-950 border-white" : "bg-slate-800 text-slate-400 border-white/5"
                      )}
                    >
                      {isSubMenuOpen ? <X className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side={direction === 'left' ? 'right' : 'left'}>Utilities</TooltipContent>
                </Tooltip>
              </div>

              {/* Secondary Utility Matrix */}
              <AnimatePresence>
                {isSubMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className={cn(
                      "grid grid-cols-2 gap-2 p-3 bg-slate-900/90 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-xl",
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
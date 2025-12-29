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

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('floating_dock_position');
      return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    }
    return { x: 0, y: 0 };
  });

  const [isSafePitchActive, setIsSafePitchActive] = useState(false);
  const { safePitchMaxNote } = useSettings();

  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window);

  const internalIsMenuOpen = isReaderMode ? isMenuOpenProp : isOpen;

  // Smart direction: open away from nearest edge
  const direction = useMemo((): MenuDirection => {
    if (typeof window === 'undefined') return isMobile ? 'up' : 'right';

    const threshold = window.innerWidth / 2;
    const dockCenterX = window.innerWidth - 64 + position.x; // approx from right

    if (isMobile) return 'up'; // always up on mobile for vertical layout

    return dockCenterX < threshold ? 'right' : 'left';
  }, [position.x, isMobile]);

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
    { id: 'automation', icon: <Zap className="w-6 h-6" />, onClick: onOpenAdmin, tooltip: "Automation Hub" },
    { id: 'admin', icon: <ShieldCheck className="w-6 h-6" />, onClick: onOpenAdmin, tooltip: "Audit Matrix" },
    { id: 'heatmap', icon: <Sparkles className="w-6 h-6" />, onClick: onToggleHeatmap, tooltip: "Heatmap (H)", active: showHeatmap },
    { id: 'safe-pitch', icon: <ShieldAlert className="w-6 h-6" />, onClick: () => setIsSafePitchActive(p => !p), tooltip: "Safe Pitch", active: isSafePitchActive },
    { id: 'preferences', icon: <Settings className="w-6 h-6" />, onClick: onOpenPreferences, tooltip: "Preferences" },
    { id: 'user-guide', icon: <BookOpen className="w-6 h-6" />, onClick: onOpenUserGuide, tooltip: "User Guide" },
  ];

  return (
    <TooltipProvider>
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ x: position.x, y: position.y }}
        className={cn(
          "fixed bottom-8 right-8 z-[9999] touch-none cursor-grab active:cursor-grabbing",
          "flex items-center gap-4",
          direction === 'left' && "flex-row-reverse",
          direction === 'right' && "flex-row",
          isMobile && internalIsMenuOpen && "flex-col bottom-20" // vertical on mobile when open
        )}
      >
        {/* Main Hub Button - Larger */}
        <div className="bg-slate-950/95 backdrop-blur-2xl p-3 rounded-full border border-white/20 shadow-2xl">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleMenu}
                className={cn(
                  "h-16 w-16 rounded-full border-4 shadow-2xl transition-all hover:scale-110",
                  internalIsMenuOpen 
                    ? "bg-white text-slate-950 border-white" 
                    : "bg-slate-900 text-indigo-400 border-white/20"
                )}
              >
                {internalIsMenuOpen ? <X className="w-8 h-8" /> : <LayoutDashboard className="w-8 h-8" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={direction === 'left' ? 'right' : 'left'}>Command Center</TooltipContent>
          </Tooltip>
        </div>

        <AnimatePresence>
          {internalIsMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "flex gap-4",
                isMobile ? "flex-col" : direction === 'left' ? "flex-row-reverse mr-4" : "flex-row ml-4"
              )}
            >
              {/* Primary Actions */}
              <div className={cn(
                "flex gap-4 p-5 bg-slate-950/95 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl",
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
                          "rounded-full border-2 transition-all hover:scale-110 active:scale-95 disabled:opacity-40",
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

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSubMenuOpen(p => !p)}
                      className={cn(
                        "rounded-full border-2",
                        isMobile ? "h-16 w-16" : "h-14 w-14",
                        isSubMenuOpen ? "bg-white text-slate-950" : "bg-slate-800 text-slate-400"
                      )}
                    >
                      {isSubMenuOpen ? <X className="w-7 h-7" /> : <Wrench className="w-7 h-7" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Tools</TooltipContent>
                </Tooltip>
              </div>

              <AnimatePresence>
                {isSubMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={cn(
                      "p-5 bg-slate-900/95 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl",
                      isMobile ? "grid grid-cols-3 gap-5" : "grid grid-cols-3 gap-4"
                    )}
                  >
                    {secondaryButtons.map((btn) => (
                      <Tooltip key={btn.id}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { btn.onClick(); if (!['heatmap', 'safe-pitch'].includes(btn.id)) handleToggleMenu(); }}
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
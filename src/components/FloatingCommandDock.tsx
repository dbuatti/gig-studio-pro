"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Search, Sparkles, ShieldCheck, X, Settings, 
  Play, FileText, Pause, BookOpen, Volume2, ShieldAlert
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
  // --- Persisted Open/Close State ---
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('floating_dock_open') === 'true';
    }
    return false;
  });

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('floating_dock_position');
      return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    }
    return { x: 0, y: 0 };
  });

  const [isSafePitchActive, setIsSafePitchActive] = useState(false);
  const { safePitchMaxNote } = useSettings();

  // Intelligent Direction logic
  // Since we start with 'bottom-8', a negative Y means we've moved UP.
  const isNearTop = useMemo(() => {
    if (typeof window === 'undefined') return false;
    // Check if the center of the hub is in the top half of the screen
    // y = 0 is bottom. y = -innerHeight is top.
    return position.y < -(window.innerHeight / 2);
  }, [position.y]);

  // Sync menu state for ReaderMode or internal state
  const internalIsMenuOpen = isReaderMode ? isMenuOpenProp : isOpen;
  
  const handleToggleMenu = () => {
    const nextState = !internalIsMenuOpen;
    if (isReaderMode) {
      onSetMenuOpen?.(nextState);
    } else {
      setIsOpen(nextState);
    }
    localStorage.setItem('floating_dock_open', nextState.toString());
  };

  // Persist position
  const handleDragEnd = (_: any, info: any) => {
    const newPos = { 
      x: position.x + info.offset.x, 
      y: position.y + info.offset.y 
    };
    setPosition(newPos);
    localStorage.setItem('floating_dock_position', JSON.stringify(newPos));
  };

  // Safe Pitch Calculation
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
      id: 'reader',
      icon: <FileText className="w-5 h-5" />,
      onClick: () => onOpenReader(activeSongId || undefined),
      disabled: !hasReadableChart,
      tooltip: "Sheet Reader (R)",
      className: "bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600 hover:text-white",
    },
    {
      id: 'practice',
      icon: isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />,
      onClick: onTogglePlayback,
      disabled: !hasPlayableSong,
      tooltip: isPlaying ? "Pause (Space)" : "Play (Space)",
      className: cn(
        "text-white shadow-lg",
        isPlaying ? "bg-red-600 border-red-500 hover:bg-red-700" : "bg-indigo-600 border-indigo-500 hover:bg-indigo-700"
      ),
    },
    {
      id: 'search',
      icon: <Search className="w-5 h-5" />,
      onClick: onOpenSearch,
      tooltip: "Global Discovery",
      className: "bg-slate-800 text-slate-100 border-white/10 hover:bg-indigo-600 hover:text-white",
    },
  ];

  const secondaryButtons = [
    { id: 'user-guide', icon: <BookOpen className="w-4 h-4" />, onClick: onOpenUserGuide, tooltip: "User Guide", className: "bg-blue-600/20 text-blue-400 border-blue-500/30" },
    { id: 'preferences', icon: <Settings className="w-4 h-4" />, onClick: onOpenPreferences, tooltip: "Preferences", className: "bg-slate-800 text-slate-300 border-white/10" },
    { id: 'admin', icon: <ShieldCheck className="w-4 h-4" />, onClick: onOpenAdmin, tooltip: "Audit Matrix", className: "bg-red-900/40 text-red-400 border-red-500/30" },
    { 
      id: 'heatmap', 
      icon: <Sparkles className="w-4 h-4" />, 
      onClick: onToggleHeatmap,
      tooltip: "Heatmap (H)", 
      className: cn(showHeatmap ? "bg-amber-500 text-black border-amber-400" : "bg-slate-800 text-amber-400 border-amber-500/20") 
    },
    { 
      id: 'safe-pitch', 
      icon: <ShieldAlert className="w-4 h-4" />, 
      onClick: () => setIsSafePitchActive(!isSafePitchActive), 
      tooltip: "Safe Pitch Mode", 
      className: cn(isSafePitchActive ? "bg-emerald-600 text-white border-emerald-400" : "bg-slate-800 text-emerald-400 border-emerald-500/20") 
    },
  ];

  return (
    <TooltipProvider>
      <motion.div
        drag
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x: position.x, y: position.y }}
        className={cn(
          "fixed bottom-8 right-8 z-[300] flex items-center gap-3 touch-none cursor-grab active:cursor-grabbing",
          isNearTop ? "flex-col" : "flex-col-reverse"
        )}
      >
        {/* Hub Trigger Button */}
        <div className="bg-slate-950/90 backdrop-blur-2xl p-2 rounded-full border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleToggleMenu}
                className={cn(
                  "h-14 w-14 rounded-full transition-all duration-500 border-2",
                  internalIsMenuOpen 
                    ? "bg-slate-100 text-slate-950 border-white rotate-90 shadow-xl" 
                    : "bg-slate-900 text-indigo-400 border-white/10 hover:border-indigo-500/50"
                )}
              >
                {internalIsMenuOpen ? <X className="w-6 h-6" /> : <LayoutDashboard className="w-6 h-6" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-[10px] font-black uppercase">Command Hub</TooltipContent>
          </Tooltip>
        </div>

        {/* Action Buttons Stack (Visible when hub is open) */}
        <AnimatePresence>
          {internalIsMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: isNearTop ? -20 : 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: isNearTop ? -20 : 20, scale: 0.8 }}
              className={cn(
                "flex items-center gap-3",
                isNearTop ? "flex-col" : "flex-col-reverse",
                isNearTop ? "mt-2" : "mb-2"
              )}
            >
              {/* Secondary Actions (Mini) */}
              <div className={cn(
                "flex items-center gap-2 p-2 bg-slate-900/60 rounded-3xl border border-white/5",
                isNearTop ? "flex-col" : "flex-col-reverse"
              )}>
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
                    <TooltipContent side="left" className="text-[10px] font-black uppercase tracking-widest">{btn.tooltip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>

              {/* Primary Actions (Large) */}
              <div className={cn(
                "flex items-center gap-3 p-2 bg-slate-900/80 rounded-[2.5rem] border border-white/10 shadow-2xl",
                isNearTop ? "flex-col" : "flex-col-reverse"
              )}>
                {primaryButtons.map((btn) => (
                  <Tooltip key={btn.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={btn.disabled}
                        onClick={() => { btn.onClick(); if (btn.id === 'search' || btn.id === 'reader') handleToggleMenu(); }}
                        className={cn(
                          "h-14 w-14 rounded-full border-2 transition-all active:scale-90 disabled:opacity-10", 
                          btn.className
                        )}
                      >
                        {btn.icon}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-[10px] font-black uppercase tracking-widest">{btn.tooltip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  );
});

FloatingCommandDock.displayName = 'FloatingCommandDock';

export default FloatingCommandDock;
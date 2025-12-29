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
  // position.y is offset from initial bottom-8. Negative value means it moved UP.
  const isNearTop = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return position.y < -(window.innerHeight / 2);
  }, [position.y]);

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

  const handleDragEnd = (_: any, info: any) => {
    const newPos = { 
      x: position.x + info.offset.x, 
      y: position.y + info.offset.y 
    };
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

  const menuButtons = [
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
      id: 'reader',
      icon: <FileText className="w-5 h-5" />,
      onClick: () => onOpenReader(activeSongId || undefined),
      disabled: !hasReadableChart,
      tooltip: "Sheet Reader (R)",
      className: "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700",
    },
    {
      id: 'search',
      icon: <Search className="w-5 h-5" />,
      onClick: onOpenSearch,
      tooltip: "Global Discovery",
      className: "bg-slate-800 text-white border-white/10 hover:bg-indigo-600",
    },
    { 
      id: 'heatmap', 
      icon: <Sparkles className="w-5 h-5" />, 
      onClick: onToggleHeatmap,
      tooltip: "Heatmap (H)", 
      className: cn(showHeatmap ? "bg-amber-500 text-black border-amber-400" : "bg-slate-800 text-amber-400 border-white/10") 
    },
    { 
      id: 'safe-pitch', 
      icon: <ShieldAlert className="w-5 h-5" />, 
      onClick: () => setIsSafePitchActive(!isSafePitchActive), 
      tooltip: "Safe Pitch Mode", 
      className: cn(isSafePitchActive ? "bg-emerald-600 text-white border-emerald-400" : "bg-slate-800 text-emerald-400 border-white/10") 
    },
    { id: 'admin', icon: <ShieldCheck className="w-5 h-5" />, onClick: onOpenAdmin, tooltip: "Audit Matrix", className: "bg-slate-800 text-red-400 border-white/10 hover:bg-red-900/40" },
    { id: 'preferences', icon: <Settings className="w-5 h-5" />, onClick: onOpenPreferences, tooltip: "Preferences", className: "bg-slate-800 text-slate-300 border-white/10" },
    { id: 'user-guide', icon: <BookOpen className="w-5 h-5" />, onClick: onOpenUserGuide, tooltip: "User Guide", className: "bg-slate-800 text-blue-400 border-white/10" },
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
                "flex items-center gap-3 p-2 bg-slate-950/90 rounded-[2.5rem] border border-white/10 shadow-2xl backdrop-blur-xl",
                isNearTop ? "flex-col" : "flex-col-reverse"
              )}
            >
              {menuButtons.map((btn) => (
                <Tooltip key={btn.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={btn.disabled}
                      onClick={() => { btn.onClick(); if (btn.id === 'search' || btn.id === 'reader') handleToggleMenu(); }}
                      className={cn(
                        "h-12 w-12 rounded-full border transition-all active:scale-90 disabled:opacity-10", 
                        btn.className
                      )}
                    >
                      {btn.icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-[10px] font-black uppercase tracking-widest">{btn.tooltip}</TooltipContent>
                </Tooltip>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  );
});

FloatingCommandDock.displayName = 'FloatingCommandDock';

export default FloatingCommandDock;
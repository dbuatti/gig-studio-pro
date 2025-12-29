"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Search, Sparkles, ShieldCheck, X, Settings, Play, FileText, Pause, BookOpen, AlertTriangle, Volume2, ShieldAlert, Music, ListMusic, ChevronLeft, ChevronRight, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useSettings } from '@/hooks/use-settings';
import { transposeNote, compareNotes } from '@/utils/keyUtils';
import { showSuccess, showError } from '@/utils/toast';

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
  onSetUiVisible?: (visible: boolean) => void;
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
  onSetUiVisible,
  isMenuOpen: isMenuOpenProp,
}) => {
  // --- Persisted State ---
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('floating_dock_collapsed') === 'true';
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

  const [isCommandHubOpen, setIsCommandHubOpen] = useState(false);
  const [isSafePitchActive, setIsSafePitchActive] = useState(false);
  const { safePitchMaxNote } = useSettings();
  const dragControls = useDragControls();

  // Sync isMenuOpen for ReaderMode
  const internalIsMenuOpen = isReaderMode ? isMenuOpenProp : isCommandHubOpen;
  const setInternalIsMenuOpen = (val: boolean) => {
    if (isReaderMode) {
      onSetMenuOpen?.(val);
    } else {
      setIsCommandHubOpen(val);
    }
  };

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem('floating_dock_collapsed', isCollapsed.toString());
  }, [isCollapsed]);

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

  const toggleCollapse = () => {
    setIsCollapsed(prev => !prev);
    if (typeof window !== 'undefined' && window.navigator.vibrate) {
      window.navigator.vibrate(20);
    }
  };

  const primaryButtons = [
    {
      id: 'reader',
      icon: <FileText className="w-5 h-5" />,
      onClick: () => onOpenReader(activeSongId || undefined),
      disabled: !hasReadableChart,
      tooltip: "Open Reader",
      className: "bg-slate-800 text-slate-400 border-white/5",
    },
    {
      id: 'practice',
      icon: isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />,
      onClick: onOpenPractice,
      disabled: !hasPlayableSong,
      tooltip: isPlaying ? "Pause (Space)" : "Practice Mode (Space)",
      className: cn(
        "text-white",
        isPlaying ? "bg-red-600 shadow-lg shadow-red-600/20" : "bg-indigo-600 shadow-lg shadow-indigo-600/20"
      ),
    },
    {
      id: 'search',
      icon: <Search className="w-5 h-5" />,
      onClick: onOpenSearch,
      tooltip: "Global Search",
      className: "bg-slate-800 text-slate-400 border-white/5",
    },
  ];

  const secondaryButtons = [
    { id: 'user-guide', icon: <BookOpen className="w-4 h-4" />, onClick: onOpenUserGuide, tooltip: "User Guide", className: "bg-slate-900 text-slate-400" },
    { id: 'preferences', icon: <Settings className="w-4 h-4" />, onClick: onOpenPreferences, tooltip: "Preferences", className: "bg-slate-900 text-slate-400" },
    { id: 'admin', icon: <ShieldCheck className="w-4 h-4" />, onClick: onOpenAdmin, tooltip: "Audit Matrix", className: "bg-red-950/20 text-red-400 border-red-900/30" },
    { 
      id: 'heatmap', 
      icon: <Sparkles className="w-4 h-4" />, 
      onClick: onOpenAdmin, // Re-mapped to Audit per your recent requests or toggle heatmap
      tooltip: "Heatmap (H)", 
      className: cn(showHeatmap ? "bg-amber-500 text-black" : "bg-slate-900 text-slate-400") 
    },
    { 
      id: 'safe-pitch', 
      icon: <ShieldAlert className="w-4 h-4" />, 
      onClick: () => setIsSafePitchActive(!isSafePitchActive), 
      tooltip: "Safe Pitch", 
      className: cn(isSafePitchActive ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400") 
    },
  ];

  return (
    <TooltipProvider>
      <motion.div
        drag
        dragMomentum={false}
        dragControls={dragControls}
        dragListener={false} // Only drag by the handle
        onDragEnd={handleDragEnd}
        style={{ x: position.x, y: position.y }}
        className="fixed bottom-8 right-8 z-[300] flex flex-col items-center gap-3 touch-none"
      >
        {/* Secondary Hub Fan (Vertical) */}
        <AnimatePresence>
          {internalIsMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="flex flex-col gap-2 mb-1"
            >
              {secondaryButtons.map((btn) => (
                <Tooltip key={btn.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { btn.onClick(); setInternalIsMenuOpen(false); }}
                      className={cn("h-10 w-10 rounded-full border shadow-xl transition-all hover:scale-110", btn.className)}
                    >
                      {btn.icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-[10px] font-black uppercase">{btn.tooltip}</TooltipContent>
                </Tooltip>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Dock Container */}
        <div className="flex items-center bg-black/40 backdrop-blur-2xl p-1.5 rounded-full border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {/* Drag Handle & Collapse Toggle */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            className="h-12 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-600 hover:text-white transition-colors"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Hub Trigger Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setInternalIsMenuOpen(!internalIsMenuOpen)}
                className={cn(
                  "h-12 w-12 rounded-full transition-all duration-500",
                  internalIsMenuOpen ? "bg-slate-200 text-black rotate-90" : "text-slate-400 hover:text-white"
                )}
              >
                {internalIsMenuOpen ? <X className="w-5 h-5" /> : <LayoutDashboard className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] font-black uppercase">Command Hub</TooltipContent>
          </Tooltip>

          {/* Collapsible Section */}
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                animate={{ width: "auto", opacity: 1, marginLeft: 8 }}
                exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                className="flex items-center gap-2 overflow-hidden pr-2"
              >
                <div className="h-6 w-px bg-white/10 mx-1" />
                {primaryButtons.map((btn) => (
                  <Tooltip key={btn.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={btn.disabled}
                        onClick={btn.onClick}
                        className={cn("h-11 w-11 rounded-full border transition-all active:scale-90 disabled:opacity-20", btn.className)}
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

          {/* Expand/Collapse Arrow */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="h-10 w-6 rounded-full text-slate-600 hover:text-white hover:bg-white/5"
          >
            {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </motion.div>
    </TooltipProvider>
  );
});

FloatingCommandDock.displayName = 'FloatingCommandDock';

export default FloatingCommandDock;
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Search, Sparkles, ShieldCheck, X, Settings, Play, FileText, Pause, BookOpen, AlertTriangle, Volume2, ShieldAlert, Music, ListMusic } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from 'framer-motion';
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
  // New props for Safe Pitch Mode
  currentSongHighestNote?: string;
  currentSongPitch?: number;
  onSafePitchToggle?: (active: boolean, safePitch: number) => void;
  isReaderMode?: boolean; // New prop to indicate if in SheetReaderMode
  // New prop to pass active song ID
  activeSongId?: string | null;
  // NEW: Callback to set menu open state in SheetReaderMode
  onSetMenuOpen?: (open: boolean) => void;
  // NEW: Callback to set UI visible state in SheetReaderMode
  onSetUiVisible?: (visible: boolean) => void;
  // NEW: Current menu open state from SheetReaderMode
  isMenuOpen?: boolean;
}

/**
 * FloatingCommandDock: A global performance and management interface.
 * Optimized for high-density data views and mobile reachability.
 */
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
  isMenuOpen,
}) => {
  const [isCommandHubOpen, setIsCommandHubOpen] = useState(false);
  const [isSafePitchActive, setIsSafePitchActive] = useState(false);
  const { safePitchMaxNote } = useSettings();

  // Calculate safe pitch limit
  const safePitchLimit = useMemo(() => {
    if (!currentSongHighestNote || !safePitchMaxNote) return null;
    const semitones = compareNotes(safePitchMaxNote, currentSongHighestNote);
    return semitones;
  }, [currentSongHighestNote, safePitchMaxNote]);

  // Effect to handle Safe Pitch Mode logic
  useEffect(() => {
    if (isSafePitchActive && safePitchLimit !== null) {
      const currentPitch = currentSongPitch || 0;
      if (currentPitch > safePitchLimit) {
        onSafePitchToggle?.(false, 0);
        setIsSafePitchActive(false);
        showError("Current pitch exceeds safe limit. Resetting.");
        return;
      }
      onSafePitchToggle?.(true, safePitchLimit);
      showSuccess(`Safe Pitch Mode Active: Max shift ${safePitchLimit} semitones`);
    } else if (!isSafePitchActive) {
      onSafePitchToggle?.(false, 0);
    }
  }, [isSafePitchActive, safePitchLimit, currentSongPitch, onSafePitchToggle]);

  const toggleCommandHub = () => {
    setIsCommandHubOpen(prev => !prev);
    if (typeof window !== 'undefined' && window.navigator.vibrate) {
      window.navigator.vibrate(40);
    }
  };

  const toggleSafePitch = () => {
    if (safePitchLimit === null) {
      showError("Please set a Safe Pitch Max Note in Preferences.");
      return;
    }
    setIsSafePitchActive(prev => !prev);
  };

  const primaryButtons = [
    {
      id: 'reader',
      icon: <FileText className="w-6 h-6" />,
      label: "Reader Mode",
      onClick: () => onOpenReader(activeSongId || undefined),
      disabled: !hasReadableChart,
      className: cn(
        "bg-slate-900/80 backdrop-blur-md text-slate-400 border border-white/10 hover:text-white",
        viewMode === 'setlist' && "scale-110 border-indigo-500/50"
      ),
      tooltip: "Open Reader (R)",
    },
    {
      id: 'practice',
      icon: isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />,
      label: "Practice Mode",
      onClick: onOpenPractice,
      disabled: !hasPlayableSong,
      className: cn(
        "text-white transition-all duration-300",
        isPlaying 
          ? "bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]" 
          : "bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.4)]",
        viewMode === 'setlist' && "scale-125 mx-2"
      ),
      tooltip: isPlaying ? "Pause (Space)" : "Practice Mode (Space)",
    },
    {
      id: 'search',
      icon: <Search className="w-6 h-6" />,
      label: "Global Search",
      onClick: onOpenSearch,
      className: "bg-slate-900/80 backdrop-blur-md text-slate-400 border border-white/10 hover:text-white",
      tooltip: "Global Search (K)",
    },
  ];

  const secondaryButtons = [
    {
      id: 'user-guide',
      icon: <BookOpen className="w-5 h-5" />,
      onClick: onOpenUserGuide,
      className: "bg-slate-800 text-slate-400",
      tooltip: "User Guide",
    },
    {
      id: 'preferences',
      icon: <Settings className="w-5 h-5" />,
      onClick: onOpenPreferences,
      className: "bg-slate-800 text-slate-400",
      tooltip: "Preferences",
    },
    {
      id: 'admin',
      icon: <ShieldCheck className="w-5 h-5" />,
      onClick: onOpenAdmin,
      className: "bg-red-950/30 text-red-400 border-red-900/50",
      tooltip: "Resource Audit",
    },
    {
      id: 'heatmap',
      icon: <Sparkles className="w-5 h-5" />,
      onClick: onToggleHeatmap,
      className: cn(
        "transition-colors",
        showHeatmap 
          ? "bg-amber-500 text-black" 
          : "bg-slate-800 text-slate-400"
      ),
      tooltip: "Heatmap Overlay (H)",
    },
    {
      id: 'safe-pitch',
      icon: isSafePitchActive ? <ShieldAlert className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />,
      onClick: toggleSafePitch,
      className: cn(
        "transition-colors",
        isSafePitchActive 
          ? "bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]" 
          : "bg-slate-800 text-slate-400"
      ),
      tooltip: isSafePitchActive ? "Safe Pitch Mode: ON" : "Safe Pitch Mode: OFF",
    },
  ];

  // Render a minimized version if in reader mode
  if (isReaderMode) {
    return (
      <TooltipProvider>
        <div className="fixed bottom-8 right-8 z-[250]">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              onSetUiVisible?.(true); // Ensure UI is visible
              onSetMenuOpen?.(!isMenuOpen); // Toggle the menu (isOverlayOpen in SheetReaderMode)
            }}
            className={cn(
              "h-14 w-14 rounded-full transition-all duration-500 bg-black/40 backdrop-blur-xl border border-white/5 shadow-2xl",
              isMenuOpen 
                ? "text-white rotate-90" 
                : "text-slate-400 hover:text-white" // Use isMenuOpen prop here
            )}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <ListMusic className="w-6 h-6" />} {/* Use isMenuOpen prop here to control visibility of secondary buttons */}
          </Button>
          
          <AnimatePresence>
            {isMenuOpen && ( // Use isMenuOpen prop here to control visibility of secondary buttons
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="absolute bottom-16 right-0 flex flex-col gap-3 mb-2"
              >
                {secondaryButtons.map((btn) => (
                  <Tooltip key={btn.id}>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          btn.onClick();
                          onSetMenuOpen?.(false); // Close the menu after clicking a secondary button
                          onSetUiVisible?.(true); // Ensure UI is visible on secondary button click
                        }}
                        className={cn("h-12 w-12 rounded-full border shadow-xl", btn.className)}
                      >
                        {btn.icon}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-[10px] font-black uppercase tracking-widest">
                      {btn.tooltip}
                    </TooltipContent>
                  </Tooltip>
                ))}
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        onTogglePlayback();
                        onSetUiVisible?.(true); // Ensure UI is visible on play/pause
                      }}
                      disabled={!hasPlayableSong}
                      className={cn(
                        "h-12 w-12 rounded-full border shadow-xl transition-all duration-300",
                        isPlaying 
                          ? "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]" 
                          : "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]",
                        !hasPlayableSong && "opacity-20 cursor-not-allowed"
                      )}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-[10px] font-black uppercase tracking-widest">
                    {isPlaying ? "Pause (Space)" : "Play (Space)"}
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="fixed bottom-8 right-8 z-[250] flex flex-col items-center gap-4">
        {/* Secondary Radial Hub (Vertical Fan) */}
        <AnimatePresence>
          {isCommandHubOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              className="flex flex-col gap-3 mb-2"
            >
              {secondaryButtons.map((btn) => (
                <Tooltip key={btn.id}>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        btn.onClick();
                        setIsCommandHubOpen(false);
                      }}
                      className={cn("h-12 w-12 rounded-full border shadow-xl", btn.className)}
                    >
                      {btn.icon}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-[10px] font-black uppercase tracking-widest">
                    {btn.tooltip}
                  </TooltipContent>
                </Tooltip>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Horizontal Primary Dock */}
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl p-2 rounded-full border border-white/5 shadow-2xl">
          {/* Hub Trigger */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleCommandHub}
            className={cn(
              "h-14 w-14 rounded-full transition-all duration-500",
              isCommandHubOpen 
                ? "bg-slate-200 text-black rotate-90" 
                : "bg-white/5 text-slate-400 hover:text-white"
            )}
          >
            {isCommandHubOpen ? <X className="w-6 h-6" /> : <LayoutDashboard className="w-6 h-6" />}
          </Button>
          
          <div className="h-8 w-px bg-white/10 mx-1" />
          
          {/* Core Performance Tools */}
          {primaryButtons.map((btn) => (
            <Tooltip key={btn.id}>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  disabled={btn.disabled}
                  onClick={btn.onClick}
                  className={cn("h-14 w-14 rounded-full transition-all active:scale-90 disabled:opacity-20", btn.className)}
                >
                  {btn.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] font-black uppercase tracking-widest">
                {btn.tooltip}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
});

FloatingCommandDock.displayName = 'FloatingCommandDock';

export default FloatingCommandDock;
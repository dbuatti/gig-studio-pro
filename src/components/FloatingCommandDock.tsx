"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Search, Waves, ShieldCheck, X, Sparkles, ListMusic, Settings, 
  Play, FileText, Guitar, Pause, Keyboard, BookOpen // Import BookOpen icon
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingCommandDockProps {
  onOpenSearch: () => void;
  onOpenPractice: () => void;
  onOpenReader: () => void;
  onOpenAdmin: () => void;
  onOpenPreferences: () => void;
  onToggleHeatmap: () => void;
  onOpenUserGuide: () => void; // New prop for User Guide
  showHeatmap: boolean;
  viewMode: 'repertoire' | 'setlist';
  hasPlayableSong: boolean;
  hasReadableChart: boolean;
  onTogglePlayback: () => void;
  isPlaying: boolean;
}

const FloatingCommandDock: React.FC<FloatingCommandDockProps> = React.memo(({
  onOpenSearch,
  onOpenPractice,
  onOpenReader,
  onOpenAdmin,
  onOpenPreferences,
  onToggleHeatmap,
  onOpenUserGuide, // Destructure new prop
  showHeatmap,
  viewMode,
  hasPlayableSong,
  hasReadableChart,
  onTogglePlayback,
  isPlaying,
}) => {
  const [isCommandHubOpen, setIsCommandHubOpen] = useState(false);

  const toggleCommandHub = () => {
    setIsCommandHubOpen(prev => !prev);
    // Optional: Trigger haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const primaryButtons = [
    {
      id: 'search',
      icon: <Search className="w-6 h-6" />,
      label: "Open Song Search",
      onClick: onOpenSearch,
      className: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30",
      tooltip: "Open Song Search",
    },
    {
      id: 'practice',
      icon: isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />,
      label: "Start Practice Mode",
      onClick: onOpenPractice,
      className: cn(
        "text-white shadow-indigo-600/30",
        isPlaying ? "bg-red-600 hover:bg-red-700 shadow-red-600/30" : "bg-indigo-600 hover:bg-indigo-700",
        viewMode === 'setlist' && "scale-105" // Scale up in Gig Mode
      ),
      disabled: !hasPlayableSong,
      tooltip: isPlaying ? "Pause Playback (Space)" : "Start Practice Mode (Space)",
    },
    {
      id: 'reader',
      icon: <FileText className="w-6 h-6" />,
      label: "Open Sheet Reader",
      onClick: onOpenReader,
      className: cn(
        "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10",
        viewMode === 'setlist' && "scale-105" // Scale up in Gig Mode
      ),
      disabled: !hasReadableChart,
      tooltip: "Open Sheet Reader (R)",
    },
  ];

  const secondaryButtons = [
    {
      id: 'heatmap',
      icon: <Sparkles className="w-6 h-6" />,
      label: showHeatmap ? "Hide Repertoire Heatmap" : "Show Repertoire Heatmap",
      onClick: onToggleHeatmap,
      className: cn(
        "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10",
        showHeatmap && viewMode === 'repertoire' && "bg-red-600 hover:bg-red-700 text-white shadow-red-600/30" // Highlight in Repertoire Mode
      ),
      tooltip: showHeatmap ? "Hide Repertoire Heatmap (H)" : "Show Repertoire Heatmap (H)",
    },
    {
      id: 'admin',
      icon: <ShieldCheck className="w-6 h-6" />,
      label: "Open Admin Panel",
      onClick: onOpenAdmin,
      className: "bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/20",
      tooltip: "Open Admin Panel",
    },
    {
      id: 'preferences',
      icon: <Settings className="w-6 h-6" />,
      label: "Open Preferences",
      onClick: onOpenPreferences,
      className: "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10",
      tooltip: "Open Preferences",
    },
    {
      id: 'user-guide', // New button for User Guide
      icon: <BookOpen className="w-6 h-6" />,
      label: "Open User Guide",
      onClick: onOpenUserGuide,
      className: "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10",
      tooltip: "Open User Guide",
    },
  ];

  // Animation variants for radial expansion
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, x: 0, scale: 0.5 },
    visible: (i: number) => ({
      opacity: 1,
      y: -70 * (i + 1), // Stack vertically above the hub
      x: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 15,
      } as const,
    }),
  };

  return (
    <TooltipProvider>
      <div className="fixed bottom-8 right-8 z-[200] flex flex-col items-end gap-3 animate-in fade-in slide-in-from-right-8 duration-500">
        {/* Secondary Tier (Command Hub items) */}
        <AnimatePresence>
          {isCommandHubOpen && (
            <motion.div
              className="flex flex-col items-end gap-3"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              {secondaryButtons.map((button, i) => (
                <motion.div key={button.id} variants={itemVariants} custom={i}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={button.onClick}
                        className={cn(
                          "h-14 w-14 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95",
                          button.className
                        )}
                        aria-label={button.label}
                      >
                        {button.icon}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px] font-black uppercase">
                      {button.tooltip}
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Command Hub Button (Central "G" button) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCommandHub}
              className={cn(
                "h-16 w-16 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 relative z-10",
                isCommandHubOpen && "rotate-45 bg-red-600 hover:bg-red-700 shadow-red-600/30"
              )}
              aria-label="Toggle Command Hub"
            >
              {isCommandHubOpen ? <X className="w-8 h-8" /> : <LayoutDashboard className="w-8 h-8" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] font-black uppercase">
            {isCommandHubOpen ? "Close Command Hub" : "Open Command Hub"}
          </TooltipContent>
        </Tooltip>

        {/* Primary Tier Buttons (Always visible) */}
        {primaryButtons.map((button) => (
          <Tooltip key={button.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={button.onClick}
                disabled={button.disabled}
                className={cn(
                  "h-14 w-14 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 relative z-10",
                  button.className
                )}
                aria-label={button.label}
              >
                {button.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-black uppercase">
              {button.tooltip}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
});

FloatingCommandDock.displayName = 'FloatingCommandDock';

export default FloatingCommandDock;
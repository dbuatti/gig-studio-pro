"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Search, Sparkles, ShieldCheck, X, 
  Settings, Play, FileText, Pause, BookOpen 
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
  onOpenUserGuide: () => void;
  showHeatmap: boolean;
  viewMode: 'repertoire' | 'setlist';
  hasPlayableSong: boolean;
  hasReadableChart: boolean;
  isPlaying: boolean;
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
}) => {
  const [isCommandHubOpen, setIsCommandHubOpen] = useState(false);

  const toggleCommandHub = () => {
    setIsCommandHubOpen(prev => !prev);
    if (typeof window !== 'undefined' && window.navigator.vibrate) {
      window.navigator.vibrate(40); // Haptic feedback for iPhone users
    }
  };

  const primaryButtons = [
    {
      id: 'reader',
      icon: <FileText className="w-6 h-6" />,
      label: "Reader Mode",
      onClick: onOpenReader,
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
        showHeatmap ? "bg-amber-500 text-black" : "bg-slate-800 text-slate-400"
      ),
      tooltip: "Heatmap Overlay (H)",
    },
  ];

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
                      onClick={() => { btn.onClick(); setIsCommandHubOpen(false); }}
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
              isCommandHubOpen ? "bg-slate-200 text-black rotate-90" : "bg-white/5 text-slate-400 hover:text-white"
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
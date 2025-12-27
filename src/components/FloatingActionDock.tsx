"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Search, Waves, ShieldCheck, X, Sparkles, ListMusic, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface FloatingActionDockProps {
  onOpenSearch: () => void;
  onOpenAdmin: () => void;
  onOpenPreferences: () => void;
  onToggleHeatmap: () => void;
  showHeatmap: boolean;
  viewMode: 'repertoire' | 'setlist';
}

const FloatingActionDock: React.FC<FloatingActionDockProps> = React.memo(({
  onOpenSearch,
  onOpenAdmin,
  onOpenPreferences,
  onToggleHeatmap,
  showHeatmap,
  viewMode,
}) => {
  return (
    <TooltipProvider>
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3 animate-in fade-in slide-in-from-right-8 duration-500">
        {viewMode === 'repertoire' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleHeatmap}
                className={cn(
                  "h-14 w-14 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95",
                  showHeatmap
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-red-600/30"
                    : "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10"
                )}
                aria-label="Toggle Repertoire Heatmap"
              >
                <Sparkles className="w-6 h-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-black uppercase">
              {showHeatmap ? "Hide Repertoire Heatmap" : "Show Repertoire Heatmap"}
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSearch}
              className="h-14 w-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
              aria-label="Open Song Search"
            >
              <Search className="w-6 h-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] font-black uppercase">
            Open Song Search
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenPreferences}
              className="h-14 w-14 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 shadow-xl transition-all hover:scale-105 active:scale-95"
              aria-label="Open Preferences"
            >
              <Settings className="w-6 h-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] font-black uppercase">
            Open Preferences
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenAdmin}
              className="h-14 w-14 rounded-full bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/20 shadow-xl transition-all hover:scale-105 active:scale-95"
              aria-label="Open Admin Panel"
            >
              <ShieldCheck className="w-6 h-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] font-black uppercase">
            Open Admin Panel
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});

FloatingActionDock.displayName = 'FloatingActionDock';

export default FloatingActionDock;
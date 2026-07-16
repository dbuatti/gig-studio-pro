"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface StudioTabNavProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TAB_LABELS: Record<string, string> = {
  config: "Config",
  audio: "Audio",
  details: "Details",
  charts: "Charts",
  lyrics: "Lyrics",
  visual: "Visual",
  library: "Library",
};

const StudioTabNav: React.FC<StudioTabNavProps> = ({ tabs, activeTab, onTabChange }) => {
  const isMobile = useIsMobile();

  return (
    <nav role="tablist" aria-label="Studio tabs" className="h-11 md:h-12 bg-black/40 border-b border-white/5 flex items-center px-3 md:px-6 overflow-x-auto no-scrollbar shrink-0">
      <div className={cn(
        "flex w-full max-w-full mx-auto",
        isMobile ? "gap-1" : "justify-between"
      )}>
        {tabs.map((tab, i) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`studio-panel-${tab}`}
            onClick={() => onTabChange(tab)}
            className={cn(
              "text-[8px] md:text-[10px] font-bold uppercase tracking-[0.15em] h-11 md:h-12 flex flex-col items-center justify-center border-b-2 transition-all shrink-0 relative group",
              isMobile ? "px-2" : "px-4",
              activeTab === tab
                ? "text-indigo-400 border-indigo-500"
                : "text-slate-500 border-transparent hover:text-slate-300"
            )}
          >
            <span className="relative z-10">{TAB_LABELS[tab] || tab}</span>
            {!isMobile && (
              <span className={cn(
                "text-[7px] font-mono mt-0.5 transition-opacity",
                activeTab === tab ? "opacity-40" : "opacity-0 group-hover:opacity-20"
              )}>
                ⌘{i + 1}
              </span>
            )}
            {activeTab === tab && (
              <div className="absolute inset-0 bg-indigo-500/5 blur-xl pointer-events-none" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default StudioTabNav;
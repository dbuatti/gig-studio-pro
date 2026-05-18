"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface StudioTabNavProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: any) => void;
}

const StudioTabNav: React.FC<StudioTabNavProps> = ({ tabs, activeTab, onTabChange }) => {
  const isMobile = useIsMobile();

  return (
    <nav className="h-14 md:h-16 bg-black/40 border-b border-white/5 flex items-center px-4 md:px-8 overflow-x-auto no-scrollbar shrink-0">
      <div className={cn(
        "flex w-full max-w-7xl mx-auto",
        isMobile ? "gap-2" : "justify-between"
      )}>
        {tabs.map((tab, i) => (
          <button 
            key={tab} 
            onClick={() => onTabChange(tab)} 
            className={cn(
              "text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] h-14 md:h-16 flex flex-col items-center justify-center border-b-2 transition-all shrink-0 relative group", 
              isMobile ? "px-4" : "px-6",
              activeTab === tab 
                ? "text-indigo-400 border-indigo-500" 
                : "text-slate-500 border-transparent hover:text-slate-300"
            )}
          >
            <span className="relative z-10">{tab}</span>
            {!isMobile && (
              <span className={cn(
                "text-[8px] font-mono mt-1 transition-opacity",
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
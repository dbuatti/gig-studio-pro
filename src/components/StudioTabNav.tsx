"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface StudioTabNavProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: any) => void;
}

const StudioTabNav: React.FC<StudioTabNavProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <nav className="h-16 bg-black/20 border-b border-white/5 flex items-center px-6 overflow-x-auto no-scrollbar shrink-0">
      <div className="grid grid-cols-7 w-full">
        {tabs.map((tab, i) => (
          <button 
            key={tab} 
            onClick={() => onTabChange(tab)} 
            className={cn(
              "text-[10px] font-black uppercase tracking-widest h-16 flex flex-col items-center justify-center border-b-4 transition-colors", 
              activeTab === tab ? "text-indigo-400 border-indigo-50" : "text-slate-500 border-transparent hover:text-white"
            )}
          >
            <span>{tab.toUpperCase()}</span>
            <span className="text-[8px] opacity-40 mt-0.5">⌘{i + 1}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default StudioTabNav;
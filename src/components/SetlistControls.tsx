"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  LayoutList, SortAsc, Sparkles, Star, TrendingUp, Zap, Filter, Search, Loader2, X 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface SetlistControlsProps {
  sortMode: string;
  setSortMode: (mode: string) => void;
  onOpenSortModal: () => void;
  isFilterOpen: boolean;
  setIsFilterOpen: (open: boolean) => void;
  handleVibeCheck: () => void;
  isVibeChecking: boolean;
  vibeCheckProgress: number;
  vibeCheckCount: number;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const SetlistControls: React.FC<SetlistControlsProps> = ({
  sortMode,
  setSortMode,
  onOpenSortModal,
  isFilterOpen,
  setIsFilterOpen,
  handleVibeCheck,
  isVibeChecking,
  vibeCheckProgress,
  vibeCheckCount,
  searchTerm,
  setSearchTerm
}) => {
  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 px-1">
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        <div className="flex items-center gap-1 bg-slate-900/50 p-1.5 rounded-[1.5rem] border border-white/5 w-full sm:w-auto overflow-x-auto no-scrollbar shadow-xl">
          <Button 
            variant="ghost" size="sm" 
            onClick={() => setSortMode('none')}
            className={cn(
              "h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2.5 shrink-0 rounded-xl transition-all",
              sortMode === 'none' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-500 hover:text-white"
            )}
          >
            <LayoutList className="w-4 h-4" /> <span className="hidden xs:inline">List</span>
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setSortMode('manual')}
            className={cn(
              "h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2.5 shrink-0 rounded-xl transition-all",
              sortMode === 'manual' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-500 hover:text-white"
            )}
          >
            <SortAsc className="w-4 h-4" /> <span className="hidden xs:inline">Manual</span>
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={onOpenSortModal}
            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2.5 shrink-0 rounded-xl text-indigo-400 hover:bg-indigo-600/10 transition-all"
          >
            <Sparkles className="w-4 h-4" /> <span className="hidden xs:inline">AI Sort</span>
          </Button>
          <div className="w-px h-5 bg-white/10 mx-1.5 hidden sm:block" />
          <Button 
            variant="ghost" size="sm" 
            onClick={() => setSortMode(sortMode === 'ready' ? 'work' : 'ready')}
            className={cn(
              "h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2.5 shrink-0 rounded-xl transition-all",
              (sortMode === 'ready' || sortMode === 'work') ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-slate-500 hover:text-white"
            )}
          >
            {sortMode === 'work' ? <TrendingUp className="w-4 h-4" /> : <Star className="w-4 h-4" />}
            <span className="hidden xs:inline">{sortMode === 'work' ? 'Work' : 'Ready'}</span>
          </Button>
          <Button 
            variant="ghost" size="sm" 
            onClick={() => setSortMode('energy-asc')}
            className={cn(
              "h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2.5 shrink-0 rounded-xl transition-all",
              sortMode === 'energy-asc' ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "text-slate-500 hover:text-white"
            )}
          >
            <Zap className="w-4 h-4" /> <span className="hidden xs:inline">Energy</span>
          </Button>
        </div>
        <Button 
          variant="ghost" size="sm" 
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={cn(
            "h-12 px-6 text-[10px] font-black uppercase tracking-widest rounded-2xl gap-3 transition-all border shadow-xl",
            isFilterOpen ? "bg-indigo-600 text-white border-indigo-400 shadow-indigo-600/30" : "bg-slate-900/50 text-slate-500 border-white/5 hover:text-white hover:bg-slate-800"
          )}
        >
          <Filter className="w-4.5 h-4.5" /> Matrix
        </Button>
      </div>

      <div className="flex items-center gap-4 w-full lg:w-auto">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={handleVibeCheck}
                disabled={isVibeChecking || vibeCheckCount === 0}
                className={cn(
                  "h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-3 shadow-2xl transition-all active:scale-95",
                  isVibeChecking ? "bg-purple-600/50 text-white cursor-wait" : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30"
                )}
              >
                {isVibeChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {vibeCheckProgress}%
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span className="hidden xs:inline">Vibe Check</span> ({vibeCheckCount})
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-950 text-white border-white/10 text-[10px] font-black uppercase">
              AI Energy Analysis
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="relative flex-1 sm:w-80 group">
          <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          <Input 
            placeholder="Search Gig..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-12 pl-12 pr-10 text-[11px] font-bold bg-slate-900/50 border-white/5 rounded-2xl focus-visible:ring-indigo-500/50 focus-visible:bg-slate-900 transition-all shadow-inner"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetlistControls;
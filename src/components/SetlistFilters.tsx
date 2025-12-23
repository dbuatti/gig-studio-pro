"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Filter, Music, Youtube, FileText, CheckCircle2, 
  X, Star, Save, Trash2, Headphones, Sparkles, Hash,
  CircleDashed, ChevronDown, ListFilter, Music2, 
  VideoOff, FileX2, VolumeX, BarChart3, TrendingUp, TrendingDown,
  Target, AlertCircle, Link as LinkIcon, FileSearch, ShieldCheck,
  BrainCircuit
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface FilterState {
  hasAudio: 'all' | 'full' | 'itunes' | 'none';
  hasVideo: 'all' | 'yes' | 'no';
  hasChart: 'all' | 'yes' | 'no';
  hasPdf: 'all' | 'yes' | 'no';
  hasUg: 'all' | 'yes' | 'no';
  isConfirmed: 'all' | 'yes' | 'no';
  minComfort: number;
  readiness: number; 
}

const DEFAULT_FILTERS: FilterState = {
  hasAudio: 'all',
  hasVideo: 'all',
  hasChart: 'all',
  hasPdf: 'all',
  hasUg: 'all',
  isConfirmed: 'all',
  minComfort: 0,
  readiness: 100 
};

interface SetlistFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  activeFilters: FilterState;
}

interface SavedPreset {
  id: string;
  name: string;
  filters: FilterState;
}

const SetlistFilters: React.FC<SetlistFiltersProps> = ({ onFilterChange, activeFilters }) => {
  const [presets, setPresets] = useState<SavedPreset[]>(() => {
    const saved = localStorage.getItem('gig_filter_presets');
    return saved ? JSON.parse(saved) : [
      { id: 'broken', name: 'Needs Attention', filters: { ...DEFAULT_FILTERS, readiness: 40 } },
      { id: 'learned', name: 'Learned Only', filters: { ...DEFAULT_FILTERS, minComfort: 7 } },
      { id: 'stage-ready', name: 'Performance Ready', filters: { ...DEFAULT_FILTERS, readiness: 100, hasAudio: 'full', hasChart: 'yes', isConfirmed: 'yes', minComfort: 8 } }
    ];
  });

  const savePreset = () => {
    const name = prompt("Enter preset name:");
    if (!name) return;
    const newPreset = { id: Date.now().toString(), name, filters: { ...activeFilters } };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('gig_filter_presets', JSON.stringify(updated));
  };

  const deletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('gig_filter_presets', JSON.stringify(updated));
  };

  const isDefault = JSON.stringify(activeFilters) === JSON.stringify(DEFAULT_FILTERS);

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm">
                <Star className="w-3.5 h-3.5 fill-indigo-600" /> <span className="hidden sm:inline">Views</span> <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-2 rounded-2xl bg-slate-950 border-white/10 text-white">
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">Quick Toggles</DropdownMenuLabel>
              {presets.map(p => (
                <DropdownMenuItem 
                  key={p.id} 
                  onClick={() => onFilterChange(p.filters)}
                  className="flex items-center justify-between rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10"
                >
                  <span className="text-xs font-bold uppercase">{p.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={savePreset} className="text-indigo-400 font-black uppercase text-[9px] tracking-widest h-10 px-3 cursor-pointer hover:bg-white/10 gap-2">
                <Save className="w-3.5 h-3.5" /> Save View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block" />

          {/* Comfort Threshold Filter */}
          <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-4 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 flex-1 min-w-[300px]">
            <div className="flex items-center gap-2 shrink-0">
               <BrainCircuit className="w-3.5 h-3.5 text-indigo-500" />
               <span className="text-[10px] font-black uppercase text-slate-400 whitespace-nowrap">Comfort: <span className="text-indigo-600 font-mono">≥{activeFilters.minComfort}/10</span></span>
            </div>
            <Slider 
              value={[activeFilters.minComfort]} 
              max={10} 
              step={1} 
              onValueChange={([v]) => onFilterChange({ ...activeFilters, minComfort: v })}
              className="flex-1"
            />
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden lg:block" />

          {/* Readiness Slider */}
          <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-4 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 shrink-0">
               <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
               <span className="text-[10px] font-black uppercase text-slate-400 whitespace-nowrap">Score: <span className="text-indigo-600 font-mono">≤{activeFilters.readiness}%</span></span>
            </div>
            <Slider 
              value={[activeFilters.readiness]} 
              max={100} 
              step={5} 
              onValueChange={([v]) => onFilterChange({ ...activeFilters, readiness: v })}
              className="flex-1"
            />
          </div>

          {!isDefault && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onFilterChange(DEFAULT_FILTERS)}
              className="h-8 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 gap-2"
            >
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SetlistFilters;
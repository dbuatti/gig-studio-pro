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
  Target, AlertCircle
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
import { cn } from "@/lib/utils";

export interface FilterState {
  hasAudio: 'all' | 'full' | 'itunes' | 'none';
  hasVideo: 'all' | 'yes' | 'no';
  hasChart: 'all' | 'yes' | 'no';
  isConfirmed: 'all' | 'yes' | 'no';
  readiness: number; // 0 to 100
}

const DEFAULT_FILTERS: FilterState = {
  hasAudio: 'all',
  hasVideo: 'all',
  hasChart: 'all',
  isConfirmed: 'all',
  readiness: 100 // Default to 100 so all songs (0-100) are shown
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
      { id: 'stage-ready', name: 'Performance Ready', filters: { ...DEFAULT_FILTERS, readiness: 100, hasAudio: 'full', hasChart: 'yes' } }
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
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-3">
        {/* Presets Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm">
              <Star className="w-3.5 h-3.5 fill-indigo-600" /> Views <ChevronDown className="w-3 h-3 opacity-50" />
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
                <button onClick={(e) => deletePreset(p.id, e)} className="p-1 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem onClick={savePreset} className="text-indigo-400 font-black uppercase text-[9px] tracking-widest h-10 px-3 cursor-pointer hover:bg-white/10 gap-2">
              <Save className="w-3.5 h-3.5" /> Save Current View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

        {/* Readiness Slider (Max threshold) */}
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-4 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 flex-1 min-w-[220px] max-w-sm">
          <div className="flex items-center gap-2 shrink-0">
             <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
             <span className="text-[10px] font-black uppercase text-slate-400 whitespace-nowrap">Show Under: <span className="text-indigo-600 font-mono">{activeFilters.readiness}%</span></span>
          </div>
          <Slider 
            value={[activeFilters.readiness]} 
            max={100} 
            step={5} 
            onValueChange={([v]) => onFilterChange({ ...activeFilters, readiness: v })}
            className="flex-1"
          />
        </div>

        {/* Audio Consolidated Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-tight gap-2 border transition-all",
                activeFilters.hasAudio !== 'all' ? "bg-indigo-600 text-white shadow-lg" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500"
              )}
            >
              <Music className="w-3.5 h-3.5" /> Audio <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48 p-2 rounded-2xl bg-slate-950 border-white/10 text-white">
            <DropdownMenuRadioGroup value={activeFilters.hasAudio} onValueChange={(v) => onFilterChange({ ...activeFilters, hasAudio: v as any })}>
              <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-10 rounded-xl">All Songs</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="full" className="text-xs font-bold uppercase h-10 rounded-xl text-emerald-400">Master Audio Only</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="itunes" className="text-xs font-bold uppercase h-10 rounded-xl text-indigo-400">iTunes Previews</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="none" className="text-xs font-bold uppercase h-10 rounded-xl text-red-400">Missing Audio</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Video Consolidated Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-tight gap-2 border transition-all",
                activeFilters.hasVideo !== 'all' ? "bg-red-600 text-white shadow-lg" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500"
              )}
            >
              <Youtube className="w-3.5 h-3.5" /> Video <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48 p-2 rounded-2xl bg-slate-950 border-white/10 text-white">
            <DropdownMenuRadioGroup value={activeFilters.hasVideo} onValueChange={(v) => onFilterChange({ ...activeFilters, hasVideo: v as any })}>
              <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-10 rounded-xl">All Songs</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="yes" className="text-xs font-bold uppercase h-10 rounded-xl text-emerald-400">Has Video</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="no" className="text-xs font-bold uppercase h-10 rounded-xl text-red-400">No Video</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Chart Consolidated Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-tight gap-2 border transition-all",
                activeFilters.hasChart !== 'all' ? "bg-emerald-600 text-white shadow-lg" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500"
              )}
            >
              <FileText className="w-3.5 h-3.5" /> Charts <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48 p-2 rounded-2xl bg-slate-950 border-white/10 text-white">
            <DropdownMenuRadioGroup value={activeFilters.hasChart} onValueChange={(v) => onFilterChange({ ...activeFilters, hasChart: v as any })}>
              <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-10 rounded-xl">All Songs</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="yes" className="text-xs font-bold uppercase h-10 rounded-xl text-emerald-400">Has Chart</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="no" className="text-xs font-bold uppercase h-10 rounded-xl text-red-400">No Chart</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {!isDefault && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onFilterChange(DEFAULT_FILTERS)}
            className="h-8 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 gap-2"
          >
            <X className="w-3 h-3" /> Clear All
          </Button>
        )}
      </div>

      {/* Active Filter Badges */}
      {!isDefault && (
        <div className="flex flex-wrap gap-2 px-1">
          <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 mr-2">
            <ListFilter className="w-3 h-3" /> Active Criteria:
          </span>
          {activeFilters.readiness < 100 && (
            <Badge 
              variant="secondary" 
              className="bg-orange-50 text-orange-600 border-orange-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-red-50 hover:text-red-600 transition-all group"
              onClick={() => onFilterChange({ ...activeFilters, readiness: 100 })}
            >
              Readiness: ≤{activeFilters.readiness}% <X className="w-2 h-2 ml-1.5 opacity-40 group-hover:opacity-100" />
            </Badge>
          )}
          {activeFilters.hasAudio !== 'all' && (
            <Badge 
              variant="secondary" 
              className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-red-50 hover:text-red-600 transition-all group"
              onClick={() => onFilterChange({ ...activeFilters, hasAudio: 'all' })}
            >
              Audio: {activeFilters.hasAudio} <X className="w-2.5 h-2.5 ml-1 opacity-40 group-hover:opacity-100" />
            </Badge>
          )}
          {activeFilters.hasVideo !== 'all' && (
            <Badge 
              variant="secondary" 
              className="bg-red-50 text-red-600 border-red-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-red-50 hover:text-red-600 transition-all group"
              onClick={() => onFilterChange({ ...activeFilters, hasVideo: 'all' })}
            >
              Video: {activeFilters.hasVideo} <X className="w-2.5 h-2.5 ml-1 opacity-40 group-hover:opacity-100" />
            </Badge>
          )}
          {activeFilters.hasChart !== 'all' && (
            <Badge 
              variant="secondary" 
              className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-red-50 hover:text-red-600 transition-all group"
              onClick={() => onFilterChange({ ...activeFilters, hasChart: 'all' })}
            >
              Chart: {activeFilters.hasChart} <X className="w-2.5 h-2.5 ml-1 opacity-40 group-hover:opacity-100" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default SetlistFilters;
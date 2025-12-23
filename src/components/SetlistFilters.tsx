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
  Target
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface FilterState {
  hasAudio: 'all' | 'full' | 'itunes' | 'none';
  hasVideo: 'all' | 'yes' | 'no';
  hasChart: 'all' | 'yes' | 'no';
  isConfirmed: 'all' | 'yes' | 'no';
  isPlayed: 'all' | 'yes' | 'no';
  readiness: number; // 0 to 100
}

const DEFAULT_FILTERS: FilterState = {
  hasAudio: 'all',
  hasVideo: 'all',
  hasChart: 'all',
  isConfirmed: 'all',
  isPlayed: 'all',
  readiness: 0
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
      { id: 'stage-ready', name: 'Stage Ready', filters: { ...DEFAULT_FILTERS, readiness: 80, hasAudio: 'full', isConfirmed: 'yes' } },
      { id: 'work-needed', name: 'Work Needed', filters: { ...DEFAULT_FILTERS, readiness: 0 } }
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

  const FilterButton = ({ label, active, onClick, icon: Icon, colorClass = "text-indigo-600" }: any) => (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={onClick}
      className={cn(
        "h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-tight gap-2 transition-all border border-transparent",
        active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : cn("bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-100", `hover:${colorClass}`)
      )}
    >
      <Icon className="w-3 h-3" /> {label}
    </Button>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-4">
        {/* Presets Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm">
              <Star className="w-3.5 h-3.5 fill-indigo-600" /> Presets <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-2 rounded-2xl bg-slate-950 border-white/10 text-white">
            <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">Quick Views</DropdownMenuLabel>
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

        {/* Readiness Slider */}
        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 px-4 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 flex-1 min-w-[200px] max-w-sm">
          <div className="flex items-center gap-2 shrink-0">
             <Target className="w-3.5 h-3.5 text-indigo-600" />
             <span className="text-[10px] font-black uppercase text-slate-400 whitespace-nowrap">Min Ready: <span className="text-indigo-600 font-mono">{activeFilters.readiness}%</span></span>
          </div>
          <Slider 
            value={[activeFilters.readiness]} 
            max={100} 
            step={5} 
            onValueChange={([v]) => onFilterChange({ ...activeFilters, readiness: v })}
            className="flex-1"
          />
        </div>

        {/* Audio Filter */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <FilterButton 
            label="Full Audio" 
            active={activeFilters.hasAudio === 'full'} 
            onClick={() => onFilterChange({ ...activeFilters, hasAudio: activeFilters.hasAudio === 'full' ? 'all' : 'full' })}
            icon={Headphones}
          />
          <FilterButton 
            label="No Audio" 
            active={activeFilters.hasAudio === 'none'} 
            onClick={() => onFilterChange({ ...activeFilters, hasAudio: activeFilters.hasAudio === 'none' ? 'all' : 'none' })}
            icon={VolumeX}
            colorClass="text-red-500"
          />
        </div>

        {/* Assets Filter */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <FilterButton 
            label="Video" 
            active={activeFilters.hasVideo === 'yes'} 
            onClick={() => onFilterChange({ ...activeFilters, hasVideo: activeFilters.hasVideo === 'yes' ? 'all' : 'yes' })}
            icon={Youtube}
          />
          <FilterButton 
            label="Chart" 
            active={activeFilters.hasChart === 'yes'} 
            onClick={() => onFilterChange({ ...activeFilters, hasChart: activeFilters.hasChart === 'yes' ? 'all' : 'yes' })}
            icon={FileText}
          />
        </div>

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
          {activeFilters.readiness > 0 && (
            <Badge 
              variant="secondary" 
              className="bg-slate-100 text-slate-900 border-slate-200 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-red-50 hover:text-red-600 transition-all"
              onClick={() => onFilterChange({ ...activeFilters, readiness: 0 })}
            >
              Readiness: ≥{activeFilters.readiness}%
            </Badge>
          )}
          {activeFilters.hasAudio !== 'all' && (
            <Badge 
              variant="secondary" 
              className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-red-50 hover:text-red-600 transition-all"
              onClick={() => onFilterChange({ ...activeFilters, hasAudio: 'all' })}
            >
              Audio: {activeFilters.hasAudio}
            </Badge>
          )}
          {activeFilters.hasVideo !== 'all' && (
            <Badge 
              variant="secondary" 
              className="bg-red-50 text-red-600 border-red-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-red-100 transition-all"
              onClick={() => onFilterChange({ ...activeFilters, hasVideo: 'all' })}
            >
              Video: {activeFilters.hasVideo}
            </Badge>
          )}
          {activeFilters.hasChart !== 'all' && (
            <Badge 
              variant="secondary" 
              className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-red-100 transition-all"
              onClick={() => onFilterChange({ ...activeFilters, hasChart: 'all' })}
            >
              Chart: {activeFilters.hasChart}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default SetlistFilters;
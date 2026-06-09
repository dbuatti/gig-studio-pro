"use client";
// Setlist Filters Component
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Filter, Music, Youtube, FileText, CheckCircle2, 
  X, Star, Save, Trash2, Headphones, Sparkles, Hash,
  CircleDashed, ChevronDown, ListFilter, Music2,
  VideoOff, FileX2, VolumeX, BarChart3, TrendingUp, TrendingDown,
  Target, AlertCircle, Link as LinkIcon, FileSearch, ShieldCheck, Check, Guitar, Type, ListMusic
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
  isApproved: 'all' | 'yes' | 'no';
  readiness: number; 
  hasUgChords: 'all' | 'yes' | 'no';
  hasLyrics: 'all' | 'yes' | 'no';
  hasHighestNote: 'all' | 'yes' | 'no';
  hasOriginalKey: 'all' | 'yes' | 'no';
  inSetlist: 'all' | 'yes' | 'no';
}

export const DEFAULT_FILTERS: FilterState = {
  hasAudio: 'all',
  hasVideo: 'all',
  hasChart: 'all',
  hasPdf: 'all',
  hasUg: 'all',
  isConfirmed: 'all',
  isApproved: 'all',
  readiness: 0,
  hasUgChords: 'all',
  hasLyrics: 'all',
  hasHighestNote: 'all',
  hasOriginalKey: 'all',
  inSetlist: 'all',
};

interface SetlistFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  activeFilters: FilterState;
}

const SetlistFilters: React.FC<SetlistFiltersProps> = ({ onFilterChange, activeFilters }) => {
  const [presets, setPresets] = useState<SavedPreset[]>(() => {
    const saved = localStorage.getItem('gig_filter_presets');
    return saved ? JSON.parse(saved) : [
      { id: 'broken', name: 'Needs Attention', filters: { ...DEFAULT_FILTERS, readiness: 40 } },
      { id: 'stage-ready', name: 'Performance Ready', filters: { ...DEFAULT_FILTERS, readiness: 100, hasAudio: 'full', hasChart: 'yes', isConfirmed: 'yes', isApproved: 'yes', hasUgChords: 'yes', hasLyrics: 'yes' } }
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
      <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500 bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 px-5 rounded-xl border-white/10 bg-slate-950 text-indigo-400 font-black uppercase text-[10px] tracking-widest gap-2.5 shadow-lg transition-all hover:bg-indigo-600 hover:text-white">
                <Star className="w-4 h-4 fill-current" /> <span className="hidden sm:inline">Saved Views</span> <ChevronDown className="w-3.5 h-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 p-2 rounded-2xl bg-slate-950 border-white/10 text-white shadow-2xl">
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">Quick Toggles</DropdownMenuLabel>
              {presets.map(p => (
                <DropdownMenuItem 
                  key={p.id} 
                  onClick={() => onFilterChange(p.filters)}
                  className="flex items-center justify-between rounded-xl h-11 px-3 cursor-pointer hover:bg-white/5 group"
                >
                  <span className="text-xs font-bold uppercase">{p.name}</span>
                  <button onClick={(e) => deletePreset(p.id, e)} className="p-1.5 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={savePreset} className="text-indigo-400 font-black uppercase text-[9px] tracking-widest h-11 px-3 cursor-pointer hover:bg-indigo-600/10 gap-2.5">
                <Save className="w-4 h-4" /> Save Current View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-8 w-px bg-white/10 mx-1 hidden md:block" />

          <div className="flex items-center gap-6 bg-slate-950 px-6 py-2 rounded-xl border border-white/10 flex-1 min-w-[300px] shadow-inner">
            <div className="flex items-center gap-2.5 shrink-0">
               <AlertCircle className="w-4 h-4 text-orange-500" />
               <span className="text-[10px] font-black uppercase text-slate-500 whitespace-nowrap">Readiness: <span className="text-indigo-400 font-mono">≥{activeFilters.readiness}%</span></span>
            </div>
            <Slider 
              value={[activeFilters.readiness]} 
              max={100} 
              step={5} 
              onValueChange={([v]) => onFilterChange({ ...activeFilters, readiness: v })}
              className="flex-1"
            />
          </div>

          <div className="h-8 w-px bg-white/10 mx-1 hidden lg:block" />

          <div className="flex items-center gap-2">
            {[
              { id: 'isConfirmed', icon: ShieldCheck, label: 'Key Verified', color: 'bg-emerald-600' },
              { id: 'isApproved', icon: Check, label: 'Approved', color: 'bg-indigo-600' },
              { id: 'hasAudio', icon: Music, label: 'Audio Status', color: 'bg-indigo-600' },
              { id: 'hasVideo', icon: Youtube, label: 'Video Link', color: 'bg-red-600' },
              { id: 'hasPdf', icon: FileText, label: 'Sheet Music', color: 'bg-emerald-600' },
              { id: 'hasUg', icon: FileSearch, label: 'Ultimate Guitar', color: 'bg-orange-600' },
            ].map((filter) => (
              <DropdownMenu key={filter.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn(
                          "h-10 w-10 rounded-xl border transition-all",
                          activeFilters[filter.id as keyof FilterState] !== 'all' ? `${filter.color} text-white shadow-lg` : "bg-slate-950 border-white/10 text-slate-500 hover:text-white"
                        )}
                      >
                        <filter.icon className="w-4.5 h-4.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px] font-black uppercase">{filter.label}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="w-52 p-2 rounded-2xl bg-slate-950 border-white/10 text-white shadow-2xl">
                  <DropdownMenuRadioGroup value={activeFilters[filter.id as keyof FilterState] as string} onValueChange={(v) => onFilterChange({ ...activeFilters, [filter.id]: v as string })}>
                    <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-11 rounded-xl">All Songs</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="yes" className="text-xs font-bold uppercase h-11 rounded-xl text-emerald-400">Yes / Verified</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="no" className="text-xs font-bold uppercase h-11 rounded-xl text-red-400">No / Missing</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>

          {!isDefault && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onFilterChange(DEFAULT_FILTERS)}
              className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-400/10 gap-2.5 transition-all"
            >
              <X className="w-4 h-4" /> Reset Matrix
            </Button>
          )}
        </div>

        {!isDefault && (
          <div className="flex flex-wrap gap-2.5 px-1 pt-4 border-t border-white/5">
            <span className="text-[9px] font-black uppercase text-slate-600 flex items-center gap-2 mr-2">
              <ListFilter className="w-3.5 h-3.5" /> Active Criteria:
            </span>
            {Object.entries(activeFilters).map(([key, val]) => {
              if (val === 'all' || (key === 'readiness' && val === 0)) return null;
              return (
                <Badge 
                  key={key}
                  variant="secondary" 
                  className="bg-indigo-600/10 text-indigo-400 border-indigo-500/20 text-[9px] font-black uppercase px-3 py-1 rounded-lg cursor-pointer hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all group"
                  onClick={() => onFilterChange({ ...activeFilters, [key]: key === 'readiness' ? 0 : 'all' })}
                >
                  {key.replace(/([A-Z])/g, ' $1')}: {val} <X className="w-2.5 h-2.5 ml-2 opacity-40 group-hover:opacity-100" />
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default SetlistFilters;

interface SavedPreset {
  id: string;
  name: string;
  filters: FilterState;
}
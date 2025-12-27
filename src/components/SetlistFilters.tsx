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
  Target, AlertCircle, Link as LinkIcon, FileSearch, ShieldCheck, Check, Guitar
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
}

const DEFAULT_FILTERS: FilterState = {
  hasAudio: 'all',
  hasVideo: 'all',
  hasChart: 'all',
  hasPdf: 'all',
  hasUg: 'all',
  isConfirmed: 'all',
  isApproved: 'all',
  readiness: 0, // Changed default readiness to 0
  hasUgChords: 'all'
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
      { id: 'stage-ready', name: 'Performance Ready', filters: { ...DEFAULT_FILTERS, readiness: 100, hasAudio: 'full', hasChart: 'yes', isConfirmed: 'yes', isApproved: 'yes', hasUgChords: 'yes' } }
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
          {/* Presets Dropdown */}
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
                  <button onClick={(e) => deletePreset(p.id, e)} className="p-1 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={savePreset} className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                <Save className="w-3.5 h-3.5 mr-2" /> <span className="text-xs font-bold uppercase">Save Current View</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFilterChange(DEFAULT_FILTERS)} disabled={isDefault} className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                <RotateCcw className="w-3.5 h-3.5 mr-2" /> <span className="text-xs font-bold uppercase">Reset Filters</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter Buttons */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm">
                <Headphones className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Audio</span> <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 p-2 rounded-2xl bg-slate-950 border-white/10 text-white">
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">Audio Source</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuRadioGroup value={activeFilters.hasAudio} onValueChange={(value: 'all' | 'full' | 'itunes' | 'none') => onFilterChange({ ...activeFilters, hasAudio: value })}>
                <DropdownMenuRadioItem value="all" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <ListFilter className="w-3.5 h-3.5 mr-2" /> All Audio
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="full" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <Volume2 className="w-3.5 h-3.5 mr-2" /> Full Master
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="itunes" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <Music2 className="w-3.5 h-3.5 mr-2" /> iTunes Preview
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="none" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <VolumeX className="w-3.5 h-3.5 mr-2" /> No Audio
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm">
                <Youtube className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Video</span> <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 p-2 rounded-2xl bg-slate-950 border-white/10 text-white">
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">Video Links</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuRadioGroup value={activeFilters.hasVideo} onValueChange={(value: 'all' | 'yes' | 'no') => onFilterChange({ ...activeFilters, hasVideo: value })}>
                <DropdownMenuRadioItem value="all" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <ListFilter className="w-3.5 h-3.5 mr-2" /> All Videos
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Has Video
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <VideoOff className="w-3.5 h-3.5 mr-2" /> No Video
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm">
                <FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Charts</span> <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 p-2 rounded-2xl bg-slate-950 border-white/10 text-white">
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">Chart Links</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuRadioGroup value={activeFilters.hasChart} onValueChange={(value: 'all' | 'yes' | 'no') => onFilterChange({ ...activeFilters, hasChart: value })}>
                <DropdownMenuRadioItem value="all" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <ListFilter className="w-3.5 h-3.5 mr-2" /> All Charts
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <FileCheck2 className="w-3.5 h-3.5 mr-2" /> Has Chart
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <FileX2 className="w-3.5 h-3.5 mr-2" /> No Chart
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">Specific Types</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activeFilters.hasPdf} onValueChange={(value: 'all' | 'yes' | 'no') => onFilterChange({ ...activeFilters, hasPdf: value })}>
                <DropdownMenuRadioItem value="all" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <ListFilter className="w-3.5 h-3.5 mr-2" /> All PDFs
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <FileText className="w-3.5 h-3.5 mr-2" /> Has PDF
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <FileX2 className="w-3.5 h-3.5 mr-2" /> No PDF
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuRadioGroup value={activeFilters.hasUg} onValueChange={(value: 'all' | 'yes' | 'no') => onFilterChange({ ...activeFilters, hasUg: value })}>
                <DropdownMenuRadioItem value="all" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <ListFilter className="w-3.5 h-3.5 mr-2" /> All UG Links
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <LinkIcon className="w-3.5 h-3.5 mr-2" /> Has UG Link
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <Link2Off className="w-3.5 h-3.5 mr-2" /> No UG Link
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuRadioGroup value={activeFilters.hasUgChords} onValueChange={(value: 'all' | 'yes' | 'no') => onFilterChange({ ...activeFilters, hasUgChords: value })}>
                <DropdownMenuRadioItem value="all" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <ListFilter className="w-3.5 h-3.5 mr-2" /> All UG Chords
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <Guitar className="w-3.5 h-3.5 mr-2" /> Has UG Chords
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <FileX2 className="w-3.5 h-3.5 mr-2" /> No UG Chords
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Status</span> <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 p-2 rounded-2xl bg-slate-950 border-white/10 text-white">
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">Verification</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuRadioGroup value={activeFilters.isConfirmed} onValueChange={(value: 'all' | 'yes' | 'no') => onFilterChange({ ...activeFilters, isConfirmed: value })}>
                <DropdownMenuRadioItem value="all" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <ListFilter className="w-3.5 h-3.5 mr-2" /> All Confirmed
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <Check className="w-3.5 h-3.5 mr-2" /> Confirmed
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <AlertCircle className="w-3.5 h-3.5 mr-2" /> Unconfirmed
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">Approval</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activeFilters.isApproved} onValueChange={(value: 'all' | 'yes' | 'no') => onFilterChange({ ...activeFilters, isApproved: value })}>
                <DropdownMenuRadioItem value="all" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <ListFilter className="w-3.5 h-3.5 mr-2" /> All Approved
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Approved
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="rounded-xl h-10 px-3 cursor-pointer hover:bg-white/10">
                  <CircleDashed className="w-3.5 h-3.5 mr-2" /> Unapproved
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" /> Readiness Score
            </span>
            <span className="text-xs font-black text-indigo-600">{activeFilters.readiness}%+</span>
          </div>
          <Slider 
            value={[activeFilters.readiness]} 
            onValueChange={([value]) => onFilterChange({ ...activeFilters, readiness: value })} 
            min={0} 
            max={100} 
            step={5} 
            className="w-full" 
          />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SetlistFilters;
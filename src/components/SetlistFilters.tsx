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
  Target, AlertCircle, Link as LinkIcon, FileSearch, ShieldCheck, Check, Guitar, Type
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
  hasLyrics: 'all' | 'yes' | 'no'; // NEW
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
  hasLyrics: 'all', // NEW
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

  useEffect(() => {
    console.log("[SetlistFilters] Active Filters Updated:", activeFilters);
  }, [activeFilters]);

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
      <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500 bg-secondary p-4 rounded-2xl border border-border">
        <div className="flex flex-wrap items-center gap-3">
          {/* Presets Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-border bg-card text-indigo-600 font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm">
                <Star className="w-3.5 h-3.5 fill-indigo-600" /> <span className="hidden sm:inline">Views</span> <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-2 rounded-2xl bg-popover border-border text-foreground">
              <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">Quick Toggles</DropdownMenuLabel>
              {presets.map(p => (
                <DropdownMenuItem 
                  key={p.id} 
                  onClick={() => onFilterChange(p.filters)}
                  className="flex items-center justify-between rounded-xl h-10 px-3 cursor-pointer hover:bg-accent dark:hover:bg-secondary"
                >
                  <span className="text-xs font-bold uppercase">{p.name}</span>
                  <button onClick={(e) => deletePreset(p.id, e)} className="p-1 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={savePreset} className="text-indigo-400 font-black uppercase text-[9px] tracking-widest h-10 px-3 cursor-pointer hover:bg-accent dark:hover:bg-secondary gap-2">
                <Save className="w-3.5 h-3.5" /> Save Current View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-6 w-px bg-border mx-1 hidden md:block" />

          {/* Readiness Slider - Expanded */}
          <div className="flex items-center gap-4 bg-card px-4 py-1.5 rounded-xl border border-border flex-1 min-w-[300px]">
            <div className="flex items-center gap-2 shrink-0">
               <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
               <span className="text-[10px] font-black uppercase text-muted-foreground whitespace-nowrap">Readiness: <span className="text-indigo-600 font-mono">≥{activeFilters.readiness}%</span></span>
            </div>
            <Slider 
              value={[activeFilters.readiness]} 
              max={100} 
              step={5} 
              onValueChange={([v]) => onFilterChange({ ...activeFilters, readiness: v })}
              className="flex-1"
            />
          </div>

          <div className="h-6 w-px bg-border mx-1 hidden lg:block" />

          {/* Confirmed Toggle (Icon only) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-9 w-9 rounded-xl border transition-all",
                      activeFilters.isConfirmed !== 'all' ? "bg-emerald-600 text-white shadow-lg" : "bg-card border-border text-muted-foreground"
                    )}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="text-[10px] font-black uppercase">Key Verified</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-48 p-2 rounded-2xl bg-popover border-border text-foreground">
              <DropdownMenuRadioGroup value={activeFilters.isConfirmed} onValueChange={(v) => onFilterChange({ ...activeFilters, isConfirmed: v as any })}>
                <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-10 rounded-xl">All Status</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="text-xs font-bold uppercase h-10 rounded-xl text-emerald-400">Verified Only</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="text-xs font-bold uppercase h-10 rounded-xl text-destructive">Unverified Only</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Approved Toggle (Icon only) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-9 w-9 rounded-xl border transition-all",
                      activeFilters.isApproved !== 'all' ? "bg-indigo-600 text-white shadow-lg" : "bg-card border-border text-muted-foreground"
                    )}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="text-[10px] font-black uppercase">Performance Approved</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-48 p-2 rounded-2xl bg-popover border-border text-foreground">
              <DropdownMenuRadioGroup value={activeFilters.isApproved} onValueChange={(v) => onFilterChange({ ...activeFilters, isApproved: v as any })}>
                <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-10 rounded-xl">All Songs</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="text-xs font-bold uppercase h-10 rounded-xl text-emerald-400">Approved Only</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="text-xs font-bold uppercase h-10 rounded-xl text-destructive">Unapproved Only</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Audio Toggle (Icon only) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-9 w-9 rounded-xl border transition-all",
                      activeFilters.hasAudio !== 'all' ? "bg-indigo-600 text-white shadow-lg" : "bg-card border-border text-muted-foreground"
                    )}
                  >
                    <Music className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="text-[10px] font-black uppercase">Audio Status</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-48 p-2 rounded-2xl bg-popover border-border text-foreground">
              <DropdownMenuRadioGroup value={activeFilters.hasAudio} onValueChange={(v) => onFilterChange({ ...activeFilters, hasAudio: v as any })}>
                <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-10 rounded-xl">All Songs</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="full" className="text-xs font-bold uppercase h-10 rounded-xl text-emerald-400">Master Audio Only</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="itunes" className="text-xs font-bold uppercase h-10 rounded-xl text-indigo-400">iTunes Previews</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="none" className="text-xs font-bold uppercase h-10 rounded-xl text-destructive">Missing Audio</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Video Toggle (Icon only) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-9 w-9 rounded-xl border transition-all",
                      activeFilters.hasVideo !== 'all' ? "bg-destructive text-white shadow-lg" : "bg-card border-border text-muted-foreground"
                    )}
                  >
                    <Youtube className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="text-[10px] font-black uppercase">Video Link</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-48 p-2 rounded-2xl bg-popover border-border text-foreground">
              <DropdownMenuRadioGroup value={activeFilters.hasVideo} onValueChange={(v) => onFilterChange({ ...activeFilters, hasVideo: v as any })}>
                <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-10 rounded-xl">All Songs</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="text-xs font-bold uppercase h-10 rounded-xl text-emerald-400">Has Video</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="text-xs font-bold uppercase h-10 rounded-xl text-destructive">Missing Video</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* PDF Toggle (Icon only) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-9 w-9 rounded-xl border transition-all",
                      activeFilters.hasPdf !== 'all' ? "bg-emerald-600 text-white shadow-lg" : "bg-card border-border text-muted-foreground"
                    )}
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="text-[10px] font-black uppercase">Sheet Music</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-48 p-2 rounded-2xl bg-popover border-border text-foreground">
              <DropdownMenuRadioGroup value={activeFilters.hasPdf} onValueChange={(v) => onFilterChange({ ...activeFilters, hasPdf: v as any })}>
                <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-10 rounded-xl">All Songs</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="text-xs font-bold uppercase h-10 rounded-xl text-emerald-400">Has PDF</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="text-xs font-bold uppercase h-10 rounded-xl text-destructive">Missing PDF</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* UG Toggle (Icon only) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-9 w-9 rounded-xl border transition-all",
                      activeFilters.hasUg !== 'all' ? "bg-orange-600 text-white shadow-lg" : "bg-card border-border text-muted-foreground"
                    )}
                  >
                    <FileSearch className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="text-[10px] font-black uppercase">Ultimate Guitar</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-48 p-2 rounded-2xl bg-popover border-border text-foreground">
              <DropdownMenuRadioGroup value={activeFilters.hasUg} onValueChange={(v) => onFilterChange({ ...activeFilters, hasUg: v as any })}>
                <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-10 rounded-xl">All Songs</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="text-xs font-bold uppercase h-10 rounded-xl text-emerald-400">Has UG Link</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="text-xs font-bold uppercase h-10 rounded-xl text-destructive">Missing UG Link</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* UG Chords Toggle (Icon only) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-9 w-9 rounded-xl border transition-all",
                      activeFilters.hasUgChords !== 'all' ? "bg-purple-600 text-white shadow-lg" : "bg-card border-border text-muted-foreground"
                    )}
                  >
                    <Guitar className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="text-[10px] font-black uppercase">UG Chords Text</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-48 p-2 rounded-2xl bg-popover border-border text-foreground">
              <DropdownMenuRadioGroup value={activeFilters.hasUgChords} onValueChange={(v) => onFilterChange({ ...activeFilters, hasUgChords: v as any })}>
                <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-10 rounded-xl">All Songs</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="text-xs font-bold uppercase h-10 rounded-xl text-emerald-400">Has Chords Text</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="text-xs font-bold uppercase h-10 rounded-xl text-destructive">Missing Chords Text</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* NEW: Lyrics Toggle (Icon only) */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-9 w-9 rounded-xl border transition-all",
                      activeFilters.hasLyrics !== 'all' ? "bg-pink-600 text-white shadow-lg" : "bg-card border-border text-muted-foreground"
                    )}
                  >
                    <Type className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent className="text-[10px] font-black uppercase">Lyrics</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="w-48 p-2 rounded-2xl bg-popover border-border text-foreground">
              <DropdownMenuRadioGroup value={activeFilters.hasLyrics} onValueChange={(v) => onFilterChange({ ...activeFilters, hasLyrics: v as any })}>
                <DropdownMenuRadioItem value="all" className="text-xs font-bold uppercase h-10 rounded-xl">All Songs</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yes" className="text-xs font-bold uppercase h-10 rounded-xl text-emerald-400">Has Lyrics</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="no" className="text-xs font-bold uppercase h-10 rounded-xl text-destructive">Missing Lyrics</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {!isDefault && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onFilterChange(DEFAULT_FILTERS)}
              className="h-8 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 gap-2"
            >
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
        </div>

        {/* Active Filter Badges */}
        {!isDefault && (
          <div className="flex flex-wrap gap-2 px-1">
            <span className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-2 mr-2">
              <ListFilter className="w-3 h-3" /> Active Criteria:
            </span>
            {activeFilters.readiness > 0 && (
              <Badge 
                variant="secondary" 
                className="bg-orange-50 text-orange-600 border-orange-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-all group"
                onClick={() => onFilterChange({ ...activeFilters, readiness: 0 })}
              >
                Readiness: ≥{activeFilters.readiness}% <X className="w-2 h-2 ml-1.5 opacity-40 group-hover:opacity-100" />
              </Badge>
            )}
            {activeFilters.isConfirmed !== 'all' && (
              <Badge 
                variant="secondary" 
                className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-all group"
                onClick={() => onFilterChange({ ...activeFilters, isConfirmed: 'all' })}
              >
                Key Verified: {activeFilters.isConfirmed} <X className="w-2 h-2 ml-1.5 opacity-40 group-hover:opacity-100" />
              </Badge>
            )}
            {activeFilters.isApproved !== 'all' && (
              <Badge 
                variant="secondary" 
                className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-all group"
                onClick={() => onFilterChange({ ...activeFilters, isApproved: 'all' })}
              >
                Approved: {activeFilters.isApproved} <X className="w-2 h-2 ml-1.5 opacity-40 group-hover:opacity-100" />
              </Badge>
            )}
            {activeFilters.hasAudio !== 'all' && (
              <Badge 
                variant="secondary" 
                className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-all group"
                onClick={() => onFilterChange({ ...activeFilters, hasAudio: 'all' })}
              >
                Audio: {activeFilters.hasAudio} <X className="w-2 h-2 ml-1.5 opacity-40 group-hover:opacity-100" />
              </Badge>
            )}
            {activeFilters.hasVideo !== 'all' && (
              <Badge 
                variant="secondary" 
                className="bg-red-50 text-red-600 border-red-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-all group"
                onClick={() => onFilterChange({ ...activeFilters, hasVideo: 'all' })}
              >
                Video: {activeFilters.hasVideo} <X className="w-2 h-2 ml-1.5 opacity-40 group-hover:opacity-100" />
              </Badge>
            )}
            {activeFilters.hasPdf !== 'all' && (
              <Badge 
                variant="secondary" 
                className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-all group"
                onClick={() => onFilterChange({ ...activeFilters, hasPdf: 'all' })}
              >
                PDF: {activeFilters.hasPdf} <X className="w-2 h-2 ml-1.5 opacity-40 group-hover:opacity-100" />
              </Badge>
            )}
            {activeFilters.hasUg !== 'all' && (
              <Badge 
                variant="secondary" 
                className="bg-orange-50 text-orange-600 border-orange-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-all group"
                onClick={() => onFilterChange({ ...activeFilters, hasUg: 'all' })}
              >
                UG: {activeFilters.hasUg} <X className="w-2 h-2 ml-1.5 opacity-40 group-hover:opacity-100" />
              </Badge>
            )}
            {activeFilters.hasUgChords !== 'all' && (
              <Badge 
                variant="secondary" 
                className="bg-purple-50 text-purple-600 border-purple-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-all group"
                onClick={() => onFilterChange({ ...activeFilters, hasUgChords: 'all' })}
              >
                UG Chords: {activeFilters.hasUgChords} <X className="w-2 h-2 ml-1.5 opacity-40 group-hover:opacity-100" />
              </Badge>
            )}
            {/* NEW: Lyrics Badge */}
            {activeFilters.hasLyrics !== 'all' && (
              <Badge 
                variant="secondary" 
                className="bg-pink-50 text-pink-600 border-pink-100 text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-all group"
                onClick={() => onFilterChange({ ...activeFilters, hasLyrics: 'all' })}
              >
                Lyrics: {activeFilters.hasLyrics} <X className="w-2 h-2 ml-1.5 opacity-40 group-hover:opacity-100" />
              </Badge>
            )}
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
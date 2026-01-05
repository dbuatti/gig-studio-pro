"use client";

import React, { useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Search, Music, ChevronLeft, ChevronRight, Loader2, ChevronDown, Maximize2, Minimize2, Bug, Hash, Sparkles, ListMusic, Play, Pause, Gauge, Volume2, Activity, RotateCcw, FileText, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils';
import { SetlistSong } from './SetlistManager';
import { KeyPreference } from '@/hooks/use-settings';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { showError } from '@/utils/toast';
import { AudioEngineControls } from '@/hooks/use-tone-audio';

type ChartType = 'pdf' | 'leadsheet' | 'chords';

interface SheetReaderHeaderProps {
  currentSong: SetlistSong | null;
  onClose: () => void; // Still needed for the back button, even if not in the image, for good UX
  onOpenRepertoireSearch: () => void;
  onOpenCurrentSongStudio: () => void;
  isLoading: boolean;
  keyPreference: KeyPreference; // Global preference, not directly used in header anymore
  onUpdateKey: (newTargetKey: string) => void;
  isFullScreen: boolean; // Still needed for fullscreen logic, but button removed from header
  onToggleFullScreen: () => void; // Still needed for fullscreen logic, but button removed from header
  setIsOverlayOpen: (isOpen: boolean) => void;
  pitch: number;
  setPitch: (pitch: number) => void;
  readerKeyPreference: 'sharps' | 'flats';
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  effectiveTargetKey: string;
}

const SheetReaderHeader: React.FC<SheetReaderHeaderProps> = ({
  currentSong,
  onClose, // Keep for now, might be used by other components or for a different exit strategy
  onOpenRepertoireSearch,
  onOpenCurrentSongStudio,
  isLoading,
  onUpdateKey,
  isFullScreen, // Keep for internal logic
  onToggleFullScreen, // Keep for internal logic
  setIsOverlayOpen,
  pitch,
  setPitch,
  readerKeyPreference,
  isSidebarOpen,
  onToggleSidebar,
  effectiveTargetKey,
}) => {
  const displayKey = effectiveTargetKey ? formatKey(effectiveTargetKey, readerKeyPreference) : null;
  const keysToUse = readerKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  const activeKeyItemRef = useRef<HTMLDivElement>(null);

  const handleDropdownOpenChange = (open: boolean) => {
    setIsOverlayOpen(open);
    if (open && activeKeyItemRef.current) {
      // Use a slight delay to ensure the dropdown content is rendered before scrolling
      setTimeout(() => {
        activeKeyItemRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 100); 
    }
  };

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-60 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300 h-[72px]",
        isFullScreen && "hidden" // NEW: Hide header when in fullscreen
      )}
    >
      {/* Left Section: Sidebar Toggle */}
      <div className="flex items-center gap-4 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className={cn(
            "h-10 w-10 rounded-xl transition-all",
            isSidebarOpen ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white/5 hover:bg-white/10 text-slate-400"
          )}
          title="Toggle Song List"
        >
          <ListMusic className="w-5 h-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenCurrentSongStudio}
          disabled={!currentSong}
          className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
          title="Open Current Song in Studio"
        >
          <FileText className="w-5 h-5" />
        </Button>
      </div>

      {/* Center Section: Song Title and Studio Button */}
      <div className="flex-1 text-center min-w-0 px-4">
        {isLoading ? (
          <Skeleton className="h-6 w-48 mx-auto bg-white/10" />
        ) : currentSong ? (
          <h2 className="text-lg font-black uppercase tracking-tight text-white line-clamp-1">{currentSong.name}</h2>
        ) : (
          <p className="text-sm font-bold text-slate-500">No Song Selected</p>
        )}
      </div>

      {/* Right Section: Transposer & Search */}
      <div className="flex items-center gap-4 shrink-0">
        {currentSong && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1">
            <Button variant="ghost" size="icon" onClick={() => setPitch(pitch - 1)} className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400" title="Transpose Down">
              <Minus className="w-4 h-4" />
            </Button>
            <DropdownMenu onOpenChange={handleDropdownOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="bg-transparent border-none text-xs font-black font-mono h-9 px-2 rounded-xl text-indigo-400 gap-1 min-w-[60px] hover:bg-transparent"
                  title="Change Stage Key"
                >
                  <span className="flex items-center gap-1">
                    {displayKey || <Skeleton className="h-4 w-6 bg-white/10" />}
                    <span className="text-slate-400">{pitch > 0 ? `+${pitch}` : pitch}</span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white z-[300] max-h-60 overflow-y-auto custom-scrollbar">
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">Stage Key</DropdownMenuLabel>
                  {keysToUse.map(k => (
                    <DropdownMenuItem 
                      key={k} 
                      onSelect={() => onUpdateKey(k)} 
                      className={cn(
                        "font-mono font-bold cursor-pointer",
                        k === displayKey && "bg-indigo-600 text-white hover:bg-indigo-700" // Highlight current key
                      )}
                      ref={k === displayKey ? activeKeyItemRef : null} // Assign ref to active item
                    >
                      {k}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={() => setPitch(pitch + 1)} className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400" title="Transpose Up">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={onOpenRepertoireSearch} className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400" title="Search Repertoire">
          <Search className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default SheetReaderHeader;
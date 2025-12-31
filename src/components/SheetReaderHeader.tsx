"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Music, ChevronLeft, ChevronRight, Loader2, ChevronDown, Maximize2, Minimize2, Bug, Hash, Sparkles, ListMusic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils';
import { SetlistSong } from './SetlistManager';
import { KeyPreference } from '@/hooks/use-settings';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

interface SheetReaderHeaderProps {
  currentSong: SetlistSong | null;
  onClose: () => void;
  onSearchClick: () => void;
  onPrevSong: () => void;
  onNextSong: () => void;
  isLoading: boolean;
  keyPreference: KeyPreference;
  onUpdateKey: (newTargetKey: string) => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  setIsOverlayOpen: (isOpen: boolean) => void;
  isOverrideActive: boolean;
  // Harmonic Sync Props
  pitch: number;
  setPitch: (pitch: number) => void;
  // NEW: Props for override readerKeyPreference
  readerKeyPreference: 'sharps' | 'flats';
  setReaderKeyPreference: (pref: 'sharps' | 'flats') => void;
  // NEW: Pull Key Handler
  onPullKey: () => void;
  // NEW: Sidebar Toggle
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const SheetReaderHeader: React.FC<SheetReaderHeaderProps> = ({
  currentSong,
  onClose,
  onSearchClick,
  onPrevSong,
  onNextSong,
  isLoading,
  keyPreference,
  onUpdateKey,
  isFullScreen,
  onToggleFullScreen,
  setIsOverlayOpen,
  isOverrideActive,
  pitch,
  setPitch,
  readerKeyPreference,
  setReaderKeyPreference,
  onPullKey,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  // Use the reader specific preference for display
  const rawTargetKey = currentSong?.targetKey || currentSong?.originalKey;
  const displayKey = rawTargetKey ? formatKey(rawTargetKey, readerKeyPreference) : null;
  const keysToUse = readerKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  console.log(`[SheetReaderHeader] Rendering for song: ${currentSong?.name || 'N/A'}`);
  console.log(`[SheetReaderHeader] Raw Target Key: ${rawTargetKey}, Display Key: ${displayKey}, Reader Key Preference: ${readerKeyPreference}`);

  return (
    <div className="fixed top-0 left-0 right-0 z-60 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-xl bg-white/5"><ArrowLeft className="w-5 h-5 text-slate-400" /></Button>
        
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

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onPrevSong} 
            disabled={isLoading}
            className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex-1 text-center min-w-[120px]">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mx-auto" />
            ) : currentSong ? (
              <>
                <h2 className="text-lg font-black uppercase tracking-tight text-white line-clamp-1">{currentSong.name}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 line-clamp-1">{currentSong.artist || "Unknown Artist"}</p>
              </>
            ) : (
              <p className="text-sm font-bold text-slate-500">No Song</p>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onNextSong} 
            disabled={isLoading}
            className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isOverrideActive && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-red-600/20 border border-red-500/20 rounded-full">
            <Bug className="w-3 h-3 text-red-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-red-400">DEBUG ACTIVE</span>
          </div>
        )}
        
        {currentSong && (
          <div className="flex items-center gap-2">
            {/* NEW: Pull Key Button */}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onPullKey}
              className="bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white border border-emerald-600/20 h-10 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Pull Key
            </Button>

            {/* NEW: Key Preference Override Toggle */}
            <DropdownMenu onOpenChange={setIsOverlayOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  onPointerDown={(e) => e.stopPropagation()}
                  className="bg-white/5 border-white/10 text-xs font-black font-mono h-10 px-3 rounded-xl text-indigo-400 gap-2 min-w-[60px]"
                  disabled={isLoading}
                >
                  <span className="flex items-center gap-1.5">
                    {readerKeyPreference === 'sharps' ? <Hash className="w-3 h-3" /> : <Music className="w-3 h-3" />}
                    {readerKeyPreference === 'sharps' ? '#' : 'b'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white z-[300]">
                <DropdownMenuItem onClick={() => setReaderKeyPreference('sharps')} className="font-bold cursor-pointer flex items-center justify-between">
                  <span>Sharps</span>
                  {readerKeyPreference === 'sharps' && <span className="text-emerald-500">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReaderKeyPreference('flats')} className="font-bold cursor-pointer flex items-center justify-between">
                  <span>Flats</span>
                  {readerKeyPreference === 'flats' && <span className="text-emerald-500">✓</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Existing Key Signature Dropdown */}
            <DropdownMenu onOpenChange={setIsOverlayOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  onPointerDown={(e) => e.stopPropagation()}
                  className="bg-white/5 border-white/10 text-xs font-black font-mono h-10 px-4 rounded-xl text-indigo-400 gap-2 min-w-[80px]"
                  disabled={isLoading}
                >
                  <span className="flex items-center gap-2">
                    <Music className="w-3.5 h-3.5" />
                    {displayKey || <Skeleton className="h-4 w-6 bg-white/10" />}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white z-[300] max-h-60 overflow-y-auto custom-scrollbar">
                  {keysToUse.map(k => (
                    <DropdownMenuItem key={k} onSelect={() => onUpdateKey(k)} className="font-mono font-bold cursor-pointer">
                      {k}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>
          </div>
        )}
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onSearchClick}
          className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
        >
          <Search className="w-5 h-5" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggleFullScreen}
          className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
        >
          {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </Button>
      </div>
    </div>
  );
};

export default SheetReaderHeader;
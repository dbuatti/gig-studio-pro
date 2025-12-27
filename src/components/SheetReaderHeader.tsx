"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Music, ChevronLeft, ChevronRight, Loader2, ChevronDown, Maximize2, Minimize2 } from 'lucide-react'; // Import Maximize2, Minimize2
import { cn } from '@/lib/utils';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils';
import { SetlistSong } from './SetlistManager';
import { KeyPreference } from '@/hooks/use-settings';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"; // Import DropdownMenu components

interface SheetReaderHeaderProps {
  currentSong: SetlistSong | null;
  onClose: () => void;
  onSearchClick: () => void;
  onPrevSong: () => void;
  onNextSong: () => void;
  currentSongIndex: number;
  totalSongs: number;
  isLoading: boolean;
  keyPreference: KeyPreference;
  onUpdateKey: (newTargetKey: string) => void;
  isFullScreen: boolean; // NEW: isFullScreen prop
  onToggleFullScreen: () => void; // NEW: onToggleFullScreen prop
  setIsOverlayOpen: (isOpen: boolean) => void; // NEW: setIsOverlayOpen prop
}

const SheetReaderHeader: React.FC<SheetReaderHeaderProps> = ({
  currentSong,
  onClose,
  onSearchClick,
  onPrevSong,
  onNextSong,
  currentSongIndex,
  totalSongs,
  isLoading,
  keyPreference,
  onUpdateKey,
  isFullScreen, // Destructure new prop
  onToggleFullScreen, // Destructure new prop
  setIsOverlayOpen, // Destructure new prop
}) => {
  const displayKey = formatKey(currentSong?.targetKey || currentSong?.originalKey, keyPreference);
  const keysToUse = keyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  return (
    <div className="fixed top-0 left-0 right-0 z-60 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-white/10 text-slate-400">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onPrevSong} disabled={totalSongs === 0 || isLoading} className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 text-center min-w-[100px]">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mx-auto" />
            ) : currentSong ? (
              <>
                {/* Removed max-w-[250px] and truncate */}
                <h2 className="text-lg font-black uppercase tracking-tight text-white">{currentSong.name}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{currentSong.artist || "Unknown Artist"}</p>
              </>
            ) : (
              <p className="text-sm font-bold text-slate-500">No Song</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onNextSong} disabled={totalSongs === 0 || isLoading} className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {currentSong && (
          <DropdownMenu onOpenChange={setIsOverlayOpen}> {/* NEW: Set setIsOverlayOpen */}
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}> {/* NEW: e.stopPropagation() */}
              <Button 
                variant="ghost" 
                className="bg-white/5 border-white/10 text-xs font-black font-mono h-10 px-4 rounded-xl text-indigo-400 gap-2"
                disabled={isLoading}
              >
                <Music className="w-3.5 h-3.5" />
                {displayKey}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white z-[300] max-h-60 overflow-y-auto custom-scrollbar">
              {keysToUse.map(k => (
                <DropdownMenuItem key={k} onSelect={() => onUpdateKey(k)} className="font-mono font-bold">
                  {k}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="ghost" size="icon" onClick={onSearchClick} className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400">
          <Search className="w-5 h-5" />
        </Button>
        {/* NEW: Full Screen Toggle Button */}
        <Button variant="ghost" size="icon" onClick={onToggleFullScreen} className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400">
          {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </Button>
      </div>
    </div>
  );
};

export default SheetReaderHeader;
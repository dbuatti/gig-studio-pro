"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { X, Music, ChevronDown } from 'lucide-react'; // Added ChevronDown
import { SetlistSong } from '@/components/SetlistManager';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils'; // Import ALL_KEYS
import { KeyPreference } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal } from "@/components/ui/dropdown-menu"; // Import DropdownMenu components

interface FullScreenSongInfoProps {
  song: SetlistSong;
  onExitFullScreen: () => void;
  readerKeyPreference: KeyPreference;
  onUpdateKey: (newTargetKey: string) => void; // NEW: Add onUpdateKey prop
  setIsOverlayOpen: (isOpen: boolean) => void; // NEW: Add setIsOverlayOpen prop
  effectiveTargetKey: string; // NEW: Add effectiveTargetKey prop
}

const FullScreenSongInfo: React.FC<FullScreenSongInfoProps> = ({
  song,
  onExitFullScreen,
  readerKeyPreference,
  onUpdateKey, // Destructure new prop
  setIsOverlayOpen, // Destructure new prop
  effectiveTargetKey, // Destructure new prop
}) => {
  const displayKey = formatKey(effectiveTargetKey, readerKeyPreference); // Use effectiveTargetKey here
  const keysToUse = readerKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT; // Determine keys based on preference

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-sm text-white py-2 px-4 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3 min-w-0">
        <Music className="w-4 h-4 text-indigo-400 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-sm font-black uppercase tracking-tight truncate leading-none">{song.name}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{song.artist || "Unknown Artist"}</p>
        </div>
      </div>
      
      {/* NEW: Key Signature Toggle */}
      <div className="flex items-center gap-2">
        <DropdownMenu onOpenChange={setIsOverlayOpen}>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-white/5 border-white/10 text-xs font-black font-mono h-8 px-3 rounded-xl text-indigo-400 gap-2 min-w-[60px]"
              title="Change Stage Key"
            >
              <span className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5" />
                {displayKey}
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

        <Button
          variant="ghost"
          size="icon"
          onClick={onExitFullScreen}
          className="rounded-full hover:bg-white/10 text-white/70 hover:text-white h-8 w-8 shrink-0"
          title="Exit Fullscreen (ESC)"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default FullScreenSongInfo;
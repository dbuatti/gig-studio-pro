"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { X, ChevronDown } from 'lucide-react'; // Removed Music icon
import { SetlistSong } from '@/components/SetlistManager';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils';
import { KeyPreference } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal } from "@/components/ui/dropdown-menu";

interface FullScreenSongInfoProps {
  song: SetlistSong;
  onExitFullScreen: () => void; // This prop now means 'onHideOverlay'
  readerKeyPreference: KeyPreference;
  onUpdateKey: (newTargetKey: string) => void;
  setIsOverlayOpen: (isOpen: boolean) => void;
  effectiveTargetKey: string;
}

const FullScreenSongInfo: React.FC<FullScreenSongInfoProps> = ({
  song,
  onExitFullScreen, // Renamed conceptually to onHideOverlay
  readerKeyPreference,
  onUpdateKey,
  setIsOverlayOpen,
  effectiveTargetKey,
}) => {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
      const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
      const day = now.getDate();
      const month = now.toLocaleDateString('en-US', { month: 'short' });
      setCurrentDate(`${weekday} ${day} ${month}`); // Format: "Fri 2 Jan"
    };

    updateDateTime(); // Set initial time
    const intervalId = setInterval(updateDateTime, 1000); // Update every second

    return () => clearInterval(intervalId);
  }, []);

  const displayKey = formatKey(effectiveTargetKey, readerKeyPreference);
  const keysToUse = readerKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-sm text-white py-2 px-4 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300 h-16">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col text-left">
          <span className="text-xs font-medium text-slate-300">
            {currentTime} {currentDate}
          </span>
          <h2 className="text-base font-black uppercase tracking-tight truncate leading-none">{song.name}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{song.artist || "Unknown Artist"}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <DropdownMenu onOpenChange={setIsOverlayOpen}>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-white/10 border-white/20 text-xs font-black font-mono h-9 px-3 rounded-xl text-indigo-400 gap-2 min-w-[60px]"
              title="Change Stage Key"
            >
              <span className="flex items-center gap-2">
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
          onClick={onExitFullScreen} // This now triggers hiding the info overlay
          className="rounded-full hover:bg-white/10 text-white/70 hover:text-white h-9 w-9 shrink-0"
          title="Hide Info Overlay"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default FullScreenSongInfo;
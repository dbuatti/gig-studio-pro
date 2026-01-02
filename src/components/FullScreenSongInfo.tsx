"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { X, Music } from 'lucide-react';
import { SetlistSong } from '@/components/SetlistManager';
import { formatKey } from '@/utils/keyUtils';
import { KeyPreference } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';

interface FullScreenSongInfoProps {
  song: SetlistSong;
  onExitFullScreen: () => void;
  readerKeyPreference: KeyPreference;
}

const FullScreenSongInfo: React.FC<FullScreenSongInfoProps> = ({
  song,
  onExitFullScreen,
  readerKeyPreference,
}) => {
  const displayKey = formatKey(song.targetKey || song.originalKey, readerKeyPreference);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-sm text-white py-2 px-4 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3 min-w-0">
        <Music className="w-4 h-4 text-indigo-400 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-sm font-black uppercase tracking-tight truncate leading-none">{song.name}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{song.artist || "Unknown Artist"} • {displayKey}</p>
        </div>
      </div>
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
  );
};

export default FullScreenSongInfo;
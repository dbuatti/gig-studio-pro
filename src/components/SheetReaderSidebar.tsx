"use client";

import React from 'react';
import { SetlistSong } from '@/components/SetlistManager';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X, Music, CheckCircle2, Volume2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useParams } from 'react-router-dom';

interface SheetReaderSidebarProps {
  songs: SetlistSong[];
  currentIndex: number;
  onSelectSong: (index: number) => void;
  isFullScreen: boolean;
  onToggleSidebar: () => void;
}

const SheetReaderSidebar: React.FC<SheetReaderSidebarProps> = ({
  songs,
  currentIndex,
  onSelectSong,
  isFullScreen,
  onToggleSidebar,
}) => {
  const { setlistId: routeSetlistId } = useParams<{ setlistId?: string }>();
  const isGigMode = routeSetlistId && routeSetlistId !== 'repertoire';

  return (
    <div className="h-full bg-slate-900 border-r border-slate-800 flex flex-col shadow-lg">
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
        <h2 className="text-xl font-black uppercase tracking-tight text-white">Setlist</h2>
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm italic gap-2">
            <Music className="w-8 h-8 opacity-20" />
            <p>No songs in this view.</p>
          </div>
        ) : (
          songs.map((song, index) => (
            <div
              key={song.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                index === currentIndex ? "bg-indigo-600 text-white shadow-md" : "hover:bg-slate-800 text-slate-300"
              )}
              onClick={() => onSelectSong(index)}
            >
              {isGigMode && (
                <span className={cn(
                  "text-sm font-black tracking-tight",
                  index === currentIndex ? "text-white" : "text-indigo-400"
                )}>
                  {(index + 1).toString().padStart(2, '0')}
                </span>
              )}
              <div className="flex-1">
                <p className={cn(
                  "text-sm font-black tracking-tight leading-tight",
                  index === currentIndex ? "text-white" : "text-slate-200"
                )}>
                  {song.name}
                </p>
                <p className={cn(
                  "text-[10px] font-black uppercase tracking-widest mt-0.5",
                  index === currentIndex ? "text-indigo-200" : "text-slate-400"
                )}>
                  {song.artist || "Unknown Artist"}
                </p>
              </div>
              {song.isPlayed && (
                <CheckCircle2 className={cn("w-4 h-4", index === currentIndex ? "text-indigo-200" : "text-emerald-500")} />
              )}
              {song.audio_url && (
                <Volume2 className={cn("w-4 h-4", index === currentIndex ? "text-indigo-200" : "text-slate-500")} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SheetReaderSidebar;
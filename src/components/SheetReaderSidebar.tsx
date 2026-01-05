"use client";

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SetlistSong } from '@/components/SetlistManager';
import { cn } from '@/lib/utils';
import { Music, CheckCircle2, Loader2, CloudDownload, AlertTriangle, ListMusic, PanelLeft } from 'lucide-react'; // Import PanelLeft
import { calculateReadiness } from '@/utils/repertoireSync';
import { Button } from '@/components/ui/button'; // Import Button

interface SheetReaderSidebarProps {
  songs: SetlistSong[];
  currentIndex: number;
  onSelectSong: (index: number) => void;
  isFullScreen?: boolean;
  onToggleSidebar: () => void; // Pass this prop down
}

const SheetReaderSidebar: React.FC<SheetReaderSidebarProps> = ({ songs, currentIndex, onSelectSong, isFullScreen, onToggleSidebar }) => {
  if (isFullScreen) return null; // Hide sidebar in full-screen mode

  return (
    <div className="w-full h-full bg-slate-900/80 backdrop-blur-xl border-r border-white/10 flex flex-col shrink-0">
      <div className="p-4 border-b border-white/10 shrink-0 flex items-center justify-between"> {/* Make it a flex container */}
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
          Repertoire ({songs.length})
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar} // This button will close the sidebar
          className="h-8 w-8 rounded-xl text-slate-400 hover:bg-white/10"
          title="Close Sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {songs.map((song, index) => {
            const isSelected = index === currentIndex;
            const readiness = calculateReadiness(song);
            const isReady = readiness === 100;
            const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
            const isExtractionFailed = song.extraction_status === 'failed';

            return (
              <button
                key={song.id}
                onClick={() => onSelectSong(index)}
                className={cn(
                  "w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 group",
                  isSelected 
                    ? "bg-indigo-600 text-white shadow-lg" 
                    : "hover:bg-white/5 text-slate-400 hover:text-white"
                )}
              >
                <div className="shrink-0">
                  {isProcessing ? (
                    <CloudDownload className="w-4 h-4 animate-bounce text-indigo-300" />
                  ) : isExtractionFailed ? (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  ) : isReady ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Music className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-black uppercase tracking-tight truncate", isSelected ? "text-white" : "text-slate-300 group-hover:text-white")}>
                    {song.name}
                  </p>
                  <p className={cn("text-[9px] font-bold uppercase tracking-widest truncate", isSelected ? "text-indigo-200" : "text-slate-500")}>
                    {song.artist || "Unknown"}
                  </p>
                </div>
                <span className={cn(
                  "text-[8px] font-mono font-black px-2 py-0.5 rounded-full shrink-0",
                  isSelected ? "bg-white/20 text-white" : "bg-white/5 text-slate-500"
                )}>
                  {readiness}%
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SheetReaderSidebar;
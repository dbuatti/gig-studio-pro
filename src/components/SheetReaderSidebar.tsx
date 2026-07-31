"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SetlistSong } from '@/components/SetlistManager';
import { cn } from '@/lib/utils';
import { Music, CheckCircle2, Loader2, CloudDownload, AlertTriangle, ListMusic, PanelLeft, Search, X } from 'lucide-react';
import { calculateReadiness } from '@/utils/repertoireSync';
import { normalizeSearch } from '@/utils/searchUtils';
import { Button } from '@/components/ui/button';

interface SheetReaderSidebarProps {
  songs: SetlistSong[];
  currentIndex: number;
  onSelectSong: (index: number) => void;
  isFullScreen?: boolean;
  onToggleSidebar: () => void;
  isOpen?: boolean;
}

const SheetReaderSidebar: React.FC<SheetReaderSidebarProps> = ({ songs, currentIndex, onSelectSong, isFullScreen, onToggleSidebar, isOpen }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  const filteredSongs = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    if (!q) return songs.map((song, index) => ({ song, index }));
    return songs
      .map((song, index) => ({ song, index }))
      .filter(({ song }) =>
        normalizeSearch(song.name).includes(q) ||
        normalizeSearch(song.artist || '').includes(q)
      );
  }, [songs, searchQuery]);

  if (isFullScreen) return null; // Hide sidebar in full-screen mode

  return (
    <div className="w-full h-full bg-slate-900/80 backdrop-blur-xl border-r border-white/10 flex flex-col shrink-0">
      <div className="p-4 border-b border-white/10 shrink-0 flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
          Repertoire ({searchQuery ? filteredSongs.length : songs.length})
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-8 w-8 rounded-xl text-slate-400 hover:bg-white/10"
          title="Close Sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </Button>
      </div>
      <div className="p-3 border-b border-white/10 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search songs..."
            aria-label="Search songs"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 rounded-md"
              aria-label="Clear search"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {filteredSongs.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500">No songs found</p>
              <p className="text-xs text-slate-600 mt-1">Try a different search.</p>
            </div>
          )}
          {filteredSongs.map(({ song, index }) => {
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
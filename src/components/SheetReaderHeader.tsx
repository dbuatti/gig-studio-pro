"use client";

import React, { useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils';
import { ArrowLeft, Search, ListMusic, ChevronDown, Minus, Plus, FileText, Headphones } from 'lucide-react';

interface SheetReaderHeaderProps {
  currentSong: SetlistSong | null;
  onClose: () => void;
  onOpenRepertoireSearch: () => void;
  onOpenCurrentSongStudio: () => void;
  isLoading: boolean;
  onUpdateKey: (newTargetKey: string) => void;
  setIsOverlayOpen: (isOpen: boolean) => void;
  pitch: number;
  setPitch: (pitch: number) => void;
  readerKeyPreference: 'sharps' | 'flats';
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  effectiveTargetKey: string;
  isAudioPlayerVisible: boolean;
  onToggleAudioPlayer: () => void;
  isFullScreen: boolean;
}

const SheetReaderHeader: React.FC<SheetReaderHeaderProps> = ({
  currentSong,
  onClose,
  onOpenRepertoireSearch,
  onOpenCurrentSongStudio,
  isLoading,
  onUpdateKey,
  setIsOverlayOpen,
  pitch,
  setPitch,
  readerKeyPreference,
  isSidebarOpen,
  onToggleSidebar,
  effectiveTargetKey,
  isAudioPlayerVisible,
  onToggleAudioPlayer,
  isFullScreen,
}) => {
  const displayKey = effectiveTargetKey ? formatKey(effectiveTargetKey, readerKeyPreference) : null;
  const keysToUse = readerKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;
  const activeKeyItemRef = useRef<HTMLDivElement>(null);

  const handleDropdownOpenChange = (open: boolean) => {
    setIsOverlayOpen(open);
    if (open && activeKeyItemRef.current) {
      setTimeout(() => {
        activeKeyItemRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-60 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300 h-[72px]",
        isFullScreen && "hidden"
      )}
    >
      {/* Left: Sidebar Toggle */}
      <div className="flex items-center">
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
      </div>

      {/* Center: Song Title + Action Buttons */}
      <div className="absolute inset-x-0 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto max-w-full">
          {isLoading ? (
            <Skeleton className="h-7 w-64 bg-white/10 rounded-lg" />
          ) : currentSong ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 shrink-0"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>

              <h2 className="text-lg font-black uppercase tracking-tight text-white truncate max-w-md px-2 text-center">
                {currentSong.name}
              </h2>

              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenCurrentSongStudio}
                disabled={!currentSong}
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 shrink-0"
                title="Open in Studio"
              >
                <FileText className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <p className="text-sm font-bold text-slate-500">No Song Selected</p>
          )}
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {currentSong && (
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPitch(pitch - 1)}
              className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400"
              title="Transpose Down"
            >
              <Minus className="w-4 h-4" />
            </Button>

            <DropdownMenu onOpenChange={handleDropdownOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="bg-transparent text-xs font-black font-mono h-9 px-3 rounded-lg text-indigo-400 gap-1.5 hover:bg-transparent min-w-[70px]"
                  title="Change Stage Key"
                >
                  <span className="flex items-center gap-1">
                    {displayKey || <Skeleton className="h-4 w-10 bg-white/10" />}
                    <span className="text-slate-400 text-[10px]">
                      {pitch > 0 ? `+${pitch}` : pitch < 0 ? pitch : ''}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white z-[300] max-h-60 overflow-y-auto custom-scrollbar">
                  <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    Stage Key
                  </DropdownMenuLabel>
                  {keysToUse.map((k) => (
                    <DropdownMenuItem
                      key={k}
                      onSelect={() => onUpdateKey(k)}
                      className={cn(
                        "font-mono font-bold cursor-pointer",
                        k === displayKey && "bg-indigo-600 text-white hover:bg-indigo-700"
                      )}
                      ref={k === displayKey ? activeKeyItemRef : null}
                    >
                      {k}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPitch(pitch + 1)}
              className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400"
              title="Transpose Up"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleAudioPlayer}
          className={cn(
            "h-10 w-10 rounded-xl transition-all",
            isAudioPlayerVisible ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white/5 hover:bg-white/10 text-slate-400"
          )}
          title="Toggle Audio Player (P)"
        >
          <Headphones className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenRepertoireSearch}
          className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400"
          title="Search Repertoire"
        >
          <Search className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default SheetReaderHeader;
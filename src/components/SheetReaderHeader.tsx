"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Music, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKey } from '@/utils/keyUtils';
import { SetlistSong } from './SetlistManager';
import { KeyPreference } from '@/hooks/use-settings';

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
}) => {
  const displayKey = formatKey(currentSong?.targetKey || currentSong?.originalKey, keyPreference);

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-white/10 text-slate-400">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onPrevSong} disabled={totalSongs === 0 || isLoading} className="h-9 w-9 rounded-lg hover:bg-white/10 text-slate-400">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center min-w-[100px]">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mx-auto" />
            ) : currentSong ? (
              <>
                <h2 className="text-lg font-black uppercase tracking-tight text-white truncate max-w-[150px]">{currentSong.name}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate max-w-[150px]">{currentSong.artist || "Unknown Artist"}</p>
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
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
            <Music className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-sm font-mono font-bold text-indigo-400">{displayKey}</span>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={onSearchClick} className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400">
          <Search className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default SheetReaderHeader;
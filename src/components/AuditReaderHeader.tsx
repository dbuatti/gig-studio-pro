"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from '@/lib/utils';
import { ArrowLeft, ListMusic, Headphones, Search, ShieldCheck, AlertCircle } from 'lucide-react';
import { SetlistSong } from '@/components/SetlistManager';

interface AuditReaderHeaderProps {
  currentSong: SetlistSong | null;
  onClose: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  isAudioPlayerVisible: boolean;
  onToggleAudioPlayer: () => void;
  onOpenRepertoireSearch: () => void;
}

const AuditReaderHeader: React.FC<AuditReaderHeaderProps> = ({
  currentSong,
  onClose,
  onToggleSidebar,
  isSidebarOpen,
  isAudioPlayerVisible,
  onToggleAudioPlayer,
  onOpenRepertoireSearch,
}) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex items-center justify-between shadow-lg h-[72px]">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className={cn(
            "h-10 w-10 rounded-xl transition-all",
            isSidebarOpen ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400"
          )}
        >
          <ListMusic className="w-5 h-5" />
        </Button>
        <div className="h-8 w-px bg-white/10 mx-2" />
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 p-2 rounded-lg">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">Audit Mode</h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Rehearsal & Quality Control</p>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white/5 text-slate-400"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          {currentSong ? (
            <div className="text-center">
              <h2 className="text-base font-black uppercase tracking-tight text-white truncate max-w-[300px]">
                {currentSong.name}
              </h2>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                {currentSong.artist || "Unknown Artist"}
              </p>
            </div>
          ) : (
            <Skeleton className="h-6 w-48 bg-white/5 rounded-lg" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleAudioPlayer}
          className={cn(
            "h-10 w-10 rounded-xl transition-all",
            isAudioPlayerVisible ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400"
          )}
        >
          <Headphones className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenRepertoireSearch}
          className="h-10 w-10 rounded-xl bg-white/5 text-slate-400"
        >
          <Search className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default AuditReaderHeader;
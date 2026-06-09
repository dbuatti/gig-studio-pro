"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Activity, Clock, Timer, Waves, AlignLeft, FileText, Keyboard, Edit3, X, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SetlistSong } from '../SetlistManager';

interface PerformanceHUDProps {
  songs: SetlistSong[];
  currentIndex: number;
  viewMode: 'visualizer' | 'pdf' | 'lyrics';
  setViewMode: (mode: 'visualizer' | 'pdf' | 'lyrics') => void;
  onClose: () => void;
  onOpenShortcutLegend: () => void;
  onEditClick: () => void;
  currentSong: SetlistSong;
  isWakeLockActive: boolean;
  wallClock: Date;
  elapsedSetTime: string;
  isMobile: boolean;
  onOpenMobileMenu: () => void;
}

const PerformanceHUD: React.FC<PerformanceHUDProps> = ({
  songs, currentIndex, viewMode, setViewMode, onClose, onOpenShortcutLegend, onEditClick,
  currentSong, isWakeLockActive, wallClock, elapsedSetTime, isMobile, onOpenMobileMenu
}) => {
  return (
    <div className="h-16 md:h-24 border-b border-white/10 px-4 md:px-10 flex items-center justify-between bg-slate-900/80 backdrop-blur-2xl shrink-0 shadow-2xl relative z-50">
      <div className="flex items-center gap-4 md:gap-12">
        <div className="flex items-center gap-3 md:gap-8">
          <div className="bg-indigo-600 p-2 md:p-3 rounded-xl shadow-2xl">
            <Activity className="w-6 h-6 md:w-10 md:h-10 animate-pulse text-white" />
          </div>
          <div>
            <h2 className="hidden sm:block text-[8px] md:text-[11px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-0.5 font-mono">Performance Engine</h2>
            <div className="flex items-center gap-2 md:gap-6">
              <span className="text-sm md:text-3xl font-black uppercase tracking-tighter">Active Stage</span>
              <div className="hidden sm:flex gap-1">
                {songs.map((_, i) => (
                  <div key={i} className={cn("h-1 md:h-2 w-2 md:w-8 rounded-full transition-all duration-700", i === currentIndex ? "bg-indigo-500 w-6 md:w-20 shadow-[0_0_15px_rgba(99,102,241,0.6)]" : i < currentIndex ? "bg-emerald-500/40" : "bg-white/10")} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-16 border-l border-white/10 pl-16 font-mono">
          <div className="flex items-center gap-5">
             <div className="p-3 bg-white/5 rounded-2xl"><Clock className="w-6 h-6 text-slate-500" /></div>
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-500 uppercase">Local Time</span>
                <span className="text-2xl font-black text-white">{wallClock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             </div>
          </div>
          <div className="flex items-center gap-5">
             <div className="p-3 bg-indigo-600/10 rounded-2xl"><Timer className="w-6 h-6 text-indigo-400" /></div>
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-indigo-400 uppercase">Set Duration</span>
                <span className="text-2xl font-black text-white">{elapsedSetTime}</span>
             </div>
          </div>
          {isWakeLockActive && (
            <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span className="text-[9px] font-black text-emerald-500 uppercase">Stay Awake Active</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-10">
        <div className="hidden md:flex bg-slate-950 p-1.5 rounded-[1.5rem] border border-white/10 shadow-inner font-mono">
          {[
            { id: 'visualizer', label: 'Matrix', icon: Waves, color: 'bg-indigo-600' },
            { id: 'lyrics', label: 'Lyrics', icon: AlignLeft, color: 'bg-pink-600', disabled: !currentSong?.lyrics },
            { id: 'pdf', label: 'Chart', icon: FileText, color: 'bg-emerald-600', disabled: !currentSong?.pdfUrl }
          ].map((mode) => (
            <Button key={mode.id} variant="ghost" size="sm" disabled={mode.disabled} onClick={() => setViewMode(mode.id as 'visualizer' | 'pdf' | 'lyrics')} className={cn("text-[10px] font-black uppercase tracking-widest h-10 px-6 gap-2.5 rounded-xl transition-all", viewMode === mode.id ? `${mode.color} text-white shadow-lg` : "text-slate-500 hover:text-white disabled:opacity-10")}>
              <mode.icon className="w-4 h-4" /> {mode.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {isMobile && <Button variant="ghost" size="icon" onClick={onOpenMobileMenu} className="rounded-xl bg-white/5 h-10 w-10"><Shield className="w-5 h-5 text-slate-400" /></Button>}
          <Button variant="ghost" size="icon" onClick={onOpenShortcutLegend} className="rounded-xl bg-white/5 hover:bg-white/10 h-10 w-10 md:h-14 md:w-14 transition-all"><Keyboard className="w-5 h-5 md:w-6 md:h-6 text-slate-400" /></Button>
          <Button variant="ghost" size="icon" onClick={onEditClick} className="rounded-xl bg-white/5 hover:bg-indigo-600 hover:text-white h-10 w-10 md:h-14 md:w-14 transition-all group"><Edit3 className="w-5 h-5 md:w-6 md:h-6 text-slate-400 group-hover:text-white" /></Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl md:rounded-2xl hover:bg-red-500/20 hover:text-red-400 h-10 w-10 md:h-14 md:w-14 transition-all"><X className="w-6 h-6 md:w-9 md:h-9" /></Button>
        </div>
      </div>
    </div>
  );
};

export default PerformanceHUD;
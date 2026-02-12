"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  Play, Pause, X, Sparkles, CheckCircle2, 
  CircleDashed, Loader2, ChevronLeft, Info,
  Music2, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SetlistSong, Setlist } from './SetlistManager';
import { KeyPreference } from '@/hooks/use-settings';
import { formatKey } from '@/utils/keyUtils';
import { calculateReadiness } from '@/utils/repertoireSync';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import MasteryRating from './MasteryRating';

interface SongStudioConsolidatedHeaderProps {
  formData: Partial<SetlistSong>;
  isPlaying: boolean;
  isLoadingAudio: boolean;
  onTogglePlayback: () => void;
  pitch: number;
  targetKey: string;
  globalKeyPreference: KeyPreference;
  onClose: () => void;
  onOpenProSync: () => void;
  gigId: string | 'library';
  allSetlists: Setlist[];
  onUpdateSetlistSongs?: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  onAutoSave: (updates: Partial<SetlistSong>) => void;
}

const SongStudioConsolidatedHeader: React.FC<SongStudioConsolidatedHeaderProps> = ({
  formData,
  isPlaying,
  isLoadingAudio,
  onTogglePlayback,
  targetKey,
  globalKeyPreference,
  onClose,
  onOpenProSync,
  onAutoSave
}) => {
  const isApproved = formData.isApproved || false;
  const displayKey = formatKey(targetKey || formData.originalKey || 'C', formData.key_preference || globalKeyPreference);
  const readinessScore = calculateReadiness(formData);

  return (
    <div className="h-28 bg-slate-950/90 border-b border-white/10 px-6 flex items-center justify-between backdrop-blur-3xl sticky top-0 z-[100] gap-4">
      {/* Left Section: Identity - Increased flex weight to prevent truncation */}
      <div className="flex items-center gap-4 flex-[1.5] min-w-0">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-10 w-10 rounded-xl text-slate-500 hover:bg-white/5 hover:text-white transition-all shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl shrink-0">
              <Music2 className="w-4 h-4 text-indigo-400" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-white leading-none whitespace-nowrap">
              {formData.name || "Untitled Track"}
            </h2>
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[8px] mt-2 ml-9 truncate">
            {formData.artist || "Unknown Artist"}
          </p>
        </div>
      </div>

      {/* Center Section: Performance Metrics & Playback - More compact */}
      <div className="flex items-center gap-2 bg-white/[0.02] p-1 rounded-[2rem] border border-white/5 shadow-2xl shrink-0">
        <Button
          onClick={onTogglePlayback}
          disabled={isLoadingAudio}
          className={cn(
            "h-12 px-6 rounded-[1.75rem] font-black uppercase tracking-widest text-[10px] gap-2.5 shadow-2xl transition-all active:scale-95 shrink-0",
            isPlaying 
              ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/40" 
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/40"
          )}
        >
          {isLoadingAudio ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          {isPlaying ? "Stop" : "Preview"}
        </Button>

        <div className="flex items-center gap-1.5 px-1">
          {/* Key Badge */}
          <div className="flex flex-col items-center justify-center w-16 h-12 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Key</span>
            <span className="text-xs font-mono font-black text-indigo-400">{displayKey}</span>
          </div>

          {/* Mastery Badge */}
          <div className="flex flex-col items-center justify-center px-3 h-12 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Mastery</span>
            <MasteryRating 
              value={formData.comfort_level || 0} 
              onChange={(val) => onAutoSave({ comfort_level: val })}
              size="sm"
            />
          </div>

          {/* Readiness Badge */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center justify-center w-20 h-12 bg-white/5 rounded-xl border border-white/5 cursor-help group hover:bg-white/10 transition-colors">
                  <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Ready</span>
                  <div className="flex items-center gap-1">
                    <Activity className={cn(
                      "w-2.5 h-2.5",
                      readinessScore >= 90 ? "text-emerald-400" : readinessScore >= 60 ? "text-amber-400" : "text-red-400"
                    )} />
                    <span className={cn(
                      "text-xs font-mono font-black",
                      readinessScore >= 90 ? "text-emerald-400" : readinessScore >= 60 ? "text-amber-400" : "text-red-400"
                    )}>
                      {readinessScore}%
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-white/10 text-[10px] font-black uppercase p-3 rounded-xl">
                Preparation score based on audio, charts, and mastery
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Right Section: Actions - Tightened spacing */}
      <div className="flex items-center justify-end gap-3 flex-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => onAutoSave({ isApproved: !isApproved })}
                className={cn(
                  "h-12 px-5 rounded-[1.75rem] font-black uppercase tracking-widest text-[9px] gap-2.5 transition-all border-2",
                  isApproved 
                    ? "bg-emerald-600/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]" 
                    : "bg-slate-900 border-white/5 text-slate-500 hover:bg-white/5 hover:text-slate-300"
                )}
              >
                {isApproved ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <CircleDashed className="w-3.5 h-3.5" />
                )}
                {isApproved ? "Approved" : "Approve"}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-white/10 text-[10px] font-black uppercase">
              {isApproved ? "Song is ready for performance" : "Mark as ready for performance"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button
          variant="outline"
          onClick={onOpenProSync}
          className="h-12 px-5 rounded-[1.75rem] font-black uppercase tracking-widest text-[9px] gap-2.5 text-indigo-400 border-white/5 bg-white/5 hover:bg-white/10 hover:border-indigo-500/30 transition-all shadow-xl"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Pro Sync
        </Button>

        <div className="w-px h-8 bg-white/10 mx-1" />

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-10 w-10 rounded-xl text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all shrink-0"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default SongStudioConsolidatedHeader;
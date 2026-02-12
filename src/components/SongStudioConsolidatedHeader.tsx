"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  Play, Pause, X, Sparkles, CheckCircle2, 
  CircleDashed, Loader2, ChevronLeft, Info 
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
    <div className="h-24 bg-slate-900/50 border-b border-white/5 px-8 flex items-center justify-between backdrop-blur-xl">
      <div className="flex items-center gap-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-12 w-12 rounded-2xl text-slate-400 hover:bg-white/5 hover:text-white transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        <div className="flex flex-col">
          <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-none truncate max-w-[300px]">
            {formData.name || "Untitled Track"}
          </h2>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">
            {formData.artist || "Unknown Artist"}
          </p>
        </div>

        <div className="h-10 w-px bg-white/5 mx-2" />

        <div className="flex items-center gap-4">
          <Button
            onClick={onTogglePlayback}
            disabled={isLoadingAudio}
            className={cn(
              "h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-3 shadow-2xl transition-all active:scale-95",
              isPlaying ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
            )}
          >
            {isLoadingAudio ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            {isPlaying ? "Pause" : "Preview"}
          </Button>

          <div className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Stage Key</span>
            <span className="text-sm font-mono font-black text-indigo-400">{displayKey}</span>
          </div>

          <div className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Mastery</span>
            <MasteryRating 
              value={formData.comfort_level || 0} 
              onChange={(val) => onAutoSave({ comfort_level: val })}
              size="md"
            />
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-2xl border border-white/5 cursor-help">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Readiness</span>
                  <span className={cn(
                    "text-sm font-mono font-black flex items-center gap-1.5",
                    readinessScore >= 90 ? "text-emerald-400" : readinessScore >= 60 ? "text-amber-400" : "text-red-400"
                  )}>
                    {readinessScore}%
                    <Info className="w-3 h-3 opacity-50" />
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-white/10 text-[10px] font-black uppercase">
                Calculated based on audio, charts, and mastery
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => onAutoSave({ isApproved: !isApproved })}
                className={cn(
                  "h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-3 transition-all border-2",
                  isApproved 
                    ? "bg-emerald-600/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/20" 
                    : "bg-slate-900 border-white/5 text-slate-400 hover:bg-white/5"
                )}
              >
                {isApproved ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <CircleDashed className="w-4 h-4" />
                )}
                {isApproved ? "Gig Approved" : "Approve for Gig"}
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
          className="h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-3 text-indigo-400 border-white/5 bg-white/5 hover:bg-white/10 transition-all"
        >
          <Sparkles className="w-4 h-4" />
          Pro Sync
        </Button>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-12 w-12 rounded-2xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};

export default SongStudioConsolidatedHeader;
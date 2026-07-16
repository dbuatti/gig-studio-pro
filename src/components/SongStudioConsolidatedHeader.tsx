"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Play, Pause, Sparkles, Globe,
  Check, Loader2, Save, Share2, MoreHorizontal,
  CloudUpload, Activity, Music, X, ShieldCheck,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { SetlistSong, Setlist } from './SetlistManager';
import { cn } from '@/lib/utils';
import SetlistMultiSelector from './SetlistMultiSelector';
import { formatKey } from '@/utils/keyUtils';
import { KeyPreference } from '@/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { calculateReadiness } from '@/utils/repertoireSync';

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
  isSaving?: boolean;
  currentIndex?: number;
  totalSongs?: number;
  onPrev?: () => void;
  onNext?: () => void;
}

const SongStudioConsolidatedHeader: React.FC<SongStudioConsolidatedHeaderProps> = ({
  formData,
  isPlaying,
  isLoadingAudio,
  onTogglePlayback,
  pitch,
  targetKey,
  globalKeyPreference,
  onClose,
  onOpenProSync,
  gigId,
  allSetlists,
  onUpdateSetlistSongs,
  onAutoSave,
  isSaving = false,
  currentIndex,
  totalSongs,
  onPrev,
  onNext
}) => {
  const isMobile = useIsMobile();
  const [showSynced, setShowSynced] = useState(false);

  useEffect(() => {
    if (isSaving) {
      setShowSynced(false);
    } else if (!isSaving && formData.id) {
      setShowSynced(true);
      const timer = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSaving, formData.id]);

  const currentPref = formData.key_preference || globalKeyPreference;
  const displayTargetKey = formatKey(targetKey || formData.originalKey || 'C', currentPref === 'neutral' ? 'sharps' : currentPref);
  const readinessScore = calculateReadiness(formData);

  const getReadinessColor = (score: number) => {
    if (score < 25) return '#ef4444';
    if (score < 50) return '#f97316';
    if (score < 75) return '#eab308';
    return '#22c55e';
  };

  const readinessColor = getReadinessColor(readinessScore);
  const circleRadius = 12;
  const circumference = 2 * Math.PI * circleRadius;
  const dashOffset = circumference - (readinessScore / 100) * circumference;

  const ReadinessCircle = () => (
    <div className="relative inline-flex items-center justify-center">
      <svg width="32" height="32" className="-rotate-90">
        <circle
          cx="16" cy="16" r={circleRadius}
          fill="none" stroke="currentColor" strokeWidth="3"
          className="text-white/10"
        />
        <circle
          cx="16" cy="16" r={circleRadius}
          fill="none" stroke={readinessColor} strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-[8px] font-black text-white tabular-nums">{readinessScore}</span>
    </div>
  );

  return (
    <div className="bg-slate-950 border-b border-white/10 px-4 md:px-8 py-3 md:py-3 flex items-center justify-between gap-3 md:gap-4 shadow-2xl relative z-50 h-auto md:h-[72px]">
      {/* Left: Back & Title */}
      <div className="flex items-center gap-4 md:gap-6 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 shrink-0 transition-all active:scale-90"
          title="Back to Dashboard"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
        </Button>

        {currentIndex !== undefined && totalSongs !== undefined && totalSongs > 1 && (
          <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-xl border border-white/5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev}
              disabled={currentIndex === 0}
              className="h-7 w-7 md:h-8 md:w-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
              title="Previous Song (Left Arrow)"
              aria-label="Previous song"
            >
              <ChevronLeft className="w-3 h-3 md:w-4 md:h-4" />
            </Button>
            <span className="text-[9px] md:text-[10px] font-black text-slate-500 px-0.5 select-none">
              {currentIndex + 1} / {totalSongs}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={currentIndex === totalSongs - 1}
              className="h-7 w-7 md:h-8 md:w-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
              title="Next Song (Right Arrow)"
              aria-label="Next song"
            >
              <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
            </Button>
          </div>
        )}
        
        <div className="hidden sm:block h-8 w-px bg-white/10 mx-1" />

        <div className="min-w-0">
          <div className="flex items-center gap-3 md:gap-4">
            <h2 className="text-sm md:text-xl font-black uppercase tracking-tight text-white truncate leading-none">
              {formData.name || "Untitled Track"}
            </h2>
            {formData.isMetadataConfirmed && <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />}
            {(isSaving || showSynced) && (
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all duration-500 shrink-0",
                isSaving ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"
              )}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-2.5 h-2.5 md:w-3 md:h-3 animate-spin" />
                    <span className="hidden xs:inline">Syncing</span>
                  </>
                ) : (
                  <>
                    <Check className="w-2.5 h-2.5 md:w-3 md:h-3" />
                    <span className="hidden xs:inline">Synced</span>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1 truncate">
            {formData.artist || "Unknown Artist"}
          </p>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <div className="hidden lg:flex items-center gap-5 px-5 py-2 bg-white/5 rounded-xl border border-white/5 mr-1 shadow-inner">
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Readiness</p>
            <ReadinessCircle />
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Stage Key</p>
            <div className="flex items-center gap-2">
              <Music className="w-3 h-3 text-indigo-400" />
              <p className="text-base font-mono font-black text-white leading-none">{displayTargetKey}</p>
            </div>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pitch Shift</p>
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-emerald-400" />
              <p className="text-base font-mono font-black text-white leading-none">{pitch > 0 ? '+' : ''}{pitch}</p>
            </div>
          </div>
        </div>

        <Button 
          onClick={onTogglePlayback}
          disabled={isLoadingAudio}
          className={cn(
            "h-10 md:h-12 px-4 md:px-8 rounded-xl font-black uppercase tracking-widest text-[9px] md:text-[10px] gap-2 md:gap-3 shadow-2xl transition-all active:scale-95",
            isPlaying 
              ? "bg-red-600 hover:bg-red-700 shadow-red-600/30" 
              : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30"
          )}
        >
          {isLoadingAudio ? (
            <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin text-white" />
          ) : isPlaying ? (
            <Pause className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current ml-0.5" />
          )}
          <span className="hidden xs:inline">{isPlaying ? "Stop" : "Preview"}</span>
        </Button>

        <div className="flex items-center gap-2 md:gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onOpenProSync}
            className="h-10 md:h-12 px-3 md:px-6 rounded-xl text-indigo-400 border-white/10 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[9px] md:text-[10px] gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Pro Sync</span>
          </Button>

          <SetlistMultiSelector
            songMasterId={formData.master_id || formData.id || ''}
            allSetlists={allSetlists}
            songToAssign={formData as SetlistSong}
            onUpdateSetlistSongs={onUpdateSetlistSongs}
          />
        </div>
      </div>
    </div>
  );
};

export default SongStudioConsolidatedHeader;
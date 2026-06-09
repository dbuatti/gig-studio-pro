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

  return (
    <div className="bg-slate-950 border-b border-white/10 px-4 md:px-8 py-4 md:py-5 flex items-center justify-between gap-4 md:gap-6 shadow-2xl relative z-50 h-auto md:h-[88px]">
      {/* Left: Back & Title */}
      <div className="flex items-center gap-4 md:gap-6 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 shrink-0 transition-all active:scale-90"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
        </Button>

        {currentIndex !== undefined && totalSongs !== undefined && totalSongs > 1 && (
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev}
              disabled={currentIndex === 0}
              className="h-8 w-8 md:h-10 md:w-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
              title="Previous Song (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
            <span className="text-[10px] md:text-xs font-black text-slate-500 px-1 select-none">
              {currentIndex + 1} / {totalSongs}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={currentIndex === totalSongs - 1}
              className="h-8 w-8 md:h-10 md:w-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
              title="Next Song (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </div>
        )}
        
        <div className="hidden sm:block h-10 w-px bg-white/10 mx-1" />

        <div className="min-w-0">
          <div className="flex items-center gap-3 md:gap-4">
            <h2 className="text-base md:text-2xl font-black uppercase tracking-tight text-white truncate leading-none">
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
          <p className="text-[9px] md:text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1.5 truncate">
            {formData.artist || "Unknown Artist"}
          </p>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3 md:gap-6 shrink-0">
        <div className="hidden lg:flex items-center gap-8 px-8 py-3 bg-white/5 rounded-[1.5rem] border border-white/5 mr-2 shadow-inner">
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Stage Key</p>
            <div className="flex items-center gap-2">
              <Music className="w-3.5 h-3.5 text-indigo-400" />
              <p className="text-lg font-mono font-black text-white leading-none">{displayTargetKey}</p>
            </div>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pitch Shift</p>
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-lg font-mono font-black text-white leading-none">{pitch > 0 ? '+' : ''}{pitch}</p>
            </div>
          </div>
        </div>

        <Button 
          onClick={onTogglePlayback}
          disabled={isLoadingAudio}
          className={cn(
            "h-11 md:h-14 px-5 md:px-10 rounded-2xl md:rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] md:text-[11px] gap-3 md:gap-4 shadow-2xl transition-all active:scale-95",
            isPlaying 
              ? "bg-red-600 hover:bg-red-700 shadow-red-600/30" 
              : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30"
          )}
        >
          {isLoadingAudio ? (
            <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin text-white" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current" />
          ) : (
            <Play className="w-4 h-4 md:w-5 md:h-5 fill-current ml-1" />
          )}
          <span className="hidden xs:inline">{isPlaying ? "Stop" : "Preview"}</span>
        </Button>

        <div className="flex items-center gap-2 md:gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onOpenProSync}
            className="h-11 md:h-14 px-4 md:px-8 rounded-2xl md:rounded-[1.5rem] text-indigo-400 border-white/10 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[10px] md:text-[11px] gap-3"
          >
            <Sparkles className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">Pro Sync</span>
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
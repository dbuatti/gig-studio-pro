"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Play, Pause, Sparkles, Globe, 
  Check, Loader2, Save, Share2, MoreHorizontal,
  CloudUpload, Activity, Music
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
  isSaving = false
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
    <div className="bg-slate-950 border-b border-white/10 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-4 shadow-2xl relative z-50 h-auto md:h-[72px]">
      {/* Left: Back & Title */}
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 shrink-0 transition-all active:scale-90"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
        
        <div className="hidden sm:block h-8 w-px bg-white/10 mx-1" />

        <div className="min-w-0">
          <div className="flex items-center gap-2 md:gap-3">
            <h2 className="text-sm md:text-lg font-black uppercase tracking-tight text-white truncate">
              {formData.name || "Untitled Track"}
            </h2>
            {(isSaving || showSynced) && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] md:text-[8px] font-black uppercase tracking-widest transition-all duration-500 shrink-0",
                isSaving ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"
              )}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-2 h-2 md:w-2.5 md:h-2.5 animate-spin" />
                    <span className="hidden xs:inline">Syncing</span>
                  </>
                ) : (
                  <>
                    <Check className="w-2 h-2 md:w-2.5 md:h-2.5" />
                    <span className="hidden xs:inline">Synced</span>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">
            {formData.artist || "Unknown Artist"}
          </p>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <div className="hidden lg:flex items-center gap-6 px-6 py-2 bg-white/5 rounded-2xl border border-white/5 mr-2 shadow-inner">
          <div className="text-center">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Stage Key</p>
            <div className="flex items-center gap-1.5">
              <Music className="w-3 h-3 text-indigo-400" />
              <p className="text-sm font-mono font-black text-white">{displayTargetKey}</p>
            </div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Pitch Shift</p>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-emerald-400" />
              <p className="text-sm font-mono font-black text-white">{pitch > 0 ? '+' : ''}{pitch}</p>
            </div>
          </div>
        </div>

        <Button 
          onClick={onTogglePlayback}
          disabled={isLoadingAudio}
          className={cn(
            "h-10 md:h-12 px-4 md:px-8 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[9px] md:text-[10px] gap-2 md:gap-3 shadow-xl transition-all active:scale-95",
            isPlaying 
              ? "bg-red-600 hover:bg-red-700 shadow-red-600/20" 
              : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
          )}
        >
          {isLoadingAudio ? (
            <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" />
          ) : (
            <Play className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" />
          )}
          <span className="hidden xs:inline">{isPlaying ? "Stop" : "Preview"}</span>
        </Button>

        <div className="flex items-center gap-1.5 md:gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onOpenProSync}
            className="h-10 md:h-12 px-3 md:px-6 rounded-xl md:rounded-2xl text-indigo-400 border-white/5 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[9px] md:text-[10px] gap-2 md:gap-2.5"
          >
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Pro Sync</span>
          </Button>

          <SetlistMultiSelector
            songMasterId={formData.master_id || formData.id || ''}
            allSetlists={allSetlists}
            songToAssign={formData as any}
            onUpdateSetlistSongs={onUpdateSetlistSongs}
          />
        </div>
      </div>
    </div>
  );
};

export default SongStudioConsolidatedHeader;
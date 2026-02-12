"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, X, Sparkles, Loader2, Music, CheckCircle2 } from 'lucide-react';
import { SetlistSong, Setlist } from './SetlistManager';
import { KeyPreference } from '@/hooks/use-settings';
import { formatKey } from '@/utils/keyUtils';
import { cn } from '@/lib/utils';
import SetlistMultiSelector from './SetlistMultiSelector';

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
  pitch,
  targetKey,
  globalKeyPreference,
  onClose,
  onOpenProSync,
  gigId,
  allSetlists,
  onUpdateSetlistSongs,
  onAutoSave
}) => {
  const currentPref = formData.key_preference || globalKeyPreference;
  const displayKey = formatKey(targetKey || formData.originalKey || 'C', currentPref === 'neutral' ? 'sharps' : currentPref);

  return (
    <div className="h-24 bg-slate-900/50 border-b border-white/5 px-8 flex items-center justify-between backdrop-blur-xl">
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <div className="bg-indigo-600/20 p-3 rounded-2xl border border-indigo-500/20">
          <Music className="w-6 h-6 text-indigo-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black uppercase tracking-tight text-white truncate">
              {formData.name || "Untitled Track"}
            </h2>
            {formData.isMetadataConfirmed && (
              <CheckCircle2 className="w-4 h-4 text-indigo-400 fill-indigo-400/10" />
            )}
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 truncate">
            {formData.artist || "Unknown Artist"} • {displayKey}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 px-8 border-x border-white/5 h-full">
        <Button
          onClick={onTogglePlayback}
          disabled={isLoadingAudio}
          className={cn(
            "h-14 w-14 rounded-full shadow-2xl transition-all active:scale-90",
            isPlaying ? "bg-red-600 hover:bg-red-500 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"
          )}
        >
          {isLoadingAudio ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-1" />
          )}
        </Button>

        <div className="flex flex-col items-center gap-1 min-w-[80px]">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Stage Key</span>
          <div className={cn(
            "font-mono font-black text-sm px-3 py-1 rounded-xl border",
            formData.isKeyConfirmed ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30" : "bg-indigo-600/20 text-indigo-400 border-indigo-500/30"
          )}>
            {displayKey}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-1 justify-end">
        {onUpdateSetlistSongs && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mr-1">Add to Setlist</span>
            <SetlistMultiSelector
              songMasterId={formData.master_id || formData.id || ''}
              allSetlists={allSetlists}
              songToAssign={formData as SetlistSong}
              onUpdateSetlistSongs={onUpdateSetlistSongs}
            />
          </div>
        )}

        <Button
          variant="outline"
          onClick={onOpenProSync}
          className="h-11 px-6 rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 text-indigo-400 font-black uppercase tracking-widest text-[10px] gap-2.5"
        >
          <Sparkles className="w-4 h-4" />
          Pro Sync
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-11 w-11 rounded-2xl text-slate-400 hover:text-white hover:bg-white/5"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};

export default SongStudioConsolidatedHeader;
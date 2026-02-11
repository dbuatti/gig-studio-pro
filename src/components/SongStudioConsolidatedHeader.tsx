"use client";

import React from 'react';
import { Play, Pause, X, Sparkles, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetlistSong, Setlist } from './SetlistManager';
import { cn } from '@/lib/utils';
import MasteryRating from './MasteryRating';
import { formatKey } from '@/utils/keyUtils';
import { KeyPreference } from '@/hooks/use-settings';

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
  onAutoSave
}) => {
  const displayKey = formatKey(targetKey || formData.originalKey || 'C', formData.key_preference || globalKeyPreference);

  return (
    <div className="bg-slate-900 border-b border-white/5 px-6 py-4 flex items-center justify-between gap-6">
      <div className="flex items-center gap-4 min-w-0">
        <Button
          onClick={onTogglePlayback}
          disabled={isLoadingAudio}
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-xl",
            isPlaying 
              ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20" 
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
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

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black uppercase tracking-tight text-white truncate">
              {formData.name || "Untitled Track"}
            </h2>
            {formData.isMetadataConfirmed && <ShieldCheck className="w-4 h-4 text-indigo-400" />}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] truncate">
              {formData.artist || "Unknown Artist"}
            </p>
            <span className="text-slate-700 text-[8px]">•</span>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Mastery</span>
              <MasteryRating 
                value={formData.comfort_level || 0} 
                onChange={(val) => onAutoSave({ comfort_level: val })}
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="flex flex-col items-center px-4 border-x border-white/5">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Stage Key</span>
          <div className={cn(
            "px-3 py-1 rounded-lg font-mono font-black text-sm flex items-center gap-2",
            formData.isKeyConfirmed ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
          )}>
            {displayKey}
            {formData.isKeyConfirmed && <CheckCircle2 className="w-3 h-3" />}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenProSync}
          className="h-10 px-4 rounded-xl border-white/10 bg-white/5 text-indigo-400 hover:bg-white/10 hover:text-indigo-300 font-black uppercase tracking-widest text-[10px] gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Pro Sync
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="w-10 h-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default SongStudioConsolidatedHeader;
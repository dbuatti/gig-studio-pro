"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  Music, 
  Play, 
  Pause, 
  X, 
  Sparkles, 
  Loader2
} from 'lucide-react';
import { SetlistSong, Setlist } from './SetlistManager';
import { cn } from '@/lib/utils';
import SetlistMultiSelector from './SetlistMultiSelector';
import { formatKey } from '@/utils/keyUtils';

interface SongStudioConsolidatedHeaderProps {
  formData: Partial<SetlistSong>;
  isPlaying: boolean;
  isLoadingAudio: boolean;
  onTogglePlayback: () => void;
  pitch: number;
  targetKey: string;
  globalKeyPreference: 'sharps' | 'flats' | 'neutral';
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
  const displayKey = formatKey(targetKey || formData.originalKey || 'C', globalKeyPreference === 'neutral' ? 'sharps' : globalKeyPreference);

  return (
    <div className="h-24 bg-slate-950 border-b border-white/5 flex items-center justify-between px-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-full bg-indigo-600/5 blur-[100px] pointer-events-none" />

      <div className="flex items-center gap-6 relative z-10">
        <div className="bg-indigo-600/10 p-3 rounded-2xl border border-indigo-500/20 shadow-lg shadow-indigo-900/20">
          <Music className="w-6 h-6 text-indigo-400" />
        </div>
        
        <div className="flex flex-col">
          <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-none truncate max-w-[400px]">
            {formData.name || "Untitled Track"}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
              {formData.artist || "Unknown Artist"}
            </p>
            
            {/* The requested Setlist Selector */}
            {onUpdateSetlistSongs && (
              <SetlistMultiSelector
                songMasterId={formData.master_id || formData.id || ''}
                allSetlists={allSetlists}
                songToAssign={formData as SetlistSong}
                onUpdateSetlistSongs={onUpdateSetlistSongs}
                className="h-5 w-5 p-0 opacity-40 hover:opacity-100 hover:text-indigo-400 transition-all"
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 relative z-10">
        {/* Key Display */}
        <div className="flex flex-col items-center px-6 border-r border-white/5">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Stage Key</span>
          <div className={cn(
            "font-mono font-black text-lg px-4 py-1 rounded-xl border transition-all",
            formData.isKeyConfirmed ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/30" : "bg-indigo-600/10 text-indigo-400 border-indigo-500/30"
          )}>
            {displayKey}
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-4">
          <Button
            onClick={onOpenProSync}
            variant="ghost"
            className="h-12 px-6 rounded-2xl text-indigo-400 hover:bg-indigo-500/10 font-black uppercase tracking-widest text-[10px] gap-2"
          >
            <Sparkles className="w-4 h-4" /> Pro Sync
          </Button>

          <Button
            onClick={onTogglePlayback}
            disabled={isLoadingAudio}
            className={cn(
              "h-14 w-14 rounded-full shadow-2xl transition-all active:scale-90 flex items-center justify-center",
              isPlaying ? "bg-red-600 hover:bg-red-500 shadow-red-600/20" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
            )}
          >
            {isLoadingAudio ? (
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            ) : isPlaying ? (
              <Pause className="w-6 h-6 text-white fill-current" />
            ) : (
              <Play className="w-6 h-6 text-white fill-current ml-1" />
            )}
          </Button>

          <div className="w-px h-8 bg-white/5 mx-2" />

          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-2xl text-slate-500 hover:text-white hover:bg-white/5"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SongStudioConsolidatedHeader;
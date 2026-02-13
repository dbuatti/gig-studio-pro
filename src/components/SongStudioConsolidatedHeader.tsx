"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Play, Pause, Sparkles, Globe, 
  Check, Loader2, Save, Share2, MoreHorizontal,
  CloudUpload
} from 'lucide-react';
import { SetlistSong, Setlist } from './SetlistManager';
import { cn } from '@/lib/utils';
import SetlistMultiSelector from './SetlistMultiSelector';
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
  gigId,
  allSetlists,
  onUpdateSetlistSongs,
  onAutoSave
}) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Monitor formData changes to show saving status
  useEffect(() => {
    if (saveStatus === 'idle') return;
    const timer = setTimeout(() => setSaveStatus('saved'), 800);
    const hideTimer = setTimeout(() => setSaveStatus('idle'), 3000);
    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, [formData]);

  // Intercept auto-save to show status
  const handleSaveWithStatus = (updates: Partial<SetlistSong>) => {
    setSaveStatus('saving');
    onAutoSave(updates);
  };

  const currentPref = formData.key_preference || globalKeyPreference;
  const displayTargetKey = formatKey(targetKey || formData.originalKey || 'C', currentPref === 'neutral' ? 'sharps' : currentPref);

  return (
    <div className="bg-slate-950 border-b border-white/10 px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-10 w-10 rounded-xl text-slate-400 hover:bg-white/5 shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black uppercase tracking-tight text-white truncate">
              {formData.name || "Untitled Track"}
            </h2>
            {saveStatus !== 'idle' && (
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all duration-300",
                saveStatus === 'saving' ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"
              )}>
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Check className="w-2.5 h-2.5" />
                    Saved
                  </>
                )}
              </div>
            )}
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
            {formData.artist || "Unknown Artist"} • {formData.genre || "No Genre"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/5 mr-2">
          <div className="text-center">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Stage Key</p>
            <p className="text-xs font-mono font-black text-indigo-400">{displayTargetKey}</p>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="text-center">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Pitch</p>
            <p className="text-xs font-mono font-black text-emerald-400">{pitch > 0 ? '+' : ''}{pitch}</p>
          </div>
        </div>

        <Button 
          onClick={onTogglePlayback}
          disabled={isLoadingAudio}
          className={cn(
            "h-11 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-2.5 shadow-xl transition-all active:scale-95",
            isPlaying ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
          )}
        >
          {isLoadingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          {isPlaying ? "Pause" : "Preview"}
        </Button>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onOpenProSync}
            className="h-11 px-5 rounded-2xl text-indigo-400 border-white/5 bg-white/5 hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[10px] gap-2"
          >
            <Sparkles className="w-4 h-4" /> Pro Sync
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
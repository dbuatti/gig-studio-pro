"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { formatKey } from '@/utils/keyUtils';
import { KeyPreference } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { Play, Pause, Music, Hash, Activity, Loader2, Check, ArrowLeft, Globe, ListMusic, Edit3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import SetlistMultiSelector from './SetlistMultiSelector';
import { Setlist } from './SetlistManager';

interface SongStudioHeaderProps {
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
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  onAutoSave: (updates: Partial<SetlistSong>) => void;
}

const SongStudioHeader: React.FC<SongStudioHeaderProps> = ({
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
}) => {
  const currentPref = formData.key_preference || globalKeyPreference;
  const displayOrigKey = formatKey(formData.originalKey, currentPref);
  const displayTargetKey = formatKey(targetKey, currentPref);

  return (
    <div className="bg-slate-900 border-b border-white/5 flex flex-col shrink-0 shadow-lg">
      {/* Top Row: Navigation, Title, Actions */}
      <div className="h-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 rounded-2xl bg-white/5"><ArrowLeft className="w-5 h-5 text-slate-400" /></Button>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{gigId === 'library' ? 'MASTER' : 'GIG'}</p>
            <h2 className="text-xl font-black uppercase text-white truncate max-w-[250px]">
              {formData.name || "Untitled Track"}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={onOpenProSync}
            className="h-11 px-4 rounded-xl border-indigo-500/20 bg-indigo-600/10 text-indigo-400 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg hover:bg-indigo-600 hover:text-white transition-all"
          >
            <Globe className="w-4 h-4" /> Pro Sync
          </Button>

          {gigId === 'library' && formData.id ? (
            <SetlistMultiSelector 
              songMasterId={formData.id} 
              allSetlists={allSetlists} 
              songToAssign={formData as SetlistSong} 
              onUpdateSetlistSongs={onUpdateSetlistSongs} 
            />
          ) : (
            <div className="flex items-center gap-3 bg-white/5 px-4 h-11 rounded-xl border border-white/10">
              <Label className="text-[8px] font-black text-slate-500 uppercase">Gig Approved</Label>
              <Switch 
                checked={formData.isApproved || false} 
                onCheckedChange={(v) => onAutoSave({ isApproved: v })} 
                className="data-[state=checked]:bg-emerald-500" 
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Playback and Metrics */}
      <div className="flex items-center justify-between p-4 bg-slate-900/50 border-t border-white/5 shadow-lg shrink-0">
        <div className="flex items-center gap-6 min-w-0">
          <Button 
            onClick={onTogglePlayback}
            disabled={isLoadingAudio || !formData.previewUrl}
            className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg transition-all active:scale-95",
              isLoadingAudio || !formData.previewUrl
                ? "bg-slate-600 cursor-not-allowed" 
                : isPlaying 
                  ? "bg-red-600 hover:bg-red-700 shadow-red-600/20" 
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
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
          
          <div className="min-w-0">
            <h3 className="text-xl font-black uppercase tracking-tight truncate text-white leading-none">
              {formData.name || "Untitled Track"}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">
              {formData.artist || "Unknown Artist"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-8 shrink-0">
          {/* Original Key */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
              <Hash className="w-3 h-3" /> Original Key
            </span>
            <span className="text-xl font-black text-white font-mono">{displayOrigKey}</span>
          </div>

          {/* Stage Key */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
              <Music className="w-3 h-3" /> Stage Key
            </span>
            <span className="text-xl font-black text-indigo-400 font-mono flex items-center gap-2">
              {displayTargetKey}
              {formData.isKeyConfirmed && <Check className="w-4 h-4 text-emerald-500" />}
            </span>
          </div>

          {/* Tempo */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
              <Activity className="w-3 h-3" /> Tempo
            </span>
            <span className="text-xl font-black text-white font-mono">{formData.bpm || "--"} <span className="text-[10px] text-slate-500">BPM</span></span>
          </div>
          
          {/* Pitch */}
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
              <Activity className="w-3 h-3" /> Pitch
            </span>
            <span className="text-xl font-black text-white font-mono">{pitch > 0 ? '+' : ''}{pitch} <span className="text-[10px] text-slate-500">ST</span></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongStudioHeader;
"use client";

import React from 'react';
import { SetlistSong, EnergyZone } from './SetlistManager';
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, CloudDownload, AlertTriangle, Check, 
  MoreVertical, ListMusic, LayoutList, Settings2, Trash2, Play, Volume2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKey } from '@/utils/keyUtils';
import MasteryRating from './MasteryRating';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

interface SetlistMobileCardProps {
  song: SetlistSong;
  isSelected: boolean;
  readinessScore: number;
  isFullyReady: boolean;
  currentPref: 'sharps' | 'flats' | 'neutral';
  onTogglePlayed: (id: string) => void;
  onEdit: (song: SetlistSong) => void;
  onSelect: (song: SetlistSong) => void;
  onUpdateSong: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  setDeleteConfirmId: (id: string) => void;
  getHeatmapClass: (song: SetlistSong) => string;
  getEnergyBarClass: (energy: EnergyZone | undefined) => string;
}

const SetlistMobileCard: React.FC<SetlistMobileCardProps> = ({
  song, isSelected, readinessScore, isFullyReady, currentPref,
  onTogglePlayed, onEdit, onSelect, onUpdateSong, onUpdateKey, setDeleteConfirmId,
  getHeatmapClass, getEnergyBarClass
}) => {
  const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref === 'neutral' ? 'sharps' : currentPref);
  const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
  const isExtractionFailed = song.extraction_status === 'failed';
  const hasAudio = !!song.audio_url;

  return (
    <div
      onClick={() => onEdit(song)}
      className={cn(
        "bg-slate-900/40 rounded-[2rem] border-2 transition-all p-5 flex flex-col gap-4 shadow-xl relative overflow-hidden",
        isSelected ? "border-indigo-500 bg-indigo-500/5 shadow-indigo-500/10" : "border-white/5",
        song.isPlayed && "opacity-50 grayscale-[0.2]",
        getHeatmapClass(song)
      )}
    >
      <div className={cn("absolute top-0 left-0 h-full transition-all duration-700 opacity-20", getEnergyBarClass(song.energy_level))} />
      <div className="flex items-start justify-between relative z-10">
        <div className="flex gap-4">
          <button onClick={(e) => { e.stopPropagation(); onTogglePlayed(song.id); }} className="mt-1">
            {song.isPlayed ? (
              <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            ) : (
              <div className="h-6 w-6 rounded-full border-2 border-white/10 bg-black/20" />
            )}
          </button>
          <div>
            <h4 className={cn("text-base font-black tracking-tight flex items-center gap-2 text-white", song.isPlayed && "line-through text-slate-500")}>
              {song.name}
              {isFullyReady && <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />}
              {isProcessing && <CloudDownload className="w-4 h-4 text-indigo-500 animate-bounce" />}
              {isExtractionFailed && <AlertTriangle className="w-4 h-4 text-red-500" />}
            </h4>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{song.artist || "Unknown Artist"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Ready</span>
            <span className={cn(
              "text-[10px] font-mono font-bold px-2.5 py-1 rounded-xl",
              readinessScore >= 90 ? "bg-emerald-600/20 text-emerald-400" : "bg-amber-600/20 text-amber-400"
            )}>
              {readinessScore}%
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:bg-white/5">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl bg-slate-950 border-white/10">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdateSong(song.id, { isApproved: !song.isApproved }); showSuccess(`Song marked as ${song.isApproved ? 'unapproved' : 'approved'} for gig.`); }} className="h-11 rounded-xl text-xs font-bold uppercase">
                {song.isApproved ? <Check className="w-4 h-4 mr-3 text-emerald-500" /> : <ListMusic className="w-4 h-4 mr-3" />}
                {song.isApproved ? "Unapprove" : "Approve for Gig"}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenu>
                <DropdownMenuTrigger className="w-full">
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="h-11 rounded-xl text-xs font-bold uppercase">
                    <LayoutList className="w-4 h-4 mr-3 text-indigo-400" /> Move to Set...
                  </DropdownMenuItem>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="left" className="bg-slate-950 border-white/10">
                  {[1, 2, 3, 4, 99].map(num => (
                    <DropdownMenuItem
                      key={num}
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await supabase.from('setlist_songs').update({ set_group: num }).eq('id', song.id);
                          showSuccess(`Moved to ${num === 99 ? 'Surplus' : `Set ${num}`}`);
                          onUpdateSong(song.id, { set_group: num });
                        } catch (err) {
                          showError("Failed to move set");
                        }
                      }}
                      className="h-10 rounded-lg text-[10px] font-black uppercase"
                    >
                      {num === 99 ? "Surplus" : `Set ${num}`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(song); }} className="h-11 rounded-xl text-xs font-bold uppercase">
                <Settings2 className="w-4 h-4 mr-3" /> Configure Studio
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem className="text-red-400 h-11 rounded-xl text-xs font-bold uppercase" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(song.id); }}>
                <Trash2 className="w-4 h-4 mr-3" /> Remove Track
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/5 pt-4 relative z-10">
        <div className="flex items-center gap-5">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Key</span>
            <div className={cn(
              "font-mono font-black text-[10px] px-3 py-1 rounded-xl text-white flex items-center gap-1.5 shadow-lg",
              song.isKeyConfirmed ? "bg-emerald-600 shadow-emerald-500/20" : "bg-indigo-600 shadow-indigo-500/20"
            )}>
              {displayTargetKey}
              {song.isKeyConfirmed && <Check className="w-3 h-3" />}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Mastery</span>
            <MasteryRating value={song.comfort_level || 0} onChange={(val) => onUpdateSong(song.id, { comfort_level: val })} size="sm" />
          </div>
        </div>
        <div className="flex gap-3">
          {hasAudio && <Volume2 className="w-4 h-4 text-indigo-400" />}
          <Button
            size="sm"
            className={cn(
              "h-10 px-5 text-[10px] font-black uppercase tracking-widest rounded-2xl gap-2.5 shadow-xl transition-all active:scale-95",
              !song.audio_url ? "bg-slate-800 text-slate-500" : isSelected ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20"
            )}
            disabled={!song.audio_url}
            onClick={(e) => { e.stopPropagation(); onSelect(song); }}
          >
            {isSelected ? "Active" : "Perform"}
            <Play className={cn("w-3.5 h-3.5 fill-current", isSelected && "fill-indigo-400")} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SetlistMobileCard;
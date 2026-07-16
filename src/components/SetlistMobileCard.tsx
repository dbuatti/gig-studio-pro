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
        "bg-slate-900/40 rounded-xl border transition-all p-3 flex items-center gap-3 shadow-sm relative overflow-hidden cursor-pointer",
        isSelected ? "border-indigo-500 bg-indigo-500/5" : "border-white/5 hover:border-white/20 hover:bg-white/[0.03]",
        song.isPlayed && "opacity-50 grayscale-[0.2]",
        getHeatmapClass(song)
      )}
    >
      <div className={cn("absolute top-0 left-0 h-full transition-all duration-700 opacity-20 w-1", getEnergyBarClass(song.energy_level))} />

      <button onClick={(e) => { e.stopPropagation(); onTogglePlayed(song.id); }} className="shrink-0" aria-label={song.isPlayed ? "Mark as unplayed" : "Mark as played"}>
        {song.isPlayed ? (
          <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-white/10 bg-black/20" />
        )}
      </button>

      <div className="flex items-center gap-2 min-w-0 flex-1">
        <h4 className={cn("text-xs font-black tracking-tight flex items-center gap-1 text-white truncate", song.isPlayed && "line-through text-slate-500")}>
          {song.name}
          {isProcessing && <CloudDownload className="w-3 h-3 text-indigo-500 animate-bounce shrink-0" />}
          {isExtractionFailed && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
          {isFullyReady && <CheckCircle2 className="w-3 h-3 text-emerald-500 fill-emerald-500/20 shrink-0" />}
        </h4>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className={cn(
          "font-mono font-black text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 leading-none",
          song.isKeyConfirmed ? "bg-emerald-600/20 text-emerald-400" : "bg-indigo-600/20 text-indigo-400"
        )}>
          {displayTargetKey}
          {song.isKeyConfirmed && <Check className="w-2 h-2" />}
        </div>

        <MasteryRating value={song.comfort_level || 0} onChange={(val) => onUpdateSong(song.id, { comfort_level: val })} size="sm" />

        <span className={cn(
          "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded",
          readinessScore >= 90 ? "bg-emerald-600/20 text-emerald-400" : "bg-amber-600/20 text-amber-400"
        )}>
          {readinessScore}%
        </span>

        {hasAudio && <Volume2 className="w-3 h-3 text-indigo-400" />}

        <button
          className={cn(
            "h-7 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg gap-1.5 transition-all active:scale-95 flex items-center",
            !song.audio_url ? "bg-slate-800 text-slate-500" : isSelected ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : "bg-indigo-600 text-white hover:bg-indigo-500"
          )}
          disabled={!song.audio_url}
          onClick={(e) => { e.stopPropagation(); onSelect(song); }}
        >
          <Play className="w-2.5 h-2.5 fill-current" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-7 w-7 rounded-lg text-slate-400 hover:bg-white/5 inline-flex items-center justify-center">
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-xl bg-slate-950 border-white/10">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdateSong(song.id, { isApproved: !song.isApproved }); showSuccess(`Song marked as ${song.isApproved ? 'unapproved' : 'approved'} for gig.`); }} className="h-9 rounded-lg text-[9px] font-bold uppercase">
              {song.isApproved ? <Check className="w-3.5 h-3.5 mr-2 text-emerald-500" /> : <ListMusic className="w-3.5 h-3.5 mr-2" />}
              {song.isApproved ? "Unapprove" : "Approve for Gig"}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full">
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="h-9 rounded-lg text-[9px] font-bold uppercase">
                  <LayoutList className="w-3.5 h-3.5 mr-2 text-indigo-400" /> Move to Set...
                </DropdownMenuItem>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="left" className="bg-slate-950 border-white/10 rounded-xl">
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
                    className="h-8 rounded-lg text-[9px] font-black uppercase"
                  >
                    {num === 99 ? "Surplus" : `Set ${num}`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(song); }} className="h-9 rounded-lg text-[9px] font-bold uppercase">
              <Settings2 className="w-3.5 h-3.5 mr-2" /> Configure Studio
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem className="text-red-400 h-9 rounded-lg text-[9px] font-bold uppercase" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(song.id); }}>
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Remove Track
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default SetlistMobileCard;

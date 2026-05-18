"use client";

import React from 'react';
import { SetlistSong, EnergyZone } from './SetlistManager';
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, CircleDashed, CloudDownload, AlertTriangle, 
  ShieldCheck, Clock, ArrowRight, Check, ChevronDown, 
  ChevronUp, Edit3, MoreVertical, ListMusic, Settings2, Trash2, LayoutList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKey, ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import SetlistMultiSelector from './SetlistMultiSelector';
import MasteryRating from './MasteryRating';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

interface SetlistRowProps {
  song: SetlistSong;
  isSelected: boolean;
  readinessScore: number;
  isFullyReady: boolean;
  currentPref: 'sharps' | 'flats' | 'neutral';
  idx: number;
  onTogglePlayed: (id: string) => void;
  onEdit: (song: SetlistSong) => void;
  onSelect: (song: SetlistSong) => void;
  onUpdateSong: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onRemove: (id: string) => void;
  allSetlists: any[];
  onUpdateSetlistSongs: any;
  isReorderingEnabled: boolean;
  handleMove: (id: string, dir: 'up' | 'down') => void;
  handleMoveToTop: (id: string) => void;
  handleMoveToBottom: (id: string) => void;
  setDeleteConfirmId: (id: string) => void;
  getHeatmapClass: (song: SetlistSong) => string;
  getEnergyBarClass: (energy: EnergyZone | undefined) => string;
  getReadinessBreakdown: (song: SetlistSong) => string[];
}

const SetlistRow: React.FC<SetlistRowProps> = ({
  song, isSelected, readinessScore, isFullyReady, currentPref, idx,
  onTogglePlayed, onEdit, onSelect, onUpdateSong, onUpdateKey, onRemove,
  allSetlists, onUpdateSetlistSongs, isReorderingEnabled, handleMove,
  handleMoveToTop, handleMoveToBottom, setDeleteConfirmId,
  getHeatmapClass, getEnergyBarClass, getReadinessBreakdown
}) => {
  const displayOrigKey = formatKey(song.originalKey, currentPref === 'neutral' ? 'sharps' : currentPref);
  const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref === 'neutral' ? 'sharps' : currentPref);
  const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
  const isExtractionFailed = song.extraction_status === 'failed';

  return (
    <tr
      className={cn(
        "transition-all group relative cursor-pointer h-[90px]",
        isSelected ? "bg-indigo-500/5" : "hover:bg-white/[0.02]",
        song.isPlayed && "opacity-40 grayscale-[0.5]",
        getHeatmapClass(song)
      )}
      onClick={() => onEdit(song)}
    >
      <td className="px-8 text-center">
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePlayed(song.id); }}
          className="transition-transform active:scale-90 inline-flex items-center justify-center"
          aria-label={song.isPlayed ? "Mark as unplayed" : "Mark as played"}
        >
          {song.isPlayed ? (
            <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          ) : (
            <div className="h-7 w-7 rounded-full border-2 border-white/10 bg-black/20 flex items-center justify-center text-slate-600 group-hover:border-indigo-500/50 transition-colors">
              <CircleDashed className="w-4.5 h-4.5" />
            </div>
          )}
        </button>
      </td>

      <td className="px-8 text-left">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono font-black text-slate-600 min-w-[24px]">{(idx + 1).toString().padStart(2, '0')}</span>
            <h4 className={cn("text-lg font-black tracking-tight leading-none flex items-center gap-2.5 text-white", song.isPlayed && "line-through text-slate-500")}>
              {song.name}
              {isFullyReady && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 fill-emerald-500/20" />}
              {isProcessing && <CloudDownload className="w-4.5 h-4.5 text-indigo-500 animate-bounce" />}
              {isExtractionFailed && <AlertTriangle className="w-4.5 h-4.5 text-red-500" />}
            </h4>
            {song.isMetadataConfirmed && <ShieldCheck className="w-4 h-4 text-indigo-500" />}
          </div>
          <div className="flex items-center gap-3 ml-[38px]">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{song.artist || "Unknown Artist"}</span>
            <span className="text-slate-700 text-[8px]">•</span>
            <span className="text-[10px] font-mono font-bold text-slate-500 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              {Math.floor((song.duration_seconds || 0) / 60)}:{(Math.floor((song.duration_seconds || 0) % 60)).toString().padStart(2, '0')}
            </span>
          </div>
        </div>
      </td>
      <td className="px-8 text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                  <div className={cn("h-full transition-all duration-700 shadow-[0_0_10px_rgba(0,0,0,0.5)]", getEnergyBarClass(song.energy_level))} />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{song.energy_level || 'TBC'}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-white/10 text-[10px] font-black uppercase">Energy Zone: {song.energy_level || 'Not Classified'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </td>
      <td className="px-8 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <MasteryRating value={song.comfort_level || 0} onChange={(val) => onUpdateSong(song.id, { comfort_level: val })} size="md" />
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Confidence</span>
        </div>
      </td>
      <td className="px-8 text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center gap-1.5 cursor-help">
                <span className={cn(
                  "text-[11px] font-mono font-bold px-3 py-1 rounded-xl flex items-center gap-2 shadow-lg",
                  readinessScore >= 90 ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/20" : "bg-amber-600/20 text-amber-400 border border-amber-500/20"
                )}>
                  {readinessScore}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="p-4 bg-slate-950 border-white/10 rounded-[1.5rem] shadow-2xl max-w-xs">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3">Readiness Breakdown</p>
                {getReadinessBreakdown(song).map((item, i) => (
                  <p key={i} className="text-[10px] font-bold text-slate-300 flex items-center gap-2.5">{item}</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </td>
      <td className="px-8 text-center">
        <div className="flex flex-col items-center justify-center gap-1 h-full">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 transition-all flex items-center justify-center rounded-xl", isReorderingEnabled ? "text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10" : "text-slate-700 opacity-20 cursor-not-allowed")}
            onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'up'); }}
            disabled={!isReorderingEnabled}
            aria-label="Move song up"
          >
            <ChevronUp className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 transition-all flex items-center justify-center rounded-xl", isReorderingEnabled ? "text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10" : "text-slate-700 opacity-20 cursor-not-allowed")}
            onClick={(e) => { e.stopPropagation(); handleMove(song.id, 'down'); }}
            disabled={!isReorderingEnabled}
            aria-label="Move song down"
          >
            <ChevronDown className="w-5 h-5" />
          </Button>
        </div>
      </td>

      <td className="px-8 text-center">
        <div className="flex items-center justify-center gap-6 h-full">
          <div className="text-center min-w-[40px]">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Orig</p>
            <span className="text-sm font-mono font-bold text-slate-300">{displayOrigKey}</span>
          </div>
          <div className="flex flex-col items-center justify-center opacity-20">
            <ArrowRight className="w-4 h-4 text-slate-400 mb-1" />
            <div className="h-px w-8 bg-white/20" />
          </div>
          <div className="text-center min-w-[40px] relative">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Stage</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "font-mono font-black text-sm px-3.5 py-1.5 rounded-xl shadow-2xl flex items-center justify-center gap-2 leading-none border transition-all hover:scale-105 active:scale-95",
                    song.isKeyConfirmed ? "bg-emerald-600 text-white border-emerald-400 shadow-emerald-500/20" : "bg-indigo-600 text-white border-indigo-400 shadow-indigo-500/20"
                  )}
                >
                  {displayTargetKey}
                  {song.isKeyConfirmed ? <Check className="w-3.5 h-3.5" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-slate-950 border-white/10 text-white max-h-60 overflow-y-auto custom-scrollbar">
                {(currentPref === 'flats' ? ALL_KEYS_FLAT : ALL_KEYS_SHARP).map(k => (
                  <DropdownMenuItem key={k} onClick={(e) => { e.stopPropagation(); onUpdateKey(song.id, k); }} className="font-mono text-xs font-bold">{k}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </td>
      <td className="px-8 text-right pr-12">
        <div className="flex items-center justify-end gap-3 h-full">
          <SetlistMultiSelector songMasterId={song.master_id || song.id} allSetlists={allSetlists} songToAssign={song} onUpdateSetlistSongs={onUpdateSetlistSongs} />
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all inline-flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onEdit(song); }}>
            <Edit3 className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-white/5">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 p-2 rounded-[1.5rem] bg-slate-950 border-white/10 shadow-2xl">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdateSong(song.id, { isApproved: !song.isApproved }); showSuccess(`Song marked as ${song.isApproved ? 'unapproved' : 'approved'} for gig.`); }} className="h-12 rounded-xl text-xs font-bold uppercase">
                {song.isApproved ? <Check className="w-4 h-4 mr-3 text-emerald-500" /> : <ListMusic className="w-4 h-4 mr-3" />}
                {song.isApproved ? "Unapprove" : "Approve for Gig"}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToTop(song.id); }} disabled={!isReorderingEnabled} className="h-12 rounded-xl text-xs font-bold uppercase">
                <ChevronUp className="w-4 h-4 mr-3 text-indigo-400" /> Move to Top
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMoveToBottom(song.id); }} disabled={!isReorderingEnabled} className="h-12 rounded-xl text-xs font-bold uppercase">
                <ChevronDown className="w-4 h-4 mr-3 text-indigo-400" /> Move to Bottom
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenu>
                <DropdownMenuTrigger className="w-full">
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="h-12 rounded-xl text-xs font-bold uppercase">
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
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(song); }} className="h-12 rounded-xl text-xs font-bold uppercase">
                <Settings2 className="w-4 h-4 mr-3" /> Configure Studio
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem className="text-red-400 h-12 rounded-xl text-xs font-bold uppercase" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(song.id); }}>
                <Trash2 className="w-4 h-4 mr-3" /> Remove Track
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
};

export default SetlistRow;
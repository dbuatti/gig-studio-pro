"use client";

import React from 'react';
import { SetlistSong, EnergyZone } from './SetlistManager';
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, CloudDownload, AlertTriangle, Check,
  MoreVertical, ListMusic, LayoutList, Settings2, Trash2, Play, Target, CircleDashed
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKey } from '@/utils/keyUtils';
import ReaderStatusChip from './ReaderStatusChip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { IconButton } from '@/components/ui/icon-button';
import { ReadinessBadge } from '@/components/ui/readiness-badge';
import { songAudioUrl } from '@/utils/playbackQueue';

interface SetlistMobileCardProps {
  song: SetlistSong;
  isSelected: boolean;
  readinessScore: number;
  isFullyReady: boolean;
  currentPref: 'sharps' | 'flats' | 'neutral';
  onTogglePlayed: (id: string) => void;
  onEdit: (song: SetlistSong) => void;
  onSelect: (song: SetlistSong, forceAutoplay?: boolean) => void;
  onUpdateSong: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  setDeleteConfirmId: (id: string) => void;
  getHeatmapClass: (song: SetlistSong) => string;
  getEnergyBarClass: (energy: EnergyZone | undefined) => string;
  getSetLabel: (group: number) => string;
  currentGroup: number;
  onOpenWizard?: (song: SetlistSong) => void;
}

const SetlistMobileCard: React.FC<SetlistMobileCardProps> = ({
  song, isSelected, readinessScore, isFullyReady, currentPref,
  onTogglePlayed, onEdit, onSelect, onUpdateSong, onUpdateKey, setDeleteConfirmId,
  getHeatmapClass, getEnergyBarClass, getSetLabel, currentGroup, onOpenWizard
}) => {
  const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref === 'neutral' ? 'sharps' : currentPref);
  const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
  const isExtractionFailed = song.extraction_status === 'failed';
  const hasAudio = !!songAudioUrl(song);
  const audioLabel = isProcessing ? 'Preparing audio' : isExtractionFailed ? 'Audio failed' : hasAudio ? 'Audio ready' : 'No audio';

  return (
    <div
      onClick={() => onEdit(song)}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-studio-surface p-3 shadow-sm transition-colors",
        isSelected ? "border-indigo-500/60 bg-indigo-500/[0.06]" : "border-studio-border",
        song.isPlayed && "opacity-60",
        getHeatmapClass(song)
      )}
    >
      <div className={cn("absolute bottom-0 left-0 top-0 w-1 opacity-60", getEnergyBarClass(song.energy_level))} />

      <div className="flex items-start gap-2">
        <IconButton
          aria-label={song.isPlayed ? "Mark as unplayed" : "Mark as played"}
          onClick={(e) => { e.stopPropagation(); onTogglePlayed(song.id); }}
          className={cn("shrink-0", song.isPlayed && "text-emerald-400")}
        >
          {song.isPlayed ? <CheckCircle2 className="h-5 w-5" /> : <CircleDashed className="h-5 w-5" />}
        </IconButton>

        <div className="min-w-0 flex-1 pt-0.5">
          <h4 className={cn("flex items-center gap-1.5 truncate text-sm font-bold text-white", song.isPlayed && "line-through text-studio-muted")}>
            {song.name}
            {isProcessing && <CloudDownload className="h-3.5 w-3.5 shrink-0 animate-bounce text-indigo-400" />}
            {isExtractionFailed && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />}
            {isFullyReady && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
          </h4>
          <p className="mt-0.5 truncate text-[11px] text-studio-muted">{song.artist || 'Unknown artist'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <ReaderStatusChip song={song} />
            <span className={cn("text-[9px] font-semibold uppercase tracking-wider", hasAudio ? "text-studio-muted" : "text-amber-400")}>
              {audioLabel}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label={`More actions for ${song.name}`} onClick={(e) => e.stopPropagation()} className="-mr-1 -mt-1">
              <MoreVertical className="h-5 w-5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl border border-studio-border bg-studio-raised p-2">
            <DropdownMenuItem disabled={!hasAudio} onClick={(e) => { e.stopPropagation(); onSelect(song, true); }} className="h-11 rounded-xl text-xs font-semibold">
              <Play className="mr-3 h-4 w-4 text-indigo-400" /> Play from here
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdateSong(song.id, { isApproved: !song.isApproved }); showSuccess(`Song marked as ${song.isApproved ? 'unapproved' : 'approved'} for gig.`); }} className="h-11 rounded-xl text-xs font-semibold">
              {song.isApproved ? <Check className="mr-3 h-4 w-4 text-emerald-400" /> : <ListMusic className="mr-3 h-4 w-4" />}
              {song.isApproved ? "Unapprove" : "Approve for Gig"}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full">
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="h-11 rounded-xl text-xs font-semibold">
                  <LayoutList className="mr-3 h-4 w-4 text-indigo-400" /> Move to Set...
                </DropdownMenuItem>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="left" className="rounded-xl border border-studio-border bg-studio-raised">
                {[1, 2, 3, 4, 99].filter((number) => number !== currentGroup).map((number) => (
                  <DropdownMenuItem
                    key={number}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await supabase.from('setlist_songs').update({ set_group: number }).eq('id', song.id);
                        showSuccess(`Moved to ${getSetLabel(number)}`);
                        onUpdateSong(song.id, { set_group: number });
                      } catch {
                        showError("Failed to move set");
                      }
                    }}
                    className="h-11 rounded-lg text-xs font-semibold"
                  >
                    {getSetLabel(number)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenuSeparator className="bg-white/5" />
            {onOpenWizard && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenWizard(song); }} className="h-11 rounded-xl text-xs font-semibold">
                <Target className="mr-3 h-4 w-4 text-indigo-400" /> Readiness Wizard
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(song); }} className="h-11 rounded-xl text-xs font-semibold">
              <Settings2 className="mr-3 h-4 w-4" /> Configure Studio
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem className="h-11 rounded-xl text-xs font-semibold text-red-400" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(song.id); }}>
              <Trash2 className="mr-3 h-4 w-4" /> Remove Track
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-studio-border pt-3">
        <Button
          disabled={!hasAudio}
          onClick={(e) => { e.stopPropagation(); onSelect(song, true); }}
          className="h-11 min-w-[92px] rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-500 disabled:bg-white/5 disabled:text-studio-muted"
        >
          <Play className="h-4 w-4 fill-current" /> Play
        </Button>
        <div onClick={(e) => e.stopPropagation()}>
          <ReadinessBadge
            score={readinessScore}
            compact
            onInspect={() => (onOpenWizard ? onOpenWizard(song) : onEdit(song))}
          />
        </div>
        <span className={cn(
          "inline-flex min-h-11 items-center rounded-lg border px-2.5 font-mono text-xs font-bold",
          song.isKeyConfirmed ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-indigo-500/20 bg-indigo-500/10 text-indigo-400"
        )}>
          {displayTargetKey}
          {song.isKeyConfirmed && <Check className="ml-1 h-3 w-3" />}
        </span>
      </div>
    </div>
  );
};

export default SetlistMobileCard;

"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import {
  Check, ShieldCheck, CloudDownload, AlertTriangle,
  Edit3, Trash2, ArrowRight, MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatKey } from '@/utils/keyUtils';
import { calculateReadiness } from '@/utils/repertoireSync';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import SetlistMultiSelector from './SetlistMultiSelector';
import ReaderStatusChip from './ReaderStatusChip';
import { IconButton } from '@/components/ui/icon-button';
import { ReadinessBadge } from '@/components/ui/readiness-badge';

interface RepertoireMobileCardProps {
  song: SetlistSong;
  onEdit: (song: SetlistSong) => void;
  onDelete: (id: string) => void;
  allSetlists: { id: string; name: string; songs: SetlistSong[] }[];
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  currentPref: 'sharps' | 'flats' | 'neutral';
}

const RepertoireMobileCard: React.FC<RepertoireMobileCardProps> = ({
  song, onEdit, onDelete, allSetlists, onUpdateSetlistSongs, currentPref
}) => {
  const readinessScore = calculateReadiness(song);
  const isFullyReady = readinessScore === 100;
  const displayOrigKey = formatKey(song.originalKey, currentPref === 'neutral' ? 'sharps' : currentPref);
  const displayTargetKey = formatKey(song.targetKey || song.originalKey, currentPref === 'neutral' ? 'sharps' : currentPref);
  const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
  const isExtractionFailed = song.extraction_status === 'failed';

  return (
    <div
      onClick={() => onEdit(song)}
      className="flex flex-col gap-4 rounded-2xl border border-studio-border bg-studio-surface p-4 shadow-sm transition-colors active:bg-studio-raised"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 truncate text-base font-bold text-studio-foreground">
            {song.name}
            {isFullyReady && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
            {isProcessing && <CloudDownload className="h-4 w-4 shrink-0 animate-bounce text-indigo-400" />}
            {isExtractionFailed && <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />}
          </h4>
          <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wider text-studio-muted">
            {song.artist || "Unknown Artist"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <ReaderStatusChip song={song} />
            {song.isMetadataConfirmed && <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" aria-label="Metadata confirmed" />}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ReadinessBadge score={readinessScore} compact />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label={`More actions for ${song.name}`} onClick={(e) => e.stopPropagation()} className="-mr-2 -mt-2">
                <MoreVertical className="h-5 w-5" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl border border-studio-border bg-studio-raised p-2">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(song); }} className="h-11 rounded-xl text-xs font-semibold">
                <Edit3 className="mr-2 h-4 w-4" /> Edit Details
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem className="h-11 rounded-xl text-xs font-semibold text-red-400" onClick={(e) => { e.stopPropagation(); onDelete(song.id); }}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Track
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-studio-border pt-3">
        <div className="flex flex-col">
          <span className="studio-eyebrow mb-1">Key map</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-studio-muted">{displayOrigKey}</span>
            <ArrowRight className="h-3 w-3 text-studio-muted opacity-40" />
            <div className={cn(
              "inline-flex min-h-11 items-center rounded-lg px-2.5 font-mono text-xs font-bold text-white",
              song.isKeyConfirmed ? "bg-emerald-600" : "bg-indigo-600"
            )}>
              {displayTargetKey}
              {song.isKeyConfirmed && <Check className="ml-1 h-3 w-3" />}
            </div>
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <SetlistMultiSelector
            songMasterId={song.id}
            allSetlists={allSetlists}
            songToAssign={song}
            onUpdateSetlistSongs={onUpdateSetlistSongs}
          />
        </div>
      </div>
    </div>
  );
};

export default RepertoireMobileCard;

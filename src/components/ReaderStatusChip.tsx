"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { getChartStatus } from '@/utils/chartStatus';
import { CheckCircle2, AlertTriangle, HelpCircle, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface ReaderStatusChipProps {
  song: SetlistSong;
  className?: string;
  /** Icon-only chip for tight layouts. */
  compact?: boolean;
}

/**
 * Always-visible status of a song's preferred reader format:
 * - which format is chosen (Lead Sheet / Full Score / Chords / Memorised), and
 * - whether its material has been uploaded or is still missing.
 * Shows a clear "Not set" chip when no preferred reader has been chosen.
 */
const ReaderStatusChip: React.FC<ReaderStatusChipProps> = ({ song, className, compact = false }) => {
  const { readerState, preferredLabel } = getChartStatus(song);

  let Icon = HelpCircle;
  let label = 'Reader not set';
  let tone = 'bg-amber-500/15 border-amber-500/30 text-amber-400';
  let tip = 'No preferred reader chosen yet. Open the Readiness Wizard to pick Lead Sheet, Full Score, Chords or Memorised.';

  if (readerState === 'memorised') {
    Icon = Brain;
    label = 'Memorised';
    tone = 'bg-slate-500/15 border-slate-500/30 text-slate-300';
    tip = 'Preferred reader is None (memorised) — no sheet or chords required.';
  } else if (readerState === 'filled') {
    Icon = CheckCircle2;
    label = preferredLabel || 'Chosen';
    tone = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
    tip = `Preferred reader: ${preferredLabel}. Material is uploaded.`;
  } else if (readerState === 'missing') {
    Icon = AlertTriangle;
    label = preferredLabel || 'Chosen';
    tone = 'bg-red-500/15 border-red-500/30 text-red-400';
    tip = `Preferred reader: ${preferredLabel}. Material is NOT uploaded yet — add it in the song's studio or the Readiness Wizard.`;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border font-black uppercase tracking-wider cursor-help whitespace-nowrap",
              compact ? "p-1 text-[8px]" : "px-1.5 py-0.5 text-[8px]",
              tone,
              className
            )}
          >
            <Icon className={compact ? "w-3 h-3" : "w-2.5 h-2.5"} />
            {!compact && <span className="max-w-[110px] truncate">{label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-900 text-white border-white/10 text-xs font-medium max-w-[260px]">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ReaderStatusChip;

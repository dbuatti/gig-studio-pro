"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { getChartStatus } from '@/utils/chartStatus';
import { CheckCircle2, AlertTriangle, CircleDashed } from 'lucide-react';
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
 * - which format is chosen (Lead Sheet / Full Score / UG Chords), and
 * - whether its material has been uploaded or is still missing.
 * Shows a clear "Not set" chip when no preferred reader has been chosen.
 */
const ReaderStatusChip: React.FC<ReaderStatusChipProps> = ({ song, className, compact = false }) => {
  const { readerState, preferredLabel, needsPreferredLabel } = getChartStatus(song);

  let Icon = CircleDashed;
  let label = 'Reader not set';
  // Quiet "needs setup" look — over half the library is unset, so this stays
  // readable without drowning the real problems (missing material) in colour.
  let tone = 'border-dashed border-indigo-500/40 text-indigo-300 bg-indigo-500/10';
  let tip = 'No preferred reader chosen yet. Open the Readiness Wizard to pick UG Chords, Lead Sheet or Full Score.';

  if (readerState === 'filled') {
    Icon = CheckCircle2;
    label = preferredLabel || 'Chosen';
    tone = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
    tip = `Preferred reader: ${preferredLabel}. Material is uploaded.`;
  } else if (readerState === 'missing') {
    // "No …" here always refers to the material the PREFERRED format needs
    // (chords for UG, a lead sheet, or a full score) — never generic sheet music.
    Icon = AlertTriangle;
    label = `No ${needsPreferredLabel || preferredLabel || 'material'}`;
    tone = 'bg-red-500/15 border-red-500/30 text-red-400';
    tip = `Preferred reader is ${preferredLabel}, but the ${needsPreferredLabel || 'material'} hasn't been added yet — add it in the song's studio or the Readiness Wizard.`;
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

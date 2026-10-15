"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { getChartStatus } from '@/utils/chartStatus';
import { FileWarning, Guitar, Layout, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface SongChartBadgesProps {
  song: SetlistSong;
  className?: string;
  /** Icon-only chips for tight layouts (e.g. mobile cards). */
  compact?: boolean;
}

const iconForMissing = (label: string | null) => {
  switch (label) {
    case 'Chords': return Guitar;
    case 'Lead Sheet': return Layout;
    case 'Full Score': return FileText;
    default: return FileText;
  }
};

/**
 * Compact, at-a-glance indicators for missing sheet music and/or the sheets or
 * chords that match a song's preferred reader format. Renders nothing when the
 * song is fine, so it stays quiet on a healthy setlist.
 */
const SongChartBadges: React.FC<SongChartBadgesProps> = ({ song, className, compact = false }) => {
  const status = getChartStatus(song);
  if (!status.needsPreferred && !status.missingSheet) return null;

  const MissingIcon = iconForMissing(status.needsPreferredLabel);
  const chipBase = "inline-flex items-center gap-1 rounded-md border font-black uppercase tracking-wider cursor-help whitespace-nowrap";
  const chipSize = compact ? "p-1 text-[8px]" : "px-1.5 py-0.5 text-[8px]";

  return (
    <TooltipProvider delayDuration={150}>
      <span className={cn("inline-flex items-center gap-1 shrink-0", className)}>
        {status.needsPreferred && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(chipBase, chipSize, "bg-amber-500/15 border-amber-500/30 text-amber-400")}>
                <MissingIcon className={compact ? "w-3 h-3" : "w-2.5 h-2.5"} />
                {!compact && <>Needs {status.needsPreferredLabel}</>}
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-white/10 text-xs font-medium max-w-[220px]">
              Preferred reader is <span className="font-black">{status.preferredLabel}</span>, but no {status.needsPreferredLabel} is attached.
            </TooltipContent>
          </Tooltip>
        )}

        {status.missingSheet && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(chipBase, chipSize, "bg-red-500/15 border-red-500/30 text-red-400")}>
                <FileWarning className={compact ? "w-3 h-3" : "w-2.5 h-2.5"} />
                {!compact && <>No Sheet</>}
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-white/10 text-xs font-medium max-w-[240px]">
              No sheet music (PDF full score or lead sheet) is linked. Add one in the song's studio or the Readiness Wizard.
            </TooltipContent>
          </Tooltip>
        )}
      </span>
    </TooltipProvider>
  );
};

export default SongChartBadges;

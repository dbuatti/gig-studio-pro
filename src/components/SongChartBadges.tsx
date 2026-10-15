"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { getChartStatus } from '@/utils/chartStatus';
import { FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface SongChartBadgesProps {
  song: SetlistSong;
  className?: string;
  /** Icon-only chip for tight layouts (e.g. mobile cards). */
  compact?: boolean;
}

/**
 * Compact indicator for a song that has no sheet music (PDF full score or lead
 * sheet) linked at all. Renders nothing otherwise. The preferred-reader status
 * is shown separately by ReaderStatusChip.
 */
const SongChartBadges: React.FC<SongChartBadgesProps> = ({ song, className, compact = false }) => {
  const { missingSheet } = getChartStatus(song);
  if (!missingSheet) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border font-black uppercase tracking-wider cursor-help whitespace-nowrap bg-red-500/15 border-red-500/30 text-red-400",
              compact ? "p-1 text-[8px]" : "px-1.5 py-0.5 text-[8px]",
              className
            )}
          >
            <FileWarning className={compact ? "w-3 h-3" : "w-2.5 h-2.5"} />
            {!compact && <>No Sheet</>}
          </span>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-900 text-white border-white/10 text-xs font-medium max-w-[240px]">
          No sheet music (PDF full score or lead sheet) is linked. Add one in the song's studio or the Readiness Wizard.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SongChartBadges;

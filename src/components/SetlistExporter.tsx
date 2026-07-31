"use client";

import React, { useState, useMemo } from 'react';
import { SetlistSong } from './SetlistManager';
import { 
  ClipboardCopy, 
  Youtube, 
  Sparkles, 
  Loader2, 
  Download, 
  Wand2, 
  RefreshCcw, 
  Undo2,
  Settings2,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess, showError } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SetlistExporterProps {
  songs: SetlistSong[];
  onAutoLink?: () => Promise<void>;
  onGlobalAutoSync?: () => Promise<void>;
  onBulkRefreshAudio?: () => Promise<void>;
  onClearAutoLinks?: () => Promise<void>;
  onBulkVibeCheck?: () => Promise<void>;
  isBulkDownloading?: boolean;
  missingAudioCount?: number;
  onOpenAdmin?: () => void;
  onRetryFailed?: () => Promise<void>;
  retryFailedCount?: number;
}

const SetlistExporter: React.FC<SetlistExporterProps> = ({ 
  songs, 
  onAutoLink, 
  onGlobalAutoSync,
  onBulkRefreshAudio,
  onClearAutoLinks,
  onBulkVibeCheck,
  isBulkDownloading,
  missingAudioCount = 0,
  onOpenAdmin,
  onRetryFailed,
  retryFailedCount = 0,
}) => {
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isVibeChecking, setIsVibeChecking] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const isMissingLink = (url?: string) => {
    if (!url) return true;
    const clean = String(url).trim();
    return clean === "" || clean === "undefined" || clean === "null";
  };

  const missingYoutubeLinkCount = useMemo(() => { 
    return songs.filter(s => isMissingLink(s.youtubeUrl) && s.name).length;
  }, [songs]);

  const autoPopulatedCount = useMemo(() => {
    return (songs as Record<string, unknown>[]).filter(s => s.metadata_source === 'auto_populated').length;
  }, [songs]);

  const missingEnergyCount = useMemo(() => {
    return songs.filter(s => !s.energy_level && s.name && s.artist && s.bpm).length;
  }, [songs]);

  const handleAction = async (action: (() => Promise<void>) | undefined, setter: (v: boolean) => void, successMsg: string) => {
    if (!action) return;
    setter(true);
    try {
      await action();
      showSuccess(successMsg);
    } catch (err) {
      showError(`Action failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setter(false);
    }
  };

  const handleBulkQueueClick = () => {
    onBulkRefreshAudio?.();
  };

  return (
    <div className="bg-slate-900/60 p-5 rounded-2xl border border-white/5 flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Wand2 className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Automation</p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 rounded-lg hover:text-white">
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border-border text-foreground rounded-xl">
            <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Maintenance</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem 
              onClick={() => onOpenAdmin?.()}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
            >
              <RefreshCcw className="w-4 h-4 mr-2" /> Force Refresh All Audio
            </DropdownMenuItem>
            {onClearAutoLinks && (
              <DropdownMenuItem 
                disabled={autoPopulatedCount === 0 || isClearing}
                onClick={() => handleAction(onClearAutoLinks, setIsClearing, "Auto-links cleared")}
                className="cursor-pointer"
              >
                <Undo2 className="w-4 h-4 mr-2" /> Clear Auto-Links ({autoPopulatedCount})
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="grid grid-cols-1 gap-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleAction(onBulkVibeCheck, setIsVibeChecking, "Bulk Vibe Check Complete")}
                  disabled={isVibeChecking || missingEnergyCount === 0}
                  className={cn(
                    "h-8 w-full justify-start text-[9px] font-black uppercase tracking-widest rounded-lg gap-2 relative overflow-hidden transition-all",
                    isVibeChecking ? "bg-purple-500/10 text-purple-400" : "text-purple-400 hover:bg-purple-500/10"
                  )}
                >
                  {isVibeChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Vibe Check ({missingEnergyCount})
                </Button>
              </div>
            </TooltipTrigger>
            {missingEnergyCount === 0 && (
              <TooltipContent className="bg-popover text-foreground border-border text-[10px] font-black uppercase">
                All tracks have an Energy Zone set.
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {onGlobalAutoSync && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleAction(onGlobalAutoSync, setIsSyncing, "Global Auto-Sync Pipeline Complete")}
            disabled={isSyncing || songs.length === 0}
            className={cn(
              "h-8 w-full justify-start text-[9px] font-black uppercase tracking-widest rounded-lg gap-2 relative overflow-hidden transition-all",
              isSyncing ? "bg-purple-500/10 text-purple-400" : "text-purple-400 hover:bg-purple-500/10"
            )}
          >
            {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {isSyncing ? "Syncing..." : "Auto-Sync"}
          </Button>
        )}

        {onAutoLink && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleAction(onAutoLink, setIsLinking, "AI Discovery Pipeline Complete")}
                    disabled={isLinking || missingYoutubeLinkCount === 0}
                    className={cn(
                      "h-8 w-full justify-start text-[9px] font-black uppercase tracking-widest rounded-lg gap-2 relative overflow-hidden transition-all",
                      isLinking ? "bg-indigo-500/10 text-indigo-400" : "text-indigo-400 hover:bg-indigo-500/10"
                    )}
                  >
                    {isLinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Youtube className="w-3 h-3" />}
                    YouTube ({missingYoutubeLinkCount})
                  </Button>
                </div>
              </TooltipTrigger>
              {missingYoutubeLinkCount === 0 && (
                <TooltipContent className="bg-popover text-foreground border-border text-[10px] font-black uppercase">
                  All songs already have YouTube links bound.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleBulkQueueClick}
          disabled={isBulkDownloading || missingAudioCount === 0}
          className="h-8 justify-start text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/10 rounded-lg gap-2 relative overflow-hidden"
        >
          {isBulkDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          Audio ({missingAudioCount})
        </Button>

        {onRetryFailed && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleAction(onRetryFailed, setIsRetrying, "Retry complete")}
            disabled={isRetrying || retryFailedCount === 0}
            className="h-8 justify-start text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 rounded-lg gap-2 relative overflow-hidden"
          >
            {isRetrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
            Retry Failed ({retryFailedCount})
          </Button>
        )}
      </div>
    </div>
  );
};

export default SetlistExporter;
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
  onBulkVibeCheck?: () => Promise<void>; // NEW PROP
  isBulkDownloading?: boolean;
  missingAudioCount?: number;
  onOpenAdmin?: () => void;
}

const SetlistExporter: React.FC<SetlistExporterProps> = ({ 
  songs, 
  onAutoLink, 
  onGlobalAutoSync,
  onBulkRefreshAudio,
  onClearAutoLinks,
  onBulkVibeCheck, // Destructure new prop
  isBulkDownloading,
  missingAudioCount = 0,
  onOpenAdmin
}) => {
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isVibeChecking, setIsVibeChecking] = useState(false); // NEW STATE

  const isMissingLink = (url?: string) => {
    if (!url) return true;
    const clean = String(url).trim();
    return clean === "" || clean === "undefined" || clean === "null";
  };

  const missingYoutubeLinkCount = useMemo(() => { 
    return songs.filter(s => isMissingLink(s.youtubeUrl) && s.name).length;
  }, [songs]);

  const autoPopulatedCount = useMemo(() => {
    return (songs as any[]).filter(s => s.metadata_source === 'auto_populated').length;
  }, [songs]);

  const missingEnergyCount = useMemo(() => {
    return songs.filter(s => !s.energy_level && s.name && s.artist && s.bpm).length;
  }, [songs]);

  const handleAction = async (action: () => Promise<void>, setter: (v: boolean) => void, successMsg: string) => {
    setter(true);
    try {
      await action();
      showSuccess(successMsg);
    } catch (err) {
      // Errors handled by parent/toast
    } finally {
      setter(false);
    }
  };

  const handleBulkQueueClick = () => {
    console.log(`[AutomationHub] User triggered 'Queue Audio' for ${missingAudioCount} missing tracks.`);
    onBulkRefreshAudio?.();
  };

  return (
    <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm flex flex-col justify-center gap-4 transition-transform hover:scale-[1.02]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600">
            <Wand2 className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Automation Hub</p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-lg">
              <Settings2 className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border-border text-foreground rounded-xl">
            <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Maintenance Tools</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem 
              onClick={() => onOpenAdmin?.()}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
            >
              <RefreshCcw className="w-4 h-4 mr-2" /> Force Refresh All Audio
            </DropdownMenuItem>
            <DropdownMenuItem 
              disabled={autoPopulatedCount === 0 || isClearing}
              onClick={() => handleAction(onClearAutoLinks!, setIsClearing, "Auto-links cleared")}
              className="cursor-pointer"
            >
              <Undo2 className="w-4 h-4 mr-2" /> Clear Auto-Links ({autoPopulatedCount})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {/* NEW: Bulk Vibe Check */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleAction(onBulkVibeCheck!, setIsVibeChecking, "Bulk Vibe Check Complete")}
                  disabled={isVibeChecking || missingEnergyCount === 0}
                  className={cn(
                    "h-9 w-full justify-start text-[10px] font-black uppercase tracking-widest rounded-xl gap-3 relative overflow-hidden transition-all",
                    isVibeChecking ? "bg-purple-50 text-purple-600" : "text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  )}
                >
                  {isVibeChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Bulk Vibe Check ({missingEnergyCount} Missing)
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

        {/* Tier 1: iTunes -> YouTube Global Sync */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleAction(onGlobalAutoSync!, setIsSyncing, "Global Auto-Sync Pipeline Complete")}
          disabled={isSyncing || songs.length === 0}
          className={cn(
            "h-9 w-full justify-start text-[10px] font-black uppercase tracking-widest rounded-xl gap-3 relative overflow-hidden transition-all",
            isSyncing ? "bg-purple-50 text-purple-600" : "text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
          )}
        >
          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isSyncing ? "Syncing Metadata..." : "Global Auto-Sync"}
        </Button>

        {/* Tier 2: Smart-Link (Missing Only) */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleAction(onAutoLink!, setIsLinking, "AI Discovery Pipeline Complete")}
                  disabled={isLinking || missingYoutubeLinkCount === 0}
                  className={cn(
                    "h-9 w-full justify-start text-[10px] font-black uppercase tracking-widest rounded-xl gap-3 relative overflow-hidden transition-all",
                    isLinking ? "bg-indigo-50 text-indigo-400" : "text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                  )}
                >
                  {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
                  Smart-Link Missing YouTube ({missingYoutubeLinkCount})
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

        {/* Tier 3: Audio Extraction */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleBulkQueueClick}
          disabled={isBulkDownloading || missingAudioCount === 0}
          className="h-9 justify-start text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl gap-3 relative overflow-hidden"
        >
          {isBulkDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Queue Audio ({missingAudioCount} Missing Full Audio)
        </Button>
      </div>
    </div>
  );
};

export default SetlistExporter;
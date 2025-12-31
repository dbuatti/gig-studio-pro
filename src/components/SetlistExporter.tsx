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
  AlertTriangle
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
  onBulkRefreshAudio?: () => Promise<void>; // This will now queue extraction
  onClearAutoLinks?: () => Promise<void>;
  isBulkDownloading?: boolean; // Renamed from isBulkDownloading to isQueuingBulkExtraction
  missingAudioCount?: number;
  onOpenAdmin?: () => void; // Fixed: Added onOpenAdmin prop
}

const SetlistExporter: React.FC<SetlistExporterProps> = ({ 
  songs, 
  onAutoLink, 
  onGlobalAutoSync,
  onBulkRefreshAudio, // This will now queue extraction
  onClearAutoLinks,
  isBulkDownloading, // Use new state variable
  missingAudioCount = 0,
  onOpenAdmin // Destructure new prop
}) => {
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false); // This state is for the "Force Refresh All Audio" in dropdown
  const [isClearing, setIsClearing] = useState(false);

  const isMissingLink = (url?: string) => {
    if (!url) return true;
    const clean = String(url).trim();
    return clean === "" || clean === "undefined" || clean === "null";
  };

  const missingMetadataCount = useMemo(() => {
    return songs.filter(s => isMissingLink(s.youtubeUrl) && s.name).length;
  }, [songs]);

  const autoPopulatedCount = useMemo(() => {
    return (songs as any[]).filter(s => s.metadata_source === 'auto_populated').length;
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

  const copyAllYoutubeLinks = () => {
    const links = songs
      .filter(s => !isMissingLink(s.youtubeUrl))
      .map(s => s.youtubeUrl)
      .join("\n");

    if (!links) {
      showError("No YouTube links found in this setlist.");
      return;
    }

    navigator.clipboard.writeText(links);
    showSuccess("Copied all YouTube links to clipboard");
  };

  return (
    <div className="bg-slate-900 p-6 rounded-[2rem] border border-white/10 shadow-sm flex flex-col justify-center gap-4 transition-transform hover:scale-[1.02]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600">
            <Wand2 className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Automation Hub</p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 rounded-lg">
              <Settings2 className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-slate-950 border-white/10 text-white rounded-xl">
            <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500">Maintenance Tools</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem 
              onClick={() => onOpenAdmin?.()} // Direct to Admin Panel for full refresh
              className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
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
        {/* Tier 1: iTunes -> YouTube Global Sync */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleAction(onGlobalAutoSync!, setIsSyncing, "Global Auto-Sync Pipeline Complete")}
          disabled={isSyncing || songs.length === 0}
          className={cn(
            "h-9 w-full justify-start text-[10px] font-black uppercase tracking-widest rounded-xl gap-3 relative overflow-hidden transition-all",
            isSyncing ? "bg-purple-50 text-purple-600" : "text-purple-600 hover:bg-purple-50"
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
                  disabled={isLinking || missingMetadataCount === 0}
                  className={cn(
                    "h-9 w-full justify-start text-[10px] font-black uppercase tracking-widest rounded-xl gap-3 relative overflow-hidden transition-all",
                    isLinking ? "bg-indigo-50 text-indigo-400" : "text-indigo-600 hover:bg-indigo-50"
                  )}
                >
                  {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
                  Smart-Link Missing ({missingMetadataCount})
                </Button>
              </div>
            </TooltipTrigger>
            {missingMetadataCount === 0 && (
              <TooltipContent className="bg-slate-900 text-white border-white/10 text-[10px] font-black uppercase">
                All songs already have links bound.
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Tier 3: Audio Extraction */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBulkRefreshAudio} // This now queues extraction
          disabled={isBulkDownloading || missingAudioCount === 0} // Use new state variable
          className="h-9 justify-start text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 rounded-xl gap-3 relative overflow-hidden"
        >
          {isBulkDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Queue Audio ({missingAudioCount} Missing)
        </Button>
      </div>
    </div>
  );
};

export default SetlistExporter;
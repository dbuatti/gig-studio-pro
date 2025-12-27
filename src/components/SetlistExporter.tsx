"use client";

import React, { useState } from 'react';
import { SetlistSong } from './SetlistManager';
import { ClipboardCopy, Youtube, Sparkles, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess, showError } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface SetlistExporterProps {
  songs: SetlistSong[];
  onAutoLink?: () => Promise<void>;
  onDownloadAllMissingAudio?: () => Promise<void>;
  isBulkDownloading?: boolean;
  missingAudioCount?: number;
}

const SetlistExporter: React.FC<SetlistExporterProps> = ({ songs, onAutoLink, onDownloadAllMissingAudio, isBulkDownloading, missingAudioCount = 0 }) => {
  const [isLinking, setIsLinking] = useState(false);

  const handleAutoLink = async () => {
    if (!onAutoLink) return;
    
    setIsLinking(true);
    try {
      await onAutoLink();
      showSuccess("Manifest Sync Complete");
    } catch (err) {
      showError("AI Auto-link engine failed");
    } finally {
      setIsLinking(false);
    }
  };

  const copyAllYoutubeLinks = () => {
    const links = songs
      .filter(s => s.youtubeUrl)
      .map(s => s.youtubeUrl)
      .join("\n");

    if (!links) {
      showError("No YouTube links found in this setlist.");
      return;
    }

    navigator.clipboard.writeText(links);
    showSuccess("Copied all YouTube links to clipboard");
  };

  const handleBulkDownloadClick = async () => {
    if (onDownloadAllMissingAudio) {
      await onDownloadAllMissingAudio();
    }
  };

  const missingMetadataCount = songs.filter(s => !s.youtubeUrl || s.youtubeUrl.trim() === '').length;

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border shadow-sm flex flex-col justify-center gap-4 transition-transform hover:scale-[1.02]">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-8 w-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600">
          <ClipboardCopy className="w-4 h-4" />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manifest Tools</p>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleAutoLink}
                  disabled={isLinking || missingMetadataCount === 0}
                  className="h-9 w-full justify-start text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-xl gap-3 relative overflow-hidden"
                >
                  {isLinking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isLinking ? `Linking Engine Active...` : `AI Auto-Link (${missingMetadataCount} Missing)`}
                  {isLinking && <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />}
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

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleBulkDownloadClick}
          disabled={isBulkDownloading || missingAudioCount === 0}
          className="h-9 justify-start text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 rounded-xl gap-3 relative overflow-hidden"
        >
          {isBulkDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Download Audio ({missingAudioCount} Missing)
          {isBulkDownloading && <div className="absolute inset-0 bg-emerald-500/10 animate-pulse" />}
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          onClick={copyAllYoutubeLinks}
          className="h-9 justify-start text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl gap-3"
        >
          <Youtube className="w-4 h-4" /> Link Manifest (All YT)
        </Button>
      </div>
    </div>
  );
};

export default SetlistExporter;
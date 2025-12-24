"use client";

import React, { useState } from 'react';
import { SetlistSong } from './SetlistManager';
import { ClipboardCopy, Youtube, ListMusic, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess, showError } from '@/utils/toast';

interface SetlistExporterProps {
  songs: SetlistSong[];
  onAutoLink?: () => Promise<void>;
}

const SetlistExporter: React.FC<SetlistExporterProps> = ({ songs, onAutoLink }) => {
  const [isLinking, setIsLinking] = useState(false);

  const handleAutoLink = async () => {
    if (!onAutoLink) return;
    
    setIsLinking(true);
    try {
      await onAutoLink();
    } catch (err) {
      showError("Auto-link engine failed");
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

  const missingCount = songs.filter(s => !s.youtubeUrl).length;

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border shadow-sm flex flex-col justify-center gap-4 transition-transform hover:scale-[1.02]">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-8 w-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600">
          <ClipboardCopy className="w-4 h-4" />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manifest Tools</p>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleAutoLink}
          disabled={isLinking || missingCount === 0}
          className="h-9 justify-start text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-xl gap-3 relative overflow-hidden"
        >
          {isLinking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          AI Auto-Link ({missingCount} Missing)
          {isLinking && <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />}
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
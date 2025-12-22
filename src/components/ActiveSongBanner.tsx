"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { Music, Youtube, Copy, Play, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface ActiveSongBannerProps {
  song: SetlistSong | null;
  onClear?: () => void;
}

const ActiveSongBanner: React.FC<ActiveSongBannerProps> = ({ song }) => {
  if (!song) return null;

  const handleCopyLink = () => {
    if (song.youtubeUrl) {
      navigator.clipboard.writeText(song.youtubeUrl);
      showSuccess("YouTube link copied to clipboard");
    }
  };

  return (
    <div className="sticky top-0 z-20 mb-6 animate-in slide-in-from-top duration-300">
      <div className="bg-indigo-600 rounded-2xl shadow-xl overflow-hidden border-b-4 border-indigo-800">
        <div className="bg-indigo-700/50 px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-indigo-200 animate-pulse" />
            <span className="text-[9px] font-black text-indigo-100 uppercase tracking-[0.2em]">Active Performance Slot</span>
          </div>
          <div className="text-[9px] font-mono text-indigo-200 uppercase">Engine: Low Latency</div>
        </div>
        
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
              <Play className="w-6 h-6 text-white fill-current" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white uppercase tracking-tight truncate leading-none">
                {song.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider opacity-80">{song.artist || "Unknown Artist"}</span>
                <div className="w-1 h-1 rounded-full bg-indigo-400" />
                <span className="text-xs font-mono font-bold text-white bg-indigo-500/50 px-1.5 rounded">{song.targetKey || song.originalKey}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {song.youtubeUrl && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleCopyLink}
                className="bg-white/10 hover:bg-white/20 border-white/10 text-white font-bold text-[10px] uppercase gap-2 h-9"
              >
                <Copy className="w-4 h-4" /> Copy URL
              </Button>
            )}
            <div className="h-9 w-px bg-white/10 mx-1" />
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black text-indigo-200 uppercase tracking-widest">Pitch Shift</span>
              <span className="text-sm font-mono font-bold text-white">{song.pitch > 0 ? '+' : ''}{song.pitch} ST</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveSongBanner;
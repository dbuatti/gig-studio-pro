"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { 
  Music, Copy, Play, Pause, Activity, 
  Gauge, Sparkles, Tag, Apple, 
  X, CloudDownload, AlertTriangle, Loader2, 
  SkipBack, SkipForward 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess } from '@/utils/toast';
import { formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';

interface ActiveSongBannerProps {
  song: SetlistSong | null;
  isPlaying?: boolean;
  onTogglePlayback?: () => void;
  onClear?: () => void;
  isLoadingAudio?: boolean;
  nextSongName?: string | null;
  onNext?: () => void;
  onPrevious?: () => void;
}

const ActiveSongBanner: React.FC<ActiveSongBannerProps> = ({ 
  song, 
  isPlaying, 
  onTogglePlayback, 
  onClear, 
  isLoadingAudio, 
  nextSongName,
  onNext,
  onPrevious
}) => {
  const { keyPreference: globalPreference } = useSettings();
  if (!song) return null;

  const handleCopyLink = () => {
    if (song.youtubeUrl) {
      navigator.clipboard.writeText(song.youtubeUrl);
      showSuccess("YouTube link copied to clipboard");
    }
  };

  const currentPref = song.key_preference || globalPreference;
  const displayKey = formatKey(song.targetKey || song.originalKey, currentPref);

  const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
  const isExtractionFailed = song.extraction_status === 'failed';

  return (
    <div className="sticky top-0 z-20 mb-10 animate-in slide-in-from-top duration-700">
      <div className="bg-slate-900/95 backdrop-blur-3xl rounded-[2rem] md:rounded-[2.5rem] shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden border border-white/[0.06]">
        {/* Top Bar */}
        <div className="px-6 md:px-10 py-3 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-1.5 w-1.5 rounded-full",
              isPlaying ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-slate-600"
            )} />
            <span className="text-[9px] md:text-[10px] font-semibold text-slate-500 uppercase tracking-[0.25em]">
              {isPlaying ? 'Now Playing' : 'Ready'}
            </span>
          </div>
          <div className="flex gap-3 items-center">
            {nextSongName && (
              <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] rounded-lg border border-white/[0.04]">
                <SkipForward className="w-3 h-3 text-slate-500" />
                <span className="text-[10px] font-medium text-slate-500 truncate max-w-[180px]">Next: {nextSongName}</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClear}
              className="h-7 w-7 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
          <div className="flex items-center gap-6 md:gap-10 w-full md:min-w-0">
            {/* Controls */}
            <div className="flex items-center gap-2 md:gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onPrevious}
                className="h-10 w-10 md:h-12 md:w-12 rounded-full hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all active:scale-90"
              >
                <SkipBack className="w-4 h-4 md:w-5 md:h-5" />
              </Button>

              <Button
                onClick={onTogglePlayback}
                disabled={isLoadingAudio}
                className={cn(
                  "h-14 w-14 md:h-18 md:w-18 rounded-2xl md:rounded-[1.75rem] flex items-center justify-center shrink-0 shadow-xl transition-all active:scale-95",
                  isLoadingAudio 
                    ? "bg-slate-800 border border-white/5 cursor-not-allowed" 
                    : isPlaying 
                      ? "bg-white text-slate-900 hover:bg-slate-100 shadow-white/10" 
                      : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
                )}
              >
                {isLoadingAudio ? (
                  <Loader2 className="w-6 md:w-7 h-6 md:h-7 animate-spin text-slate-400" />
                ) : isPlaying ? (
                  <Pause className="w-6 md:w-7 h-6 md:h-7 fill-current" />
                ) : (
                  <Play className="w-6 md:w-7 h-6 md:h-7 fill-current ml-0.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onNext}
                className="h-10 w-10 md:h-12 md:w-12 rounded-full hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-all active:scale-90"
              >
                <SkipForward className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>

            {/* Song Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2">
                {isProcessing && <CloudDownload className="w-4 h-4 text-indigo-400 animate-bounce" />}
                {isExtractionFailed && <AlertTriangle className="w-4 h-4 text-red-400" />}
              </div>
              <h2 className="text-2xl md:text-5xl font-bold text-white tracking-tight truncate leading-none">
                {song.name}
              </h2>
              <div className="flex items-center gap-3 mt-2 md:mt-3">
                <span className="text-sm md:text-lg font-medium text-slate-400 truncate">{song.artist || "Unknown Artist"}</span>
                <span className="text-slate-700">·</span>
                <span className="text-sm md:text-sm font-mono font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/10">
                  {displayKey}
                </span>
              </div>
            </div>
          </div>

          {/* Stats & Links */}
          <div className="flex flex-col sm:flex-row items-center gap-6 md:gap-12 w-full md:w-auto md:shrink-0">
            <div className="flex justify-between md:justify-start w-full md:w-auto gap-8 md:gap-12 border-t md:border-t-0 md:border-l border-white/[0.04] pt-6 md:pt-0 md:pl-12">
              <div className="flex flex-col items-center">
                <span className="text-[9px] md:text-[10px] font-semibold text-slate-600 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                  <Gauge className="w-3 h-3" /> BPM
                </span>
                <span className="text-lg md:text-2xl font-bold text-slate-300 font-mono">{song.bpm || "—"}</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] md:text-[10px] font-semibold text-slate-600 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Vibe
                </span>
                <span className="text-lg md:text-2xl font-bold text-slate-300 truncate max-w-[120px] md:max-w-[180px]">{song.genre || "—"}</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] md:text-[10px] font-semibold text-slate-600 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                  <Activity className="w-3 h-3" /> Pitch
                </span>
                <span className="text-lg md:text-2xl font-bold text-slate-300 font-mono">
                  {(song.pitch || 0) > 0 ? '+' : ''}{song.pitch || 0} <span className="text-xs text-slate-600">ST</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              {song.appleMusicUrl && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => window.open(song.appleMusicUrl, '_blank')}
                  className="h-9 md:h-10 px-4 bg-white/[0.03] hover:bg-white/[0.06] text-slate-400 font-semibold text-[10px] md:text-[11px] uppercase tracking-wider gap-2 rounded-xl border border-white/[0.04] transition-all"
                >
                  <Apple className="w-3.5 h-3.5" /> Music
                </Button>
              )}
              {song.youtubeUrl && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCopyLink}
                  className="h-9 md:h-10 px-4 bg-white/[0.03] hover:bg-white/[0.06] text-slate-400 font-semibold text-[10px] md:text-[11px] uppercase tracking-wider gap-2 rounded-xl border border-white/[0.04] transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveSongBanner;
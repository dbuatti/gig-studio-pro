"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { 
  Music, Youtube, Copy, Play, Pause, Activity, 
  Gauge, Sparkles, Tag, Apple, ExternalLink, 
  X, CloudDownload, AlertTriangle, Loader2, 
  FastForward, SkipBack, SkipForward 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
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
    <div className="sticky top-0 z-20 mb-6 animate-in slide-in-from-top duration-500">
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden border-2 md:border-4 border-indigo-600/20">
        {/* Top Bar */}
        <div className="bg-indigo-600 px-4 md:px-6 py-1.5 md:py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <Activity className="w-3 h-3 md:w-4 md:h-4 text-indigo-200 animate-pulse" />
            <span className="text-[8px] md:text-[10px] font-black text-indigo-100 uppercase tracking-[0.2em] md:tracking-[0.3em] font-mono">Live Telemetry</span>
          </div>
          <div className="flex gap-2 md:gap-4 items-center">
            {nextSongName && (
              <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-0.5 md:py-1 bg-black/20 rounded-lg">
                <FastForward className="w-2.5 h-2.5 md:w-3 md:h-3 text-indigo-300" />
                <span className="text-[8px] md:text-[9px] font-black text-indigo-100 uppercase truncate max-w-[80px] md:max-w-[150px]">Next: {nextSongName}</span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-[9px] font-mono text-indigo-100 font-bold uppercase">Engine: Stable</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClear}
              className="h-5 w-5 md:h-6 md:w-6 text-indigo-100 hover:text-white hover:bg-white/10 rounded-full"
            >
              <X className="w-3 h-3 md:w-3.5 md:h-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="p-4 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 bg-gradient-to-br from-slate-900 to-indigo-950/30">
          <div className="flex items-center gap-4 md:gap-6 w-full md:min-w-0">
            {/* Controls */}
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onPrevious}
                className="h-8 w-8 md:h-10 md:w-10 rounded-full hover:bg-white/10 text-slate-400"
                title="Previous Song"
              >
                <SkipBack className="w-4 h-4 md:w-5 md:h-5" />
              </Button>

              <Button 
                onClick={onTogglePlayback}
                disabled={isLoadingAudio}
                className={cn(
                  "h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-all active:scale-95",
                  isLoadingAudio ? "bg-slate-600 cursor-not-allowed" : isPlaying ? "bg-red-600 hover:bg-red-700 shadow-red-600/20" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
                )}
              >
                {isLoadingAudio ? (
                  <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-white" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 md:w-8 md:h-8 text-white fill-current" />
                ) : (
                  <Play className="w-6 h-6 md:w-8 md:h-8 text-white fill-current ml-1" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onNext}
                className="h-8 w-8 md:h-10 md:w-10 rounded-full hover:bg-white/10 text-slate-400"
                title="Next Song"
              >
                <SkipForward className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>

            {/* Song Info */}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-tighter truncate leading-none">
                {song.name}
              </h2>
              <div className="flex items-center gap-2 md:gap-3 mt-1 md:mt-2">
                <span className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-wider truncate max-w-[100px] md:max-w-none">{song.artist || "Unknown Artist"}</span>
                <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-slate-700" />
                <span className="text-[10px] md:text-sm font-mono font-bold text-indigo-400 bg-indigo-400/10 px-1.5 md:px-2 rounded">{displayKey}</span>
                {isProcessing && <CloudDownload className="w-3 h-3 md:w-4 md:h-4 text-indigo-300 animate-bounce" />}
                {isExtractionFailed && <AlertTriangle className="w-3 h-3 md:w-4 md:h-4 text-red-400" />}
              </div>
            </div>
          </div>

          {/* Stats & Links */}
          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-10 w-full md:w-auto md:shrink-0">
            <div className="flex justify-between md:justify-start w-full md:w-auto gap-4 md:gap-8 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-8">
              <div className="flex flex-col items-center">
                <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5 md:mb-1 flex items-center gap-1 md:gap-1.5 font-mono">
                  <Gauge className="w-2.5 h-2.5 md:w-3 md:h-3" /> Tempo
                </span>
                <span className="text-sm md:text-xl font-black text-white font-mono">{song.bpm || "--"} <span className="text-[8px] md:text-[10px] text-slate-500">BPM</span></span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5 md:mb-1 flex items-center gap-1 md:gap-1.5 font-mono">
                  <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3" /> Vibe
                </span>
                <span className="text-sm md:text-xl font-black text-white font-mono uppercase truncate max-w-[80px] md:max-w-[120px]">{song.genre || "Standard"}</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5 md:mb-1 flex items-center gap-1 md:gap-1.5 font-mono">
                  <Activity className="w-2.5 h-2.5 md:w-3 md:h-3" /> Pitch
                </span>
                <span className="text-sm md:text-xl font-black text-white font-mono">{(song.pitch || 0) > 0 ? '+' : ''}{song.pitch || 0} <span className="text-[8px] md:text-[10px] text-slate-500">ST</span></span>
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center w-full md:w-auto gap-3">
              <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-[180px]">
                {(song.user_tags || []).slice(0, 3).map(tag => (
                  <Badge key={tag} variant="secondary" className="bg-white/5 text-[7px] md:text-[8px] font-black uppercase text-indigo-300 border-white/5 px-1.5 md:px-2 py-0.5 font-mono">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                {song.appleMusicUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => window.open(song.appleMusicUrl, '_blank')}
                    className="flex-1 md:flex-none h-8 md:h-9 px-3 md:px-4 bg-red-600/10 hover:bg-red-600/20 text-red-400 font-bold text-[9px] md:text-[10px] uppercase gap-1.5 md:gap-2 rounded-lg md:rounded-xl font-mono"
                  >
                    <Apple className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="sm:inline">Music</span>
                  </Button>
                )}
                {song.youtubeUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCopyLink}
                    className="flex-1 md:flex-none h-8 md:h-9 px-3 md:px-4 bg-white/5 hover:bg-white/10 text-white font-bold text-[9px] md:text-[10px] uppercase gap-1.5 md:gap-2 rounded-lg md:rounded-xl font-mono"
                  >
                    <Copy className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="sm:inline">Copy</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveSongBanner;
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
    <div className="sticky top-0 z-20 mb-10 animate-in slide-in-from-top duration-700">
      <div className="bg-slate-900/95 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_0_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden border-2 md:border-4 border-indigo-500/20">
        {/* Top Bar */}
        <div className="bg-indigo-600/90 px-6 md:px-12 py-2.5 md:py-3.5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="h-2 w-2 rounded-full bg-indigo-200 animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
            <span className="text-[9px] md:text-[11px] font-black text-indigo-50 uppercase tracking-[0.4em] font-mono">Live Performance Engine v4.2</span>
          </div>
          <div className="flex gap-4 md:gap-10 items-center">
            {nextSongName && (
              <div className="flex items-center gap-2 md:gap-3 px-4 py-1.5 bg-black/30 rounded-full border border-white/5">
                <FastForward className="w-3.5 h-3.5 text-indigo-300" />
                <span className="text-[9px] md:text-[10px] font-black text-indigo-100 uppercase truncate max-w-[120px] md:max-w-[250px]">Next: {nextSongName}</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClear}
              className="h-7 w-7 md:h-9 md:w-9 text-indigo-100 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </Button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="p-8 md:p-14 flex flex-col md:flex-row items-center justify-between gap-10 md:gap-16 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50">
          <div className="flex items-center gap-8 md:gap-14 w-full md:min-w-0">
            {/* Controls */}
            <div className="flex items-center gap-3 md:gap-5">
              <Button
                variant="ghost"
                size="icon"
                onClick={onPrevious}
                className="h-12 w-12 md:h-16 md:w-16 rounded-full hover:bg-white/5 text-slate-500 transition-all active:scale-90"
                title="Previous Song"
              >
                <SkipBack className="w-6 h-6 md:w-8 md:h-8" />
              </Button>

              <Button
                onClick={onTogglePlayback}
                disabled={isLoadingAudio}
                className={cn(
                  "h-20 w-16 md:h-28 md:w-28 rounded-3xl md:rounded-[2.5rem] flex items-center justify-center shrink-0 shadow-2xl transition-all active:scale-95",
                  isLoadingAudio ? "bg-slate-700 cursor-not-allowed" : isPlaying ? "bg-red-600 hover:bg-red-700 shadow-red-600/40" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/40"
                )}
              >
                {isLoadingAudio ? (
                  <Loader2 className="w-10 md:w-14 h-10 md:h-14 animate-spin text-white" />
                ) : isPlaying ? (
                  <Pause className="w-10 md:w-14 h-10 md:h-14 text-white fill-current" />
                ) : (
                  <Play className="w-10 md:w-14 h-10 md:h-14 text-white fill-current ml-2 md:ml-3" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onNext}
                className="h-12 w-12 md:h-16 md:w-16 rounded-full hover:bg-white/5 text-slate-500 transition-all active:scale-90"
                title="Next Song"
              >
                <SkipForward className="w-6 h-6 md:w-8 md:h-8" />
              </Button>
            </div>

            {/* Song Info */}
            <div className="min-w-0 flex-1">
              <h2 className="text-3xl md:text-7xl font-black text-white uppercase tracking-tighter truncate leading-none drop-shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                {song.name}
              </h2>
              <div className="flex items-center gap-4 md:gap-6 mt-3 md:mt-5">
                <span className="text-sm md:text-2xl font-bold text-slate-400 uppercase tracking-[0.15em] truncate max-w-[150px] md:max-w-none">{song.artist || "Unknown Artist"}</span>
                <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-slate-800" />
                <span className="text-sm md:text-2xl font-mono font-black text-indigo-400 bg-indigo-400/10 px-3 md:px-4 py-1 md:py-1.5 rounded-xl border border-indigo-400/20 shadow-lg">{displayKey}</span>
                {isProcessing && <CloudDownload className="w-5 h-5 md:w-8 md:h-8 text-indigo-300 animate-bounce" />}
                {isExtractionFailed && <AlertTriangle className="w-5 h-5 md:w-8 md:h-8 text-red-400" />}
              </div>
            </div>
          </div>

          {/* Stats & Links */}
          <div className="flex flex-col sm:flex-row items-center gap-8 md:gap-20 w-full md:w-auto md:shrink-0">
            <div className="flex justify-between md:justify-start w-full md:w-auto gap-10 md:gap-20 border-t md:border-t-0 md:border-l border-white/10 pt-8 md:pt-0 md:pl-20">
              <div className="flex flex-col items-center">
                <span className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 md:mb-3 flex items-center gap-2 font-mono">
                  <Gauge className="w-3.5 h-3.5 md:w-4.5 md:h-4.5" /> Tempo
                </span>
                <span className="text-xl md:text-4xl font-black text-white font-mono">{song.bpm || "--"} <span className="text-[10px] md:text-sm text-slate-600">BPM</span></span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 md:mb-3 flex items-center gap-2 font-mono">
                  <Sparkles className="w-3.5 h-3.5 md:w-4.5 md:h-4.5" /> Vibe
                </span>
                <span className="text-xl md:text-4xl font-black text-white font-mono uppercase truncate max-w-[100px] md:max-w-[200px]">{song.genre || "Standard"}</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 md:mb-3 flex items-center gap-2 font-mono">
                  <Activity className="w-3.5 h-3.5 md:w-4.5 md:h-4.5" /> Pitch
                </span>
                <span className="text-xl md:text-4xl font-black text-white font-mono">{(song.pitch || 0) > 0 ? '+' : ''}{song.pitch || 0} <span className="text-[10px] md:text-sm text-slate-600">ST</span></span>
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center w-full md:w-auto gap-5">
              <div className="hidden sm:flex flex-wrap gap-2.5 justify-end max-w-[250px]">
                {(song.user_tags || []).slice(0, 3).map(tag => (
                  <Badge key={tag} variant="secondary" className="bg-white/5 text-[9px] md:text-[11px] font-black uppercase text-indigo-300 border-white/10 px-3 md:px-4 py-1.5 font-mono rounded-xl">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                {song.appleMusicUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => window.open(song.appleMusicUrl, '_blank')}
                    className="flex-1 md:flex-none h-11 md:h-14 px-5 md:px-8 bg-red-600/10 hover:bg-red-600/20 text-red-400 font-black text-[10px] md:text-[12px] uppercase gap-3 rounded-2xl font-mono transition-all shadow-lg"
                  >
                    <Apple className="w-4.5 h-4.5 md:w-5.5 md:h-5.5" /> <span className="sm:inline">Music</span>
                  </Button>
                )}
                {song.youtubeUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCopyLink}
                    className="flex-1 md:flex-none h-11 md:h-14 px-5 md:px-8 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] md:text-[12px] uppercase gap-3 rounded-2xl font-mono transition-all shadow-lg"
                  >
                    <Copy className="w-4.5 h-4.5 md:w-5.5 md:h-5.5" /> <span className="sm:inline">Copy</span>
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
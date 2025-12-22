"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { Music, Youtube, Copy, Play, Pause, Activity, Gauge, Sparkles, Tag, Apple, ExternalLink, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showSuccess, showError } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';

interface ActiveSongBannerProps {
  song: SetlistSong | null;
  isPlaying?: boolean;
  onTogglePlayback?: () => void;
  onClear?: () => void;
}

const ActiveSongBanner: React.FC<ActiveSongBannerProps> = ({ song, isPlaying, onTogglePlayback, onClear }) => {
  const { keyPreference: globalPreference } = useSettings();
  if (!song) return null;

  const handleCopyLink = () => {
    if (song.youtubeUrl) {
      navigator.clipboard.writeText(song.youtubeUrl);
      showSuccess("YouTube link copied to clipboard");
    }
  };

  const handleOnSongImport = () => {
    if (!song.ugUrl && !song.lyrics) {
      showError("No chords or link available to import.");
      return;
    }

    if (song.ugUrl) {
      window.location.href = `onsong://import?url=${encodeURIComponent(song.ugUrl)}`;
      showSuccess("Opening OnSong Import...");
    } else {
      const text = `${song.name}\n${song.artist}\nKey: ${song.targetKey || song.originalKey}\nTempo: ${song.bpm}\n---\n${song.lyrics}`;
      window.location.href = `onsong://import?text=${encodeURIComponent(text)}`;
      showSuccess("Sending chords to OnSong...");
    }
  };

  const currentPref = song.key_preference || globalPreference;
  const displayKey = formatKey(song.targetKey || song.originalKey, currentPref);

  return (
    <div className="sticky top-0 z-20 mb-6 animate-in slide-in-from-top duration-500">
      <div className="bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden border-4 border-indigo-600/20">
        <div className="bg-indigo-600 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-indigo-200 animate-pulse" />
            <span className="text-[10px] font-black text-indigo-50 uppercase tracking-[0.3em] font-mono">Live Performance Telemetry</span>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-[9px] font-mono text-indigo-100 font-bold uppercase">Engine: Stable</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClear}
              className="h-6 w-6 text-indigo-100 hover:text-white hover:bg-white/10 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        
        <div className="p-8 flex items-center justify-between gap-8 bg-gradient-to-br from-slate-900 to-indigo-950/30">
          <div className="flex items-center gap-6 min-w-0">
            <Button 
              onClick={onTogglePlayback}
              className="h-16 w-16 bg-indigo-600 hover:bg-indigo-700 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20 p-0 transition-all active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-white fill-current" />
              ) : (
                <Play className="w-8 h-8 text-white fill-current ml-1" />
              )}
            </Button>
            <div className="min-w-0">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter truncate leading-none">
                {song.name}
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">{song.artist || "Unknown Artist"}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                <span className="text-sm font-mono font-bold text-indigo-400 bg-indigo-400/10 px-2 rounded">{displayKey}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-10 shrink-0">
            <div className="flex gap-8 border-l border-white/5 pl-8">
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
                  <Gauge className="w-3 h-3" /> Tempo
                </span>
                <span className="text-xl font-black text-white font-mono">{song.bpm || "--"} <span className="text-[10px] text-slate-500">BPM</span></span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
                  <Sparkles className="w-3 h-3" /> Vibe
                </span>
                <span className="text-xl font-black text-white font-mono uppercase truncate max-w-[120px]">{song.genre || "Standard"}</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-mono">
                  <Activity className="w-3 h-3" /> Pitch
                </span>
                <span className="text-xl font-black text-white font-mono">{song.pitch > 0 ? '+' : ''}{song.pitch} <span className="text-[10px] text-slate-500">ST</span></span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1 justify-end max-w-[180px]">
                {(song.user_tags || []).slice(0, 3).map(tag => (
                  <Badge key={tag} variant="secondary" className="bg-white/5 text-[8px] font-black uppercase text-indigo-300 border-white/5 px-2 py-0.5 font-mono">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleOnSongImport}
                  className="h-9 px-4 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-bold text-[10px] uppercase gap-2 rounded-xl font-mono"
                >
                  <Smartphone className="w-3.5 h-3.5" /> OnSong
                </Button>
                {song.appleMusicUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => window.open(song.appleMusicUrl, '_blank')}
                    className="h-9 px-4 bg-red-600/10 hover:bg-red-600/20 text-red-400 font-bold text-[10px] uppercase gap-2 rounded-xl font-mono"
                  >
                    <Apple className="w-3.5 h-3.5" /> Music
                  </Button>
                )}
                {song.youtubeUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCopyLink}
                    className="h-9 px-4 bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] uppercase gap-2 rounded-xl font-mono"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Link
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
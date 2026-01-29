"use client";

import React from 'react';
import { SetlistSong } from './SetlistManagementModal';
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
  song: SetlistSong;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onClear: () => void;
  isLoadingAudio: boolean;
  nextSongName?: string;
  onNext: () => void;
  onPrevious: () => void;
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
  const { keyPreference } = useSettings();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const handleCopyLink = () => {
    if (song.youtubeUrl) {
      navigator.clipboard.writeText(song.youtubeUrl);
      showSuccess("YouTube Link Copied!");
    } else {
      showSuccess("No YouTube link available.");
    }
  };

  const handleOpenInApp = (url?: string) => {
    if (url) window.open(url, '_blank');
    else showWarning("No link available for this resource.");
  };

  const displayKey = formatKey(song.targetKey || song.originalKey, keyPreference);
  const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
  const isExtractionFailed = song.extraction_status === 'failed';

  return (
    <div className="bg-card border border-border rounded-[2rem] p-4 flex items-center justify-between shadow-xl animate-in fade-in duration-500 gap-4">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={onTogglePlayback} className="h-12 w-12 rounded-full bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 transition-all active:scale-95">
            {isLoadingAudio || isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </Button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-sm font-black uppercase tracking-tight truncate text-foreground">{song.name}</p>
            {isExtractionFailed && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 truncate">{song.artist || "Unknown Artist"}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-center hidden md:block">
          <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Key</p>
          <p className="text-sm font-mono font-bold text-indigo-400">{displayKey || '--'}</p>
        </div>
        
        <div className="hidden sm:flex items-center gap-2">
          {song.youtubeUrl && (
            <Button variant="ghost" size="icon" onClick={() => handleOpenInApp(song.youtubeUrl)} className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10">
              <Youtube className="w-4 h-4" />
            </Button>
          )}
          {song.audio_url && (
            <Button variant="ghost" size="icon" onClick={handleCopyLink} className="h-9 w-9 rounded-lg text-emerald-500 hover:bg-emerald-500/10">
              <Copy className="w-4 h-4" />
            </Button>
          )}
          {song.pdfUrl || song.sheet_music_url ? (
            <Button variant="ghost" size="icon" onClick={() => showInfo("PDF/Sheet Music is available in Reader Mode")} className="h-9 w-9 rounded-lg text-blue-500 hover:bg-blue-500/10">
              <FileText className="w-4 h-4" />
            </Button>
          ) : null}
        </div>

        <Button variant="ghost" size="icon" onClick={onClear} className="h-9 w-9 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 ml-2" title="Stop Playback & Clear Song">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ActiveSongBanner;
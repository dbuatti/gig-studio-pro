"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { Clock, Music, Zap, Target, Copy, Check, PlayCircle, Shuffle, Square, BookOpen } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { showSuccess } from '@/utils/toast';
import { calculateReadiness } from '@/utils/repertoireSync';
import { partitionSongsByAudio } from '@/utils/playbackQueue';
import { Button } from './ui/button';

interface SetlistStatsProps {
  songs: SetlistSong[];
  goalSeconds?: number;
  onUpdateGoal?: (seconds: number) => void;
  onPlayAll?: () => void;
  onShuffleAll?: () => void;
  onShuffleReader?: () => void;
  isAutoplayActive?: boolean;
}

const SetlistStats: React.FC<SetlistStatsProps> = ({
  songs,
  goalSeconds = 7200,
  onUpdateGoal,
  onPlayAll,
  onShuffleAll,
  onShuffleReader,
  isAutoplayActive = false
}) => {
  const [isCopied, setIsCopied] = React.useState(false);
  const totalSeconds = songs.reduce((acc, song) => acc + (song.duration_seconds || 0), 0);
  const progress = Math.min(100, (totalSeconds / goalSeconds) * 100);
  const { playable, skipped } = partitionSongsByAudio(songs);
  const averageReadiness = songs.length > 0
    ? Math.round(songs.reduce((acc, song) => acc + calculateReadiness(song), 0) / songs.length)
    : 0;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const energyCounts = songs.reduce((acc, song) => {
    const zone = song.energy_level || 'Unknown';
    acc[zone] = (acc[zone] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleCopySetlist = () => {
    const text = songs.map((song, index) =>
      `${(index + 1).toString().padStart(2, '0')}. ${song.name} - ${song.artist} [${song.targetKey || song.originalKey || 'TBC'}] (${song.energy_level || '?'})`
    ).join('\n');

    void navigator.clipboard.writeText(`SETLIST: \n\n${text}\n\nTotal Duration: ${formatTime(totalSeconds)}`);
    setIsCopied(true);
    showSuccess("Setlist copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const cardClass = "rounded-2xl border border-studio-border bg-studio-surface p-4 md:p-5 shadow-sm";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className={`${cardClass} relative`}>
        <button
          type="button"
          onClick={handleCopySetlist}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl text-studio-muted transition-colors hover:bg-white/5 hover:text-white"
          title="Copy setlist to clipboard"
          aria-label="Copy setlist to clipboard"
        >
          {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="studio-eyebrow">Total duration</p>
            <h3 className="mt-1 text-xl font-bold text-white">{formatTime(totalSeconds)}</h3>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider">
            <span className="text-studio-muted">Goal: {formatTime(goalSeconds)}</span>
            <span className="text-indigo-400">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5 bg-white/5" />
        </div>
      </div>

      <div className={`${cardClass} flex flex-col`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Music className="h-5 w-5" />
          </div>
          <div>
            <p className="studio-eyebrow">Track count</p>
            <h3 className="mt-1 text-xl font-bold text-white">
              {songs.length} <span className="text-xs font-medium text-studio-muted">songs</span>
            </h3>
          </div>
        </div>
        <p className="mt-3 text-xs text-studio-muted">
          {playable.length} playable{skipped.length > 0 ? ` · ${skipped.length} without audio` : ''}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <Button
            onClick={onPlayAll}
            disabled={!onPlayAll || playable.length === 0}
            className="h-11 min-w-[132px] flex-1 rounded-xl bg-indigo-600 px-3 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-indigo-500"
          >
            {isAutoplayActive ? <Square className="h-3.5 w-3.5 fill-current" /> : <PlayCircle className="h-4 w-4" />}
            {isAutoplayActive ? 'Stop queue' : `Play visible (${playable.length})`}
          </Button>
          {onShuffleAll && !isAutoplayActive && (
            <Button
              onClick={onShuffleAll}
              disabled={playable.length < 2}
              className="h-11 rounded-xl border border-studio-border bg-white/5 px-3 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-white/10"
            >
              <Shuffle className="h-3.5 w-3.5" /> Shuffle
            </Button>
          )}
          {onShuffleReader && (
            <Button
              onClick={onShuffleReader}
              className="h-11 rounded-xl border border-studio-border bg-white/5 px-3 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-white/10"
            >
              <BookOpen className="h-3.5 w-3.5" /> Shuffle Reader
            </Button>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="studio-eyebrow">Energy mix</p>
            <h3 className="mt-1 text-xl font-bold text-white">
              {energyCounts['Peak'] || 0} <span className="text-xs font-medium text-studio-muted">peak</span>
            </h3>
          </div>
        </div>
        <div className="mt-5 flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div className="bg-red-500" style={{ width: `${((energyCounts['Peak'] || 0) / Math.max(1, songs.length)) * 100}%` }} />
          <div className="bg-amber-500" style={{ width: `${((energyCounts['Groove'] || 0) / Math.max(1, songs.length)) * 100}%` }} />
          <div className="bg-emerald-500" style={{ width: `${((energyCounts['Pulse'] || 0) / Math.max(1, songs.length)) * 100}%` }} />
          <div className="bg-blue-500" style={{ width: `${((energyCounts['Ambient'] || 0) / Math.max(1, songs.length)) * 100}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-semibold uppercase tracking-wider text-studio-muted">
          <span>Ambient {energyCounts['Ambient'] || 0}</span>
          <span>Pulse {energyCounts['Pulse'] || 0}</span>
          <span>Groove {energyCounts['Groove'] || 0}</span>
          <span>Peak {energyCounts['Peak'] || 0}</span>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="studio-eyebrow">Avg readiness</p>
            <h3 className="mt-1 text-xl font-bold text-white">{averageReadiness}%</h3>
          </div>
        </div>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full bg-violet-500" style={{ width: `${averageReadiness}%` }} />
        </div>
        <p className="mt-3 text-xs text-studio-muted">
          {songs.filter((song) => calculateReadiness(song) >= 90).length} of {songs.length} songs ready
        </p>
      </div>
    </div>
  );
};

export default SetlistStats;

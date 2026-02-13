"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { Clock, Music, Zap, Target, Share2, Copy, Check } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { cn } from '@/lib/utils';
import { showSuccess } from '@/utils/toast';
import { calculateReadiness } from '@/utils/repertoireSync';

interface SetlistStatsProps {
  songs: SetlistSong[];
  goalSeconds?: number;
  onUpdateGoal?: (seconds: number) => void;
}

const SetlistStats: React.FC<SetlistStatsProps> = ({ songs, goalSeconds = 7200, onUpdateGoal }) => {
  const [isCopied, setIsCopied] = React.useState(false);
  const totalSeconds = songs.reduce((acc, song) => acc + (song.duration_seconds || 0), 0);
  const progress = Math.min(100, (totalSeconds / goalSeconds) * 100);
  
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
    const text = songs.map((s, i) => 
      `${(i + 1).toString().padStart(2, '0')}. ${s.name} - ${s.artist} [${s.targetKey || s.originalKey || 'TBC'}] (${s.energy_level || '?'})`
    ).join('\n');
    
    navigator.clipboard.writeText(`SETLIST: \n\n${text}\n\nTotal Duration: ${formatTime(totalSeconds)}`);
    setIsCopied(true);
    showSuccess("Setlist copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-xl backdrop-blur-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={handleCopySetlist}
            className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20 hover:scale-110 transition-transform"
            title="Copy Setlist to Clipboard"
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-indigo-600/10 p-3 rounded-2xl text-indigo-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Duration</p>
            <h3 className="text-2xl font-black text-white">{formatTime(totalSeconds)}</h3>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-slate-500">Goal: {formatTime(goalSeconds)}</span>
            <span className="text-indigo-400">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5 bg-slate-800" />
        </div>
      </div>

      <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-emerald-600/10 p-3 rounded-2xl text-emerald-400">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Track Count</p>
            <h3 className="text-2xl font-black text-white">{songs.length} <span className="text-sm text-slate-500 font-bold">Songs</span></h3>
          </div>
        </div>
        <div className="flex gap-1.5">
          {songs.slice(0, 8).map((_, i) => (
            <div key={i} className="h-1.5 flex-1 bg-emerald-500/20 rounded-full" />
          ))}
          {songs.length > 8 && <div className="text-[8px] font-black text-slate-600 self-center ml-1">+{songs.length - 8}</div>}
        </div>
      </div>

      <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-amber-600/10 p-3 rounded-2xl text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Energy Mix</p>
            <h3 className="text-2xl font-black text-white">{energyCounts['Peak'] || 0} <span className="text-sm text-slate-500 font-bold">Peak</span></h3>
          </div>
        </div>
        <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-800">
          <div className="bg-red-500" style={{ width: `${((energyCounts['Peak'] || 0) / songs.length) * 100}%` }} />
          <div className="bg-amber-500" style={{ width: `${((energyCounts['Groove'] || 0) / songs.length) * 100}%` }} />
          <div className="bg-emerald-500" style={{ width: `${((energyCounts['Pulse'] || 0) / songs.length) * 100}%` }} />
          <div className="bg-blue-500" style={{ width: `${((energyCounts['Ambient'] || 0) / songs.length) * 100}%` }} />
        </div>
      </div>

      <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-purple-600/10 p-3 rounded-2xl text-purple-400">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Avg Readiness</p>
            <h3 className="text-2xl font-black text-white">
              {songs.length > 0 ? Math.round(songs.reduce((acc, s) => acc + calculateReadiness(s), 0) / songs.length) : 0}%
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-600" 
              style={{ width: `${songs.length > 0 ? songs.reduce((acc, s) => acc + calculateReadiness(s), 0) / songs.length : 0}%` }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetlistStats;
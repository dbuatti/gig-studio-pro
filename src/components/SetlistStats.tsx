"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { Clock, Music, CheckCircle2, Zap, BarChart3 } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface SetlistStatsProps {
  songs: SetlistSong[];
}

const SetlistStats: React.FC<SetlistStatsProps> = ({ songs }) => {
  const totalSongs = songs.length;
  const playedSongs = songs.filter(s => s.isPlayed).length;
  
  // Calculate total duration (convert e.g. "4:30" to seconds)
  const calculateTotalSeconds = () => {
    let total = 0;
    songs.forEach(song => {
      const duration = song.bpm; // Reusing BPM field or adding duration logic? Let's add a duration logic
      // For now, let's assume if duration exists, we parse it. If not, assume 3.5 mins avg for gig planning
      if (song.bpm && song.bpm.includes(':')) {
         const [m, s] = song.bpm.split(':').map(Number);
         total += (m * 60) + (s || 0);
      } else {
        total += 210; // Default 3:30
      }
    });
    return total;
  };

  const totalSeconds = calculateTotalSeconds();
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  // Readiness calculation
  const readySongs = songs.filter(s => s.previewUrl && !s.previewUrl.includes('apple.com')).length;
  const readinessPercent = totalSongs > 0 ? (readySongs / totalSongs) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm flex items-center gap-4">
        <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950 rounded-xl flex items-center justify-center text-indigo-600">
          <Music className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Repertoire</p>
          <p className="text-xl font-black">{totalSongs} <span className="text-xs font-bold text-slate-400">SONGS</span></p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm flex items-center gap-4">
        <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-950 rounded-xl flex items-center justify-center text-emerald-600">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Set Time</p>
          <p className="text-xl font-black">
            {hours > 0 && `${hours}h `}{minutes}m
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm flex items-center gap-4">
        <div className="h-10 w-10 bg-amber-50 dark:bg-amber-950 rounded-xl flex items-center justify-center text-amber-600">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Set Progress</p>
          <p className="text-xl font-black">{playedSongs} / {totalSongs}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm space-y-2">
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3 text-indigo-500" /> Gig Readiness
          </p>
          <span className="text-[10px] font-black text-indigo-600">{Math.round(readinessPercent)}%</span>
        </div>
        <Progress value={readinessPercent} className="h-2 bg-slate-100" />
      </div>
    </div>
  );
};

export default SetlistStats;
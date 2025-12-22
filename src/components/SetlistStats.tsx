"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { Clock, Music, CheckCircle2, BarChart3, PieChart, Tag } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface SetlistStatsProps {
  songs: SetlistSong[];
}

const SetlistStats: React.FC<SetlistStatsProps> = ({ songs }) => {
  const totalSongs = songs.length;
  const playedSongs = songs.filter(s => s.isPlayed).length;
  
  const calculateTotalSeconds = () => {
    let total = 0;
    songs.forEach(song => {
      total += 210; // Default 3:30 for gig planning
    });
    return total;
  };

  const totalSeconds = calculateTotalSeconds();
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const readySongs = songs.filter(s => s.previewUrl && !s.previewUrl.includes('apple.com')).length;
  const readinessPercent = totalSongs > 0 ? (readySongs / totalSongs) * 100 : 0;

  // Genre distribution
  const genres = songs.reduce((acc, song) => {
    const g = song.genre || "Standard";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topGenres = Object.entries(genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="space-y-4 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border shadow-sm flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Repertoire</p>
            <p className="text-2xl font-black">{totalSongs} <span className="text-[10px] font-bold text-slate-400">TRACKS</span></p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border shadow-sm flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="h-12 w-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Duration</p>
            <p className="text-2xl font-black">
              {hours > 0 && `${hours}h `}{minutes}m
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border shadow-sm flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="h-12 w-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gig Progress</p>
            <p className="text-2xl font-black">{playedSongs} / {totalSongs}</p>
          </div>
        </div>

        <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-xl shadow-indigo-600/20 space-y-3">
          <div className="flex justify-between items-center text-white">
            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 opacity-80">
              <BarChart3 className="w-4 h-4" /> Readiness
            </p>
            <span className="text-lg font-black">{Math.round(readinessPercent)}%</span>
          </div>
          <Progress value={readinessPercent} className="h-2.5 bg-white/20" />
          <p className="text-[8px] font-black text-indigo-100/60 uppercase tracking-widest">Audio Connectivity Status</p>
        </div>
      </div>

      {/* Deep Telemetry Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-6 rounded-[2rem] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-indigo-600">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sonic Profile</p>
              <div className="flex gap-4 mt-1">
                {topGenres.map(([genre, count]) => (
                  <div key={genre} className="flex items-baseline gap-1.5">
                    <span className="text-xs font-black uppercase tracking-tight">{genre}</span>
                    <span className="text-[10px] font-mono font-bold text-indigo-600">{Math.round((count/totalSongs)*100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/5 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-6 rounded-[2rem] flex items-center gap-4">
          <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-indigo-600">
            <Tag className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Popular Set Tags</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(songs.flatMap(s => s.user_tags || []))).slice(0, 5).map(tag => (
                <span key={tag} className="text-[8px] font-black uppercase tracking-widest bg-indigo-600/10 text-indigo-600 px-2.5 py-1 rounded-full border border-indigo-600/20">
                  {tag}
                </span>
              ))}
              {songs.length === 0 && <span className="text-[9px] text-slate-400 font-bold">ADD TAGS IN STUDIO</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetlistStats;
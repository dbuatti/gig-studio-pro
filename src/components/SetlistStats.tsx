"use client";

import React, { useState } from 'react';
import { SetlistSong } from './SetlistManager';
import { Music, Target, PieChart, BarChart3 } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Input } from './ui/input';

interface SetlistStatsProps {
  songs: SetlistSong[];
  goalSeconds?: number;
  onUpdateGoal?: (seconds: number) => void;
}

const SetlistStats: React.FC<SetlistStatsProps> = ({ 
  songs, 
  goalSeconds = 7200, 
  onUpdateGoal, 
}) => {
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  
  // Filter for songs that are approved for gig AND have full audio
  const performanceReadySongs = songs.filter(song => 
    song.isApproved && !!song.audio_url && song.extraction_status === 'completed'
  );
  const totalPerformanceReadySongs = performanceReadySongs.length;

  // New: Count songs with confirmed metadata (this is separate from performance readiness)
  const totalMetadataVerifiedSongs = songs.filter(song => song.isMetadataConfirmed).length;

  const totalSeconds = performanceReadySongs.reduce((acc, song) => {
    return acc + (song.duration_seconds || 210); // Default to 210 seconds if duration is missing
  }, 0);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // "Audio Readiness (Performance Ready)" - Percentage of songs that are fully performance ready with audio
  const audioReadinessPercentage = songs.length > 0 ? (totalPerformanceReadySongs / songs.length) * 100 : 0;
  
  const goalProgress = goalSeconds > 0 ? (totalSeconds / goalSeconds) * 100 : 0;
  const remainingSeconds = Math.max(0, goalSeconds - totalSeconds);
  const isGoalMet = remainingSeconds <= 0;

  const genres = performanceReadySongs.reduce((acc, song) => {
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
        <div className="col-span-1 md:col-span-2 bg-card text-foreground p-6 rounded-[2rem] shadow-2xl shadow-indigo-500/10 border border-border flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-indigo-600/20 transition-all" />
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Performance Goal</p>
                {isEditingGoal ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      type="number"
                      autoFocus
                      className="h-7 w-20 bg-background border-border text-xs font-black p-1"
                      placeholder="Hours"
                      defaultValue={Math.floor(goalSeconds / 3600)}
                      onBlur={(e) => {
                        const hours = parseInt(e.target.value) || 0;
                        onUpdateGoal?.(hours * 3600);
                        setIsEditingGoal(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                    />
                    <span className="text-[10px] font-bold text-muted-foreground">HOURS</span>
                  </div>
                ) : (
                  <h3 className="text-2xl font-black flex items-center gap-2 cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => setIsEditingGoal(true)}>
                    {formatDuration(goalSeconds)} <span className="text-[10px] font-bold text-muted-foreground">TARGET</span>
                  </h3>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Active</p>
              <p className="text-2xl font-black text-foreground">{formatDuration(totalSeconds)}</p>
            </div>
          </div>

          <div className="space-y-3 relative z-10">
            {songs.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Add tracks to library to start tracking goals!
                </p>
              </div>
            ) : totalPerformanceReadySongs === 0 ? (
              <div className="text-center py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 animate-pulse">
                  Reach 100% Readiness to Activate Target Tracking
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-end">
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                    isGoalMet ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                  )}>
                    {isGoalMet ? "Goal Achieved" : `${formatDuration(remainingSeconds)} Remaining`}
                  </span>
                  <span className="text-xs font-mono font-bold">{Math.min(100, Math.round(goalProgress))}%</span>
                </div>
                <Progress value={Math.min(100, goalProgress)} className="h-3 bg-secondary" />
              </>
            )}
          </div>
        </div>

        <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Repertoire</p>
            <p className="text-2xl font-black text-foreground">{totalMetadataVerifiedSongs} <span className="text-[10px] font-bold text-muted-foreground">METADATA VERIFIED</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card/5 border border-border p-6 rounded-[2rem] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-secondary rounded-xl flex items-center justify-center text-indigo-600">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sonic Profile</p>
              <div className="flex gap-4 mt-1">
                {topGenres.map(([genre, count]) => (
                  <div key={genre} className="flex items-baseline gap-1.5">
                    <span className="text-xs font-black uppercase tracking-tight text-foreground">{genre}</span>
                    <span className="text-[10px] font-mono font-bold text-indigo-600">{Math.round((count/Math.max(1, totalPerformanceReadySongs))*100)}%</span>
                  </div>
                ))}
                {totalPerformanceReadySongs === 0 && <span className="text-[9px] text-muted-foreground font-bold uppercase">Ready tracks analyzed here</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card/5 border border-border p-6 rounded-[2rem] flex items-center gap-4">
          <div className="h-10 w-10 bg-secondary rounded-xl flex items-center justify-center text-indigo-600">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Audio Readiness (Performance Ready)</p>
              <span className="text-xs font-black text-indigo-600">{Math.round(audioReadinessPercentage)}%</span>
            </div>
            <Progress value={audioReadinessPercentage} className="h-1.5" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetlistStats;
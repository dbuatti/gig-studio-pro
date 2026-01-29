"use client";

import React, { useState, useMemo } from 'react';
import { SetlistSong } from './SetlistManagementModal';
import { Clock, Music, Target, PieChart, BarChart3, Download, Loader2 } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Input } from './ui/input';
import { Button } from './ui/button';
import { calculateReadiness } from '@/utils/repertoireSync';
import { useSettings } from '@/hooks/use-settings';
import { formatDuration } from '@/utils/timeUtils'; // Assuming time utility exists or defining inline

interface SetlistStatsProps {
  songs: SetlistSong[];
  onUpdateGoal: (seconds: number) => Promise<void>;
  goalSeconds?: number;
}

const SetlistStats: React.FC<SetlistStatsProps> = ({ songs, onUpdateGoal, goalSeconds = 7200 }) => {
  const { isGoalTrackerEnabled } = useSettings();
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [localGoalMinutes, setLocalGoalMinutes] = useState(Math.floor(goalSeconds / 60));

  const totalDurationSeconds = useMemo(() => {
    return songs.reduce((sum, song) => sum + (song.duration_seconds || 0), 0);
  }, [songs]);

  const totalDurationFormatted = useMemo(() => {
    const mins = Math.floor(totalDurationSeconds / 60);
    const secs = totalDurationSeconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }, [totalDurationSeconds]);

  const readinessScore = useMemo(() => {
    if (songs.length === 0) return 0;
    const totalReadiness = songs.reduce((sum, song) => sum + calculateReadiness(song), 0);
    return Math.round((totalReadiness / songs.length));
  }, [songs]);

  const handleSaveGoal = () => {
    onUpdateGoal(localGoalMinutes * 60);
    setIsEditingGoal(false);
  };

  const handleGoalChange = (value: number[]) => {
    setLocalGoalMinutes(value[0]);
  };

  if (!isGoalTrackerEnabled && songs.length === 0) return null;

  return (
    <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm relative overflow-hidden animate-in fade-in duration-500">
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/5 blur-[80px] rounded-full -mt-16 -mr-16 pointer-events-none" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <PieChart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Setlist Metrics</h3>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Live Performance Data</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Duration</p>
            <p className="text-lg font-black text-foreground font-mono">{totalDurationFormatted}</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setIsEditingGoal(prev => !prev)} className="h-9 w-9 rounded-xl border-border text-muted-foreground hover:bg-accent">
            <Settings2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        {/* Overall Readiness */}
        <div className="p-4 bg-secondary rounded-2xl border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400">
              <BarChart3 className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Overall Readiness</span>
            </div>
            <span className="text-lg font-black font-mono text-indigo-400">{readinessScore}%</span>
          </div>
          <Progress value={readinessScore} className="h-2 bg-background" indicatorClassName="bg-indigo-500" />
        </div>

        {/* Goal Setting */}
        <div className="p-4 bg-secondary rounded-2xl border border-border space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <Target className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Time Goal</span>
            </div>
            {isEditingGoal ? (
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  value={localGoalMinutes} 
                  onChange={(e) => setLocalGoalMinutes(parseInt(e.target.value) || 0)}
                  min={15}
                  max={480}
                  className="h-8 w-20 text-center text-sm font-mono bg-background border-border text-foreground"
                />
                <span className="text-xs text-muted-foreground">min</span>
                <Button variant="default" size="sm" onClick={handleSaveGoal} className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] uppercase">Save</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg font-black font-mono text-emerald-400">{Math.floor(goalSeconds / 60)}m</span>
                <Button variant="ghost" size="icon" onClick={() => setIsEditingGoal(true)} className="h-8 w-8 text-muted-foreground hover:bg-accent">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          <Progress 
            value={Math.min(100, (totalDurationSeconds / (goalSeconds || 7200)) * 100)} 
            className="h-2 bg-background" 
            indicatorClassName="bg-emerald-500" 
          />
        </div>
      </div>
    </div>
  );
};

export default SetlistStats;
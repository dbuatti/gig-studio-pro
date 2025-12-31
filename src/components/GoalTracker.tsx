"use client";

import React, { useMemo } from 'react';
import { SetlistSong } from './SetlistManager';
import { useSettings } from '@/hooks/use-settings';
import { CustomProgress } from "@/components/CustomProgress";
import { 
  Target, Type, Music2, Link as LinkIcon, 
  Music, Sparkles, CheckCircle2, Hash
} from 'lucide-react';
import { cn } from "@/lib/utils";

interface GoalTrackerProps {
  repertoire: SetlistSong[];
}

const GoalTracker: React.FC<GoalTrackerProps> = ({ repertoire }) => {
  const { 
    isGoalTrackerEnabled,
    goalLyricsCount,
    goalUgChordsCount,
    goalUgLinksCount,
    goalHighestNoteCount,
    goalOriginalKeyCount,
    goalTargetKeyCount
  } = useSettings();

  if (!isGoalTrackerEnabled) return null;

  const stats = useMemo(() => {
    // Robust local midnight check
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const isToday = (timestamp: string | undefined | null) => {
      if (!timestamp) return false;
      const date = new Date(timestamp).getTime();
      return date >= startOfToday;
    };

    const counts = {
      lyrics: repertoire.filter(s => (s.lyrics || "").length > 20 && isToday((s as any).lyrics_updated_at)).length,
      chords: repertoire.filter(s => (s.ug_chords_text || "").length > 10 && isToday((s as any).chords_updated_at)).length,
      links: repertoire.filter(s => !!s.ugUrl && isToday((s as any).ug_link_updated_at)).length,
      highestNote: repertoire.filter(s => !!s.highest_note_original && isToday((s as any).highest_note_updated_at)).length,
      originalKey: repertoire.filter(s => (s as any).original_key_updated_at && isToday((s as any).original_key_updated_at)).length,
      targetKey: repertoire.filter(s => (s as any).target_key_updated_at && isToday((s as any).target_key_updated_at)).length
    };

    const goals = [
      { 
        label: 'Lyrics Transcribed', 
        icon: <Type className="w-3 h-3" />, 
        current: counts.lyrics, 
        target: goalLyricsCount, 
        color: 'bg-pink-500',
        lightBg: 'bg-pink-500/10'
      },
      { 
        label: 'Chords Mapped', 
        icon: <Music2 className="w-3 h-3" />, 
        current: counts.chords, 
        target: goalUgChordsCount, 
        color: 'bg-indigo-500',
        lightBg: 'bg-indigo-500/10'
      },
      { 
        label: 'UG Links Bound', 
        icon: <LinkIcon className="w-3 h-3" />, 
        current: counts.links, 
        target: goalUgLinksCount, 
        color: 'bg-orange-500',
        lightBg: 'bg-orange-500/10'
      },
      { 
        label: 'Range Analyzed', 
        icon: <Music className="w-3 h-3" />, 
        current: counts.highestNote, 
        target: goalHighestNoteCount, 
        color: 'bg-emerald-500',
        lightBg: 'bg-emerald-500/10'
      },
      { 
        label: 'Original Keys Set', 
        icon: <Hash className="w-3 h-3" />, 
        current: counts.originalKey, 
        target: goalOriginalKeyCount, 
        color: 'bg-amber-500',
        lightBg: 'bg-amber-500/10'
      },
      { 
        label: 'Stage Keys Bound', 
        icon: <Target className="w-3 h-3" />, 
        current: counts.targetKey, 
        target: goalTargetKeyCount, 
        color: 'bg-blue-500',
        lightBg: 'bg-blue-500/10'
      }
    ];

    return goals;
  }, [repertoire, goalLyricsCount, goalUgChordsCount, goalUgLinksCount, goalHighestNoteCount, goalOriginalKeyCount, goalTargetKeyCount]);

  const overallProgress = useMemo(() => {
    const totalCurrent = stats.reduce((acc, g) => acc + Math.min(g.current, g.target), 0);
    const totalTarget = stats.reduce((acc, g) => acc + g.target, 0);
    return totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
  }, [stats]);

  return (
    <div className="bg-card p-6 rounded-[2rem] border border-border shadow-2xl relative overflow-hidden mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[80px] rounded-full -mr-32 -mt-32 pointer-events-none" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/20">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Daily Performance Mastery</h3>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Live Performance Daily Quota (Resets at Midnight)</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Today's Progress</p>
            <p className="text-2xl font-black text-indigo-600 font-mono">{Math.round(overallProgress)}%</p>
          </div>
          {overallProgress === 100 && <CheckCircle2 className="w-8 h-8 text-emerald-500" />}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 relative z-10">
        {stats.map((goal, i) => {
          const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
          const isComplete = goal.current >= goal.target;

          return (
            <div key={i} className="p-4 bg-secondary/50 rounded-2xl border border-border/50 space-y-3 group hover:border-indigo-500/30 transition-all">
              <div className="flex items-center justify-between">
                <div className={cn("p-2 rounded-lg", goal.lightBg)}>
                  <div className={cn(goal.color.replace('bg-', 'text-'))}>{goal.icon}</div>
                </div>
                <span className={cn(
                  "text-[10px] font-black font-mono",
                  isComplete ? "text-emerald-500" : "text-muted-foreground"
                )}>
                  {goal.current}/{goal.target}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate pr-2">{goal.label}</p>
                  {isComplete && <Sparkles className="w-3 h-3 text-amber-400" />}
                </div>
                <CustomProgress 
                  value={Math.min(100, progress)} 
                  className="h-1.5 bg-background"
                  indicatorClassName={isComplete ? "bg-emerald-500" : goal.color}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GoalTracker;
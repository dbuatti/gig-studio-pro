"use client";

import React, { useMemo } from 'react';
import { SetlistSong } from './SetlistManager';
import { useSettings } from '@/hooks/use-settings';
import { CustomProgress } from "@/components/CustomProgress";
import { 
  Target, Type, Music2, Link as LinkIcon, 
  Music, CheckCircle2, Hash, FileText, ChevronRight
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { FilterState } from './SetlistFilters';

interface GoalStat {
  label: string;
  icon: JSX.Element;
  current: number;
  target: number;
  barColor: string;
  textColor: string;
  lightBg: string;
  filter: Partial<FilterState>;
}

interface GoalTrackerProps {
  repertoire: SetlistSong[];
  onFilterApply: (filters: Partial<FilterState>) => void;
}

const GoalTracker: React.FC<GoalTrackerProps> = ({ repertoire, onFilterApply }) => {
  const { 
    isGoalTrackerEnabled,
    goalLyricsCount,
    goalUgChordsCount,
    goalUgLinksCount,
    goalHighestNoteCount,
    goalOriginalKeyCount,
    goalTargetKeyCount,
    goalPdfsCount
  } = useSettings();

  const stats = useMemo((): GoalStat[] => {
    const todayStr = new Date().toLocaleDateString('en-CA');

    const isToday = (timestamp: string | undefined | null) => {
      if (!timestamp) return false;
      const localDateStr = new Date(timestamp).toLocaleDateString('en-CA');
      return localDateStr === todayStr;
    };

    const counts = {
      lyrics: repertoire.filter(s => (s.lyrics || "").length > 20 && isToday(s.lyrics_updated_at)).length,
      chords: repertoire.filter(s => (s.ug_chords_text || "").length > 10 && isToday(s.chords_updated_at)).length,
      links: repertoire.filter(s => !!s.ugUrl && isToday(s.ug_link_updated_at)).length,
      highestNote: repertoire.filter(s => !!s.highest_note_original && isToday(s.highest_note_updated_at)).length,
      originalKey: repertoire.filter(s => s.originalKey && s.originalKey !== "TBC" && isToday(s.original_key_updated_at)).length,
      targetKey: repertoire.filter(s => s.targetKey && s.targetKey !== "TBC" && isToday(s.target_key_updated_at)).length,
      pdfs: repertoire.filter(s => (s.pdfUrl || s.leadsheetUrl || s.sheet_music_url) && isToday(s.pdf_updated_at)).length
    };

    return [
      { 
        label: 'Lyrics', 
        icon: <Type className="w-3 h-3" />, 
        current: counts.lyrics, 
        target: goalLyricsCount, 
        barColor: 'bg-pink-500',
        textColor: 'text-pink-400',
        lightBg: 'bg-pink-500/10',
        filter: { hasLyrics: 'no' }
      },
      { 
        label: 'Chords', 
        icon: <Music2 className="w-3 h-3" />, 
        current: counts.chords, 
        target: goalUgChordsCount, 
        barColor: 'bg-indigo-500',
        textColor: 'text-indigo-400',
        lightBg: 'bg-indigo-500/10',
        filter: { hasUg: 'yes', hasUgChords: 'no' }
      },
      { 
        label: 'UG Links', 
        icon: <LinkIcon className="w-3 h-3" />, 
        current: counts.links, 
        target: goalUgLinksCount, 
        barColor: 'bg-orange-500',
        textColor: 'text-orange-400',
        lightBg: 'bg-orange-500/10',
        filter: { hasUg: 'no' }
      },
      { 
        label: 'PDFs', 
        icon: <FileText className="w-3 h-3" />,
        current: counts.pdfs, 
        target: goalPdfsCount, 
        barColor: 'bg-blue-500',
        textColor: 'text-blue-400',
        lightBg: 'bg-blue-500/10',
        filter: { hasPdf: 'no' }
      },
      { 
        label: 'Range', 
        icon: <Music className="w-3 h-3" />, 
        current: counts.highestNote, 
        target: goalHighestNoteCount, 
        barColor: 'bg-emerald-500',
        textColor: 'text-emerald-400',
        lightBg: 'bg-emerald-500/10',
        filter: { hasHighestNote: 'no' }
      },
      { 
        label: 'Orig. Key', 
        icon: <Hash className="w-3 h-3" />, 
        current: counts.originalKey, 
        target: goalOriginalKeyCount, 
        barColor: 'bg-amber-500',
        textColor: 'text-amber-400',
        lightBg: 'bg-amber-500/10',
        filter: { hasOriginalKey: 'no' }
      },
      { 
        label: 'Stage Key', 
        icon: <Target className="w-3 h-3" />, 
        current: counts.targetKey, 
        target: goalTargetKeyCount, 
        barColor: 'bg-blue-400',
        textColor: 'text-blue-400',
        lightBg: 'bg-blue-400/10',
        filter: { isConfirmed: 'no' }
      }
    ];
  }, [repertoire, goalLyricsCount, goalUgChordsCount, goalUgLinksCount, goalHighestNoteCount, goalOriginalKeyCount, goalTargetKeyCount, goalPdfsCount]);

  const overallProgress = useMemo(() => {
    const totalCurrent = stats.reduce((acc, g) => acc + Math.min(g.current, g.target), 0);
    const totalTarget = stats.reduce((acc, g) => acc + g.target, 0);
    return totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
  }, [stats]);

  if (!isGoalTrackerEnabled) return null;

  return (
    <div className="bg-slate-900/60 p-5 rounded-2xl border border-white/5 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-tight text-white">Daily Mastery</h3>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Resets at midnight</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-indigo-400 tabular-nums">{Math.round(overallProgress)}%</span>
          {overallProgress === 100 && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {stats.map((goal, i) => {
          const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
          const isComplete = goal.current >= goal.target;

          return (
            <button 
              key={i} 
              onClick={() => onFilterApply(goal.filter)}
              className="p-3 bg-white/[0.02] rounded-xl border border-white/5 space-y-2 group hover:border-white/10 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className={cn("p-1.5 rounded-lg", goal.lightBg, goal.textColor)}>
                  {goal.icon}
                </div>
                <span className={cn(
                  "text-[10px] font-black font-mono tabular-nums",
                  isComplete ? "text-emerald-400" : "text-slate-500"
                )}>
                  {goal.current}/{goal.target}
                </span>
              </div>
              <div className="space-y-1.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 truncate">{goal.label}</p>
                <CustomProgress 
                  value={Math.min(100, progress)} 
                  className="h-1 bg-slate-800"
                  indicatorClassName={isComplete ? "bg-emerald-500" : goal.barColor}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default GoalTracker;

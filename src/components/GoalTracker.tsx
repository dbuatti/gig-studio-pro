"use client";

import React, { useMemo } from 'react';
import { useSettings } from '@/hooks/use-settings';
import { SetlistSong } from './SetlistManager';
import { Progress } from '@/components/ui/progress';
import { 
  Target, 
  Music, 
  FileText, 
  Link as LinkIcon, 
  Mic2, 
  Hash, 
  CheckCircle2,
  Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { calculateReadiness } from '@/utils/repertoireSync';

interface GoalTrackerProps {
  repertoire: SetlistSong[];
  onFilterApply?: (filters: any) => void;
}

const GoalTracker: React.FC<GoalTrackerProps> = ({ repertoire, onFilterApply }) => {
  const { 
    goalLyricsCount, 
    goalUgChordsCount, 
    goalUgLinksCount, 
    goalHighestNoteCount, 
    goalOriginalKeyCount, 
    goalTargetKeyCount, 
    goalPdfsCount 
  } = useSettings();

  // Calculate stats inside useMemo to ensure hooks are always called in order
  const stats = useMemo(() => {
    const counts = {
      lyrics: repertoire.filter(s => (s.lyrics || "").length > 100).length,
      chords: repertoire.filter(s => (s.ug_chords_text || "").length > 50).length,
      links: repertoire.filter(s => !!s.ugUrl).length,
      range: repertoire.filter(s => !!s.highest_note_original).length,
      origKey: repertoire.filter(s => s.originalKey && s.originalKey !== "TBC").length,
      stageKey: repertoire.filter(s => s.isKeyConfirmed).length,
      pdfs: repertoire.filter(s => !!(s.pdfUrl || s.leadsheetUrl)).length,
    };

    const goals = [
      { id: 'lyrics', label: 'Lyrics', current: counts.lyrics, target: goalLyricsCount, icon: FileText, color: 'text-blue-400' },
      { id: 'chords', label: 'Chords', current: counts.chords, target: goalUgChordsCount, icon: Music, color: 'text-emerald-400' },
      { id: 'links', label: 'UG Links', current: counts.links, target: goalUgLinksCount, icon: LinkIcon, color: 'text-orange-400' },
      { id: 'range', label: 'Vocal Range', current: counts.range, target: goalHighestNoteCount, icon: Mic2, color: 'text-pink-400' },
      { id: 'origKey', label: 'Orig Keys', current: counts.origKey, target: goalOriginalKeyCount, icon: Hash, color: 'text-indigo-400' },
      { id: 'stageKey', label: 'Stage Keys', current: counts.stageKey, target: goalTargetKeyCount, icon: CheckCircle2, color: 'text-purple-400' },
      { id: 'pdfs', label: 'PDFs', current: counts.pdfs, target: goalPdfsCount, icon: FileText, color: 'text-red-400' },
    ];

    const totalProgress = goals.reduce((acc, g) => acc + Math.min(100, (g.current / Math.max(1, g.target)) * 100), 0) / goals.length;

    return { goals, totalProgress };
  }, [
    repertoire, 
    goalLyricsCount, 
    goalUgChordsCount, 
    goalUgLinksCount, 
    goalHighestNoteCount, 
    goalOriginalKeyCount, 
    goalTargetKeyCount, 
    goalPdfsCount
  ]);

  return (
    <div className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Achievement Engine</h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
              Overall Repertoire Health: <span className="text-indigo-400">{Math.round(stats.totalProgress)}%</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-xl border border-white/5">
          <Trophy className={cn("w-5 h-5", stats.totalProgress === 100 ? "text-amber-400" : "text-slate-600")} />
          <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 transition-all duration-1000" 
              style={{ width: `${stats.totalProgress}%` }} 
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {stats.goals.map((goal) => {
          const progress = Math.min(100, (goal.current / Math.max(1, goal.target)) * 100);
          const isComplete = progress === 100;

          return (
            <div 
              key={goal.id}
              className={cn(
                "p-4 rounded-2xl border transition-all duration-300 flex flex-col gap-3",
                isComplete ? "bg-indigo-500/10 border-indigo-500/30" : "bg-white/5 border-white/5 hover:border-white/10"
              )}
            >
              <div className="flex items-center justify-between">
                <goal.icon className={cn("w-4 h-4", goal.color)} />
                <span className="text-[10px] font-mono font-bold text-slate-500">
                  {goal.current}/{goal.target}
                </span>
              </div>
              
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">{goal.label}</p>
                <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-1000", isComplete ? "bg-indigo-500" : "bg-slate-600")} 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GoalTracker;
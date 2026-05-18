"use client";

import React, { useMemo } from 'react';
import { SetlistSong } from './SetlistManager';
import { calculateReadiness } from '@/utils/repertoireSync';
import { 
  ShieldCheck, Music, FileText, AlertTriangle, 
  CheckCircle2, Zap, BarChart3, ArrowRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from './ui/progress';

interface RepertoireSummaryProps {
  repertoire: SetlistSong[];
  onFilterApply?: (filter: string) => void;
}

const RepertoireSummary: React.FC<RepertoireSummaryProps> = ({ repertoire, onFilterApply }) => {
  const stats = useMemo(() => {
    const total = repertoire.length;
    if (total === 0) return null;

    const ready = repertoire.filter(s => calculateReadiness(s) === 100).length;
    const missingAudio = repertoire.filter(s => !s.audio_url && !s.previewUrl).length;
    const missingCharts = repertoire.filter(s => !s.pdfUrl && !s.leadsheetUrl && !s.ug_chords_text).length;
    const unverifiedKeys = repertoire.filter(s => !s.isKeyConfirmed || s.originalKey === 'TBC').length;

    return {
      total,
      ready,
      readyPercent: Math.round((ready / total) * 100),
      missingAudio,
      missingCharts,
      unverifiedKeys,
      avgReadiness: Math.round(repertoire.reduce((acc, s) => acc + calculateReadiness(s), 0) / total)
    };
  }, [repertoire]);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="bg-indigo-600/10 border border-indigo-500/20 p-6 rounded-[2rem] flex flex-col justify-between shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <ShieldCheck className="w-16 h-16 text-indigo-400" />
        </div>
        <div className="space-y-1 relative z-10">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Stage Readiness</p>
          <h3 className="text-3xl font-black text-white">{stats.readyPercent}%</h3>
        </div>
        <div className="mt-4 space-y-2 relative z-10">
          <Progress value={stats.readyPercent} className="h-1.5 bg-indigo-950" />
          <p className="text-[9px] font-bold text-slate-500 uppercase">{stats.ready} of {stats.total} tracks 100% ready</p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2rem] flex items-center gap-5 shadow-xl hover:border-white/10 transition-all">
        <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-400">
          <Music className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Avg. Mastery</p>
          <h3 className="text-2xl font-black text-white">{stats.avgReadiness}%</h3>
          <p className="text-[9px] font-bold text-emerald-500/60 uppercase mt-0.5">Library Health</p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2rem] flex items-center gap-5 shadow-xl hover:border-white/10 transition-all">
        <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Action Required</p>
          <h3 className="text-2xl font-black text-white">{stats.unverifiedKeys + stats.missingCharts}</h3>
          <p className="text-[9px] font-bold text-amber-500/60 uppercase mt-0.5">Missing Data Points</p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2rem] flex items-center gap-5 shadow-xl hover:border-white/10 transition-all">
        <div className="bg-indigo-500/10 p-3 rounded-2xl text-indigo-400">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Repertoire</p>
          <h3 className="text-2xl font-black text-white">{stats.total}</h3>
          <p className="text-[9px] font-bold text-indigo-500/60 uppercase mt-0.5">Active Tracks</p>
        </div>
      </div>
    </div>
  );
};

export default RepertoireSummary;
"use client";

import React, { useMemo } from 'react';
import { SetlistSong } from './SetlistManager';
import { calculateReadiness } from '@/utils/repertoireSync';
import { 
  ShieldCheck, Music, AlertTriangle, BarChart3 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from './ui/progress';

interface RepertoireSummaryProps {
  repertoire: SetlistSong[];
}

const RepertoireSummary: React.FC<RepertoireSummaryProps> = ({ repertoire }) => {
  const stats = useMemo(() => {
    const total = repertoire.length;
    if (total === 0) return null;

    const ready = repertoire.filter(s => calculateReadiness(s) === 100).length;
    const missingCharts = repertoire.filter(s => !s.pdfUrl && !s.leadsheetUrl && !s.ug_chords_text).length;
    const unverifiedKeys = repertoire.filter(s => !s.isKeyConfirmed || s.originalKey === 'TBC').length;

    return {
      total,
      ready,
      readyPercent: Math.round((ready / total) * 100),
      actionCount: unverifiedKeys + missingCharts,
      avgReadiness: Math.round(repertoire.reduce((acc, s) => acc + calculateReadiness(s), 0) / total)
    };
  }, [repertoire]);

  if (!stats) return null;

  const cards = [
    {
      label: 'Stage Readiness',
      value: `${stats.readyPercent}%`,
      sub: `${stats.ready} / ${stats.total} tracks ready`,
      icon: <ShieldCheck className="w-5 h-5" />,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      ring: 'ring-indigo-500/20',
      showProgress: true,
      progressValue: stats.readyPercent,
    },
    {
      label: 'Avg. Mastery',
      value: `${stats.avgReadiness}%`,
      sub: 'Library health score',
      icon: <Music className="w-5 h-5" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      ring: 'ring-emerald-500/20',
    },
    {
      label: 'Action Required',
      value: stats.actionCount.toString(),
      sub: 'Missing data points',
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      ring: 'ring-amber-500/20',
    },
    {
      label: 'Total Repertoire',
      value: stats.total.toString(),
      sub: 'Active tracks',
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      ring: 'ring-indigo-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
      {cards.map((card, i) => (
        <div 
          key={i}
          className={cn(
            "bg-slate-900/60 border border-white/5 p-5 rounded-2xl flex flex-col gap-3 shadow-lg",
            "hover:border-white/10 transition-all duration-200"
          )}
        >
          <div className="flex items-center justify-between">
            <div className={cn("p-2 rounded-xl", card.bg, card.color)}>
              {card.icon}
            </div>
            <span className={cn("text-2xl font-black tabular-nums", card.color)}>
              {card.value}
            </span>
          </div>
          <div className="space-y-1.5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{card.label}</p>
            {card.showProgress && (
              <Progress value={card.progressValue} className="h-1 bg-slate-800" />
            )}
            <p className="text-[9px] font-bold text-slate-600 uppercase">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RepertoireSummary;

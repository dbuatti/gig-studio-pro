"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, X, Loader2, CheckCircle2, AlertTriangle, 
  TrendingUp, Zap, Info, BarChart3, ListChecks
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Progress } from './ui/progress';

interface AuditItem {
  title: string;
  points: string;
}

interface AuditData {
  overallScore?: number;
  summary?: string;
  strengths?: AuditItem[];
  weaknesses?: AuditItem[];
  recommendations?: string[];
}

interface MDAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditData: AuditData | null;
  isLoading: boolean;
}

const MDAuditModal: React.FC<MDAuditModalProps> = ({ isOpen, onClose, auditData, isLoading }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] h-[85vh] bg-slate-950 border-white/10 text-white rounded-[2.5rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-indigo-600 shrink-0 relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">
                Musical Director Audit
              </DialogTitle>
              <DialogDescription className="text-indigo-100 font-bold uppercase tracking-widest text-[10px] mt-1">
                AI-Powered Setlist Analysis & Optimization
              </DialogDescription>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3 text-white/80 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest">Analyzing setlist flow...</span>
            </div>
          ) : auditData && (
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2">Overall Flow Score</span>
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-black tracking-tighter">{auditData.overallScore || 0}</div>
                  <Progress value={auditData.overallScore || 0} className="w-32 h-2 bg-indigo-900" />
                </div>
              </div>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 p-8 custom-scrollbar bg-slate-950">
          {isLoading ? (
            <div className="space-y-8 py-10">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-4 animate-pulse">
                  <div className="h-4 w-32 bg-white/5 rounded-full" />
                  <div className="h-24 w-full bg-white/5 rounded-[2rem]" />
                </div>
              ))}
            </div>
          ) : auditData ? (
            <div className="space-y-10 pb-10">
              {/* Summary Section */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" /> Executive Summary
                </h3>
                <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] text-sm font-medium leading-relaxed text-slate-300">
                  {auditData.summary}
                </div>
              </section>

              {/* Strengths & Weaknesses Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Key Strengths
                  </h3>
                  <div className="space-y-3">
                    {auditData.strengths?.map((item, i) => (
                      <div key={i} className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                        <h4 className="text-xs font-black uppercase tracking-tight text-emerald-400 mb-1">{item.title}</h4>
                        <p className="text-[11px] font-medium text-slate-400 leading-relaxed">{item.points}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" /> Areas for Improvement
                  </h3>
                  <div className="space-y-3">
                    {auditData.weaknesses?.map((item, i) => (
                      <div key={i} className="p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                        <h4 className="text-xs font-black uppercase tracking-tight text-amber-400 mb-1">{item.title}</h4>
                        <p className="text-[11px] font-medium text-slate-400 leading-relaxed">{item.points}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Recommendations */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                  <ListChecks className="w-3.5 h-3.5" /> MD Recommendations
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {auditData.recommendations?.map((rec, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl group hover:bg-indigo-500/10 transition-colors">
                      <div className="h-6 w-6 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-xs font-medium text-slate-300 leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-4">
              <BarChart3 className="w-12 h-12 text-slate-800" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No audit data available.</p>
            </div>
          )}
        </ScrollArea>

        <div className="p-6 bg-slate-900 border-t border-white/5 shrink-0 flex justify-end">
          <Button 
            onClick={onClose}
            className="bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl"
          >
            Close Audit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MDAuditModal;
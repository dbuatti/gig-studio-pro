"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Zap, Activity, CheckCircle2, X, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditData {
  energy: string;
  fatigue: string;
  risk: string;
  summary: string;
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
      <DialogContent className="max-w-2xl bg-slate-950 border-white/10 text-white rounded-[2.5rem] p-8 shadow-2xl">
        <DialogHeader className="mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">MD Setlist Audit</DialogTitle>
              <DialogDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                AI-Powered Performance Analysis
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 animate-pulse">
              Consulting Gemini 2.5 Flash...
            </p>
          </div>
        ) : auditData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-amber-400">Energy Flow</h4>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{auditData.energy}</p>
              </div>

              <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-purple-400">Vocal Fatigue</h4>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{auditData.fatigue}</p>
              </div>

              <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <h4 className="text-xs font-black uppercase tracking-widest text-red-400">Technical Risk</h4>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{auditData.risk}</p>
              </div>
            </div>

            <div className="p-6 bg-indigo-600/20 rounded-3xl border border-indigo-500/30">
              <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-2">MD Summary</h4>
              <p className="text-sm font-bold text-white leading-relaxed italic">"{auditData.summary}"</p>
            </div>

            <Button 
              onClick={onClose}
              className="w-full h-14 bg-white text-black hover:bg-slate-200 rounded-2xl font-black uppercase tracking-widest text-xs"
            >
              Got it, MD
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default MDAuditModal;
"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeyReminderPillProps {
  isVisible: boolean;
  targetKey: string;
  pitch: number;
}

const KeyReminderPill: React.FC<KeyReminderPillProps> = ({ isVisible, targetKey, pitch }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9, x: 20 }}
          animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
          exit={{ opacity: 0, y: -10, scale: 0.95, x: 10 }}
          className="absolute top-6 right-6 z-[100] pointer-events-none"
        >
          <div className="bg-slate-950/90 backdrop-blur-2xl border-2 border-indigo-500/50 rounded-2xl px-5 py-3 shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] flex items-center gap-4">
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Stage Key</span>
              <div className="flex items-center gap-1.5">
                <Music className="w-3 h-3 text-indigo-400" />
                <span className="text-xl font-black font-mono text-white leading-none">{targetKey}</span>
              </div>
            </div>
            
            <div className="w-px h-8 bg-white/10" />
            
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Transpose</span>
              <div className="flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-emerald-400" />
                <span className={cn(
                  "text-xl font-black font-mono leading-none",
                  pitch === 0 ? "text-slate-400" : "text-emerald-400"
                )}>
                  {pitch > 0 ? '+' : ''}{pitch} <span className="text-[10px] ml-0.5">ST</span>
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KeyReminderPill;
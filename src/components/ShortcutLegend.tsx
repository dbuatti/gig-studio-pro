"use client";

import React from 'react';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShortcutLegendProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'SPACE', desc: 'Play / Pause Audio' },
  { key: '←', desc: 'Previous Song' },
  { key: '→', desc: 'Next Song' }, // Updated here
  { key: 'S', desc: 'Toggle Auto-Scroll' },
  { key: 'E', desc: 'Edit Studio Settings' },
  { key: 'ESC', desc: 'Exit Performance Mode' },
  { key: '⌘ + 1-6', desc: 'Switch Studio Tabs' },
];

const ShortcutLegend: React.FC<ShortcutLegendProps> = ({ onClose }) => {
  return (
    <div className="absolute inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="max-w-md w-full mx-4 bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          className="absolute top-6 right-6 rounded-full hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-4 mb-8">
          <div className="bg-indigo-600 p-3 rounded-2xl">
            <Keyboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Stage Control Map</h3>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Keyboard Shortcuts</p>
          </div>
        </div>

        <div className="space-y-3">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.desc}</span>
              <kbd className="px-3 py-1 bg-indigo-600/20 text-indigo-400 border border-indigo-600/20 rounded-lg font-mono text-xs font-black">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <Button 
          onClick={onClose}
          className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-black uppercase tracking-[0.2em] text-[10px]"
        >
          Return to Stage
        </Button>
      </div>
    </div>
  );
};

export default ShortcutLegend;
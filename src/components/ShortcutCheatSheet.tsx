"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, Keyboard, Zap, MousePointer2 } from 'lucide-react';

interface ShortcutCheatSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutCheatSheet: React.FC<ShortcutCheatSheetProps> = ({ isOpen, onClose }) => {
  const shortcuts = [
    { key: '?', label: 'Show this cheat sheet', category: 'Global' },
    { key: '⌘ K', label: 'Global Search / Discovery', category: 'Global' },
    { key: 'P', label: 'Enter Stage Mode', category: 'Navigation' },
    { key: 'R', label: 'Open Sheet Reader', category: 'Navigation' },
    { key: 'Space', label: 'Toggle Playback', category: 'Audio' },
    { key: '⌘ 1-7', label: 'Switch Studio Tabs', category: 'Studio' },
    { key: '← / →', label: 'Previous / Next Page', category: 'Reader' },
    { key: 'Z', label: 'Toggle Zen Mode', category: 'Reader' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-slate-950 border-white/10 text-white rounded-[2rem] p-8 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tight">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Keyboard className="w-5 h-5 text-white" />
            </div>
            Command Reference
          </DialogTitle>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-3">
            {shortcuts.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.category}</span>
                  <span className="text-xs font-bold text-white">{s.label}</span>
                </div>
                <kbd className="px-2.5 py-1 bg-slate-800 rounded-lg border border-white/10 font-mono text-[10px] font-black text-indigo-400 shadow-inner">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
          
          <div className="p-4 bg-indigo-600/10 rounded-2xl border border-indigo-500/20 flex items-start gap-3">
            <Zap className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[10px] font-medium text-slate-400 leading-relaxed">
              Pro Tip: Use <span className="text-white font-bold">⌘ + Number</span> in the Song Studio to jump between Config, Audio, and Charts instantly.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShortcutCheatSheet;
"use client";
import React from 'react';
import { Button } from "@/components/ui/button";
import { SetlistSong } from './SetlistManager';
import { Download, Cloud, FileMusic, Copy, SearchCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LibraryEngineProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void; // Added handleAutoSave
  isMobile: boolean;
  handleDownloadAll: () => Promise<void>;
  onSwitchTab: (tab: string) => void;
}

const LibraryEngine: React.FC<LibraryEngineProps> = ({
  formData,
  handleAutoSave, // Destructure handleAutoSave
  isMobile,
  handleDownloadAll,
  onSwitchTab
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">Library Engine</h3>

      <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600/20 p-3 rounded-xl text-indigo-400">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-black uppercase tracking-tight text-white">Cloud Assets</h4>
            <p className="text-sm text-slate-400">Manage and download all linked files.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={handleDownloadAll}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-lg shadow-indigo-600/20 gap-3"
          >
            <Download className="w-4 h-4" />
            Download All
          </Button>
          <Button
            variant="outline"
            className="border-white/20 bg-white/10 hover:bg-white/20 text-slate-300 font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl gap-3"
          >
            <FileMusic className="w-4 h-4" />
            Export Setlist
          </Button>
        </div>
      </div>

      <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-600/20 p-3 rounded-xl text-emerald-400">
            <SearchCode className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-black uppercase tracking-tight text-white">Repertoire Sync</h4>
            <p className="text-sm text-slate-400">Sync with your master repertoire library.</p>
          </div>
        </div>

        <Button
          onClick={() => onSwitchTab('details')} // Example: switch to details tab
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-lg shadow-emerald-600/20 gap-3"
        >
          <Copy className="w-4 h-4" />
          Manage Repertoire
        </Button>
      </div>
    </div>
  );
};

export default LibraryEngine;
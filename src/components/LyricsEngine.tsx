"use client";
import React from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SetlistSong } from './SetlistManager';

interface LyricsEngineProps {
  formData: Partial<SetlistSong>; // Added formData
  handleAutoSave: (updates: Partial<SetlistSong>) => void; // Added handleAutoSave
  isMobile: boolean;
}

const LyricsEngine: React.FC<LyricsEngineProps> = ({ formData, handleAutoSave, isMobile }) => {
  return (
    <div className="h-full flex flex-col space-y-6">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">Lyrics Engine</h3>
      <div className="flex-1 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col">
        <Label htmlFor="lyrics" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
          Lyrics
        </Label>
        <Textarea
          id="lyrics"
          value={formData.lyrics || ""}
          onChange={(e) => handleAutoSave({ lyrics: e.target.value })}
          placeholder="Paste your lyrics here..."
          className="w-full mt-3 bg-black/40 border border-white/20 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[300px] font-mono text-sm resize-none flex-1"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {formData.lyrics?.length || 0} characters
          </span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {formData.lyrics?.split('\n').length || 0} lines
          </span>
        </div>
      </div>
    </div>
  );
};

export default LyricsEngine;
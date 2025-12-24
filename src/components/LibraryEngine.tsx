"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Music, FileText, Download } from 'lucide-react';
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';

interface LibraryEngineProps {
  formData: Partial<SetlistSong>;
  handleDownloadAll: () => Promise<void>;
  isMobile: boolean;
}

const LibraryEngine: React.FC<LibraryEngineProps> = ({ formData, handleDownloadAll, isMobile }) => {
  return (
    <div className="space-y-12 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white">RESOURCE MATRIX</h3>
        <Button onClick={handleDownloadAll} className="bg-indigo-600 font-black uppercase text-[10px] h-10 px-8 rounded-xl"><Download className="w-4 h-4 mr-2" /> DOWNLOAD ALL</Button>
      </div>
      <div className={cn("grid gap-8", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        <div className={cn("p-10 border transition-all flex flex-col justify-between h-[350px]", formData.previewUrl ? "bg-slate-900 border-white/10 shadow-2xl" : "bg-white/5 opacity-40", isMobile ? "rounded-[2rem]" : "rounded-[2.5rem]")}>
          <Music className="w-8 h-8 text-indigo-600" />
          <p className="text-xl font-black uppercase">{formData.previewUrl ? "Master Stream Linked" : "No Audio"}</p>
        </div>
        <div className={cn("p-10 border transition-all flex flex-col justify-between h-[350px]", formData.pdfUrl ? "bg-slate-900 border-white/10 shadow-2xl" : "bg-white/5 opacity-40", isMobile ? "rounded-[2rem]" : "rounded-[2.5rem]")}>
          <FileText className="w-8 h-8 text-emerald-600" />
          <p className="text-xl font-black uppercase">{formData.pdfUrl ? "Stage Chart Active" : "No Chart"}</p>
        </div>
      </div>
    </div>
  );
};

export default LibraryEngine;
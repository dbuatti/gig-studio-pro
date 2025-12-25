"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  Music, 
  FileText, 
  Download, 
  Apple, 
  Link2, 
  ExternalLink, 
  Printer, 
  ClipboardPaste, 
  Eye 
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';
import { showSuccess } from '@/utils/toast';

interface LibraryEngineProps {
  formData: Partial<SetlistSong>;
  handleDownloadAll: () => Promise<void>;
  isMobile: boolean;
  setPreviewPdfUrl?: (url: string | null) => void;
  handleUgPrint?: () => void; // Keep this prop for now, but its internal logic will change
}

const LibraryEngine: React.FC<LibraryEngineProps> = ({ 
  formData, 
  handleDownloadAll, 
  isMobile,
  setPreviewPdfUrl,
  handleUgPrint 
}) => {
  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-500 h-full flex flex-col">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-white">RESOURCE MATRIX</h3>
          <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">Centralized management for all song assets and links.</p>
        </div>
        <Button 
          onClick={handleDownloadAll} 
          className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] md:text-xs h-12 md:h-14 gap-2 px-8 md:px-10 rounded-xl md:rounded-2xl shadow-xl shadow-indigo-600/20"
        >
          <Download className="w-4 h-4" /> DOWNLOAD ALL ASSETS
        </Button>
      </div>

      {/* GRID MATRIX */}
      <div className={cn("grid gap-4 md:gap-8", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        
        {/* 1. MASTER AUDIO MODULE */}
        <div className={cn(
          "p-8 md:p-10 border transition-all flex flex-col justify-between h-[280px] md:h-[350px] relative group",
          formData.previewUrl ? "bg-slate-900 border-white/10 shadow-2xl" : "bg-white/5 border-white/5 opacity-40 border-dashed",
          isMobile ? "rounded-[2rem]" : "rounded-[2.5rem]"
        )}>
          <div className="flex items-center justify-between">
            <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-xl shadow-indigo-600/20">
              <Music className="w-6 h-6 md:w-8 md:h-8" />
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">MASTER PERFORMANCE AUDIO</span>
            <p className="text-xl md:text-3xl font-black tracking-tight truncate">{formData.previewUrl ? `${formData.name}_Stream_Master` : "Not Linked"}</p>
          </div>
        </div>

        {/* 2. APPLE MUSIC MODULE (MISSING IN YOUR FIRST CODE) */}
        <div className={cn(
          "p-8 md:p-10 border transition-all flex flex-col justify-between h-[280px] md:h-[350px] relative group",
          formData.appleMusicUrl ? "bg-slate-900 border-white/10 shadow-2xl" : "bg-white/5 border-white/5 opacity-40 border-dashed",
          isMobile ? "rounded-[2rem]" : "rounded-[2.5rem]"
        )}>
          <div className="flex items-center justify-between">
            <div className="bg-red-600 p-4 rounded-2xl text-white shadow-xl shadow-red-600/20">
              <Apple className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            {formData.appleMusicUrl && (
              <Button 
                variant="ghost" size="icon" 
                onClick={() => window.open(formData.appleMusicUrl, '_blank')}
                className="h-10 w-10 bg-white/5 rounded-xl hover:bg-red-600 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-red-400">APPLE MUSIC LINK</span>
            <p className="text-xl md:text-3xl font-black tracking-tight truncate">{formData.appleMusicUrl ? "Integrated App Link" : "Offline"}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Launch directly in Apple Music</p>
          </div>
        </div>

        {/* 3. ULTIMATE GUITAR MODULE (MISSING IN YOUR FIRST CODE) */}
        <div className={cn(
          "p-8 md:p-10 border transition-all flex flex-col justify-between h-[280px] md:h-[350px] relative group",
          formData.ugUrl ? "bg-slate-900 border-white/10 shadow-2xl" : "bg-white/5 border-white/5 opacity-40 border-dashed",
          isMobile ? "rounded-[2rem]" : "rounded-[2.5rem]"
        )}>
          <div className="flex items-center justify-between">
            <div className="bg-orange-600 p-4 rounded-2xl text-white shadow-xl shadow-orange-600/20">
              <Link2 className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            {formData.ugUrl && (
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={handleUgPrint} className="h-10 w-10 bg-white/5 rounded-xl hover:bg-orange-600 transition-all">
                  <ExternalLink className="w-4 h-4" /> {/* Changed icon to ExternalLink */}
                </Button>
                <Button 
                  variant="ghost" size="icon" 
                  onClick={() => {
                    navigator.clipboard.writeText(formData.ugUrl || "");
                    showSuccess("UG Link Copied");
                  }} 
                  className="h-10 w-10 bg-white/5 rounded-xl hover:bg-orange-600 transition-all"
                >
                  <ClipboardPaste className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">ULTIMATE GUITAR PRO</span>
            <p className="text-xl md:text-3xl font-black tracking-tight truncate">{formData.ugUrl ? "Verified Official Link" : "Not Linked"}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Mobile App Integration Ready</p>
          </div>
        </div>

        {/* 4. STAGE CHART MODULE */}
        <div className={cn(
          "p-8 md:p-10 border transition-all flex flex-col justify-between h-[280px] md:h-[350px] relative group",
          formData.pdfUrl ? "bg-slate-900 border-white/10 shadow-2xl" : "bg-white/5 border-white/5 opacity-40 border-dashed",
          isMobile ? "rounded-[2rem]" : "rounded-[2.5rem]"
        )}>
          <div className="flex items-center justify-between">
            <div className="bg-emerald-600 p-4 rounded-2xl text-white shadow-xl shadow-emerald-600/20">
              <FileText className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            {formData.pdfUrl && setPreviewPdfUrl && (
              <Button 
                variant="ghost" size="icon" 
                onClick={() => setPreviewPdfUrl(formData.pdfUrl || null)}
                className="h-10 w-10 bg-white/5 rounded-xl hover:bg-emerald-600 transition-all"
              >
                <Eye className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">STAGE CHART / PDF</span>
            <p className="text-xl md:text-3xl font-black tracking-tight truncate">{formData.pdfUrl ? "Performance_Chart" : "No Asset Linked"}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Ready for Stage View</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibraryEngine;
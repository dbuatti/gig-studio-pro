"use client";
import React, { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';
import { ExternalLink, ShieldCheck, Printer, FileText, Music, Guitar } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import UGChordsEditor from './UGChordsEditor';

interface SongChartsTabProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
  setPreviewPdfUrl: (url: string | null) => void;
  isFramable: (url: string | null) => boolean;
  activeChartType: 'pdf' | 'leadsheet' | 'web' | 'ug';
  setActiveChartType: (type: 'pdf' | 'leadsheet' | 'web' | 'ug') => void;
  handleUgPrint: () => void;
}

const SongChartsTab: React.FC<SongChartsTabProps> = ({
  formData,
  handleAutoSave,
  isMobile,
  setPreviewPdfUrl,
  isFramable,
  activeChartType,
  setActiveChartType,
  handleUgPrint,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"view" | "edit-ug">("view");
  
  const currentChartUrl = useMemo(() => {
    switch(activeChartType) {
      case 'pdf': 
        return formData.pdfUrl ? `${formData.pdfUrl}#toolbar=0&navpanes=0&view=FitH` : null;
      case 'leadsheet': 
        return formData.leadsheetUrl ? `${formData.leadsheetUrl}#toolbar=0&navpanes=0&view=FitH` : null;
      case 'web': 
        return formData.pdfUrl; // Assuming web is just a direct link to PDF for now
      case 'ug': 
        return formData.ugUrl;
      default: 
        return null;
    }
  }, [activeChartType, formData.pdfUrl, formData.leadsheetUrl, formData.ugUrl]);

  return (
    <div className="h-full flex flex-col gap-8 animate-in fade-in duration-500">
      {/* Sub-tab switcher */}
      <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
        <Button 
          variant="ghost" 
          onClick={() => setActiveSubTab("view")}
          className={cn(
            "flex-1 text-[10px] font-black uppercase tracking-widest",
            activeSubTab === "view" && "bg-indigo-600 text-white"
          )}
        >
          View Charts
        </Button>
        <Button 
          variant="ghost" 
          onClick={() => setActiveSubTab("edit-ug")}
          className={cn(
            "flex-1 text-[10px] font-black uppercase tracking-widest",
            activeSubTab === "edit-ug" && "bg-indigo-600 text-white"
          )}
        >
          Edit UG Chords
        </Button>
      </div>

      {activeSubTab === "view" ? (
        <>
          <div className="flex justify-between items-center shrink-0">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">Chart Engine</h3>
            
            {/* Manual Sheet Music Reader Selector */}
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex w-full max-w-md bg-white/5 border border-white/10 p-1.5 rounded-xl backdrop-blur-sm">
                <button
                  onClick={() => handleAutoSave({ 
                    preferred_reader: formData.preferred_reader === "ug" ? null : "ug" 
                  })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-4 rounded-lg transition-all font-black uppercase tracking-wider text-sm",
                    formData.preferred_reader === "ug" 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                      : "text-slate-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Guitar className="w-5 h-5" />
                  UG
                </button>
                <button
                  onClick={() => handleAutoSave({ 
                    preferred_reader: formData.preferred_reader === "ls" ? null : "ls" 
                  })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-4 rounded-lg transition-all font-black uppercase tracking-wider text-sm",
                    formData.preferred_reader === "ls" 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                      : "text-slate-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Music className="w-5 h-5" />
                  LS
                </button>
                <button
                  onClick={() => handleAutoSave({ 
                    preferred_reader: formData.preferred_reader === "fn" ? null : "fn" 
                  })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-4 rounded-lg transition-all font-black uppercase tracking-wider text-sm",
                    formData.preferred_reader === "fn" 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                      : "text-slate-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  <FileText className="w-5 h-5" />
                  FN
                </button>
              </div>
              {!formData.preferred_reader && (
                <p className="text-slate-500 text-sm">
                  Select how you'll read this chart on stage
                </p>
              )}
            </div>
            
            {/* Chart Type Selector */}
            <div className="flex bg-white/5 p-1 rounded-xl">
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={!formData.pdfUrl}
                onClick={() => setActiveChartType('pdf')}
                className={cn(
                  "text-[9px] font-black uppercase h-8 px-4 rounded-lg",
                  activeChartType === 'pdf' ? "bg-indigo-600 text-white" : "text-slate-500"
                )}
              >
                PDF
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={!formData.ugUrl}
                onClick={() => setActiveChartType('ug')}
                className={cn(
                  "text-[9px] font-black uppercase h-8 px-4 rounded-lg",
                  activeChartType === 'ug' ? "bg-indigo-600 text-white" : "text-slate-500"
                )}
              >
                UG
              </Button>
            </div>
          </div>
          
          <div className={cn("flex-1 bg-white overflow-hidden shadow-2xl relative", isMobile ? "rounded-3xl" : "rounded-[3rem]")}>
            {currentChartUrl ? (
              isFramable(currentChartUrl) ? (
                <iframe 
                  src={currentChartUrl} 
                  className="w-full h-full" 
                  title="Chart Viewer" 
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
                  <ShieldCheck className="w-12 h-12 text-indigo-400 mb-6" />
                  <Button 
                    onClick={() => window.open(currentChartUrl, '_blank')}
                    className="bg-indigo-600 hover:bg-indigo-700 h-14 px-10 rounded-2xl gap-3"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Launch Source
                  </Button>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-100 text-center">
                <h4 className="text-lg font-black text-slate-900 uppercase">No Active Chart</h4>
                <p className="text-sm text-slate-500 mt-2">Link a PDF or Ultimate Guitar tab in the details tab.</p>
              </div>
            )}
          </div>
          
          {activeChartType === 'ug' && formData.ugUrl && (
            <div className="shrink-0 flex justify-center">
              <Button 
                onClick={handleUgPrint}
                className="bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-lg shadow-orange-600/20 gap-3"
              >
                <Printer className="w-4 h-4" />
                Open UG Print View
              </Button>
            </div>
          )}
        </>
      ) : (
        <UGChordsEditor 
          song={null} 
          formData={formData} 
          handleAutoSave={handleAutoSave} 
          isMobile={isMobile} 
        />
      )}
    </div>
  );
};

export default SongChartsTab;
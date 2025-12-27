"use client";
import React, { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';
import { ExternalLink, ShieldCheck, Printer, FileText, Music, Guitar, Search, Maximize, Minimize, Eye } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import UGChordsEditor from './UGChordsEditor';
import UGChordsReader from './UGChordsReader';

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

const defaultUgChordsConfig = {
  fontFamily: "monospace",
  fontSize: 16,
  chordBold: true,
  lineSpacing: 1.5,
  chordColor: "#ffffff",
  textAlign: "left" as "left" | "center" | "right"
};

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
  const [isReaderExpanded, setIsReaderExpanded] = useState(false);
  
  const currentChartUrl = useMemo(() => {
    switch(activeChartType) {
      case 'pdf': 
        return formData.pdfUrl ? `${formData.pdfUrl}#toolbar=0&navpanes=0&view=FitH` : null;
      case 'leadsheet': 
        return formData.leadsheetUrl ? `${formData.leadsheetUrl}#toolbar=0&navpanes=0&view=FitH` : null;
      case 'web': 
        return formData.pdfUrl;
      case 'ug': 
        return null; 
      default: 
        return null;
    }
  }, [activeChartType, formData.pdfUrl, formData.leadsheetUrl]);

  const canEmbedUg = useMemo(() => {
    if (activeChartType === 'ug' && formData.ugUrl) {
      return false;
    }
    return isFramable(currentChartUrl);
  }, [activeChartType, formData.ugUrl, currentChartUrl, isFramable]);

  return (
    <div className={cn("h-full flex flex-col animate-in fade-in duration-500", isReaderExpanded ? "gap-0" : "gap-8")}>
      {!isReaderExpanded && (
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
      )}

      {activeSubTab === "view" ? (
        <>
          {!isReaderExpanded && (
            <div className="flex justify-between items-center shrink-0">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-emerald-400">Chart Engine</h3>
              
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
                  disabled={!formData.ugUrl && !formData.ug_chords_text}
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
          )}
          
          <div className={cn(
            "flex-1 bg-white shadow-2xl relative", 
            isMobile ? "rounded-3xl" : "rounded-[3rem]",
            activeChartType === 'ug' ? "overflow-y-auto" : "overflow-hidden"
          )}>
            {activeChartType === 'ug' && (formData.ug_chords_text || formData.ugUrl) ? (
              <UGChordsReader
                chordsText={formData.ug_chords_text || ""}
                config={formData.ug_chords_config || defaultUgChordsConfig}
                isMobile={isMobile}
                originalKey={formData.originalKey}
                targetKey={formData.targetKey}
              />
            ) : currentChartUrl ? (
              canEmbedUg ? (
                <iframe 
                  src={currentChartUrl} 
                  className="w-full h-full" 
                  title="Chart Viewer" 
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
                  <ShieldCheck className="w-12 h-12 text-indigo-400 mb-6" />
                  <h4 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-4 md:mb-6 text-white">Asset Protected</h4>
                  <p className="text-slate-500 max-xl mb-8 md:mb-16 text-lg md:text-xl font-medium leading-relaxed">
                    External security prevents in-app display. Use the button below to launch in a secure dedicated performance window.
                  </p>
                  <Button 
                    onClick={() => window.open(currentChartUrl, '_blank')} 
                    className="bg-indigo-600 hover:bg-indigo-700 h-16 md:h-20 px-10 md:px-16 font-black uppercase tracking-[0.2em] text-xs md:text-sm rounded-2xl md:rounded-3xl shadow-2xl shadow-indigo-600/30 gap-4 md:gap-6"
                  >
                    <ExternalLink className="w-6 h-6 md:w-8 md:h-8" /> Launch Chart Window
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
          
          {activeChartType === 'ug' && (formData.ugUrl || formData.ug_chords_text) && (
            <div className="shrink-0 flex justify-center gap-3">
              <Button 
                onClick={handleUgPrint}
                className="bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-lg shadow-orange-600/20 gap-3"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Ultimate Guitar
              </Button>
              <Button
                onClick={() => setIsReaderExpanded(prev => !prev)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-lg shadow-indigo-600/20 gap-3"
              >
                {isReaderExpanded ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                {isReaderExpanded ? "Collapse View" : "Expand View"}
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
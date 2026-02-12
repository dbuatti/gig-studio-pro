"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { Button } from "@/components/ui/button";
import { FileText, Guitar, Layout, Printer, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  // Harmonic sync props for UG editor
  pitch: number;
  setPitch: (pitch: number) => void;
  targetKey: string;
  setTargetKey: (targetKey: string) => void;
  isPitchLinked: boolean;
  setIsPitchLinked: (linked: boolean) => void;
}

const SongChartsTab: React.FC<SongChartsTabProps> = ({
  formData,
  handleAutoSave,
  isMobile,
  isFramable,
  activeChartType,
  setActiveChartType,
  handleUgPrint,
  pitch,
  setPitch,
  targetKey,
  setTargetKey,
  isPitchLinked,
  setIsPitchLinked
}) => {
  const currentPdfUrl = activeChartType === 'pdf' ? formData.pdfUrl || formData.sheet_music_url : formData.leadsheetUrl;
  const hasChart = !!currentPdfUrl;

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      {/* Chart Type Navigation */}
      <div className="flex items-center justify-between bg-white/5 p-2 rounded-2xl border border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveChartType('pdf')}
            className={cn(
              "h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2.5 transition-all",
              activeChartType === 'pdf' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white"
            )}
          >
            <FileText className="w-4 h-4" />
            Full Score (PDF)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveChartType('leadsheet')}
            className={cn(
              "h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2.5 transition-all",
              activeChartType === 'leadsheet' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white"
            )}
          >
            <Layout className="w-4 h-4" />
            Lead Sheet (LS)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveChartType('ug')}
            className={cn(
              "h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2.5 transition-all",
              activeChartType === 'ug' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white"
            )}
          >
            <Guitar className="w-4 h-4" />
            Chords (UG)
          </Button>
        </div>

        {activeChartType === 'ug' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUgPrint}
            className="h-10 px-4 rounded-xl border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
          >
            <Printer className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-slate-900/50 rounded-[2.5rem] border-4 border-white/5 shadow-2xl overflow-hidden relative min-h-[400px]">
        {activeChartType === 'ug' ? (
          <UGChordsEditor 
            songId={formData.master_id || formData.id || ""}
            initialChords={formData.ug_chords_text || ""}
            onSave={(text) => handleAutoSave({ ug_chords_text: text })}
            originalKey={formData.originalKey || 'C'}
            targetKey={targetKey}
            pitch={pitch}
            setPitch={setPitch}
            setTargetKey={setTargetKey}
            isPitchLinked={isPitchLinked}
            setIsPitchLinked={setIsPitchLinked}
            config={formData.ug_chords_config}
            onConfigChange={(config) => handleAutoSave({ ug_chords_config: config })}
          />
        ) : hasChart ? (
          isFramable(currentPdfUrl) ? (
            <iframe 
              src={`${currentPdfUrl}#toolbar=0&navpanes=0`}
              className="w-full h-full border-none"
              title="Chart Viewer"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
              <div className="bg-amber-500/10 p-6 rounded-[2rem] border border-amber-500/20">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-black uppercase tracking-tight text-white">External Resource Detected</h3>
                <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                  This {activeChartType === 'pdf' ? 'Full Score' : 'Lead Sheet'} is hosted on a platform that prevents direct embedding.
                </p>
              </div>
              <Button 
                asChild
                className="bg-indigo-600 hover:bg-indigo-500 h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[11px] gap-3 shadow-xl shadow-indigo-600/20"
              >
                <a href={currentPdfUrl} target="_blank" rel="noopener noreferrer">
                  Open in New Tab <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6">
            <div className="bg-white/5 p-8 rounded-[3rem] border border-white/5">
              <FileText className="w-16 h-16 text-slate-800 mx-auto mb-4" />
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-500">No {activeChartType === 'pdf' ? 'Full Score' : 'Lead Sheet'} Linked</h3>
              <p className="text-sm text-slate-600 mt-2 max-w-xs mx-auto">
                Upload a PDF in the <span className="text-indigo-400 font-bold">Details</span> tab to view it here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SongChartsTab;
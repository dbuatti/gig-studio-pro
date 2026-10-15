"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ArrowLeft, FileText, Layout, Guitar, Loader2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SetlistSong, UGChordsConfig } from './SetlistManager';
import UGChordsReader from './UGChordsReader';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

type PreviewChartType = 'score' | 'leadsheet' | 'chords';

const EmptyChartState: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-6">
    <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
      <FileText className="w-7 h-7 text-slate-600" />
    </div>
    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
      No {label} linked yet
    </p>
    <p className="text-[10px] text-slate-600 font-medium max-w-xs">
      Add it in Step 1 (Get Sheet Music) and it will show here exactly as the stage reader renders it.
    </p>
  </div>
);

interface ReaderPreviewProps {
  /** The song being previewed (usually the wizard's formData). */
  song: Partial<SetlistSong>;
  /** Return to the wizard. */
  onExit: () => void;
}

/**
 * Read-only, full-bleed preview of exactly what the stage reader will show for a song.
 * Toggle between Full Score / Lead Sheet / Chords. Minimal chrome so it fills the modal,
 * but always offers a one-tap way back to the wizard.
 */
const ReaderPreview: React.FC<ReaderPreviewProps> = ({ song, onExit }) => {
  const isMobile = useIsMobile();
  const {
    keyPreference,
    ugChordsFontFamily,
    ugChordsFontSize,
    ugChordsChordBold,
    ugChordsChordColor,
    ugChordsLineSpacing,
    ugChordsTextAlign,
  } = useSettings();

  const scoreUrl = song.pdfUrl || song.sheet_music_url;
  const leadUrl = song.leadsheetUrl;
  const chordsText = song.ug_chords_text || '';

  const hasScore = !!scoreUrl;
  const hasLead = !!leadUrl;
  const hasChords = !!(chordsText && chordsText.trim().length > 0);

  const options = useMemo(
    () => [
      { value: 'score' as const, label: 'Full Score', short: 'Score', icon: FileText, enabled: hasScore },
      { value: 'leadsheet' as const, label: 'Lead Sheet', short: 'Lead', icon: Layout, enabled: hasLead },
      { value: 'chords' as const, label: 'Chords', short: 'Chords', icon: Guitar, enabled: hasChords },
    ],
    [hasScore, hasLead, hasChords]
  );

  const defaultType = useMemo<PreviewChartType>(() => {
    const pr = song.preferred_reader;
    if (pr === 'ug' && hasChords) return 'chords';
    if (pr === 'ls' && hasLead) return 'leadsheet';
    if ((pr === 'fn' || pr === 'fs') && hasScore) return 'score';
    if (hasScore) return 'score';
    if (hasLead) return 'leadsheet';
    if (hasChords) return 'chords';
    return 'score';
  }, [song.preferred_reader, hasScore, hasLead, hasChords]);

  const [chartType, setChartType] = useState<PreviewChartType>(defaultType);
  useEffect(() => { setChartType(defaultType); }, [defaultType]);

  const targetKey = song.targetKey || song.originalKey;
  const readerKeyPreference: KeyPreference = useMemo(() => {
    if (song.key_preference && song.key_preference !== 'neutral') return song.key_preference;
    if (keyPreference && keyPreference !== 'neutral') return keyPreference;
    return 'sharps';
  }, [song.key_preference, keyPreference]);

  const effectiveConfig = useMemo<UGChordsConfig>(() => {
    const base: UGChordsConfig = {
      fontFamily: ugChordsFontFamily,
      fontSize: ugChordsFontSize + 1,
      chordBold: ugChordsChordBold,
      chordColor: ugChordsChordColor,
      lineSpacing: ugChordsLineSpacing,
      textAlign: ugChordsTextAlign,
    };
    if (song.ug_chords_config) {
      return {
        ...base,
        ...song.ug_chords_config,
        fontSize: (song.ug_chords_config.fontSize || ugChordsFontSize) + 1,
      };
    }
    return base;
  }, [song.ug_chords_config, ugChordsFontFamily, ugChordsFontSize, ugChordsChordBold, ugChordsChordColor, ugChordsLineSpacing, ugChordsTextAlign]);

  // ── PDF auto-fit (mirrors the stage reader) ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pdfScale, setPdfScale] = useState<number | null>(null);
  const pdfUrl = chartType === 'leadsheet' ? leadUrl : scoreUrl;

  useEffect(() => { setPdfDocument(null); setPdfScale(null); }, [pdfUrl, chartType]);

  const fitPdf = useCallback(async (pdf: PDFDocumentProxy, container: HTMLDivElement) => {
    if (!container || !pdf) return;
    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const scaleX = (container.clientWidth * 0.98) / viewport.width;
      const scaleY = (container.clientHeight * 0.98) / viewport.height;
      setPdfScale(Math.min(scaleX, scaleY));
    } catch (error) {
      console.error('[ReaderPreview] PDF scale error:', error);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdfDocument) return;
    fitPdf(pdfDocument, container);
    const ro = new ResizeObserver(() => fitPdf(pdfDocument, container));
    ro.observe(container);
    return () => ro.disconnect();
  }, [pdfDocument, fitPdf]);

  const emptyLabel = chartType === 'leadsheet' ? 'lead sheet' : 'full score';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black">
      {/* ── Minimal reader bar ── */}
      <div className="shrink-0 flex items-center gap-2 px-2.5 py-2 bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-[9px] font-black uppercase tracking-widest transition-all shrink-0"
          title="Back to the readiness wizard"
          aria-label="Back to the readiness wizard"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Wizard
        </button>

        <div className="flex-1 min-w-0 text-center">
          <p className="text-[10px] font-black uppercase tracking-tight text-white truncate">
            {song.name || 'Untitled'}
          </p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] truncate flex items-center justify-center gap-1">
            <Eye className="w-2.5 h-2.5" /> Reader preview
            {song.artist ? <span className="text-slate-700">·</span> : null}
            {song.artist ? <span className="truncate max-w-[40vw]">{song.artist}</span> : null}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0 bg-black/40 border border-white/5 rounded-xl p-1">
          {options.map(opt => {
            const Icon = opt.icon;
            const active = chartType === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => opt.enabled && setChartType(opt.value)}
                disabled={!opt.enabled}
                title={opt.enabled ? `Show ${opt.label}` : `No ${opt.label} linked`}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                  active
                    ? "bg-indigo-600 text-white shadow"
                    : opt.enabled
                    ? "text-slate-400 hover:text-white hover:bg-white/5"
                    : "text-slate-700 cursor-not-allowed"
                )}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chart canvas ── */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden flex items-center justify-center"
      >
        {chartType === 'chords' ? (
          hasChords ? (
            <UGChordsReader
              chordsText={chordsText}
              config={effectiveConfig}
              isMobile={isMobile}
              originalKey={song.originalKey}
              targetKey={targetKey}
              readerKeyPreference={readerKeyPreference}
              isFullScreen
            />
          ) : (
            <EmptyChartState label="chords" />
          )
        ) : pdfUrl ? (
          <Document
            file={pdfUrl}
            onLoadSuccess={(pdf) => setPdfDocument(pdf)}
            onLoadError={(error) => console.error('[ReaderPreview] PDF load error:', error)}
            loading={<Loader2 className="w-10 h-10 animate-spin text-indigo-400" />}
            className="flex items-center justify-center"
          >
            <Page
              pageNumber={1}
              scale={pdfScale || 1}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              loading={<Loader2 className="w-8 h-8 animate-spin text-indigo-400" />}
            />
          </Document>
        ) : (
          <EmptyChartState label={emptyLabel} />
        )}
      </div>
    </div>
  );
};

export default ReaderPreview;

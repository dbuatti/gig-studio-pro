"use client";

import React, { useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatChordText, transposeChords } from '@/utils/chordUtils';
import { calculateSemitones } from '@/utils/keyUtils';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { UGChordsConfig } from './SetlistManager'; // Import UGChordsConfig

interface UGChordsReaderProps {
  chordsText: string;
  config?: UGChordsConfig; // Make config optional, will use global if not provided
  isMobile: boolean;
  originalKey?: string;
  targetKey?: string;
  isPlaying: boolean;
  progress: number;
  duration: number;
  readerKeyPreference?: KeyPreference;
  onChartReady?: () => void;
}

const UGChordsReader = React.memo(({
  chordsText,
  config: songConfig, // Rename prop to avoid conflict with resolved config
  isMobile,
  originalKey,
  targetKey,
  readerKeyPreference,
  onChartReady,
}: UGChordsReaderProps) => {
  const { 
    keyPreference: globalKeyPreference,
    ugChordsFontFamily,
    ugChordsFontSize,
    ugChordsChordBold,
    ugChordsChordColor,
    ugChordsLineSpacing,
    ugChordsTextAlign,
  } = useSettings();

  // Resolve the effective config: song-specific if available, otherwise global settings
  const resolvedConfig: UGChordsConfig = useMemo(() => ({
    fontFamily: songConfig?.fontFamily || ugChordsFontFamily,
    fontSize: songConfig?.fontSize || ugChordsFontSize,
    chordBold: songConfig?.chordBold ?? ugChordsChordBold, // Use ?? for boolean defaults
    chordColor: songConfig?.chordColor || ugChordsChordColor,
    lineSpacing: songConfig?.lineSpacing || ugChordsLineSpacing,
    textAlign: songConfig?.textAlign || ugChordsTextAlign,
  }), [songConfig, ugChordsFontFamily, ugChordsFontSize, ugChordsChordBold, ugChordsChordColor, ugChordsLineSpacing, ugChordsTextAlign]);

  const activeKeyPreference = readerKeyPreference || globalKeyPreference;
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLPreElement>(null);

  const transposedChordsText = useMemo(() => {
    if (!chordsText) return chordsText;
    const n = calculateSemitones(originalKey, targetKey);
    return transposeChords(chordsText, n, activeKeyPreference);
  }, [chordsText, originalKey, targetKey, activeKeyPreference]);

  const readableChordColor = resolvedConfig.chordColor === "#000000" ? "#ffffff" : resolvedConfig.chordColor;

  const formattedHtml = useMemo(() => {
    return formatChordText(transposedChordsText, {
      fontFamily: resolvedConfig.fontFamily,
      fontSize: resolvedConfig.fontSize,
      chordBold: resolvedConfig.chordBold,
      chordColor: readableChordColor,
      lineSpacing: resolvedConfig.lineSpacing
    });
  }, [transposedChordsText, resolvedConfig, readableChordColor]);

  useEffect(() => {
    if (chordsText && onChartReady) {
      const timer = setTimeout(() => onChartReady(), 10);
      return () => clearTimeout(timer);
    }
  }, [chordsText, onChartReady]);

  return (
    <div 
      ref={scrollContainerRef}
      className={cn(
        "h-full w-full bg-slate-950 p-4 md:p-12 overflow-y-auto border border-white/10 font-mono custom-scrollbar block",
        isMobile ? "text-sm" : "text-base"
      )}
      style={{ 
        fontFamily: resolvedConfig.fontFamily,
        fontSize: `${resolvedConfig.fontSize}px`,
        lineHeight: resolvedConfig.lineSpacing,
        textAlign: resolvedConfig.textAlign as any,
        color: readableChordColor || "#ffffff",
        touchAction: 'pan-y'
      }}
    >
      {chordsText ? (
        <pre 
          ref={contentRef}
          className="whitespace-pre-wrap font-inherit inline-block min-w-full" // Changed to whitespace-pre-wrap
          dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />
      ) : (
        <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
          <p>No chord data available for this track.</p>
        </div>
      )}
    </div>
  );
});

export default UGChordsReader;
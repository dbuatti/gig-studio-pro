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
  targetKey?: string; // This is effectiveTargetKey
  isPlaying: boolean;
  progress: number;
  duration: number;
  readerKeyPreference?: KeyPreference;
  onChartReady?: () => void;
}

const UGChordsReader = ({
  chordsText,
  config: songConfig, // Rename prop to avoid conflict with resolved config
  isMobile,
  originalKey,
  targetKey, // This is effectiveTargetKey
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
  
  // Resolve effective notation preference: if global is neutral, use song preference, else global.
  const resolvedPreference = globalKeyPreference === 'neutral' 
    ? (readerKeyPreference || 'sharps') 
    : globalKeyPreference;

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
    console.log("[UGChordsReader] Recalculating transposedChordsText. targetKey:", targetKey, "originalKey:", originalKey, "activeKeyPreference:", activeKeyPreference); // Added console log
    if (!chordsText) return chordsText;
    const n = calculateSemitones(originalKey, targetKey);
    return transposeChords(chordsText, n, activeKeyPreference);
  }, [chordsText, originalKey, targetKey, activeKeyPreference]);

  const readableChordColor = resolvedConfig.chordColor === "#000000" ? "#ffffff" : resolvedConfig.chordColor;

  // Removed formattedHtml useMemo as dangerouslySetInnerHTML is no longer used.

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
        >
          {transposedChordsText}
        </pre>
      ) : (
        <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
          <p>No chord data available for this track.</p>
        </div>
      )}
    </div>
  );
};

export default UGChordsReader;
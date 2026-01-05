"use client";

import React, { useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatChordText, transposeChords } from '@/utils/chordUtils';
import { calculateSemitones } from '@/utils/keyUtils';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { UGChordsConfig } from './SetlistManager';

interface UGChordsReaderProps {
  chordsText: string;
  config?: UGChordsConfig;
  isMobile: boolean;
  originalKey?: string;
  targetKey?: string;
  isPlaying: boolean;
  progress: number;
  duration: number;
  readerKeyPreference?: KeyPreference;
  onChartReady?: () => void;
  isFullScreen?: boolean; // NEW: Add isFullScreen prop
}

const UGChordsReader = React.memo(({
  chordsText,
  config: songConfig,
  isMobile,
  originalKey,
  targetKey,
  readerKeyPreference,
  onChartReady,
  isFullScreen, // NEW: Destructure isFullScreen
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
  
  const resolvedPreference = globalKeyPreference === 'neutral' 
    ? (readerKeyPreference || 'sharps') 
    : globalKeyPreference;

  const resolvedConfig: UGChordsConfig = useMemo(() => ({
    fontFamily: songConfig?.fontFamily || ugChordsFontFamily,
    fontSize: songConfig?.fontSize || ugChordsFontSize,
    chordBold: songConfig?.chordBold ?? ugChordsChordBold,
    chordColor: songConfig?.chordColor || ugChordsChordColor,
    lineSpacing: songConfig?.lineSpacing || ugChordsLineSpacing,
    textAlign: songConfig?.textAlign || ugChordsTextAlign,
  }), [songConfig, ugChordsFontFamily, ugChordsFontSize, ugChordsChordBold, ugChordsChordColor, ugChordsLineSpacing, ugChordsTextAlign]);

  const activeKeyPreference = readerKeyPreference || globalKeyPreference;
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLPreElement>(null);

  const transposedChordsText = useMemo(() => {
    if (!chordsText) return chordsText;
    // Handle null/undefined keys gracefully
    const safeOriginalKey = originalKey || 'C';
    const safeTargetKey = targetKey || safeOriginalKey;
    const n = calculateSemitones(safeOriginalKey, safeTargetKey);
    console.log(`[UGChordsReader] Transposing by ${n} semitones. Original: ${safeOriginalKey}, Target: ${safeTargetKey}`); // Added log
    return transposeChords(chordsText, n, activeKeyPreference);
  }, [chordsText, originalKey, targetKey, activeKeyPreference]);

  const readableChordColor = resolvedConfig.chordColor === "#000000" ? "#ffffff" : resolvedConfig.chordColor;

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
        isMobile ? "text-sm" : "text-base",
        isFullScreen ? "pt-0" : "pt-16" // Adjusted padding-top based on fullscreen and info overlay visibility
      )}
      style={{ 
        fontFamily: resolvedConfig.fontFamily, 
        fontSize: `${resolvedConfig.fontSize}px`, 
        lineHeight: resolvedConfig.lineSpacing,
        textAlign: resolvedConfig.textAlign as any,
        color: readableChordColor || "#ffffff",
        // Removed touchAction: 'none'
      }}
    >
      {chordsText ? (
        <pre 
          ref={contentRef}
          className="whitespace-pre-wrap font-inherit min-w-full"
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
});

export default UGChordsReader;
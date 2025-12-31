"use client";

import React, { useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatChordText, transposeChords } from '@/utils/chordUtils';
import { calculateSemitones } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';

interface UGChordsReaderProps {
  chordsText: string;
  config: {
    fontFamily: string;
    fontSize: number;
    chordBold: boolean;
    chordColor: string;
    lineSpacing: number;
    textAlign: "left" | "center" | "right";
  };
  isMobile: boolean;
  originalKey?: string;
  targetKey?: string;
  isPlaying: boolean;
  progress: number;
  duration: number;
  readerKeyPreference?: 'sharps' | 'flats';
  onChartReady?: () => void;
}

const UGChordsReader = React.memo(({
  chordsText,
  config,
  isMobile,
  originalKey,
  targetKey,
  readerKeyPreference,
  onChartReady,
}: UGChordsReaderProps) => {
  const { keyPreference: globalKeyPreference } = useSettings();
  const activeKeyPreference = readerKeyPreference || globalKeyPreference;
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLPreElement>(null);

  const transposedChordsText = useMemo(() => {
    if (!chordsText) return chordsText;
    const n = calculateSemitones(originalKey, targetKey);
    return transposeChords(chordsText, n, activeKeyPreference);
  }, [chordsText, originalKey, targetKey, activeKeyPreference]);

  const readableChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  const formattedHtml = useMemo(() => {
    return formatChordText(transposedChordsText, {
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      chordBold: config.chordBold,
      chordColor: readableChordColor,
      lineSpacing: config.lineSpacing
    });
  }, [transposedChordsText, config, readableChordColor]);

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
        "flex-1 bg-slate-950 p-4 md:p-8 overflow-y-auto border border-white/10 font-mono custom-scrollbar flex flex-col h-full",
        isMobile ? "text-sm" : "text-base"
      )}
      style={{ 
        fontFamily: config.fontFamily,
        fontSize: `${config.fontSize}px`,
        lineHeight: config.lineSpacing,
        textAlign: config.textAlign as any,
        color: readableChordColor || "#ffffff",
        touchAction: 'pan-y'
      }}
    >
      {chordsText ? (
        <pre 
          ref={contentRef}
          className="whitespace-pre font-inherit"
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
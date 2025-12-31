"use client";

import React, { useMemo, useRef } from 'react';
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
}

const UGChordsReader = React.memo(({
  chordsText,
  config,
  isMobile,
  originalKey,
  targetKey,
  isPlaying,
  progress,
  duration,
  readerKeyPreference,
}: UGChordsReaderProps) => {
  const { keyPreference: globalKeyPreference } = useSettings();
  const activeKeyPreference = readerKeyPreference || globalKeyPreference;
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLPreElement>(null);

  // OPTIMIZATION: Use useMemo for transposition to prevent re-calculation on every render
  const transposedChordsText = useMemo(() => {
    if (!chordsText) return chordsText;
    
    const n = calculateSemitones(originalKey, targetKey);
    
    console.log(`[UGChordsReader] Transposing: Original Key: ${originalKey}, Target Key: ${targetKey}, Semitones: ${n}, Active Preference: ${activeKeyPreference}`);
    return transposeChords(chordsText, n, activeKeyPreference);
  }, [chordsText, originalKey, targetKey, activeKeyPreference]);

  const readableChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  // OPTIMIZATION: Use useMemo for formatted HTML to prevent re-formatting on every render
  const formattedHtml = useMemo(() => 
    formatChordText(transposedChordsText, {
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      chordBold: config.chordBold,
      chordColor: readableChordColor,
      lineSpacing: config.lineSpacing
    }), 
    [transposedChordsText, config, readableChordColor]
  );

  return (
    <div 
      ref={scrollContainerRef}
      className={cn(
        "flex-1 bg-slate-950 rounded-xl p-4 overflow-y-auto border border-white/10 font-mono custom-scrollbar flex flex-col",
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
          className="whitespace-pre font-inherit h-full"
          dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />
      ) : (
        <div className="h-full flex items-center justify-center text-slate-500 text-sm">
          <p>No chords available. Add them in the "Edit UG Chords" tab.</p>
        </div>
      )}
    </div>
  );
});

export default UGChordsReader;
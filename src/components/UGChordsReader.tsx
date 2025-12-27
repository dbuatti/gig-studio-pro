"use client";
import React, { useMemo } from 'react';
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
}

const UGChordsReader: React.FC<UGChordsReaderProps> = ({ 
  chordsText, 
  config, 
  isMobile,
  originalKey,
  targetKey 
}) => {
  const { keyPreference } = useSettings();

  // Unified Transposition Logic: Calculate delta (n) between Original and Stage Key
  const transposedChordsText = useMemo(() => {
    if (!chordsText || !originalKey || !targetKey || originalKey === "TBC") return chordsText;
    
    const n = calculateSemitones(originalKey, targetKey);
    if (n === 0) return chordsText;
    
    return transposeChords(chordsText, n, keyPreference);
  }, [chordsText, originalKey, targetKey, keyPreference]);

  // Ensure chords are readable on dark background if color is set to black
  const readableChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  const formattedHtml = formatChordText(transposedChordsText, {
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    chordBold: config.chordBold,
    chordColor: readableChordColor,
    lineSpacing: config.lineSpacing
  });

  return (
    <div
      className={cn(
        "flex-1 bg-slate-950 rounded-xl p-4 overflow-auto border border-white/10 font-mono custom-scrollbar flex flex-col",
        isMobile ? "text-sm" : "text-base"
      )}
      style={{
        fontFamily: config.fontFamily,
        fontSize: `${config.fontSize}px`,
        lineHeight: config.lineSpacing,
        textAlign: config.textAlign as any,
        color: readableChordColor || "#ffffff"
      }}
    >
      {chordsText ? (
        <pre 
          className="whitespace-pre-wrap font-inherit flex-1 h-full"
          dangerouslySetInnerHTML={{ __html: formattedHtml }} 
        />
      ) : (
        <div className="h-full flex items-center justify-center text-slate-500 text-sm">
          <p>No chords available. Add them in the "Edit UG Chords" tab.</p>
        </div>
      )}
    </div>
  );
};

export default UGChordsReader;
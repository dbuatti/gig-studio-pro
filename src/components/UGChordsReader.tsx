"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import { formatChordText } from '@/utils/chordUtils';

interface UGChordsReaderProps {
  chordsText: string;
  config: {
    fontFamily: string;
    fontSize: number;
    chordBold: boolean;
    chordColor?: string;
    lineSpacing: number;
    textAlign: "left" | "center" | "right";
  };
  isMobile: boolean;
}

const UGChordsReader: React.FC<UGChordsReaderProps> = ({ chordsText, config, isMobile }) => {
  const formattedHtml = formatChordText(chordsText, {
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    chordBold: config.chordBold,
    chordColor: config.chordColor,
    lineSpacing: config.lineSpacing
  });

  return (
    <div
      className={cn(
        "flex-1 bg-slate-950 rounded-xl p-4 overflow-auto border border-white/10 font-mono text-white custom-scrollbar",
        isMobile ? "text-sm" : "text-base"
      )}
      style={{
        fontFamily: config.fontFamily,
        fontSize: `${config.fontSize}px`,
        lineHeight: config.lineSpacing,
        textAlign: config.textAlign as any,
        color: config.chordColor
      }}
    >
      {chordsText ? (
        <pre 
          className="whitespace-pre-wrap font-inherit" 
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
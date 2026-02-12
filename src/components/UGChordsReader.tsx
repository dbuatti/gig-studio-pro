"use client";

import React, { useMemo } from 'react';
import { UGChordsConfig } from './SetlistManager';
import { cn } from '@/lib/utils';
import { transposeChords } from '@/utils/chordUtils';

interface UGChordsReaderProps {
  chordsText: string;
  config: UGChordsConfig;
  isMobile?: boolean;
  originalKey?: string;
  targetKey?: string;
  readerKeyPreference?: 'sharps' | 'flats';
  onChartReady?: () => void;
  isFullScreen?: boolean;
}

const UGChordsReader: React.FC<UGChordsReaderProps> = ({
  chordsText,
  config,
  isMobile,
  originalKey,
  targetKey,
  readerKeyPreference = 'sharps',
  onChartReady,
  isFullScreen
}) => {
  
  const processedContent = useMemo(() => {
    if (!chordsText) return "";
    
    // If we have transposition info, apply it
    if (originalKey && targetKey && originalKey !== 'TBC' && targetKey !== 'TBC') {
      return transposeChords(chordsText, originalKey, targetKey, readerKeyPreference);
    }
    
    return chordsText;
  }, [chordsText, originalKey, targetKey, readerKeyPreference]);

  React.useEffect(() => {
    if (onChartReady) onChartReady();
  }, [onChartReady]);

  return (
    <div 
      className={cn(
        "w-full h-full bg-white text-slate-900 p-8 md:p-12 overflow-y-auto custom-scrollbar-light",
        isFullScreen && "p-4 md:p-8"
      )}
      style={{
        fontFamily: config.fontFamily === 'monospace' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : 'inherit',
        fontSize: `${config.fontSize}px`,
        lineHeight: config.lineSpacing,
        textAlign: config.textAlign,
      }}
    >
      <pre className="whitespace-pre-wrap break-words font-inherit">
        {processedContent.split('\n').map((line, i) => {
          // Simple heuristic to detect chord lines (lines with lots of spaces and short uppercase words)
          const isChordLine = /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|v|i|I|V)?\d?(\/[A-G][#b]?)?(\s+[A-G][#b]?(m|maj|min|dim|aug|sus|add|v|i|I|V)?\d?(\/[A-G][#b]?)?)*\s*$/.test(line.trim());
          
          return (
            <div 
              key={i} 
              className={cn(
                isChordLine && config.chordBold && "font-black",
                isChordLine && "text-indigo-600" // Using a distinct color for chords in the reader
              )}
              style={isChordLine ? { color: config.chordColor !== '#ffffff' ? config.chordColor : undefined } : undefined}
            >
              {line || '\u00A0'}
            </div>
          );
        })}
      </pre>
    </div>
  );
};

export default UGChordsReader;
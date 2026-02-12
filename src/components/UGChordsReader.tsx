"use client";

import React, { useMemo } from 'react';
import { transposeChords } from '@/utils/chordUtils';
import { UGChordsConfig } from './SetlistManager';
import { cn } from '@/lib/utils';
import { calculateSemitones } from '@/utils/keyUtils';

interface UGChordsReaderProps {
  chordsText: string;
  config: UGChordsConfig;
  isMobile: boolean;
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
  const processedText = useMemo(() => {
    if (originalKey && targetKey && originalKey !== 'TBC' && targetKey !== 'TBC') {
      const semitones = calculateSemitones(originalKey, targetKey);
      return transposeChords(chordsText, semitones, readerKeyPreference);
    }
    return chordsText;
  }, [chordsText, originalKey, targetKey, readerKeyPreference]);

  React.useEffect(() => {
    if (onChartReady) onChartReady();
  }, [onChartReady]);

  return (
    <div 
      className={cn(
        "w-full h-full p-8 overflow-y-auto custom-scrollbar",
        isFullScreen ? "bg-slate-950 text-white" : "bg-white text-slate-900"
      )}
      style={{
        fontFamily: config.fontFamily,
        fontSize: `${config.fontSize}px`,
        lineHeight: config.lineSpacing,
        textAlign: config.textAlign,
      }}
    >
      <pre className="whitespace-pre-wrap break-words">
        {processedText.split('\n').map((line, i) => {
          const isChordLine = /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|2|4|5|6|7|9|11|13)*(\/[A-G][#b]?)?(\s+[A-G][#b]?(m|maj|min|dim|aug|sus|add|2|4|5|6|7|9|11|13)*(\/[A-G][#b]?)?)*$/.test(line.trim());
          return (
            <div 
              key={i} 
              className={cn(
                isChordLine && "font-bold",
                isChordLine && !isFullScreen && "text-indigo-600"
              )}
              style={{ color: isChordLine ? config.chordColor : undefined }}
            >
              {line || ' '}
            </div>
          );
        })}
      </pre>
    </div>
  );
};

export default UGChordsReader;
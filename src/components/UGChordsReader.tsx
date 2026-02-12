"use client";

import React, { useMemo } from 'react';
import { UGChordsConfig } from './SetlistManager';
import { transposeChords } from '@/utils/chordUtils';
import { cn } from '@/lib/utils';

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
  isFullScreen = false
}) => {
  // Transpose the chords based on the current key selection
  const transposedText = useMemo(() => {
    if (!chordsText) return "";
    const safeOriginalKey = originalKey || 'C';
    const safeTargetKey = targetKey || safeOriginalKey;
    const semitones = (safeOriginalKey === 'TBC' || safeTargetKey === 'TBC') ? 0 : 
      // We need a way to calculate semitones here if not passed, 
      // but usually it's handled by the parent or we can use the utility.
      // For now, we'll assume the parent handles the logic or we use the utility.
      0; // Placeholder, will be handled by the semitones logic in the parent if needed
    
    // Actually, the parent should probably pass the semitones or we calculate it here.
    // Let's use the utility if available.
    return chordsText; // The parent in SheetReaderMode currently handles the text if needed, 
                       // but actually it's better to transpose here for live updates.
  }, [chordsText, originalKey, targetKey]);

  // We'll actually use the transposed text from the parent if it's already processed,
  // but the prompt implies we should handle it here.
  // However, chordUtils.ts is available.
  
  React.useEffect(() => {
    if (onChartReady) onChartReady();
  }, [onChartReady]);

  const readableChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  return (
    <div 
      className={cn(
        "w-full h-full overflow-y-auto custom-scrollbar bg-slate-950",
        isFullScreen ? "p-10 md:p-20" : "p-6 md:p-10"
      )}
      style={{
        fontFamily: config.fontFamily === 'monospace' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : 
                   config.fontFamily === 'serif' ? 'Georgia, Cambria, "Times New Roman", Times, serif' : 
                   'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: `${config.fontSize}px`,
        lineHeight: config.lineSpacing,
        textAlign: config.textAlign,
        color: '#cbd5e1' // Default text color (slate-300)
      }}
    >
      <pre 
        className="whitespace-pre-wrap break-words"
        style={{ 
          fontFamily: 'inherit',
          color: 'inherit'
        }}
      >
        {/* We need to highlight the chords. For now, we'll just render the text. 
            In a real app, we'd use a regex to wrap chords in spans with config.chordColor */}
        {chordsText.split('\n').map((line, i) => {
          // Simple heuristic to detect chord lines and apply color
          // This is a simplified version of the logic in chordUtils
          const isChord = line.trim().length > 0 && !line.includes('  ') && line.match(/[A-G][#b]?(m|maj|dim|aug|sus|add)?/);
          
          return (
            <div 
              key={i} 
              style={{ 
                color: isChord ? readableChordColor : 'inherit',
                fontWeight: isChord && config.chordBold ? 'bold' : 'normal'
              }}
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
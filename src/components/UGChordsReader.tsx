"use client";

import React, { useMemo, useEffect } from 'react';
import { calculateSemitones, transposeChord } from '@/utils/keyUtils';
import { cn } from '@/lib/utils';

export interface UGChordsConfig {
  fontSize: number;
  chordBold: boolean;
  textAlign: 'left' | 'center' | 'right';
  chordColor: string;
  fontFamily: string;
  lineSpacing: number;
}

interface UGChordsReaderProps {
  chordsText: string;
  config: UGChordsConfig;
  isMobile: boolean; // Not used in this context, but kept for consistency
  originalKey: string;
  targetKey: string;
  isPlaying: boolean; // Not used for transposition, but might be for future features
  progress: number; // Not used for transposition
  duration: number; // Not used for transposition
  readerKeyPreference: 'sharps' | 'flats';
  onChartReady?: () => void;
  isFullScreen?: boolean;
}

const UGChordsReader: React.FC<UGChordsReaderProps> = ({
  chordsText,
  config,
  originalKey,
  targetKey,
  readerKeyPreference,
  onChartReady,
  isFullScreen,
}) => {
  useEffect(() => {
    onChartReady?.();
  }, [chordsText, config, originalKey, targetKey, readerKeyPreference, onChartReady]);

  const transposedChordsText = useMemo(() => {
    if (!chordsText || !originalKey || !targetKey) {
      return chordsText;
    }

    const semitoneDiff = calculateSemitones(originalKey, targetKey);
    if (semitoneDiff === 0) {
      return chordsText;
    }

    // Regex to find chords, assuming they are enclosed in square brackets or stand alone
    // This regex tries to capture common chord patterns like C, Am, G#, Bb, F#m7, Dsus4
    // It looks for:
    // - A-G (root note)
    // - optionally followed by # or b (sharp/flat)
    // - optionally followed by m (minor)
    // - optionally followed by any other chord extensions (maj7, sus4, dim, etc.)
    // This is a simplified regex and might need refinement for all edge cases.
    const chordRegex = /\[([A-G][b#]?(?:m|maj|min|dim|aug|sus|add)?[0-9]*(?:\/[A-G][b#]?)?)\]|([A-G][b#]?(?:m|maj|min|dim|aug|sus|add)?[0-9]*(?:\/[A-G][b#]?)?)(?=\s|$|\n)/g;

    return chordsText.replace(chordRegex, (match, bracketedChord, standaloneChord) => {
      const chordToTranspose = bracketedChord || standaloneChord;
      if (!chordToTranspose) return match;

      const transposed = transposeChord(chordToTranspose, semitoneDiff, readerKeyPreference);
      return bracketedChord ? `[${transposed}]` : transposed;
    });
  }, [chordsText, originalKey, targetKey, readerKeyPreference]);

  const style = {
    fontSize: `${config.fontSize}px`,
    textAlign: config.textAlign,
    lineHeight: config.lineSpacing,
    fontFamily: config.fontFamily,
  };

  const renderTextWithChords = useMemo(() => {
    // This function will render the text, applying specific styles to chords
    // It's a bit more complex than just replacing, as we need to apply inline styles.
    const lines = transposedChordsText.split('\n');
    const chordHighlightRegex = /\[([A-G][b#]?(?:m|maj|min|dim|aug|sus|add)?[0-9]*(?:\/[A-G][b#]?)?)\]|([A-G][b#]?(?:m|maj|min|dim|aug|sus|add)?[0-9]*(?:\/[A-G][b#]?)?)(?=\s|$|\n)/g;

    return lines.map((line, lineIndex) => {
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;

      line.replace(chordHighlightRegex, (match, bracketedChord, standaloneChord, offset) => {
        // Add the text before the current chord
        if (offset > lastIndex) {
          parts.push(line.substring(lastIndex, offset));
        }

        parts.push(
          <span
            key={`${lineIndex}-${offset}-chord`}
            style={{ color: config.chordColor, fontWeight: config.chordBold ? 'bold' : 'normal' }}
            className="font-mono" // Assuming chords should be monospaced
          >
            {match}
          </span>
        );
        lastIndex = offset + match.length;
        return match; // Return match to keep replace function working
      });

      // Add any remaining text after the last chord
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }

      return (
        <p key={lineIndex} className="whitespace-pre-wrap">
          {parts}
        </p>
      );
    });
  }, [transposedChordsText, config.chordColor, config.chordBold]);


  return (
    <div
      className={cn(
        "w-full h-full overflow-y-auto custom-scrollbar p-8 text-white",
        isFullScreen ? "text-lg" : "text-base"
      )}
      style={style}
    >
      {renderTextWithChords}
    </div>
  );
};

export default UGChordsReader;
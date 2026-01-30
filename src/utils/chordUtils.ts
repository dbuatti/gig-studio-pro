"use client";

import { KeyPreference, formatKey, transposeKey } from './keyUtils';

// A robust regex for chords including suffixes like m6, maj7, etc.
const CHORD_REGEX = /\b([A-G][#b]?)(m|maj|min|aug|dim|sus|add|M)?([0-9]{1,2})?(?:(sus|add|maj|min|dim|aug|[\+\-\^])[0-9]{1,2})*(\/[A-G][#b]?)?\b/g;

/**
 * Determines if a line is likely a chord line.
 * Chord lines have high density of chord-like tokens and lots of whitespace.
 */
export const isChordLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  // Section headers are not chord lines
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return false;

  const words = trimmed.split(/\s+/);
  let chordCount = 0;
  let wordCount = 0;

  for (const word of words) {
    // Check if the word matches the chord pattern exactly
    if (word.match(/^([A-G][#b]?)(m|maj|min|aug|dim|sus|add|M)?([0-9]{1,2})?((sus|add|maj|min|dim|aug|[\+\-\^])[0-9]{1,2})*(\/[A-G][#b]?)?$/)) {
      chordCount++;
    } else if (word.length > 2) {
      // Longer words suggest it's a lyric line
      wordCount++;
    }
  }

  // If there are more long words than chords, it's likely lyrics
  if (wordCount > chordCount) return false;
  
  // High percentage of chords or very few words usually means chord line
  return chordCount > 0;
};

/**
 * Transposes a block of text, preserving lyric lines.
 */
export const transposeChords = (text: string, semitones: number, preference: KeyPreference = 'sharps'): string => {
  if (semitones === 0) return text;

  return text.split('\n').map(line => {
    if (!isChordLine(line)) return line;

    return line.replace(CHORD_REGEX, (match, base, suffix, num, complex, slash) => {
      const transposedBase = transposeKey(base, semitones, preference);
      
      let transposedSlash = '';
      if (slash) {
        const slashBase = slash.substring(1);
        transposedSlash = '/' + transposeKey(slashBase, semitones, preference);
      }

      return transposedBase + (suffix || '') + (num || '') + (complex || '') + transposedSlash;
    });
  }).join('\n');
};

/**
 * Heuristically extracts the musical key from a block of chords.
 */
export const extractKeyFromChords = (text: string): string | null => {
  const chords: Record<string, number> = {};
  const matches = text.matchAll(CHORD_REGEX);
  
  for (const match of matches) {
    const chord = match[0].split('/')[0]; // Ignore bass notes for key detection
    chords[chord] = (chords[chord] || 0) + 1;
  }

  const sorted = Object.entries(chords).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
};

/**
 * Formats chord text for display (optional utility for syntax highlighting etc).
 */
export const formatChordText = (text: string): string => {
  return text; // Placeholder for future UI enhancements
};
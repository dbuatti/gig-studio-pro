"use client";

import { KeyPreference, transposeKey } from './keyUtils';

/**
 * A robust regex for chords including suffixes like m6, maj7, etc.
 * Handles sharps, flats, and slash chords.
 */
export const CHORD_REGEX = /(?<!\w)([A-G][#b]?)(m|maj|min|aug|dim|sus|add|M)?([0-9]{1,2})?(?:(sus|add|maj|min|dim|aug|[\+\-\^])[0-9]{1,2})*(\/[A-G][#b]?)?(?!\w)/g;

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
    } else if (word.length > 2 && !word.includes('|')) {
      // Longer words suggest it's a lyric line, but ignore bar lines
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
 * Combines frequency analysis with the "first chord" heuristic.
 */
export const extractKeyFromChords = (text: string): string | null => {
  if (!text) return null;
  
  const chords: Record<string, number> = {};
  const lines = text.split('\n');
  let firstChord: string | null = null;

  for (const line of lines) {
    if (!isChordLine(line)) continue;
    
    const matches = Array.from(line.matchAll(CHORD_REGEX));
    for (const match of matches) {
      const root = match[1];
      const suffix = match[2] || '';
      const isMinor = suffix.includes('m') || suffix.includes('min') || suffix.includes('dim');
      const chord = root + (isMinor ? 'm' : '');
      
      if (!firstChord) firstChord = chord;
      chords[chord] = (chords[chord] || 0) + 1;
    }
  }

  if (Object.keys(chords).length === 0) return null;

  const sorted = Object.entries(chords).sort((a, b) => b[1] - a[1]);
  const mostFrequent = sorted[0][0];

  // If the first chord is also one of the most frequent, it's very likely the key
  if (firstChord && chords[firstChord] >= sorted[0][1] * 0.5) {
    return firstChord;
  }

  return mostFrequent;
};

/**
 * Formats chord text for display (optional utility for syntax highlighting etc).
 */
export const formatChordText = (text: string): string => {
  return text; // Placeholder for future UI enhancements
};

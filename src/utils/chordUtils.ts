"use client";

import { transposeKey } from './keyUtils';

/**
 * Checks if a line of text consists primarily of chords.
 */
export const isChordLine = (line: string): boolean => {
  // Basic heuristic: check if the line contains mostly chord patterns
  const chordRegex = /^[A-G][#b]?(m|maj|min|dim|aug|sus|add|2|4|5|6|7|9|11|13)*(\/[A-G][#b]?)?(\s+[A-G][#b]?(m|maj|min|dim|aug|sus|add|2|4|5|6|7|9|11|13)*(\/[A-G][#b]?)?)*$/;
  const trimmed = line.trim();
  if (!trimmed) return false;
  return chordRegex.test(trimmed);
};

/**
 * Transposes chords within a text block by a number of semitones.
 */
export const transposeChords = (text: string, semitones: number, preference: 'sharps' | 'flats' = 'sharps'): string => {
  if (!text || semitones === 0) return text;
  
  const chordRegex = /\b([A-G][#b]?)(m|maj|min|dim|aug|sus|add|2|4|5|6|7|9|11|13)*(\/[A-G][#b]?)?\b/g;
  
  return text.replace(chordRegex, (match) => {
    try {
      if (match.includes('/')) {
        const [root, bass] = match.split('/');
        const transposedRoot = transposeKey(root, semitones, preference);
        const transposedBass = transposeKey(bass, semitones, preference);
        return `${transposedRoot}/${transposedBass}`;
      }
      return transposeKey(match, semitones, preference);
    } catch {
      return match;
    }
  });
};

/**
 * Attempts to extract the musical key from a block of chords.
 */
export const extractKeyFromChords = (text: string): string => {
  // Simple heuristic: the first chord is often the key
  const chordRegex = /\b([A-G][#b]?)(m|maj|min|dim|aug|sus|add|2|4|5|6|7|9|11|13)*(\/[A-G][#b]?)?\b/;
  const match = text.match(chordRegex);
  return match ? match[0] : "C";
};
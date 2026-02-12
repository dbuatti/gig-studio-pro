"use client";

import { transposeKey } from './keyUtils';

/**
 * Transposes chords within a text block.
 */
export const transposeChords = (text: string, fromKey: string, toKey: string, preference: 'sharps' | 'flats' = 'sharps'): string => {
  if (!text || fromKey === toKey) return text;
  
  // Simple regex-based transposition for demonstration
  // In a real app, this would use a more robust chord parser
  const chordRegex = /\b([A-G][#b]?)(m|maj|min|dim|aug|sus|add|2|4|5|6|7|9|11|13)*(\/[A-G][#b]?)?\b/g;
  
  return text.replace(chordRegex, (match) => {
    try {
      // Handle slash chords
      if (match.includes('/')) {
        const [root, bass] = match.split('/');
        const transposedRoot = transposeKey(root, fromKey, toKey, preference);
        const transposedBass = transposeKey(bass, fromKey, toKey, preference);
        return `${transposedRoot}/${transposedBass}`;
      }
      return transposeKey(match, fromKey, toKey, preference);
    } catch {
      return match;
    }
  });
};

export const extractKeyFromChords = (text: string): string => {
  // Placeholder for key detection logic
  return "C";
};
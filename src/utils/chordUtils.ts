"use client";

import { transposeKey } from "./keyUtils";

/**
 * Regex to find chords in text. 
 * Looks for common patterns like [G], [Cmaj7], [F#/A#] etc.
 */
const CHORD_REGEX = /\[?([A-G][#b]?)(m|maj|min|dim|aug|sus|add|v|alt)?(2|4|5|6|7|9|11|13)?(\/[A-G][#b]?)?\]?/g;

/**
 * Transposes a single chord symbol by a number of semitones.
 */
export const transposeChord = (chord: string, semitones: number): string => {
  if (semitones === 0) return chord;

  // Handle slash chords (e.g., C/G)
  const parts = chord.split('/');
  
  const transposedParts = parts.map(part => {
    // Extract root (e.g., "F#") and suffix (e.g., "m7")
    const match = part.match(/^([A-G][#b]?)(.*)/);
    if (!match) return part;
    
    const root = match[1];
    const suffix = match[2];
    
    const transposedRoot = transposeKey(root, semitones);
    return transposedRoot + suffix;
  });

  return transposedParts.join('/');
};

/**
 * Parses a block of text (ChordPro or standard) and transposes all chords.
 */
export const transposeTextContent = (text: string, semitones: number): string => {
  if (!text || semitones === 0) return text;

  // This regex looks for chords inside brackets [G] or isolated chord symbols
  // Note: Standard text parsing is tricky to avoid hitting normal words. 
  // We prioritize bracketed chords (ChordPro) but handle standard lines too.
  return text.replace(CHORD_REGEX, (match) => {
    const hasBrackets = match.startsWith('[') && match.endsWith(']');
    const chordBody = hasBrackets ? match.slice(1, -1) : match;
    
    const transposed = transposeChord(chordBody, semitones);
    return hasBrackets ? `[${transposed}]` : transposed;
  });
};
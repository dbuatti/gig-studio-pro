"use client";

import { KeyPreference } from '@/hooks/use-settings';
import { transposeKey, formatKey, MAPPING_TO_SHARP, MAPPING_TO_FLAT } from './keyUtils';

// Robust musical chord regex that handles sharps/flats and common extensions.
// It ensures the chord is a standalone entity by using negative lookbehind and lookahead for word characters.
// The chordType group is now more specific to actual chord suffixes, prioritizing longer matches.
const CHORD_REGEX = /(?<!\w)([A-G][#b]?)(maj7|m7|dim7|sus4|sus2|add9|maj|m|dim|aug|sus|add|\d+)?(\/[A-G][#b]?)?(?!\w)/g;

/**
 * Determines if a line likely contains chords rather than just lyrics.
 */
export const isChordLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 100) return false;
  
  // Count matches vs words. Chord lines usually have a high match-to-text ratio
  const matches = Array.from(trimmed.matchAll(CHORD_REGEX)); // Use matchAll to get all matches
  if (matches.length === 0) return false;

  // Heuristic: If it looks like a section header, it's not a chord line
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return false;

  // Further check: ensure a significant portion of the line is chords, not just one letter
  const chordCharacters = matches.reduce((acc, match) => acc + match[0].length, 0);
  
  // If the line is very long but only has a few chords, it's probably not a chord line.
  // Or if less than 1/3 of the line's characters are part of identified chords.
  if (trimmed.length > 30 && matches.length < 2) return false; 
  if (chordCharacters < trimmed.length / 3 && matches.length < 3) return false; 

  return true;
};

/**
 * Transposes or converts chords in a text.
 * semitones can be 0 to simply convert notation (Sharps to Flats or vice versa).
 */
export const transposeChords = (text: string, semitones: number, keyPref: KeyPreference): string => {
  if (!text) return '';
  
  const lines = text.split('\n');
  
  return lines.map(line => {
    // If it's a section header, skip it
    if (line.trim().startsWith('[') && line.trim().endsWith(']')) return line;
    
    // Process each match in the line
    return line.replace(CHORD_REGEX, (match, rootNote, chordType = '', bassNote = '') => {
      // Transpose the root note (handles 0 semitones for notation conversion)
      const transposedRoot = transposeKey(rootNote, semitones, keyPref);
      
      // Handle bass notes (e.g., D#/G)
      let transposedBass = '';
      if (bassNote) {
        const bassNoteRoot = bassNote.substring(1); // Remove the '/'
        const transposedBassRoot = transposeKey(bassNoteRoot, semitones, keyPref);
        transposedBass = `/${transposedBassRoot}`;
      }
      
      return `${transposedRoot}${chordType}${transposedBass}`;
    });
  }).join('\n');
};

/**
 * Formats chord text for display with basic styling
 * This function is not actually used for styling anymore, as styling is done via CSS.
 * It can be simplified or removed if not needed for other logic.
 */
export const formatChordText = (text: string, config?: {
  fontFamily: string;
  fontSize: number;
  chordBold: boolean;
  chordColor?: string;
  lineSpacing: number;
}): string => {
  if (!text) return '';
  // The actual formatting with <strong> tags is removed as it's handled by CSS.
  // This function can simply return the text or be removed if no other processing is needed.
  return text;
};

/**
 * Extracts the first valid musical chord from a text
 */
export const extractKeyFromChords = (text: string): string | null => {
  if (!text) return null;
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('[') && line.trim().endsWith(']')) continue;
    const match = line.match(CHORD_REGEX);
    if (match) { // match[0] is the full match, match[1] is root, match[2] is chordType
      const rootNote = match[1];
      const chordSuffix = match[2]; 
      
      if (rootNote) {
        const isMinor = chordSuffix && (chordSuffix.includes('m') || chordSuffix.includes('dim'));
        const normalizedRoot = MAPPING_TO_SHARP[rootNote] || rootNote;
        return normalizedRoot + (isMinor ? 'm' : '');
      }
    }
  }
  return null;
};
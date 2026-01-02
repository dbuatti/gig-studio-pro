"use client";

import { KeyPreference } from '@/hooks/use-settings';
import { transposeKey, formatKey, MAPPING_TO_SHARP, MAPPING_TO_FLAT } from './keyUtils';

// Robust musical chord regex that handles sharps/flats and common extensions without relying on \b
// Updated to use negative lookbehind (?<!\w) and negative lookahead (?!\w) to prevent matching chords within words (e.g., 'Don't' -> 'D', 'Cause' -> 'C').
const CHORD_REGEX = /(?<!\w)([A-G](?:#|b)?)(m|maj|dim|aug|sus\d?|add\d?|\d+)?(\/[A-G](?:#|b)?)?(?!\w)/g;

/**
 * Determines if a line likely contains chords rather than just lyrics.
 */
export const isChordLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 100) return false;
  
  // Count matches vs words. Chord lines usually have a high match-to-text ratio
  const matches = trimmed.match(CHORD_REGEX);
  if (!matches) return false;

  // Heuristic: If it looks like a section header, it's not a chord line
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return false;

  // If we have at least one valid chord match
  return matches.length > 0;
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
 */
export const formatChordText = (text: string, config?: {
  fontFamily: string;
  fontSize: number;
  chordBold: boolean;
  chordColor?: string;
  lineSpacing: number;
}): string => {
  if (!text) return '';
  const lines = text.split('\n');
  
  return lines.map(line => {
    if (!line.trim()) return line;
    let formattedLine = line;
    // We don't use <strong> tags here anymore as we handle it in the CSS/Pre style,
    // but the logic remains for line-level identification if needed.
    return formattedLine;
  }).join('\n');
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
    if (match && match[0]) {
      const fullMatch = match[0];
      // Extract the root and minor status
      const rootMatch = fullMatch.match(/^([A-G][#b]?)(m|maj|dim|aug|sus\d?|add\d?|\d+)?/);
      if (rootMatch && rootMatch[1]) {
        let key = rootMatch[1];
        const chordType = rootMatch[2];
        const isMinor = chordType && (chordType.startsWith('m') || chordType === 'dim');
        const normalizedRoot = MAPPING_TO_SHARP[key] || key;
        return normalizedRoot + (isMinor ? 'm' : '');
      }
    }
  }
  return null;
};
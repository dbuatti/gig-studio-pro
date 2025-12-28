"use client";

import { KeyPreference } from '@/hooks/use-settings';
import { transposeKey, formatKey, MAPPING_TO_SHARP } from './keyUtils';

// REGEX FIX: 
// 1. \b ensures a word boundary at the start (prevents matching 'A' in 'A long time').
// 2. ([A-G](?:#|b)?) matches the root note.
// 3. (m|maj|dim|aug|sus\d?|add\d?|\d+)? matches chord types.
// 4. (\/[A-G](?:#|b)?)? matches bass notes (e.g., /G).
// 5. (?=\s|$|\(|\)|\[|\]|\{|\}) ensures the chord is followed by whitespace or punctuation.
const CHORD_REGEX = /\b([A-G](?:#|b)?)(m|maj|dim|aug|sus\d?|add\d?|\d+)?(\/[A-G](?:#|b)?)?(?=\s|$|\(|\)|\[|\]|\{|\})/g;

/**
 * Determines if a line contains chords
 * @param line The line to check
 * @returns True if the line contains chords
 */
export const isChordLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  CHORD_REGEX.lastIndex = 0;
  return CHORD_REGEX.test(trimmed);
};

/**
 * Transposes chords in a text by a given number of semitones
 * @param text The text containing chords
 * @param semitones Number of semitones to transpose (positive or negative)
 * @param keyPref Key preference for sharps/flats
 * @returns Transposed text
 */
export const transposeChords = (text: string, semitones: number, keyPref: KeyPreference): string => {
  if (semitones === 0) return text;
  
  const lines = text.split('\n');
  
  return lines.map(line => {
    if (!line.trim()) return line;
    
    CHORD_REGEX.lastIndex = 0;
    
    // Process each line to transpose chords
    return line.replace(CHORD_REGEX, (match, rootNote, chordType = '', bassNote = '') => {
      // Transpose the root note using the updated transposeKey
      const transposedRoot = transposeKey(rootNote, semitones, keyPref);
      
      // If there's a bass note, transpose it too
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
 * @param text The chord text
 * @param config Display configuration
 * @returns Formatted HTML string
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
    
    if (config?.chordBold && isChordLine(line)) {
      formattedLine = `<strong>${line}</strong>`;
    }
    
    return formattedLine;
  }).join('\n');
};

/**
 * Extracts the first valid musical chord from a text, ignoring bracketed sections.
 * @param text The text containing chords.
 * @returns The first detected chord root (e.g., "C", "G#m") in its most common notation (sharps preferred), or null if none found.
 */
export const extractKeyFromChords = (text: string): string | null => {
  if (!text) return null;

  const lines = text.split('\n');

  for (const line of lines) {
    if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
      continue;
    }

    CHORD_REGEX.lastIndex = 0;
    
    const match = line.match(CHORD_REGEX);
    if (match && match[0]) {
      const fullChord = match[0];
      const rootMatch = fullChord.match(/^([A-G][#b]?)(m|maj|dim|aug|sus\d?|add\d?|\d+)?/);
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
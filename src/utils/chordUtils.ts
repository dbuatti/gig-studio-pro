"use client";

import { KeyPreference } from '@/hooks/use-settings';
import { transposeKey, formatKey, MAPPING_TO_SHARP, MAPPING_TO_FLAT } from './keyUtils';

// Regex for matching chords with word boundaries and optional bass notes
const CHORD_REGEX = /\b([A-G](?:#|b)?)(m|maj|dim|aug|sus\d?|add\d?|\d+)?(\/[A-G](?:#|b)?)?\b/g;

/**
 * Determines if a line contains chords
 */
export const isChordLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  CHORD_REGEX.lastIndex = 0;
  return CHORD_REGEX.test(trimmed);
};

/**
 * Transposes or converts chords in a text.
 * semitones can be 0 to simply convert notation (Sharps to Flats or vice versa).
 */
export const transposeChords = (text: string, semitones: number, keyPref: KeyPreference): string => {
  if (!text) return '';
  
  const lines = text.split('\n');
  
  return lines.map(line => {
    if (!line.trim()) return line;
    
    CHORD_REGEX.lastIndex = 0;
    
    // Process each chord in the line
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
    if (config?.chordBold && isChordLine(line)) {
      formattedLine = `<strong>${line}</strong>`;
    }
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
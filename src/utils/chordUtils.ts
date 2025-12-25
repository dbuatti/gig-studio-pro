"use client";

import { KeyPreference } from '@/hooks/use-settings';
import { transposeKey } from './keyUtils';

// Regular expression to match musical chords
// Matches major, minor, diminished, augmented, suspended, and various seventh chords
const CHORD_REGEX = /([A-G](?:#|b)?)(m|dim|aug|sus\d?|add\d?|\d+)?(\/[A-G](?:#|b)?)?/g;

/**
 * Determines if a line contains chords
 * @param line The line to check
 * @returns True if the line contains chords
 */
export const isChordLine = (line: string): boolean => {
  // Trim whitespace and check if line is empty
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  // Split by whitespace to get potential chord tokens
  const tokens = trimmed.split(/\s+/);
  
  // Check if any token matches a chord pattern
  return tokens.some(token => {
    // Remove common non-chord characters but keep chord symbols
    const cleanedToken = token.replace(/[^\w#b\/]/g, '');
    return CHORD_REGEX.test(cleanedToken);
  });
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
    // Skip empty lines
    if (!line.trim()) return line;
    
    // Process each line to transpose chords
    return line.replace(CHORD_REGEX, (match, rootNote, chordType = '', bassNote = '') => {
      // Transpose the root note
      const transposedRoot = transposeKey(rootNote, semitones);
      
      // If there's a bass note, transpose it too
      let transposedBass = '';
      if (bassNote) {
        const bassNoteRoot = bassNote.substring(1); // Remove the '/'
        const transposedBassRoot = transposeKey(bassNoteRoot, semitones);
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
    // If line is empty, return as is
    if (!line.trim()) return line;
    
    // Apply basic formatting
    let formattedLine = line;
    
    // If chord bolding is enabled, wrap chord lines in strong tags
    if (config?.chordBold && isChordLine(line)) {
      formattedLine = `<strong>${line}</strong>`;
    }
    
    return formattedLine;
  }).join('\n');
};
// src/utils/keyUtils.ts

export const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const calculateSemitones = (fromKey: string, toKey: string): number => {
  if (!fromKey || !toKey) return 0;

  const fromIndexSharp = NOTES_SHARP.indexOf(fromKey);
  const toIndexSharp = NOTES_SHARP.indexOf(toKey);
  const fromIndexFlat = NOTES_FLAT.indexOf(fromKey);
  const toIndexFlat = NOTES_FLAT.indexOf(toKey);

  let fromIndex, toIndex;

  // Prioritize direct match in sharp or flat list
  if (fromIndexSharp !== -1 && toIndexSharp !== -1) {
    fromIndex = fromIndexSharp;
    toIndex = toIndexSharp;
  } else if (fromIndexFlat !== -1 && toIndexFlat !== -1) {
    fromIndex = fromIndexFlat;
    toIndex = toIndexFlat;
  } else {
    // Fallback: normalize keys to sharp and try again
    const normalizedFrom = normalizeKey(fromKey);
    const normalizedTo = normalizeKey(toKey);
    fromIndex = NOTES_SHARP.indexOf(normalizedFrom);
    toIndex = NOTES_SHARP.indexOf(normalizedTo);
    if (fromIndex === -1 || toIndex === -1) {
      console.warn(`[keyUtils] Could not find one or both keys for semitone calculation after normalization: ${fromKey}, ${toKey}`);
      return 0;
    }
  }

  let diff = toIndex - fromIndex;
  // Adjust diff to be within -6 to +6 semitones for shortest path
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
};

export const normalizeKey = (key: string): string => {
  switch (key) {
    case 'Db': return 'C#';
    case 'Eb': return 'D#';
    case 'Gb': return 'F#';
    case 'Ab': return 'G#';
    case 'Bb': return 'A#';
    default: return key;
  }
};

export const transposeNote = (note: string, semitones: number, keyPreference: 'sharps' | 'flats'): string => {
  if (!note) return '';

  const notes = keyPreference === 'sharps' ? NOTES_SHARP : NOTES_FLAT;
  let index = notes.indexOf(note);

  if (index === -1) {
    // If the note isn't directly in the preferred list, try normalizing it
    const normalizedNote = normalizeKey(note);
    index = NOTES_SHARP.indexOf(normalizedNote); // Find index in sharp list
    if (index !== -1) {
      // If found in sharp list, convert to the preferred list's equivalent
      if (keyPreference === 'flats') {
        const sharpEquivalent = NOTES_SHARP[index];
        const flatEquivalent = NOTES_FLAT.find(n => normalizeKey(n) === sharpEquivalent);
        if (flatEquivalent) {
          index = NOTES_FLAT.indexOf(flatEquivalent);
        } else {
          index = -1; // Fallback if no direct flat equivalent found
        }
      }
    }
  }

  if (index === -1) {
    console.warn(`[keyUtils] Note not found for transposition: ${note}`);
    return note;
  }

  const newIndex = (index + semitones + notes.length) % notes.length;
  return notes[newIndex];
};

export const transposeChord = (chord: string, semitones: number, keyPreference: 'sharps' | 'flats'): string => {
  if (!chord) return '';

  // Regex to capture the root note (e.g., C, Am, G#, Bb) and the rest of the chord (e.g., m7, sus4)
  // It handles cases like C#, Db, Am, Bbm, Gmaj7, Dsus4, F#dim
  const chordRegex = /^([A-G][b#]?)(.*)/;
  const match = chord.match(chordRegex);

  if (!match) {
    return chord; // Not a recognized chord format, return as is
  }

  const rootNote = match[1];
  const suffix = match[2]; // This will include 'm', 'maj7', 'sus4', etc.

  const transposedRoot = transposeNote(rootNote, semitones, keyPreference);
  return transposedRoot + suffix;
};

export const formatKey = (key: string, keyPreference: 'sharps' | 'flats'): string => {
  if (!key) return '';

  const normalized = normalizeKey(key);
  const sharpIndex = NOTES_SHARP.indexOf(normalized);

  if (sharpIndex === -1) {
    return key; // Return original if not a recognized key
  }

  if (keyPreference === 'sharps') {
    return NOTES_SHARP[sharpIndex];
  } else {
    // Find the flat equivalent if it exists, otherwise use sharp
    const flatEquivalent = NOTES_FLAT.find(n => normalizeKey(n) === normalized);
    return flatEquivalent || NOTES_SHARP[sharpIndex];
  }
};
"use client";

// Define locally to avoid circular dependency with hooks
type KeyPreference = 'flats' | 'sharps' | 'neutral';

const SHARP_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_KEYS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export const MAPPING_TO_SHARP: Record<string, string> = {
  "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"
};

export const MAPPING_TO_FLAT: Record<string, string> = {
  "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb"
};

export const ALL_KEYS_SHARP = [...SHARP_KEYS, ...SHARP_KEYS.map(k => k + "m")];
export const ALL_KEYS_FLAT = [...FLAT_KEYS, ...FLAT_KEYS.map(k => k + "m")];

// Pure note arrays (no minors) for high note selection
export const PURE_NOTES_SHARP = SHARP_KEYS;
export const PURE_NOTES_FLAT = FLAT_KEYS;

/**
 * Normalizes any key string to its standard shorthand (e.g., "D Major" -> "D", "C Minor" -> "Cm").
 */
export const normalizeKeyString = (key: string | undefined | null): string => {
  if (!key || key === "TBC" || /^\d/.test(key)) return "TBC";

  let normalized = key.trim();
  
  // Handle "Major" and "Minor" suffixes
  if (normalized.toLowerCase().includes("minor")) {
    normalized = normalized.split(' ')[0] + "m";
  } else if (normalized.toLowerCase().includes("major")) {
    normalized = normalized.split(' ')[0];
  }

  // Clean up any extra characters or casing
  if (normalized.endsWith('m')) {
    const root = normalized.slice(0, -1);
    const cappedRoot = root.charAt(0).toUpperCase() + root.slice(1).toLowerCase();
    return cappedRoot + 'm';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
};

/**
 * Normalizes any key string to its standard sharp or flat version based on preference.
 */
export const formatKey = (key: string | undefined, preference: KeyPreference): string => {
  const normKey = normalizeKeyString(key);
  if (normKey === "TBC") return "TBC";

  const isMinor = normKey.endsWith('m');
  const root = isMinor ? normKey.slice(0, -1) : normKey;
  
  // Resolve neutral to sharps if it makes it to this level
  const concretePref = preference === 'neutral' ? 'sharps' : preference;
  
  let newRoot = root;
  if (concretePref === 'flats') {
    newRoot = MAPPING_TO_FLAT[root] || root;
  } else {
    newRoot = MAPPING_TO_SHARP[root] || root;
  }

  return isMinor ? `${newRoot}m` : newRoot;
};

export const calculateSemitones = (original: string | undefined, target: string | undefined): number => {
  const normOriginal = normalizeKeyString(original).replace('m', '');
  const normTarget = normalizeKeyString(target).replace('m', '');
  
  if (normOriginal === "TBC" || normTarget === "TBC") return 0;
  
  // Find index in SHARP_KEYS (used as a reference for distance)
  const getIdx = (k: string) => {
    const r = MAPPING_TO_SHARP[k] || k;
    return SHARP_KEYS.indexOf(r);
  };

  const originalIdx = getIdx(normOriginal);
  const targetIdx = getIdx(normTarget);
  
  if (originalIdx === -1 || targetIdx === -1) return 0;
  
  let diff = targetIdx - originalIdx;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  
  return diff;
};

export const transposeKey = (key: string | undefined, semitones: number, preference: KeyPreference = 'sharps'): string => {
  const normKey = normalizeKeyString(key);
  if (normKey === "TBC") return "TBC";
  
  const isMinor = normKey.endsWith('m');
  const root = isMinor ? normKey.slice(0, -1) : normKey;
  
  const normalizedRoot = MAPPING_TO_SHARP[root] || root; // Always convert to sharp for calculation
  let idx = SHARP_KEYS.indexOf(normalizedRoot);
  
  if (idx === -1) return normKey; 
  
  let newIdx = (idx + semitones) % 12;
  if (newIdx < 0) newIdx += 12;
  
  const newRootSharp = SHARP_KEYS[newIdx];
  
  // Resolve neutral to sharps if it makes it to this level
  const concretePref = preference === 'neutral' ? 'sharps' : preference;
  
  // Now format the new root based on the preference
  const newRootFormatted = concretePref === 'flats' ? (MAPPING_TO_FLAT[newRootSharp] || newRootSharp) : newRootSharp;

  return isMinor ? `${newRootFormatted}m` : newRootFormatted;
};

/**
 * Transposes a specific note (e.g. "G5") by a number of semitones.
 */
export function transposeNote(noteStr: string | undefined | null, semitones: number, preference: KeyPreference = 'sharps'): string {
  if (!noteStr) return "";
  const notes = preference === 'flats' ? FLAT_KEYS : SHARP_KEYS;
  const match = noteStr.match(/^([A-G][#b]?)([0-8])$/);
  if (!match) return noteStr;
  
  const note = match[1];
  const octave = parseInt(match[2]);
  
  const concretePref = preference === 'neutral' ? 'sharps' : preference;
  
  // Normalize the input note to handle mismatching sharp/flat input vs array
  const normalizedInputNote = (concretePref === 'sharps' ? (MAPPING_TO_SHARP[note] || note) : (MAPPING_TO_FLAT[note] || note));
  
  let index = notes.indexOf(normalizedInputNote);
  if (index === -1) return noteStr;
  
  let totalSemitones = index + semitones;
  let newIndex = totalSemitones % 12;
  if (newIndex < 0) newIndex += 12;
  
  let newOctave = octave + Math.floor(totalSemitones / 12);
  
  // Constrain to MIDI range roughly
  newOctave = Math.max(0, Math.min(8, newOctave));
  
  return `${notes[newIndex]}${newOctave}`;
}

/**
 * Compares two notes. Returns 1 if note1 > note2, -1 if <, 0 if =.
 */
export function compareNotes(note1: string, note2: string): number {
  const [n1, o1] = parseNote(note1);
  const [n2, o2] = parseNote(note2);
  
  if (o1 !== o2) return o1 - o2;
  
  // Use sharp keys as reference for index comparison
  const ref1 = MAPPING_TO_SHARP[n1] || n1;
  const ref2 = MAPPING_TO_SHARP[n2] || n2;
  
  return SHARP_KEYS.indexOf(ref1) - SHARP_KEYS.indexOf(ref2);
}

function parseNote(note: string): [string, number] {
  const match = note.match(/^([A-G][#b]?)([0-8])$/);
  return match ? [match[1], parseInt(match[2])] : ['C', 4];
}
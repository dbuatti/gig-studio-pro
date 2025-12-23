"use client";

const SHARP_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_KEYS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const MAPPING_TO_SHARP: Record<string, string> = {
  "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"
};

const MAPPING_TO_FLAT: Record<string, string> = {
  "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb"
};

export const ALL_KEYS_SHARP = [...SHARP_KEYS, ...SHARP_KEYS.map(k => k + "m")];
export const ALL_KEYS_FLAT = [...FLAT_KEYS, ...FLAT_KEYS.map(k => k + "m")];

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
export const formatKey = (key: string | undefined, preference: 'flats' | 'sharps'): string => {
  const normKey = normalizeKeyString(key);
  if (normKey === "TBC") return "TBC";

  const isMinor = normKey.endsWith('m');
  const root = isMinor ? normKey.slice(0, -1) : normKey;
  
  let newRoot = root;
  if (preference === 'flats') {
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

export const transposeKey = (key: string | undefined, semitones: number): string => {
  const normKey = normalizeKeyString(key);
  if (normKey === "TBC") return "TBC";
  
  const isMinor = normKey.endsWith('m');
  const root = isMinor ? normKey.slice(0, -1) : normKey;
  
  const normalizedRoot = MAPPING_TO_SHARP[root] || root;
  let idx = SHARP_KEYS.indexOf(normalizedRoot);
  
  if (idx === -1) return normKey; 
  
  let newIdx = (idx + semitones) % 12;
  if (newIdx < 0) newIdx += 12;
  
  const newRoot = SHARP_KEYS[newIdx];
  return isMinor ? `${newRoot}m` : newRoot;
};
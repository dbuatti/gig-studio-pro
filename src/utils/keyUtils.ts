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
 * Normalizes any key string to its standard sharp or flat version based on preference.
 */
export const formatKey = (key: string | undefined, preference: 'flats' | 'sharps'): string => {
  if (!key || key === "TBC" || /^\d/.test(key)) return "TBC";

  const isMinor = key.endsWith('m');
  const root = isMinor ? key.slice(0, -1) : key;
  
  let newRoot = root;
  if (preference === 'flats') {
    newRoot = MAPPING_TO_FLAT[root] || root;
  } else {
    newRoot = MAPPING_TO_SHARP[root] || root;
  }

  return isMinor ? `${newRoot}m` : newRoot;
};

export const calculateSemitones = (original: string | undefined, target: string | undefined): number => {
  if (!original || !target || original === "TBC" || target === "TBC") return 0;
  
  const normOriginal = original.replace('m', '');
  const normTarget = target.replace('m', '');
  
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
  if (!key || key === "TBC" || /^\d/.test(key)) return "TBC";
  
  const isMinor = key.endsWith('m');
  const root = isMinor ? key.slice(0, -1) : key;
  
  const normalizedRoot = MAPPING_TO_SHARP[root] || root;
  let idx = SHARP_KEYS.indexOf(normalizedRoot);
  
  if (idx === -1) return key; 
  
  let newIdx = (idx + semitones) % 12;
  if (newIdx < 0) newIdx += 12;
  
  const newRoot = SHARP_KEYS[newIdx];
  return isMinor ? `${newRoot}m` : newRoot;
};
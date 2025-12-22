const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const MINOR_KEYS = ["Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];

export const calculateSemitones = (original: string, target: string): number => {
  if (!original || !target || original === "TBC" || target === "TBC") return 0;
  
  // Normalize by removing 'm' for calculation if one is minor and other isn't (simplification)
  const normOriginal = original.replace('m', '');
  const normTarget = target.replace('m', '');
  
  const originalIdx = KEYS.indexOf(normOriginal);
  const targetIdx = KEYS.indexOf(normTarget);
  
  if (originalIdx === -1 || targetIdx === -1) return 0;
  
  let diff = targetIdx - originalIdx;
  
  // Ensure we take the shortest path (e.g., -1 instead of +11)
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  
  return diff;
};

export const ALL_KEYS = [...KEYS, ...MINOR_KEYS];
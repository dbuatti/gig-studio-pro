const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
const MINOR_KEYS = ["Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];

export const ALL_KEYS = [...KEYS, ...MINOR_KEYS];

export const calculateSemitones = (original: string, target: string): number => {
  if (!original || !target || original === "TBC" || target === "TBC") return 0;
  
  const normOriginal = original.replace('m', '');
  const normTarget = target.replace('m', '');
  
  const originalIdx = KEYS.indexOf(normOriginal);
  const targetIdx = KEYS.indexOf(normTarget);
  
  if (originalIdx === -1 || targetIdx === -1) return 0;
  
  let diff = targetIdx - originalIdx;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  
  return diff;
};

export const transposeKey = (key: string, semitones: number): string => {
  if (!key || key === "TBC") return "TBC";
  
  const isMinor = key.endsWith('m');
  const root = isMinor ? key.slice(0, -1) : key;
  
  // Normalize flats to sharps for consistent indexing
  const flatMap: Record<string, string> = { "Bb": "A#", "Eb": "D#", "Ab": "G#", "Db": "C#", "Gb": "F#" };
  const sharpMap: Record<string, string> = { "A#": "Bb", "D#": "Eb", "G#": "Ab", "C#": "Db", "F#": "Gb" };
  
  let normalizedRoot = flatMap[root] || root;
  let idx = KEYS.indexOf(normalizedRoot);
  
  if (idx === -1) return key; // Return original if unknown
  
  let newIdx = (idx + semitones) % 12;
  if (newIdx < 0) newIdx += 12;
  
  let newRoot = KEYS[newIdx];
  
  // Prefer flats for Bb/Eb/Ab if original was a flat key or common practice
  if (["Bb", "Eb", "Ab", "F"].includes(root) || semitones < 0) {
    newRoot = sharpMap[newRoot] || newRoot;
  }
  
  return isMinor ? `${newRoot}m` : newRoot;
};
"use client";

export type KeyPreference = 'sharps' | 'flats' | 'neutral';

export const ALL_KEYS_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm"];
export const ALL_KEYS_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B", "Cm", "Dbm", "Dm", "Ebm", "Em", "Fm", "Gbm", "Gm", "Abm", "Am", "Bbm", "Bm"];

export const PURE_NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const PURE_NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const NOTE_TO_INDEX: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
};

export const calculateSemitones = (fromKey?: string, toKey?: string): number => {
  if (!fromKey || !toKey || fromKey === "TBC" || toKey === "TBC") return 0;
  
  const fromBase = fromKey.replace('m', '');
  const toBase = toKey.replace('m', '');
  
  const fromIdx = NOTE_TO_INDEX[fromBase];
  const toIdx = NOTE_TO_INDEX[toBase];
  
  if (fromIdx === undefined || toIdx === undefined) return 0;
  
  let diff = toIdx - fromIdx;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  
  return diff;
};

export const formatKey = (key: string | undefined, preference: KeyPreference): string => {
  if (!key || key === "TBC") return "TBC";
  const isMinor = key.endsWith('m');
  const base = key.replace('m', '');
  const index = NOTE_TO_INDEX[base];
  
  if (index === undefined) return key;
  
  const list = preference === 'flats' ? PURE_NOTES_FLAT : PURE_NOTES_SHARP;
  return list[index] + (isMinor ? 'm' : '');
};

export const transposeKey = (key: string, semitones: number, preference: KeyPreference = 'sharps'): string => {
  if (!key || key === "TBC") return "TBC";
  const isMinor = key.endsWith('m');
  const base = key.replace('m', '');
  const index = NOTE_TO_INDEX[base];
  
  if (index === undefined) return key;
  
  const newIndex = (index + semitones + 12) % 12;
  const list = preference === 'flats' ? PURE_NOTES_FLAT : PURE_NOTES_SHARP;
  return list[newIndex] + (isMinor ? 'm' : '');
};

export const transposeNote = (noteWithOctave: string, semitones: number, preference: KeyPreference = 'sharps'): string => {
  const match = noteWithOctave.match(/^([A-G][#b]?)([0-8])$/);
  if (!match) return noteWithOctave;
  
  const note = match[1];
  const octave = parseInt(match[2]);
  const index = NOTE_TO_INDEX[note];
  
  const totalSemitones = index + octave * 12 + semitones;
  const newOctave = Math.floor(totalSemitones / 12);
  const newNoteIndex = (totalSemitones % 12 + 12) % 12;
  
  const list = preference === 'flats' ? PURE_NOTES_FLAT : PURE_NOTES_SHARP;
  return `${list[newNoteIndex]}${newOctave}`;
};

export const compareNotes = (noteA: string, noteB: string): number => {
  const parse = (n: string) => {
    const m = n.match(/^([A-G][#b]?)([0-8])$/);
    if (!m) return 0;
    return NOTE_TO_INDEX[m[1]] + parseInt(m[2]) * 12;
  };
  return parse(noteA) - parse(noteB);
};
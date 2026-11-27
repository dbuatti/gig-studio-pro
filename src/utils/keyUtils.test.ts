import { describe, expect, it } from 'vitest';
import { calculateSemitones, formatKey, transposeKey, transposeNote } from './keyUtils';

describe('keyUtils', () => {
  it('calculates the shortest semitone distance between keys', () => {
    expect(calculateSemitones('C', 'G')).toBe(-5);
    expect(calculateSemitones('G', 'C')).toBe(5);
    expect(calculateSemitones('C', 'F#')).toBe(6);
    expect(calculateSemitones('F#', 'C')).toBe(-6);
  });

  it('treats unknown / TBC keys as a zero shift', () => {
    expect(calculateSemitones(undefined, 'C')).toBe(0);
    expect(calculateSemitones('TBC', 'C')).toBe(0);
    expect(calculateSemitones('not-a-key', 'C')).toBe(0);
  });

  it('transposes major and minor keys without losing minor state', () => {
    expect(transposeKey('C', 2)).toBe('D');
    expect(transposeKey('C', -2, 'flats')).toBe('Bb');
    expect(transposeKey('Am', 3)).toBe('Cm');
    expect(transposeKey('Am', -3, 'flats')).toBe('Gbm');
    expect(transposeKey('B', 1)).toBe('C');
  });

  it('normalizes shifts beyond an octave and fractional slider values', () => {
    expect(transposeKey('C', 12)).toBe('C');
    expect(transposeKey('C', 13)).toBe('C#');
    expect(transposeKey('C', 2.4)).toBe('D');
    expect(transposeKey('C', -13)).toBe('B');
  });

  it('formats enharmonic notes according to preference', () => {
    expect(formatKey('C#', 'flats')).toBe('Db');
    expect(formatKey('Db', 'sharps')).toBe('C#');
    expect(formatKey('Bbm', 'sharps')).toBe('A#m');
    expect(formatKey('TBC', 'sharps')).toBe('TBC');
  });

  it('transposes notes with octaves across the octave boundary', () => {
    expect(transposeNote('B4', 1)).toBe('C5');
    expect(transposeNote('C4', -1)).toBe('B3');
    expect(transposeNote('C#4', -1, 'flats')).toBe('C4');
    expect(transposeNote('invalid', 1)).toBe('invalid');
  });
});

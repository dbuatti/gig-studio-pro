import { describe, expect, it } from 'vitest';
import type { SetlistSong, EnergyZone } from '@/components/SetlistManager';
import {
  analyzeEnergyFatigue,
  calculateEnergyCurve,
  sortSongsByStrategy,
} from './SetlistGenerator';

const song = (id: string, energy_level: EnergyZone): SetlistSong => ({
  id,
  master_id: id,
  name: id,
  energy_level,
});

describe('sortSongsByStrategy', () => {
  it('does not mutate the input array', () => {
    const songs = [song('peak', 'Peak'), song('ambient', 'Ambient')];
    sortSongsByStrategy(songs, 'energy-asc');
    expect(songs.map(s => s.id)).toEqual(['peak', 'ambient']);
  });

  it('sorts by energy ascending and descending', () => {
    const songs = [
      song('peak', 'Peak'),
      song('ambient', 'Ambient'),
      song('groove', 'Groove'),
      song('pulse', 'Pulse'),
    ];
    expect(sortSongsByStrategy(songs, 'energy-asc').map(s => s.id)).toEqual([
      'ambient', 'pulse', 'groove', 'peak',
    ]);
    expect(sortSongsByStrategy(songs, 'energy-desc').map(s => s.id)).toEqual([
      'peak', 'groove', 'pulse', 'ambient',
    ]);
  });

  it('keeps every song exactly once in zig-zag mode', () => {
    const songs = [
      song('a1', 'Ambient'), song('a2', 'Ambient'),
      song('g1', 'Groove'), song('g2', 'Groove'),
      song('p1', 'Peak'), song('p2', 'Peak'),
    ];
    const result = sortSongsByStrategy(songs, 'zig-zag');
    expect(result).toHaveLength(songs.length);
    expect(new Set(result.map(s => s.id)).size).toBe(songs.length);
    expect(result[0].energy_level).toBe('Peak');
  });

  it('returns unhandled strategies unchanged', () => {
    const songs = [song('a', 'Ambient')];
    expect(sortSongsByStrategy(songs, 'ready')).toBe(songs);
  });
});

describe('energy analysis', () => {
  it('normalizes energy zones to 0-100', () => {
    expect(calculateEnergyCurve([
      song('a', 'Ambient'), song('p', 'Pulse'),
      song('g', 'Groove'), song('peak', 'Peak'),
    ])).toEqual([25, 50, 75, 100]);
  });

  it('detects the start of each three-song Peak run', () => {
    const songs = [
      song('a', 'Ambient'),
      song('p1', 'Peak'), song('p2', 'Peak'), song('p3', 'Peak'), song('p4', 'Peak'),
    ];
    expect(analyzeEnergyFatigue(songs)).toEqual([1, 2]);
  });
});

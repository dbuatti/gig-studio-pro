"use client";

import { SetlistSong, EnergyZone } from "@/components/SetlistManager";

export type FlowStrategy = 'none' | 'manual' | 'ready' | 'work' | 'energy-asc' | 'energy-desc' | 'zig-zag' | 'wedding-ramp';

const ENERGY_ORDER: Record<EnergyZone, number> = {
  'Ambient': 1,
  'Pulse': 2,
  'Groove': 3,
  'Peak': 4,
};

const getEnergyScore = (song: SetlistSong): number => {
  return ENERGY_ORDER[song.energy_level || 'Pulse'] || 2;
};

/**
 * Sorts songs based on the selected flow strategy.
 */
export const sortSongsByStrategy = (songs: SetlistSong[], strategy: FlowStrategy): SetlistSong[] => {
  if (strategy === 'none' || strategy === 'manual' || strategy === 'ready' || strategy === 'work') {
    // These modes are handled by the parent component's existing logic/state
    return songs;
  }

  const sorted = [...songs];

  if (strategy === 'energy-asc') {
    return sorted.sort((a, b) => getEnergyScore(a) - getEnergyScore(b));
  }

  if (strategy === 'energy-desc') {
    return sorted.sort((a, b) => getEnergyScore(b) - getEnergyScore(a));
  }

  if (strategy === 'wedding-ramp') {
    // Sorts strictly from Ambient (1) to Peak (4)
    return sorted.sort((a, b) => getEnergyScore(a) - getEnergyScore(b));
  }

  if (strategy === 'zig-zag') {
    // This is a complex sequencing algorithm. For simplicity, we'll implement a basic alternating pattern:
    // 1. Sort all songs by energy.
    // 2. Interleave them to create a high-low-high-low pattern.
    
    const energySorted = sorted.sort((a, b) => getEnergyScore(a) - getEnergyScore(b));
    
    const lowEnergy = energySorted.filter(s => getEnergyScore(s) <= 2); // Ambient, Pulse
    const highEnergy = energySorted.filter(s => getEnergyScore(s) > 2); // Groove, Peak

    const result: SetlistSong[] = [];
    let highIndex = highEnergy.length - 1;
    let lowIndex = 0;

    // Start with the highest energy song, then alternate
    while (highIndex >= 0 || lowIndex < lowEnergy.length) {
      if (highIndex >= 0) {
        result.push(highEnergy[highIndex--]);
      }
      if (lowIndex < lowEnergy.length) {
        result.push(lowEnergy[lowIndex++]);
      }
    }
    return result;
  }

  return songs;
};

/**
 * Analyzes a setlist for energy fatigue (3 or more consecutive songs in Zone 4).
 * Returns an array of indices where the fatigue starts.
 */
export const analyzeEnergyFatigue = (songs: SetlistSong[]): number[] => {
  const fatigueIndices: number[] = [];
  const PEAK_ZONE = ENERGY_ORDER['Peak'];
  
  for (let i = 0; i < songs.length - 2; i++) {
    const e1 = getEnergyScore(songs[i]);
    const e2 = getEnergyScore(songs[i + 1]);
    const e3 = getEnergyScore(songs[i + 2]);

    if (e1 === PEAK_ZONE && e2 === PEAK_ZONE && e3 === PEAK_ZONE) {
      fatigueIndices.push(i);
    }
  }
  return fatigueIndices;
};

/**
 * Calculates the Energy Curve (normalized scores 0-100) for visualization.
 */
export const calculateEnergyCurve = (songs: SetlistSong[]): number[] => {
  const maxEnergy = 4; // Peak
  return songs.map(song => {
    const score = getEnergyScore(song);
    return Math.round((score / maxEnergy) * 100);
  });
};
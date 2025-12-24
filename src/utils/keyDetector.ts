"use client";

import Meyda from 'meyda';

// Krumhansl-Schmuckler Key Profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Calculates the correlation coefficient between two vectors.
 */
function correlation(v1: number[], v2: number[]): number {
  const mean1 = v1.reduce((a, b) => a + b) / v1.length;
  const mean2 = v2.reduce((a, b) => a + b) / v2.length;

  let num = 0;
  let den1 = 0;
  let den2 = 0;

  for (let i = 0; i < v1.length; i++) {
    const d1 = v1[i] - mean1;
    const d2 = v2[i] - mean2;
    num += d1 * d2;
    den1 += d1 * d1;
    den2 += d2 * d2;
  }

  return num / Math.sqrt(den1 * den2);
}

/**
 * Shifts an array to the right by n positions.
 */
function shiftArray(arr: number[], n: number): number[] {
  const result = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    result[(i + n) % arr.length] = arr[i];
  }
  return result;
}

/**
 * Analyzes an AudioBuffer and returns the detected musical key.
 */
export async function detectKeyFromBuffer(audioBuffer: AudioBuffer): Promise<{ key: string; confidence: number }> {
  // We'll analyze a representative 30-second chunk from the middle
  const sampleRate = audioBuffer.sampleRate;
  const bufferSize = 4096;
  const channelData = audioBuffer.getChannelData(0);
  
  const startOffset = Math.max(0, Math.floor(channelData.length / 2) - (15 * sampleRate));
  const endOffset = Math.min(channelData.length, startOffset + (30 * sampleRate));
  
  const averagedChroma = new Array(12).fill(0);
  let frameCount = 0;

  for (let i = startOffset; i < endOffset - bufferSize; i += bufferSize) {
    const signal = channelData.slice(i, i + bufferSize);
    const chroma = Meyda.extract('chroma', signal) as number[];
    
    if (chroma) {
      for (let j = 0; j < 12; j++) {
        averagedChroma[j] += chroma[j];
      }
      frameCount++;
    }
  }

  // Normalize averaged chroma
  for (let j = 0; j < 12; j++) {
    averagedChroma[j] /= frameCount;
  }

  let bestMatch = "";
  let maxCorrelation = -Infinity;

  // Compare against 12 major and 12 minor profiles
  for (let i = 0; i < 12; i++) {
    const majorCorr = correlation(averagedChroma, shiftArray(MAJOR_PROFILE, i));
    const minorCorr = correlation(averagedChroma, shiftArray(MINOR_PROFILE, i));

    if (majorCorr > maxCorrelation) {
      maxCorrelation = majorCorr;
      bestMatch = NOTES[i];
    }

    if (minorCorr > maxCorrelation) {
      maxCorrelation = minorCorr;
      bestMatch = NOTES[i] + "m";
    }
  }

  return { 
    key: bestMatch, 
    confidence: Math.round(maxCorrelation * 100) 
  };
}
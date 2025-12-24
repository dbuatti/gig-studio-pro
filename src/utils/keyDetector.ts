"use client";

import Meyda from 'meyda';

const MAJOR_PROFILE = [5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0];
const MINOR_PROFILE = [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0];
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function correlation(v1: number[], v2: number[]): number {
  const n = v1.length;
  const mean1 = v1.reduce((a, b) => a + b) / n;
  const mean2 = v2.reduce((a, b) => a + b) / n;
  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < n; i++) {
    const d1 = v1[i] - mean1;
    const d2 = v2[i] - mean2;
    num += d1 * d2;
    den1 += d1 * d1;
    den2 += d2 * d2;
  }
  const den = Math.sqrt(den1 * den2);
  return den === 0 ? 0 : num / den;
}

function shiftArray(arr: number[], n: number): number[] {
  const result = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    result[(i + n) % arr.length] = arr[i];
  }
  return result;
}

export interface KeyCandidate {
  key: string;
  confidence: number;
}

export async function detectKeyFromBuffer(audioBuffer: AudioBuffer): Promise<KeyCandidate[]> {
  const sampleRate = audioBuffer.sampleRate;
  const bufferSize = 8192;
  const channelData = audioBuffer.getChannelData(0);
  
  const duration = audioBuffer.duration;
  const startTime = Math.max(0, (duration / 2) - 30);
  const endTime = Math.min(duration, startTime + 60);
  const startOffset = Math.floor(startTime * sampleRate);
  const endOffset = Math.floor(endTime * sampleRate);
  
  const averagedChroma = new Array(12).fill(0);
  let frameCount = 0;

  for (let i = startOffset; i < endOffset - bufferSize; i += bufferSize) {
    const signal = channelData.slice(i, i + bufferSize);
    const windowedSignal = new Float32Array(signal.length);
    for (let j = 0; j < signal.length; j++) {
      windowedSignal[j] = signal[j] * (0.5 * (1 - Math.cos((2 * Math.PI * j) / (signal.length - 1))));
    }

    const chroma = Meyda.extract('chroma', windowedSignal) as number[];
    if (chroma && chroma.length === 12) {
      const frameMax = Math.max(...chroma, 0.0001);
      for (let j = 0; j < 12; j++) averagedChroma[j] += chroma[j] / frameMax;
      frameCount++;
    }
  }

  if (frameCount === 0) throw new Error("Analysis failed");
  for (let j = 0; j < 12; j++) averagedChroma[j] /= frameCount;

  const results: { key: string, score: number }[] = [];
  for (let i = 0; i < 12; i++) {
    results.push({ key: NOTES[i], score: correlation(averagedChroma, shiftArray(MAJOR_PROFILE, i)) });
    results.push({ key: NOTES[i] + "m", score: correlation(averagedChroma, shiftArray(MINOR_PROFILE, i)) });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(r => ({ key: r.key, confidence: Math.round(r.score * 100) }));
}
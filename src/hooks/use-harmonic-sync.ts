"use client";

import { useState, useEffect, useCallback } from 'react';
import { SetlistSong } from '@/components/SetlistManager';
import { calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { KeyPreference, useSettings } from './use-settings';

interface UseHarmonicSyncProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  globalKeyPreference: KeyPreference;
}

export function useHarmonicSync({ formData, handleAutoSave, globalKeyPreference }: UseHarmonicSyncProps) {
  // Internal state for pitch, targetKey, and linking, derived from formData
  const [isPitchLinked, setIsPitchLinkedState] = useState(formData.is_pitch_linked ?? true);
  const [pitch, setPitchState] = useState(formData.pitch ?? 0);
  const [targetKeyState, setTargetKeyState] = useState(formData.targetKey || formData.originalKey || 'C');

  // Sync internal state with formData changes
  useEffect(() => {
    console.log("[useHarmonicSync] formData changed. Syncing internal state:", {
      formDataPitch: formData.pitch,
      formDataIsPitchLinked: formData.is_pitch_linked,
      formDataOriginalKey: formData.originalKey,
      formDataTargetKey: formData.targetKey
    });
    setPitchState(formData.pitch ?? 0);
    setIsPitchLinkedState(formData.is_pitch_linked ?? true);
    setTargetKeyState(formData.targetKey || formData.originalKey || 'C'); // Sync targetKeyState
  }, [formData.pitch, formData.is_pitch_linked, formData.originalKey, formData.targetKey]);

  // Derived targetKey based on originalKey and current pitch (fallback if targetKeyState is not explicitly set)
  const derivedTargetKey = useCallback(() => {
    const original = formData.originalKey || 'C';
    const derived = transposeKey(original, pitch);
    console.log(`[useHarmonicSync] Derived target key: ${derived} from original: ${original}, pitch: ${pitch}`);
    return derived;
  }, [formData.originalKey, pitch]);

  // --- Setters that interact with handleAutoSave ---

  const setPitch = useCallback((newPitch: number) => {
    console.log("[useHarmonicSync] setPitch called with:", newPitch);
    const updates: Partial<SetlistSong> = { pitch: newPitch };
    if (isPitchLinked) {
      const newTarget = transposeKey(formData.originalKey || 'C', newPitch);
      updates.targetKey = newTarget;
      console.log(`[useHarmonicSync] Pitch linked. Updating targetKey to: ${newTarget}`);
    }
    handleAutoSave(updates);
  }, [isPitchLinked, formData.originalKey, handleAutoSave]);

  const setTargetKey = useCallback((newTargetKey: string) => {
    console.log("[useHarmonicSync] setTargetKey called with:", newTargetKey);
    const updates: Partial<SetlistSong> = { targetKey: newTargetKey };
    if (isPitchLinked) {
      const newPitch = calculateSemitones(formData.originalKey || 'C', newTargetKey);
      updates.pitch = newPitch;
      console.log(`[useHarmonicSync] Pitch linked. Updating pitch to: ${newPitch}`);
    }
    handleAutoSave(updates);
  }, [isPitchLinked, formData.originalKey, handleAutoSave]);

  const setIsPitchLinked = useCallback((linked: boolean) => {
    console.log("[useHarmonicSync] setIsPitchLinked called with:", linked);
    const updates: Partial<SetlistSong> = { is_pitch_linked: linked };
    if (!linked) {
      // If unlinking, reset pitch to 0 and targetKey to originalKey
      updates.pitch = 0;
      updates.targetKey = formData.originalKey;
      console.log("[useHarmonicSync] Unlinking pitch. Resetting pitch to 0 and targetKey to original.");
    } else {
      // If linking, calculate pitch based on current targetKey
      const currentOriginalKey = formData.originalKey || 'C';
      const currentTargetKey = formData.targetKey || currentOriginalKey;
      updates.pitch = calculateSemitones(currentOriginalKey, currentTargetKey);
      console.log(`[useHarmonicSync] Linking pitch. Calculating pitch from original: ${currentOriginalKey}, target: ${currentTargetKey}. Resulting pitch: ${updates.pitch}`);
    }
    handleAutoSave(updates);
  }, [formData.originalKey, formData.targetKey, handleAutoSave]);

  return {
    pitch,
    setPitch,
    targetKey: targetKeyState || derivedTargetKey(), // Use internal state, fallback to derived
    setTargetKey,
    isPitchLinked,
    setIsPitchLinked,
  };
}
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
  // FIX: Ensure initial state uses formData, which is passed from the parent component.
  const [isPitchLinked, setIsPitchLinkedState] = useState(formData.is_pitch_linked ?? true);
  const [pitch, setPitchState] = useState(formData.pitch ?? 0);
  const [targetKeyState, setTargetKeyState] = useState(formData.targetKey || formData.originalKey || 'C');

  // Sync internal state with formData changes
  useEffect(() => {
    // Defensive check: Ensure pitch is a number, default to 0 if undefined/null
    const safePitch = typeof formData.pitch === 'number' ? formData.pitch : 0;
    
    // Defensive check: Ensure linking is a boolean, default to true if undefined
    const safeLink = typeof formData.is_pitch_linked === 'boolean' ? formData.is_pitch_linked : true;

    setPitchState(safePitch);
    setIsPitchLinkedState(safeLink);
    setTargetKeyState(formData.targetKey || formData.originalKey || 'C');
  }, [formData.pitch, formData.is_pitch_linked, formData.originalKey, formData.targetKey]);

  // Derived targetKey based on originalKey and current pitch (fallback if targetKeyState is not explicitly set)
  const derivedTargetKey = useCallback(() => {
    const original = formData.originalKey || 'C';
    const derived = transposeKey(original, pitch);
    return derived;
  }, [formData.originalKey, pitch]);

  // --- Setters that interact with handleAutoSave ---

  const setPitch = useCallback((newPitch: number) => {
    const updates: Partial<SetlistSong> = { pitch: newPitch };
    if (isPitchLinked) {
      const newTarget = transposeKey(formData.originalKey || 'C', newPitch);
      updates.targetKey = newTarget;
    }
    handleAutoSave(updates);
  }, [isPitchLinked, formData.originalKey, handleAutoSave]);

  const setTargetKey = useCallback((newTargetKey: string) => {
    const updates: Partial<SetlistSong> = { targetKey: newTargetKey };
    if (isPitchLinked) {
      const newPitch = calculateSemitones(formData.originalKey || 'C', newTargetKey);
      updates.pitch = newPitch;
    }
    handleAutoSave(updates);
  }, [isPitchLinked, formData.originalKey, handleAutoSave]);

  const setIsPitchLinked = useCallback((linked: boolean) => {
    const updates: Partial<SetlistSong> = { is_pitch_linked: linked };
    if (!linked) {
      // If unlinking, reset pitch to 0 and targetKey to originalKey
      updates.pitch = 0;
      updates.targetKey = formData.originalKey;
    } else {
      // If linking, calculate pitch based on current targetKey
      const currentOriginalKey = formData.originalKey || 'C';
      const currentTargetKey = formData.targetKey || currentOriginalKey;
      updates.pitch = calculateSemitones(currentOriginalKey, currentTargetKey);
    }
    handleAutoSave(updates);
  }, [formData.originalKey, formData.targetKey, handleAutoSave]);

  return {
    pitch,
    setPitch,
    targetKey: targetKeyState || derivedTargetKey(),
    setTargetKey,
    isPitchLinked,
    setIsPitchLinked,
  };
}
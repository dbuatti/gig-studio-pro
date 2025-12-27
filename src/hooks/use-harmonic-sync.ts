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
  // Internal state for pitch and linking, derived from formData
  const [isPitchLinked, setIsPitchLinkedState] = useState(formData.is_pitch_linked ?? true);
  const [pitch, setPitchState] = useState(formData.pitch ?? 0);

  // Sync internal state with formData changes
  useEffect(() => {
    setPitchState(formData.pitch ?? 0);
    setIsPitchLinkedState(formData.is_pitch_linked ?? true);
  }, [formData.pitch, formData.is_pitch_linked]);

  // Derived targetKey based on originalKey and current pitch
  const derivedTargetKey = useCallback(() => {
    const original = formData.originalKey || 'C';
    return transposeKey(original, pitch);
  }, [formData.originalKey, pitch]);

  // --- Setters that interact with handleAutoSave ---

  const setPitch = useCallback((newPitch: number) => {
    const updates: Partial<SetlistSong> = { pitch: newPitch };
    if (isPitchLinked) {
      updates.targetKey = transposeKey(formData.originalKey || 'C', newPitch);
    }
    handleAutoSave(updates);
  }, [isPitchLinked, formData.originalKey, handleAutoSave]);

  const setTargetKey = useCallback((newTargetKey: string) => {
    const updates: Partial<SetlistSong> = { targetKey: newTargetKey };
    if (isPitchLinked) {
      updates.pitch = calculateSemitones(formData.originalKey || 'C', newTargetKey);
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
      updates.pitch = calculateSemitones(formData.originalKey || 'C', formData.targetKey || formData.originalKey || 'C');
    }
    handleAutoSave(updates);
  }, [formData.originalKey, formData.targetKey, handleAutoSave]);

  return {
    pitch,
    setPitch,
    targetKey: formData.targetKey || derivedTargetKey(), // Use formData.targetKey if present, otherwise derive
    setTargetKey,
    isPitchLinked,
    setIsPitchLinked,
  };
}
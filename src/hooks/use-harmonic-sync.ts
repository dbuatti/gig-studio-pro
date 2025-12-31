"use client";

import { useState, useEffect, useCallback } from 'react';
import { SetlistSong } from '@/components/SetlistManager';
import { calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { KeyPreference } from './use-settings';

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
    console.log(`[useHarmonicSync] useEffect triggered for song: ${formData.name || 'N/A'}`);
    console.log(`[useHarmonicSync] Received formData: originalKey=${formData.originalKey}, targetKey=${formData.targetKey}, pitch=${formData.pitch}, is_pitch_linked=${formData.is_pitch_linked}`);

    const safePitch = typeof formData.pitch === 'number' ? formData.pitch : 0;
    const safeLink = typeof formData.is_pitch_linked === 'boolean' ? formData.is_pitch_linked : true;

    setPitchState(safePitch);
    setIsPitchLinkedState(safeLink);
    setTargetKeyState(formData.targetKey || formData.originalKey || 'C');
    console.log(`[useHarmonicSync] Internal state set: targetKeyState=${formData.targetKey || formData.originalKey || 'C'}, pitch=${safePitch}`);
  }, [formData.pitch, formData.is_pitch_linked, formData.originalKey, formData.targetKey, formData.name]); // Added formData.name for logging

  // --- Setters that interact with handleAutoSave ---

  const setPitch = useCallback((newPitch: number) => {
    const updates: Partial<SetlistSong> = { pitch: newPitch };
    const effectiveOriginalKey = formData.originalKey || 'C';
    if (isPitchLinked) {
      const newTarget = transposeKey(effectiveOriginalKey, newPitch);
      updates.targetKey = newTarget;
    }
    handleAutoSave(updates);
  }, [isPitchLinked, formData.originalKey, handleAutoSave]);

  const setTargetKey = useCallback((newTargetKey: string) => {
    const updates: Partial<SetlistSong> = { targetKey: newTargetKey };
    const effectiveOriginalKey = formData.originalKey || 'C';
    if (isPitchLinked) {
      const newPitch = calculateSemitones(effectiveOriginalKey, newTargetKey);
      updates.pitch = newPitch;
    }
    handleAutoSave(updates);
  }, [isPitchLinked, formData.originalKey, handleAutoSave]);

  const setIsPitchLinked = useCallback((linked: boolean) => {
    const updates: Partial<SetlistSong> = { is_pitch_linked: linked };
    if (!linked) {
      updates.pitch = 0;
      updates.targetKey = formData.originalKey;
    } else {
      const currentOriginalKey = formData.originalKey || 'C';
      const currentTargetKey = formData.targetKey || currentOriginalKey;
      updates.pitch = calculateSemitones(currentOriginalKey, currentTargetKey);
    }
    handleAutoSave(updates);
  }, [formData.originalKey, formData.targetKey, handleAutoSave]);

  return {
    pitch,
    setPitch,
    targetKey: targetKeyState,
    setTargetKey,
    isPitchLinked,
    setIsPitchLinked,
  };
}
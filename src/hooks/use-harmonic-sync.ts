"use client";

import { useState, useEffect, useCallback } from 'react';
import { SetlistSong } from '@/components/SetlistManager';
import { calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { KeyPreference } from './use-settings';

interface UseHarmonicSyncProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  globalKeyPreference: KeyPreference;
  preventStageKeyOverwrite: boolean; // NEW: Add this prop
}

export function useHarmonicSync({ formData, handleAutoSave, globalKeyPreference, preventStageKeyOverwrite }: UseHarmonicSyncProps) {
  // Directly derive linked status from formData
  const isPitchLinkedFromData = formData.is_pitch_linked ?? true;
  const originalKeyFromData = formData.originalKey || 'C';

  // Internal state for local overrides when not linked
  // Initialize with formData values, but these will only be used if isPitchLinkedFromData is false
  const [localPitch, setLocalPitch] = useState(formData.pitch ?? 0);
  const [localTargetKey, setLocalTargetKey] = useState(formData.targetKey || originalKeyFromData);

  // Update local state when formData changes, but only if not linked
  useEffect(() => {
    if (!isPitchLinkedFromData) {
      setLocalPitch(formData.pitch ?? 0);
      setLocalTargetKey(formData.targetKey || originalKeyFromData);
    }
  }, [formData.pitch, formData.targetKey, originalKeyFromData, isPitchLinkedFromData]);

  // Determine active pitch and targetKey based on linking status
  const activePitch = isPitchLinkedFromData
    ? (formData.pitch ?? 0)
    : localPitch;

  const activeTargetKey = isPitchLinkedFromData
    ? (formData.targetKey || originalKeyFromData)
    : localTargetKey;

  // NEW: Determine if stage key changes should be prevented
  const isStageKeyLocked = preventStageKeyOverwrite && formData.isKeyConfirmed;

  // --- Setters that interact with handleAutoSave ---

  const setPitch = useCallback((newPitch: number) => {
    if (isStageKeyLocked) { // NEW: Prevent changes if locked
      return;
    }
    if (isPitchLinkedFromData) {
      const updates: Partial<SetlistSong> = { pitch: newPitch };
      const newTarget = transposeKey(originalKeyFromData, newPitch);
      updates.targetKey = newTarget;
      handleAutoSave(updates);
    } else {
      setLocalPitch(newPitch);
    }
  }, [isPitchLinkedFromData, originalKeyFromData, handleAutoSave, isStageKeyLocked]); // Added isStageKeyLocked

  const setTargetKey = useCallback((newTargetKey: string) => {
    if (isStageKeyLocked) { // NEW: Prevent changes if locked
      return;
    }
    if (isPitchLinkedFromData) {
      const updates: Partial<SetlistSong> = { targetKey: newTargetKey };
      const newPitch = calculateSemitones(originalKeyFromData, newTargetKey);
      updates.pitch = newPitch;
      updates.isKeyConfirmed = true; // Automatically confirm when target key is set
      handleAutoSave(updates);
    } else {
      setLocalTargetKey(newTargetKey);
    }
  }, [isPitchLinkedFromData, originalKeyFromData, handleAutoSave, isStageKeyLocked]); // Added isStageKeyLocked

  const setIsPitchLinked = useCallback((linked: boolean) => {
    const updates: Partial<SetlistSong> = { is_pitch_linked: linked };
    if (!linked) {
      // When unlinking, reset pitch to 0 and targetKey to originalKey in DB
      updates.pitch = 0;
      updates.targetKey = originalKeyFromData;
      // Also reset local state for immediate UI reflection
      setLocalPitch(0);
      setLocalTargetKey(originalKeyFromData);
    } else {
      // When linking, calculate pitch based on current local targetKey and originalKey
      const currentTargetKey = localTargetKey; // Use local state if it was previously unlinked
      updates.pitch = calculateSemitones(originalKeyFromData, currentTargetKey);
      updates.targetKey = currentTargetKey; // Ensure targetKey is also saved
    }
    handleAutoSave(updates);
  }, [originalKeyFromData, localTargetKey, handleAutoSave]);

  return {
    pitch: activePitch,
    setPitch,
    targetKey: activeTargetKey,
    setTargetKey,
    isPitchLinked: isPitchLinkedFromData, // Always reflect formData for this
    setIsPitchLinked,
  };
}
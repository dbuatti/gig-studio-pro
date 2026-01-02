"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { SetlistSong } from '@/components/SetlistManager';
import { calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { KeyPreference } from './use-settings';

interface UseHarmonicSyncProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  globalKeyPreference: KeyPreference;
  preventStageKeyOverwrite: boolean;
}

export function useHarmonicSync({ formData, handleAutoSave, globalKeyPreference, preventStageKeyOverwrite }: UseHarmonicSyncProps) {
  const isPitchLinkedFromData = formData.is_pitch_linked ?? true;
  const originalKeyFromData = formData.originalKey || 'C';

  // State for session-specific overrides or local changes
  const [localPitch, setLocalPitch] = useState(formData.pitch ?? 0);
  const [localTargetKey, setLocalTargetKey] = useState(formData.targetKey || originalKeyFromData);

  // Sync local state when formData changes (e.g. song switch or DB sync)
  useEffect(() => {
    setLocalPitch(formData.pitch ?? 0);
    setLocalTargetKey(formData.targetKey || originalKeyFromData);
  }, [formData.id, formData.pitch, formData.targetKey, originalKeyFromData]);

  // Determine if stage key changes should be prevented from persisting
  const isStageKeyLocked = preventStageKeyOverwrite && formData.isKeyConfirmed;

  const setPitch = useCallback((newPitch: number) => {
    // 1. Update local UI state immediately
    setLocalPitch(newPitch);

    // 2. If not locked, persist to database
    if (!isStageKeyLocked && isPitchLinkedFromData) {
      const updates: Partial<SetlistSong> = { pitch: newPitch };
      const newTarget = transposeKey(originalKeyFromData, newPitch);
      updates.targetKey = newTarget;
      handleAutoSave(updates);
    }
  }, [isStageKeyLocked, isPitchLinkedFromData, originalKeyFromData, handleAutoSave]);

  const setTargetKey = useCallback((newTargetKey: string) => {
    // 1. Update local UI state immediately
    setLocalTargetKey(newTargetKey);

    // 2. If not locked, persist to database
    if (!isStageKeyLocked && isPitchLinkedFromData) {
      const updates: Partial<SetlistSong> = { targetKey: newTargetKey };
      const newPitch = calculateSemitones(originalKeyFromData, newTargetKey);
      updates.pitch = newPitch;
      updates.isKeyConfirmed = true; 
      handleAutoSave(updates);
    }
  }, [isStageKeyLocked, isPitchLinkedFromData, originalKeyFromData, handleAutoSave]);

  const setIsPitchLinked = useCallback((linked: boolean) => {
    const updates: Partial<SetlistSong> = { is_pitch_linked: linked };
    if (!linked) {
      updates.pitch = 0;
      updates.targetKey = originalKeyFromData;
      setLocalPitch(0);
      setLocalTargetKey(originalKeyFromData);
    } else {
      updates.pitch = calculateSemitones(originalKeyFromData, localTargetKey);
      updates.targetKey = localTargetKey;
    }
    handleAutoSave(updates);
  }, [originalKeyFromData, localTargetKey, handleAutoSave]);

  return {
    pitch: localPitch, 
    setPitch,
    targetKey: localTargetKey, 
    setTargetKey,
    isPitchLinked: isPitchLinkedFromData,
    setIsPitchLinked,
    isStageKeyLocked,
  };
}
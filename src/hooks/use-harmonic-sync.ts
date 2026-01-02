"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  const isPitchLinkedFromData = formData.is_pitch_linked ?? true;
  const originalKeyFromData = formData.originalKey || 'C';

  // Internal state for local overrides when not linked
  const [localPitch, setLocalPitch] = useState(formData.pitch ?? 0);
  const [localTargetKey, setLocalTargetKey] = useState(formData.targetKey || originalKeyFromData);

  // NEW: Ref to store temporary overrides when stage key is locked
  const sessionOverridesRef = useRef<Record<string, { pitch: number; targetKey: string }>>({});

  // Update local state when formData changes, but only if not linked
  useEffect(() => {
    if (!isPitchLinkedFromData) {
      setLocalPitch(formData.pitch ?? 0);
      setLocalTargetKey(formData.targetKey || originalKeyFromData);
    }
  }, [formData.pitch, formData.targetKey, originalKeyFromData, isPitchLinkedFromData]);

  // Determine if stage key changes should be prevented
  const isStageKeyLocked = preventStageKeyOverwrite && formData.isKeyConfirmed;

  // Determine active pitch and targetKey based on linking status AND lock status
  const effectivePitch = useMemo(() => {
    if (isStageKeyLocked && formData.id && sessionOverridesRef.current[formData.id]) {
      return sessionOverridesRef.current[formData.id].pitch;
    }
    return isPitchLinkedFromData ? (formData.pitch ?? 0) : localPitch;
  }, [isStageKeyLocked, formData.id, isPitchLinkedFromData, formData.pitch, localPitch]);

  const effectiveTargetKey = useMemo(() => {
    if (isStageKeyLocked && formData.id && sessionOverridesRef.current[formData.id]) {
      return sessionOverridesRef.current[formData.id].targetKey;
    }
    return isPitchLinkedFromData ? (formData.targetKey || originalKeyFromData) : localTargetKey;
  }, [isStageKeyLocked, formData.id, isPitchLinkedFromData, formData.targetKey, originalKeyFromData, localTargetKey]);

  // Update session overrides when formData.id changes (i.e., switching songs)
  useEffect(() => {
    if (formData.id && !sessionOverridesRef.current[formData.id]) {
      sessionOverridesRef.current[formData.id] = {
        pitch: formData.pitch ?? 0,
        targetKey: formData.targetKey || originalKeyFromData,
      };
    }
  }, [formData.id, formData.pitch, formData.targetKey, originalKeyFromData]);


  // --- Setters that interact with handleAutoSave or local/session state ---

  const setPitch = useCallback((newPitch: number) => {
    if (isStageKeyLocked) {
      if (formData.id) {
        sessionOverridesRef.current = {
          ...sessionOverridesRef.current,
          [formData.id]: { ...sessionOverridesRef.current[formData.id], pitch: newPitch }
        };
      }
      setLocalPitch(newPitch); // Update local state for immediate UI reflection
    } else if (isPitchLinkedFromData) {
      const updates: Partial<SetlistSong> = { pitch: newPitch };
      const newTarget = transposeKey(originalKeyFromData, newPitch);
      updates.targetKey = newTarget;
      handleAutoSave(updates);
    } else {
      setLocalPitch(newPitch);
    }
  }, [isPitchLinkedFromData, originalKeyFromData, handleAutoSave, isStageKeyLocked, formData.id]);

  const setTargetKey = useCallback((newTargetKey: string) => {
    if (isStageKeyLocked) {
      if (formData.id) {
        sessionOverridesRef.current = {
          ...sessionOverridesRef.current,
          [formData.id]: { ...sessionOverridesRef.current[formData.id], targetKey: newTargetKey }
        };
      }
      setLocalTargetKey(newTargetKey); // Update local state for immediate UI reflection
    } else if (isPitchLinkedFromData) {
      const updates: Partial<SetlistSong> = { targetKey: newTargetKey };
      const newPitch = calculateSemitones(originalKeyFromData, newTargetKey);
      updates.pitch = newPitch;
      updates.isKeyConfirmed = true; // Automatically confirm when target key is set
      handleAutoSave(updates);
    } else {
      setLocalTargetKey(newTargetKey);
    }
  }, [isPitchLinkedFromData, originalKeyFromData, handleAutoSave, isStageKeyLocked, formData.id]);

  const setIsPitchLinked = useCallback((linked: boolean) => {
    const updates: Partial<SetlistSong> = { is_pitch_linked: linked };
    if (!linked) {
      updates.pitch = 0;
      updates.targetKey = originalKeyFromData;
      setLocalPitch(0);
      setLocalTargetKey(originalKeyFromData);
    } else {
      const currentTargetKey = localTargetKey;
      updates.pitch = calculateSemitones(originalKeyFromData, currentTargetKey);
      updates.targetKey = currentTargetKey;
    }
    handleAutoSave(updates);
  }, [originalKeyFromData, localTargetKey, handleAutoSave]);

  return {
    pitch: effectivePitch, // Return effective pitch
    setPitch,
    targetKey: effectiveTargetKey, // Return effective target key
    setTargetKey,
    isPitchLinked: isPitchLinkedFromData,
    setIsPitchLinked,
    isStageKeyLocked, // Expose this for UI to disable controls
  };
}
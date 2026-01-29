"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

  const [localPitch, setLocalPitch] = useState(formData.pitch ?? 0);
  const [localTargetKey, setLocalTargetKey] = useState(formData.targetKey || originalKeyFromData);

  const sessionOverridesRef = useRef<Record<string, { pitch: number; targetKey: string }>>({});
  const currentSongIdRef = useRef<string | undefined>(formData.id);

  // Effect to handle song ID change: clear overrides if the ID changes
  useEffect(() => {
    if (formData.id !== currentSongIdRef.current) {
      // Clear old song ID override if it exists
      if (currentSongIdRef.current && sessionOverridesRef.current[currentSongIdRef.current]) {
        delete sessionOverridesRef.current[currentSongIdRef.current];
      }
      currentSongIdRef.current = formData.id;
      
      // Reset local state based on new form data if pitch linking is off
      if (!isPitchLinkedFromData) {
        setLocalPitch(formData.pitch ?? 0);
        setLocalTargetKey(formData.targetKey || originalKeyFromData);
      }
    }
  }, [formData.id, isPitchLinkedFromData, originalKeyFromData]);

  useEffect(() => {
    if (!isPitchLinkedFromData) {
      setLocalPitch(formData.pitch ?? 0);
      setLocalTargetKey(formData.targetKey || originalKeyFromData);
    }
  }, [formData.pitch, formData.targetKey, originalKeyFromData, isPitchLinkedFromData]);

  const isStageKeyLocked = preventStageKeyOverwrite && formData.isKeyConfirmed;

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

  useEffect(() => {
    if (formData.id && !sessionOverridesRef.current[formData.id]) {
      sessionOverridesRef.current[formData.id] = {
        pitch: formData.pitch ?? 0,
        targetKey: formData.targetKey || originalKeyFromData,
      };
    }
  }, [formData.id, formData.pitch, formData.targetKey, originalKeyFromData]);

  const setPitch = useCallback((newPitch: number) => {
    if (isStageKeyLocked) {
      if (formData.id) {
        sessionOverridesRef.current = {
          ...sessionOverridesRef.current,
          [formData.id]: { ...sessionOverridesRef.current[formData.id], pitch: newPitch }
        };
      }
      setLocalPitch(newPitch);
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
      setLocalTargetKey(newTargetKey);
    } else if (isPitchLinkedFromData) {
      const updates: Partial<SetlistSong> = { targetKey: newTargetKey };
      const newPitch = calculateSemitones(originalKeyFromData, newTargetKey);
      updates.pitch = newPitch;
      updates.isKeyConfirmed = true;
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
    pitch: effectivePitch,
    setPitch,
    targetKey: effectiveTargetKey,
    setTargetKey,
    isPitchLinked: isPitchLinkedFromData,
    setIsPitchLinked,
    isStageKeyLocked,
  };
}
"use client";

import { useState, useEffect } from 'react';

export type KeyPreference = 'flats' | 'sharps';

export function useSettings() {
  const [keyPreference, setKeyPreference] = useState<KeyPreference>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gig_key_preference');
      return (saved as KeyPreference) || 'sharps';
    }
    return 'sharps';
  });

  const [safePitchMaxNote, setSafePitchMaxNote] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gig_safe_pitch_max_note');
      return saved || 'G3'; // Default value
    }
    return 'G3';
  });

  // NEW: Add state for enabling/disabling Safe Pitch Mode
  const [isSafePitchEnabled, setIsSafePitchEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gig_is_safe_pitch_enabled');
      return saved ? JSON.parse(saved) : true; // Default to true
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('gig_key_preference', keyPreference);
  }, [keyPreference]);

  useEffect(() => {
    localStorage.setItem('gig_safe_pitch_max_note', safePitchMaxNote);
  }, [safePitchMaxNote]);

  // NEW: Effect to persist isSafePitchEnabled
  useEffect(() => {
    localStorage.setItem('gig_is_safe_pitch_enabled', JSON.stringify(isSafePitchEnabled));
  }, [isSafePitchEnabled]);

  const toggleKeyPreference = () => {
    setKeyPreference(prev => prev === 'sharps' ? 'flats' : 'sharps');
  };

  return {
    keyPreference,
    setKeyPreference,
    toggleKeyPreference,
    safePitchMaxNote,
    setSafePitchMaxNote,
    isSafePitchEnabled, // NEW: Expose isSafePitchEnabled
    setIsSafePitchEnabled, // NEW: Expose setIsSafePitchEnabled
  };
}
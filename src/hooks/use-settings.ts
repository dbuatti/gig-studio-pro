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

  // Add safePitchMaxNote state
  const [safePitchMaxNote, setSafePitchMaxNote] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gig_safe_pitch_max_note');
      return saved || 'G3'; // Default value
    }
    return 'G3';
  });

  useEffect(() => {
    localStorage.setItem('gig_key_preference', keyPreference);
  }, [keyPreference]);

  // Add effect to persist safePitchMaxNote
  useEffect(() => {
    localStorage.setItem('gig_safe_pitch_max_note', safePitchMaxNote);
  }, [safePitchMaxNote]);

  const toggleKeyPreference = () => {
    setKeyPreference(prev => prev === 'sharps' ? 'flats' : 'sharps');
  };

  return {
    keyPreference,
    setKeyPreference,
    toggleKeyPreference,
    safePitchMaxNote,
    setSafePitchMaxNote
  };
}
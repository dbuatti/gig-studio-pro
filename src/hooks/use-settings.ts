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

  useEffect(() => {
    localStorage.setItem('gig_key_preference', keyPreference);
  }, [keyPreference]);

  const toggleKeyPreference = () => {
    setKeyPreference(prev => prev === 'sharps' ? 'flats' : 'sharps');
  };

  return {
    keyPreference,
    setKeyPreference,
    toggleKeyPreference
  };
}
"use client";

import { useState, useEffect } from 'react';

export type ReaderResourceForce = 'default' | 'force-pdf' | 'force-ug' | 'force-chords' | 'simulation';

export interface ReaderSettings {
  forceReaderResource: ReaderResourceForce;
  alwaysShowAllToasts: boolean;
  ignoreConfirmedGate: boolean;
  forceDesktopView: boolean;
}

const DEFAULT_READER_SETTINGS: ReaderSettings = {
  forceReaderResource: 'default',
  alwaysShowAllToasts: false,
  ignoreConfirmedGate: false,
  forceDesktopView: false,
};

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gig_reader_settings');
      return saved ? { ...DEFAULT_READER_SETTINGS, ...JSON.parse(saved) } : DEFAULT_READER_SETTINGS;
    }
    return DEFAULT_READER_SETTINGS;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gig_reader_settings', JSON.stringify(settings));
    }
  }, [settings]);

  const updateSetting = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return {
    ...settings,
    updateSetting,
  };
}
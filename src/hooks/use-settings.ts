"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export type KeyPreference = 'flats' | 'sharps' | 'neutral';

export interface GlobalSettings {
  keyPreference: KeyPreference;
  safePitchMaxNote: string;
  isSafePitchEnabled: boolean;
}

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  keyPreference: 'neutral',
  safePitchMaxNote: 'G3',
  isSafePitchEnabled: true,
};

export function useSettings() {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<GlobalSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gig_global_settings');
      return saved ? { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) } : DEFAULT_GLOBAL_SETTINGS;
    }
    return DEFAULT_GLOBAL_SETTINGS;
  });
  const [isFetchingSettings, setIsFetchingSettings] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    const fetchUserSettings = async () => {
      if (user) {
        setIsFetchingSettings(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('key_preference, safe_pitch_max_note, is_safe_pitch_enabled')
            .eq('id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') {
            const saved = localStorage.getItem('gig_global_settings');
            setSettings(saved ? { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) } : DEFAULT_GLOBAL_SETTINGS);
          } else if (data) {
            const loadedSettings: Partial<GlobalSettings> = {};
            if (data.key_preference) loadedSettings.keyPreference = data.key_preference as KeyPreference;
            if (data.safe_pitch_max_note) loadedSettings.safePitchMaxNote = data.safe_pitch_max_note;
            if (data.is_safe_pitch_enabled !== undefined) loadedSettings.isSafePitchEnabled = data.is_safe_pitch_enabled;
            
            setSettings(prev => {
              const newSettings = { ...prev, ...loadedSettings };
              localStorage.setItem('gig_global_settings', JSON.stringify(newSettings));
              return newSettings;
            });
          } else {
            setSettings(prev => {
              const newSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...prev };
              localStorage.setItem('gig_global_settings', JSON.stringify(newSettings));
              return newSettings;
            });
          }
        } catch (err) {
          const saved = localStorage.getItem('gig_global_settings');
          setSettings(saved ? { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) } : DEFAULT_GLOBAL_SETTINGS);
        } finally {
          setIsFetchingSettings(false);
        }
      } else {
        const saved = localStorage.getItem('gig_global_settings');
        setSettings(saved ? { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) } : DEFAULT_GLOBAL_SETTINGS);
        setIsFetchingSettings(false);
      }
    };

    fetchUserSettings();
  }, [user, authLoading]);

  useEffect(() => {
    if (!isFetchingSettings && !user) {
      localStorage.setItem('gig_global_settings', JSON.stringify(settings));
    }
  }, [settings, isFetchingSettings, user]);

  const updateSetting = useCallback(async <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      if (!user) {
        localStorage.setItem('gig_global_settings', JSON.stringify(newSettings));
      }
      return newSettings;
    });

    if (user) {
      try {
        const dbKeyMap: Record<keyof GlobalSettings, string> = {
          keyPreference: 'key_preference',
          safePitchMaxNote: 'safe_pitch_max_note',
          isSafePitchEnabled: 'is_safe_pitch_enabled',
        };
        const dbColumn = dbKeyMap[key];
        const { error } = await supabase
          .from('profiles')
          .update({ [dbColumn]: value })
          .eq('id', user.id);
        if (error) {
          // Error handling
        }
      } catch (err) {
        // Error handling
      }
    }
  }, [user]);

  const setKeyPreference = useCallback((pref: KeyPreference) => updateSetting('keyPreference', pref), [updateSetting]);
  const setSafePitchMaxNote = useCallback((note: string) => updateSetting('safePitchMaxNote', note), [updateSetting]);
  const setIsSafePitchEnabled = useCallback((enabled: boolean) => updateSetting('isSafePitchEnabled', enabled), [updateSetting]);

  return {
    ...settings,
    setKeyPreference,
    setSafePitchMaxNote,
    setIsSafePitchEnabled,
    isFetchingSettings,
  };
}
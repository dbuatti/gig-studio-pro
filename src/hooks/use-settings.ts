"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export type KeyPreference = 'flats' | 'sharps';

export interface GlobalSettings {
  keyPreference: KeyPreference;
  safePitchMaxNote: string;
  isSafePitchEnabled: boolean;
}

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  keyPreference: 'sharps',
  safePitchMaxNote: 'G3',
  isSafePitchEnabled: true,
};

export function useSettings() {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<GlobalSettings>(() => {
    // Initialize from localStorage first, then will be overridden by Supabase
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gig_global_settings');
      return saved ? { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) } : DEFAULT_GLOBAL_SETTINGS;
    }
    return DEFAULT_GLOBAL_SETTINGS;
  });
  const [isFetchingSettings, setIsFetchingSettings] = useState(true);

  // Effect to load settings from Supabase
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

          if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
            // console.error("[useSettings] Error fetching user settings:", error); // Removed console.error
            // Fallback to local storage if Supabase fetch fails
            const saved = localStorage.getItem('gig_global_settings');
            setSettings(saved ? { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) } : DEFAULT_GLOBAL_SETTINGS);
          } else if (data) {
            const loadedSettings: Partial<GlobalSettings> = {};
            if (data.key_preference) loadedSettings.keyPreference = data.key_preference;
            if (data.safe_pitch_max_note) loadedSettings.safePitchMaxNote = data.safe_pitch_max_note;
            if (data.is_safe_pitch_enabled !== undefined) loadedSettings.isSafePitchEnabled = data.is_safe_pitch_enabled;
            
            setSettings(prev => {
              const newSettings = { ...prev, ...loadedSettings };
              localStorage.setItem('gig_global_settings', JSON.stringify(newSettings));
              return newSettings;
            });
          } else {
            // No profile data, use defaults and save to local storage
            setSettings(prev => {
              const newSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...prev }; // Merge with any existing local state
              localStorage.setItem('gig_global_settings', JSON.stringify(newSettings));
              return newSettings;
            });
          }
        } catch (err) {
          // console.error("[useSettings] Unexpected error during settings fetch:", err); // Removed console.error
          // Fallback to local storage
          const saved = localStorage.getItem('gig_global_settings');
          setSettings(saved ? { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) } : DEFAULT_GLOBAL_SETTINGS);
        } finally {
          setIsFetchingSettings(false);
        }
      } else {
        // User logged out, load from local storage or use defaults
        const saved = localStorage.getItem('gig_global_settings');
        setSettings(saved ? { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(saved) } : DEFAULT_GLOBAL_SETTINGS);
        setIsFetchingSettings(false);
      }
    };

    fetchUserSettings();
  }, [user, authLoading]);

  // Effect to save settings to localStorage whenever they change (for logged-out users or as a fallback)
  useEffect(() => {
    if (!isFetchingSettings && !user) { // Only save to local storage if not fetching and user is logged out
      localStorage.setItem('gig_global_settings', JSON.stringify(settings));
    }
  }, [settings, isFetchingSettings, user]);

  const updateSetting = useCallback(async <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      if (!user) { // Update local storage immediately for logged-out users
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
          // console.error(`[useSettings] Failed to save ${String(key)} to Supabase:`, error); // Removed console.error
          // Optionally revert local state or show error toast
        }
      } catch (err) {
        // console.error(`[useSettings] Unexpected error saving ${String(key)} to Supabase:`, err); // Removed console.error
      }
    }
  }, [user]);

  const setKeyPreference = useCallback((pref: KeyPreference) => updateSetting('keyPreference', pref), [updateSetting]);
  const setSafePitchMaxNote = useCallback((note: string) => updateSetting('safePitchMaxNote', note), [updateSetting]);
  const setIsSafePitchEnabled = useCallback((enabled: boolean) => updateSetting('isSafePitchEnabled', enabled), [updateSetting]);

  const toggleKeyPreference = useCallback(() => {
    setKeyPreference(settings.keyPreference === 'sharps' ? 'flats' : 'sharps');
  }, [setKeyPreference, settings.keyPreference]);

  return {
    ...settings,
    setKeyPreference,
    setSafePitchMaxNote,
    setIsSafePitchEnabled,
    toggleKeyPreference,
    isFetchingSettings, // Expose loading state
  };
}
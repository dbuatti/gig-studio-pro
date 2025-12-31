"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export type KeyPreference = 'flats' | 'sharps' | 'neutral';

export interface GlobalSettings {
  keyPreference: KeyPreference;
  safePitchMaxNote: string;
  isSafePitchEnabled: boolean;
  isGoalTrackerEnabled: boolean;
  goalLyricsCount: number;
  goalUgChordsCount: number;
  goalUgLinksCount: number;
  goalHighestNoteCount: number;
  goalOriginalKeyCount: number;
  goalTargetKeyCount: number;
}

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  keyPreference: 'neutral',
  safePitchMaxNote: 'G3',
  isSafePitchEnabled: true,
  isGoalTrackerEnabled: false,
  goalLyricsCount: 10,
  goalUgChordsCount: 10,
  goalUgLinksCount: 10,
  goalHighestNoteCount: 10,
  goalOriginalKeyCount: 10,
  goalTargetKeyCount: 10,
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
            .select(`
              key_preference, safe_pitch_max_note, is_safe_pitch_enabled, is_goal_tracker_enabled, 
              goal_lyrics_count, goal_ug_chords_count, goal_ug_links_count, goal_highest_note_count,
              goal_original_key_count, goal_target_key_count
            `)
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
            if (data.is_goal_tracker_enabled !== undefined) loadedSettings.isGoalTrackerEnabled = data.is_goal_tracker_enabled;
            if (data.goal_lyrics_count !== undefined) loadedSettings.goalLyricsCount = data.goal_lyrics_count;
            if (data.goal_ug_chords_count !== undefined) loadedSettings.goalUgChordsCount = data.goal_ug_chords_count;
            if (data.goal_ug_links_count !== undefined) loadedSettings.goalUgLinksCount = data.goal_ug_links_count;
            if (data.goal_highest_note_count !== undefined) loadedSettings.goalHighestNoteCount = data.goal_highest_note_count;
            if (data.goal_original_key_count !== undefined) loadedSettings.goalOriginalKeyCount = data.goal_original_key_count;
            if (data.goal_target_key_count !== undefined) loadedSettings.goalTargetKeyCount = data.goal_target_key_count;
            
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
          isGoalTrackerEnabled: 'is_goal_tracker_enabled',
          goalLyricsCount: 'goal_lyrics_count',
          goalUgChordsCount: 'goal_ug_chords_count',
          goalUgLinksCount: 'goal_ug_links_count',
          goalHighestNoteCount: 'goal_highest_note_count',
          goalOriginalKeyCount: 'goal_original_key_count',
          goalTargetKeyCount: 'goal_target_key_count',
        };
        const dbColumn = dbKeyMap[key];
        const { error } = await supabase
          .from('profiles')
          .update({ [dbColumn]: value })
          .eq('id', user.id);
      } catch (err) {}
    }
  }, [user]);

  return {
    ...settings,
    setKeyPreference: (pref: KeyPreference) => updateSetting('keyPreference', pref),
    setSafePitchMaxNote: (note: string) => updateSetting('safePitchMaxNote', note),
    setIsSafePitchEnabled: (enabled: boolean) => updateSetting('isSafePitchEnabled', enabled),
    setIsGoalTrackerEnabled: (enabled: boolean) => updateSetting('isGoalTrackerEnabled', enabled),
    setGoalLyricsCount: (count: number) => updateSetting('goalLyricsCount', count),
    setGoalUgChordsCount: (count: number) => updateSetting('goalUgChordsCount', count),
    setGoalUgLinksCount: (count: number) => updateSetting('goalUgLinksCount', count),
    setGoalHighestNoteCount: (count: number) => updateSetting('goalHighestNoteCount', count),
    setGoalOriginalKeyCount: (count: number) => updateSetting('goalOriginalKeyCount', count),
    setGoalTargetKeyCount: (count: number) => updateSetting('goalTargetKeyCount', count),
    isFetchingSettings,
  };
}
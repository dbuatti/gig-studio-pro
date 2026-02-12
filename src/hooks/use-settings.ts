"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export type KeyPreference = 'sharps' | 'flats' | 'neutral';

export function useSettings() {
  const { user } = useAuth();
  const [keyPreference, setKeyPreferenceState] = useState<KeyPreference>('neutral');
  const [ugChordsFontSize, setUgChordsFontSize] = useState<number>(16);
  const [preventStageKeyOverwrite, setPreventStageKeyOverwrite] = useState(false);
  const [disablePortraitPdfScroll, setDisablePortraitPdfScroll] = useState(false);
  const [isSafePitchEnabled, setIsSafePitchEnabled] = useState(true);
  const [safePitchMaxNote, setSafePitchMaxNote] = useState('G3');
  const [isGoalTrackerEnabled, setIsGoalTrackerEnabled] = useState(false);
  const [defaultDashboardView, setDefaultDashboardView] = useState<'gigs' | 'repertoire'>('gigs');
  const [isFetchingSettings, setIsFetchingSettings] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setIsFetchingSettings(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setKeyPreferenceState((data.key_preference as KeyPreference) || 'neutral');
        setUgChordsFontSize(data.ug_chords_font_size || 16);
        setPreventStageKeyOverwrite(data.prevent_stage_key_overwrite || false);
        setDisablePortraitPdfScroll(data.disable_portrait_pdf_scroll || false);
        setIsSafePitchEnabled(data.is_safe_pitch_enabled ?? true);
        setSafePitchMaxNote(data.safe_pitch_max_note || 'G3');
        setIsGoalTrackerEnabled(data.is_goal_tracker_enabled || false);
        setDefaultDashboardView((data.default_dashboard_view as 'gigs' | 'repertoire') || 'gigs');
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setIsFetchingSettings(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (updates: any) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (error) throw error;
      // Optimistic update or refetch
      fetchSettings();
    } catch (err) {
      console.error('Error updating setting:', err);
    }
  };

  const setKeyPreference = (pref: KeyPreference) => updateSetting({ key_preference: pref });
  const setChordFontSize = (size: number) => updateSetting({ ug_chords_font_size: size });

  return {
    keyPreference,
    setKeyPreference,
    ugChordsFontSize,
    setChordFontSize,
    preventStageKeyOverwrite,
    disablePortraitPdfScroll,
    isSafePitchEnabled,
    safePitchMaxNote,
    isGoalTrackerEnabled,
    defaultDashboardView,
    isFetchingSettings,
    refreshSettings: fetchSettings
  };
}
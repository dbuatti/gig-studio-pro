"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export type KeyPreference = 'sharps' | 'flats' | 'neutral';

export const useSettings = () => {
  const { user } = useAuth();
  const [isFetchingSettings, setIsFetchingSettings] = useState(true);
  
  // State variables for all settings
  const [keyPreference, setKeyPreferenceState] = useState<KeyPreference>('neutral');
  const [isSafePitchEnabled, setIsSafePitchEnabledState] = useState(true);
  const [isGoalTrackerEnabled, setIsGoalTrackerEnabledState] = useState(false);
  const [goalLyricsCount, setGoalLyricsCountState] = useState(10);
  const [goalUgChordsCount, setGoalUgChordsCountState] = useState(10);
  const [goalUgLinksCount, setGoalUgLinksCountState] = useState(10);
  const [goalHighestNoteCount, setGoalHighestNoteCountState] = useState(10);
  const [goalOriginalKeyCount, setGoalOriginalKeyCountState] = useState(10);
  const [goalTargetKeyCount, setGoalTargetKeyCountState] = useState(10);
  const [goalPdfsCount, setGoalPdfsCountState] = useState(5);
  const [defaultDashboardView, setDefaultDashboardViewState] = useState<'gigs' | 'repertoire'>('gigs');
  const [ugChordsFontFamily, setUgChordsFontFamilyState] = useState('monospace');
  const [ugChordsFontSize, setUgChordsFontSizeState] = useState(16);
  const [ugChordsChordBold, setUgChordsChordBoldState] = useState(true);
  const [ugChordsChordColor, setUgChordsChordColorState] = useState('#ffffff');
  const [ugChordsLineSpacing, setUgChordsLineSpacingState] = useState(1.5);
  const [ugChordsTextAlign, setUgChordsTextAlignState] = useState<'left' | 'center' | 'right'>('left');
  const [preventStageKeyOverwrite, setPreventStageKeyOverwriteState] = useState(false);
  const [disablePortraitPdfScroll, setDisablePortraitPdfScrollState] = useState(false);
  const [linkSize, setLinkSizeState] = useState<'small' | 'medium' | 'large' | 'extra-large'>('medium');
  const [safePitchMaxNote, setSafePitchMaxNote] = useState('G3');

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setIsFetchingSettings(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setKeyPreferenceState(data.key_preference as KeyPreference || 'neutral');
        setIsSafePitchEnabledState(data.is_safe_pitch_enabled ?? true);
        setIsGoalTrackerEnabledState(data.is_goal_tracker_enabled ?? false);
        setGoalLyricsCountState(data.goal_lyrics_count ?? 10);
        setGoalUgChordsCountState(data.goal_ug_chords_count ?? 10);
        setGoalUgLinksCountState(data.goal_ug_links_count ?? 10);
        setGoalHighestNoteCountState(data.goal_highest_note_count ?? 10);
        setGoalOriginalKeyCountState(data.goal_original_key_count ?? 10);
        setGoalTargetKeyCountState(data.goal_target_key_count ?? 10);
        setGoalPdfsCountState(data.goal_pdfs_count ?? 5);
        setDefaultDashboardViewState(data.default_dashboard_view as 'gigs' | 'repertoire' || 'gigs');
        setUgChordsFontFamilyState(data.ug_chords_font_family || 'monospace');
        setUgChordsFontSizeState(data.ug_chords_font_size ?? 16);
        setUgChordsChordBoldState(data.ug_chords_chord_bold ?? true);
        setUgChordsChordColorState(data.ug_chords_chord_color || '#ffffff');
        setUgChordsLineSpacingState(Number(data.ug_chords_line_spacing) || 1.5);
        setUgChordsTextAlignState(data.ug_chords_text_align as any || 'left');
        setPreventStageKeyOverwriteState(data.prevent_stage_key_overwrite ?? false);
        setDisablePortraitPdfScrollState(data.disable_portrait_pdf_scroll ?? false);
        setLinkSizeState(data.link_size as any || 'medium');
        setSafePitchMaxNote(data.safe_pitch_max_note || 'G3');
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
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
    } catch (err) {
      console.error("Error updating setting:", err);
    }
  };

  return {
    isFetchingSettings,
    keyPreference,
    setKeyPreference: async (val: KeyPreference) => { setKeyPreferenceState(val); await updateSetting({ key_preference: val }); },
    isSafePitchEnabled,
    setIsSafePitchEnabled: async (val: boolean) => { setIsSafePitchEnabledState(val); await updateSetting({ is_safe_pitch_enabled: val }); },
    isGoalTrackerEnabled,
    setIsGoalTrackerEnabled: async (val: boolean) => { setIsGoalTrackerEnabledState(val); await updateSetting({ is_goal_tracker_enabled: val }); },
    goalLyricsCount,
    setGoalLyricsCount: async (val: number) => { setGoalLyricsCountState(val); await updateSetting({ goal_lyrics_count: val }); },
    goalUgChordsCount,
    setGoalUgChordsCount: async (val: number) => { setGoalUgChordsCountState(val); await updateSetting({ goal_ug_chords_count: val }); },
    goalUgLinksCount,
    setGoalUgLinksCount: async (val: number) => { setGoalUgLinksCountState(val); await updateSetting({ goal_ug_links_count: val }); },
    goalHighestNoteCount,
    setGoalHighestNoteCount: async (val: number) => { setGoalHighestNoteCountState(val); await updateSetting({ goal_highest_note_count: val }); },
    goalOriginalKeyCount,
    setGoalOriginalKeyCount: async (val: number) => { setGoalOriginalKeyCountState(val); await updateSetting({ goal_original_key_count: val }); },
    goalTargetKeyCount,
    setGoalTargetKeyCount: async (val: number) => { setGoalTargetKeyCountState(val); await updateSetting({ goal_target_key_count: val }); },
    goalPdfsCount,
    setGoalPdfsCount: async (val: number) => { setGoalPdfsCountState(val); await updateSetting({ goal_pdfs_count: val }); },
    defaultDashboardView,
    setDefaultDashboardView: async (val: 'gigs' | 'repertoire') => { setDefaultDashboardViewState(val); await updateSetting({ default_dashboard_view: val }); },
    ugChordsFontFamily,
    setUgChordsFontFamily: async (val: string) => { setUgChordsFontFamilyState(val); await updateSetting({ ug_chords_font_family: val }); },
    ugChordsFontSize,
    setUgChordsFontSize: async (val: number) => { setUgChordsFontSizeState(val); await updateSetting({ ug_chords_font_size: val }); },
    ugChordsChordBold,
    setUgChordsChordBold: async (val: boolean) => { setUgChordsChordBoldState(val); await updateSetting({ ug_chords_chord_bold: val }); },
    ugChordsChordColor,
    setUgChordsChordColor: async (val: string) => { setUgChordsChordColorState(val); await updateSetting({ ug_chords_chord_color: val }); },
    ugChordsLineSpacing,
    setUgChordsLineSpacing: async (val: number) => { setUgChordsLineSpacingState(val); await updateSetting({ ug_chords_line_spacing: val }); },
    ugChordsTextAlign,
    setUgChordsTextAlign: async (val: 'left' | 'center' | 'right') => { setUgChordsTextAlignState(val); await updateSetting({ ug_chords_text_align: val }); },
    preventStageKeyOverwrite,
    setPreventStageKeyOverwrite: async (val: boolean) => { setPreventStageKeyOverwriteState(val); await updateSetting({ prevent_stage_key_overwrite: val }); },
    disablePortraitPdfScroll,
    setDisablePortraitPdfScroll: async (val: boolean) => { setDisablePortraitPdfScrollState(val); await updateSetting({ disable_portrait_pdf_scroll: val }); },
    linkSize,
    setLinkSize: async (val: 'small' | 'medium' | 'large' | 'extra-large') => { setLinkSizeState(val); await updateSetting({ link_size: val }); },
    safePitchMaxNote,
    updateAllSheetLinksSize: async (size: string) => {
      if (!user) return;
      await supabase.from('sheet_links').update({ link_size: size }).eq('user_id', user.id);
    },
    refreshSettings: fetchSettings
  };
};
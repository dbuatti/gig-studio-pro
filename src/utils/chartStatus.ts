"use client";

import { SetlistSong } from '@/components/SetlistManager';

/**
 * Human labels for the reader format a song prefers (`preferred_reader`).
 * Mirrors READER_OPTIONS in ReadinessWizardModal so wording stays consistent.
 * Note: `fn` means Full Score (the value written by the audit/recommender
 * flows) — `fs` is kept as an alias for older data.
 */
export const READER_OPTIONS_LABELS: Record<string, string> = {
  ug: 'UG Chords',
  ls: 'Lead Sheet',
  fn: 'Full Score',
  fs: 'Full Score',
  unsure: 'Unsure',
};

/**
 * What the preferred reader actually needs attached, in short form.
 */
export const READER_SOURCE_LABELS: Record<string, string | null> = {
  ug: 'Chords',
  ls: 'Lead Sheet',
  fn: 'Full Score',
  fs: 'Full Score',
};

export interface ChartStatus {
  /** A PDF full score is linked (pdfUrl / sheet_music_url). */
  hasScore: boolean;
  /** A lead sheet PDF is linked. */
  hasLeadsheet: boolean;
  /** Any sheet music (score or lead sheet) is linked. */
  hasSheetMusic: boolean;
  /** Chord text (UG) is present. */
  hasChords: boolean;
  /** The song's preferred reader format. */
  preferred: SetlistSong['preferred_reader'];
  /** Label for the preferred format, e.g. "Full Score". */
  preferredLabel: string | null;
  /** True when the preferred format's source is missing (e.g. prefers Full Score but no PDF). */
  needsPreferred: boolean;
  /** Short name of the missing preferred source: "Chords" | "Lead Sheet" | "Full Score". */
  needsPreferredLabel: string | null;
  /** No sheet music (score/lead sheet) linked at all. */
  missingSheet: boolean;
  /** No reader format chosen yet (unset or "unsure"). */
  noReaderChoice: boolean;
  /**
   * The overall state of the song's preferred reader:
   * - `not-set`  no preferred format chosen yet
   * - `filled`   preferred format chosen and its material is present
   * - `missing`  preferred format chosen but its material is NOT present
   */
  readerState: ReaderState;
  /** Number of actionable problems (missing sheet + missing preferred format). */
  issueCount: number;
  /** True when anything is worth flagging. */
  hasIssue: boolean;
}

export type ReaderState = 'not-set' | 'filled' | 'missing';

/**
 * Determines whether a song is missing sheet music and/or the sheets/chords
 * that match its preferred reader format. Pure and side-effect free.
 */
export const getChartStatus = (song: Partial<SetlistSong>): ChartStatus => {
  const hasScore = !!(song.pdfUrl || song.sheet_music_url);
  const hasLeadsheet = !!song.leadsheetUrl;
  const hasChords = !!(song.ug_chords_text && song.ug_chords_text.trim().length > 0);
  const hasSheetMusic = hasScore || hasLeadsheet;

  const preferred = song.preferred_reader ?? null;

  let needsPreferred = false;
  let needsPreferredLabel: string | null = null;
  if (preferred === 'ug' && !hasChords) {
    needsPreferred = true;
    needsPreferredLabel = 'Chords';
  } else if (preferred === 'ls' && !hasLeadsheet) {
    needsPreferred = true;
    needsPreferredLabel = 'Lead Sheet';
  } else if ((preferred === 'fn' || preferred === 'fs') && !hasScore) {
    needsPreferred = true;
    needsPreferredLabel = 'Full Score';
  }

  const missingSheet = !hasSheetMusic;
  const noReaderChoice = !preferred || preferred === 'unsure';
  const issueCount = (needsPreferred ? 1 : 0) + (missingSheet ? 1 : 0);

  let readerState: ReaderState;
  if (noReaderChoice) readerState = 'not-set';
  else if (needsPreferred) readerState = 'missing';
  else readerState = 'filled';

  return {
    hasScore,
    hasLeadsheet,
    hasSheetMusic,
    hasChords,
    preferred,
    preferredLabel: preferred ? (READER_OPTIONS_LABELS[preferred] ?? String(preferred)) : null,
    needsPreferred,
    needsPreferredLabel,
    missingSheet,
    noReaderChoice,
    readerState,
    issueCount,
    hasIssue: issueCount > 0,
  };
};

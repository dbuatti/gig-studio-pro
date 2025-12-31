"use client";
import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManager";
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';

/**
 * Checks if a given string is a valid UUID.
 */
const isValidUuid = (uuid: string | undefined | null): boolean => {
  if (!uuid) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);
};

/**
 * Cleans metadata by removing redundant quotes and trimming whitespace.
 */
const cleanMetadata = (val: string | undefined | null) => {
  if (!val) return "";
  return val.trim().replace(/^["']+|["']+$/g, '');
};

/**
 * Calculates a readiness score (0-100) based on asset presence.
 */
export const calculateReadiness = (song: Partial<SetlistSong>): number => {
  let score = 0;
  
  // 1. Audio Assets (Max 25)
  if (song.audio_url && song.extraction_status === 'completed') score += 25;

  // 2. Chords & Lyrics (Max 20)
  const hasLyrics = (song.lyrics || "").length > 20;
  const hasChordsText = (song.ug_chords_text || "").length > 10;
  if (hasLyrics && hasChordsText) score += 20;
  else if (hasLyrics || hasChordsText) score += 10;

  // 3. Harmonic Data (Max 15)
  if (song.isKeyConfirmed) score += 15;

  // 4. BPM & Timing (Max 10)
  if (song.bpm) score += 10;

  // 5. External Assets & Sheet Verification (Max 10)
  const hasSheetLink = (song.sheet_music_url || song.pdfUrl || song.leadsheetUrl || "").length > 0;
  if (hasSheetLink) score += 10;

  // 6. Basic Metadata (Max 5)
  if (song.artist && song.artist !== "Unknown Artist") score += 5;

  // 7. UG Link Presence (Max 5)
  if (song.ugUrl && song.ugUrl.length > 0) score += 5;

  // 8. Metadata Confirmed (Max 5)
  if (song.isMetadataConfirmed) score += 5;

  // 9. Approved (Max 5)
  if (song.isApproved) score += 5;
  
  return Math.min(100, score); // Cap at 100
};

/**
 * Syncs an array of SetlistSong objects with the master 'repertoire' table in Supabase.
 */
export const syncToMasterRepertoire = async (userId: string, songsToSync: Partial<SetlistSong>[]): Promise<SetlistSong[]> => {
  const syncedSongs: SetlistSong[] = [];

  for (const song of songsToSync) {
    const dbUpdates: { [key: string]: any } = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    dbUpdates.title = cleanMetadata(song.name) || 'Untitled Track';
    dbUpdates.artist = cleanMetadata(song.artist) || 'Unknown Artist';

    if (song.previewUrl !== undefined) dbUpdates.preview_url = song.previewUrl;
    if (song.youtubeUrl !== undefined) dbUpdates.youtube_url = song.youtubeUrl;
    if (song.ugUrl !== undefined) dbUpdates.ug_url = song.ugUrl;
    if (song.appleMusicUrl !== undefined) dbUpdates.apple_music_url = song.appleMusicUrl;
    if (song.pdfUrl !== undefined) dbUpdates.pdf_url = song.pdfUrl;
    if (song.leadsheetUrl !== undefined) dbUpdates.leadsheet_url = song.leadsheetUrl;
    dbUpdates.original_key = song.originalKey !== undefined && song.originalKey !== null ? song.originalKey : 'TBC';
    dbUpdates.target_key = song.targetKey !== undefined && song.targetKey !== null ? song.targetKey : dbUpdates.original_key;
    if (song.pitch !== undefined) dbUpdates.pitch = song.pitch;
    if (song.bpm !== undefined) dbUpdates.bpm = song.bpm;
    if (song.genre !== undefined) dbUpdates.genre = song.genre;
    if (song.isMetadataConfirmed !== undefined) dbUpdates.is_metadata_confirmed = song.isMetadataConfirmed;
    if (song.isKeyConfirmed !== undefined) dbUpdates.is_key_confirmed = song.isKeyConfirmed;
    if (song.notes !== undefined) dbUpdates.notes = song.notes;
    if (song.lyrics !== undefined) dbUpdates.lyrics = song.lyrics;
    if (song.resources !== undefined) dbUpdates.resources = song.resources;
    if (song.user_tags !== undefined) dbUpdates.user_tags = song.user_tags;
    if (song.is_pitch_linked !== undefined) dbUpdates.is_pitch_linked = song.is_pitch_linked;
    if (song.duration_seconds !== undefined) dbUpdates.duration_seconds = Math.round(song.duration_seconds || 0);
    if (song.is_active !== undefined) dbUpdates.is_active = song.is_active;
    if (song.isApproved !== undefined) dbUpdates.is_approved = song.isApproved;
    if (song.preferred_reader !== undefined) dbUpdates.preferred_reader = song.preferred_reader;
    if (song.ug_chords_text !== undefined) dbUpdates.ug_chords_text = song.ug_chords_text;
    if (song.ug_chords_config !== undefined) dbUpdates.ug_chords_config = song.ug_chords_config;
    if (song.is_ug_chords_present !== undefined) dbUpdates.is_ug_chords_present = song.is_ug_chords_present;
    if (song.highest_note_original !== undefined) dbUpdates.highest_note_original = song.highest_note_original;
    if (song.metadata_source !== undefined) dbUpdates.metadata_source = song.metadata_source;
    if (song.sync_status !== undefined) dbUpdates.sync_status = song.sync_status;
    if (song.last_sync_log !== undefined) dbUpdates.last_sync_log = song.last_sync_log;
    if (song.auto_synced !== undefined) dbUpdates.auto_synced = song.auto_synced;
    if (song.is_sheet_verified !== undefined) dbUpdates.is_sheet_verified = song.is_sheet_verified;
    if (song.sheet_music_url !== undefined) dbUpdates.sheet_music_url = song.sheet_music_url;
    if (song.extraction_status !== undefined) dbUpdates.extraction_status = song.extraction_status;
    if (song.extraction_error !== undefined) dbUpdates.extraction_error = song.extraction_error;
    if (song.audio_url !== undefined) dbUpdates.audio_url = song.audio_url;
    if (song.comfort_level !== undefined) dbUpdates.comfort_level = song.comfort_level;
    if (song.last_extracted_at !== undefined) dbUpdates.last_extracted_at = song.last_extracted_at;
    if (song.source_type !== undefined) dbUpdates.source_type = song.source_type;
    if (song.is_in_library !== undefined) dbUpdates.is_in_library = song.is_in_library;
    // Map key_preference for persistence
    if (song.key_preference !== undefined) dbUpdates.key_preference = song.key_preference;

    let result;
    if (song.master_id && isValidUuid(song.master_id)) {
      const { data, error } = await supabase
        .from('repertoire')
        .update(dbUpdates)
        .eq('id', song.master_id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('repertoire')
        .insert([dbUpdates])
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    const mappedResult: SetlistSong = {
      id: song.id || result.id,
      master_id: result.id,
      name: result.title,
      artist: result.artist,
      previewUrl: result.preview_url,
      youtubeUrl: result.youtube_url,
      ugUrl: result.ug_url,
      appleMusicUrl: result.apple_music_url,
      pdfUrl: result.pdf_url,
      leadsheetUrl: result.leadsheet_url,
      originalKey: result.original_key,
      targetKey: result.target_key,
      pitch: result.pitch ?? 0,
      bpm: result.bpm,
      genre: result.genre,
      isSyncing: false,
      isMetadataConfirmed: result.is_metadata_confirmed,
      isKeyConfirmed: result.is_key_confirmed,
      notes: result.notes,
      lyrics: result.lyrics,
      resources: result.resources || [],
      user_tags: result.user_tags || [],
      is_pitch_linked: result.is_pitch_linked ?? true,
      duration_seconds: result.duration_seconds,
      key_preference: result.key_preference, // Map back from DB
      is_active: result.is_active,
      fineTune: result.fineTune,
      tempo: result.tempo,
      volume: result.volume,
      isApproved: result.is_approved,
      preferred_reader: result.preferred_reader,
      ug_chords_text: result.ug_chords_text,
      ug_chords_config: result.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
      is_ug_chords_present: result.is_ug_chords_present,
      highest_note_original: result.highest_note_original,
      is_ug_link_verified: result.is_ug_link_verified,
      metadata_source: result.metadata_source,
      sync_status: result.sync_status,
      last_sync_log: result.last_sync_log,
      auto_synced: result.auto_synced,
      is_sheet_verified: result.is_sheet_verified,
      sheet_music_url: result.sheet_music_url,
      extraction_status: result.extraction_status,
      extraction_error: result.extraction_error,
      audio_url: result.audio_url,
      comfort_level: result.comfort_level,
      last_extracted_at: result.last_extracted_at,
      source_type: result.source_type,
      is_in_library: result.is_in_library,
    };
    syncedSongs.push(mappedResult);
  }

  return syncedSongs;
};
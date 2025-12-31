"use client";
import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManager";
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants'; // Import DEFAULT_UG_CHORDS_CONFIG

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
 * Creates new entries if master_id is missing/invalid, updates existing ones otherwise.
 * Returns the synced SetlistSong objects with their master_ids.
 */
export const syncToMasterRepertoire = async (userId: string, songsToSync: Partial<SetlistSong>[]): Promise<SetlistSong[]> => {
  const syncedSongs: SetlistSong[] = [];

  for (const song of songsToSync) {
    const dbUpdates: { [key: string]: any } = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    // Map SetlistSong properties to repertoire table columns
    if (song.name !== undefined) dbUpdates.title = cleanMetadata(song.name) || 'Untitled Track';
    if (song.artist !== undefined) dbUpdates.artist = cleanMetadata(song.artist) || 'Unknown Artist';
    if (song.previewUrl !== undefined) dbUpdates.preview_url = song.previewUrl; else if (song.previewUrl === null) dbUpdates.preview_url = null;
    if (song.youtubeUrl !== undefined) dbUpdates.youtube_url = song.youtubeUrl; else if (song.youtubeUrl === null) dbUpdates.youtube_url = null;
    if (song.ugUrl !== undefined) dbUpdates.ug_url = song.ugUrl; else if (song.ugUrl === null) dbUpdates.ug_url = null;
    if (song.appleMusicUrl !== undefined) dbUpdates.apple_music_url = song.appleMusicUrl; else if (song.appleMusicUrl === null) dbUpdates.apple_music_url = null;
    if (song.pdfUrl !== undefined) dbUpdates.pdf_url = song.pdfUrl; else if (song.pdfUrl === null) dbUpdates.pdf_url = null;
    if (song.leadsheetUrl !== undefined) dbUpdates.leadsheet_url = song.leadsheetUrl; else if (song.leadsheetUrl === null) dbUpdates.leadsheet_url = null;
    if (song.originalKey !== undefined) dbUpdates.original_key = song.originalKey; else if (song.originalKey === null) dbUpdates.original_key = null;
    if (song.targetKey !== undefined) dbUpdates.target_key = song.targetKey; else if (song.targetKey === null) dbUpdates.target_key = null;
    if (song.pitch !== undefined) dbUpdates.pitch = song.pitch; else if (song.pitch === null) dbUpdates.pitch = 0;
    if (song.bpm !== undefined) dbUpdates.bpm = song.bpm; else if (song.bpm === null) dbUpdates.bpm = null;
    if (song.genre !== undefined) dbUpdates.genre = song.genre; else if (song.genre === null) dbUpdates.genre = null;
    if (song.isMetadataConfirmed !== undefined) dbUpdates.is_metadata_confirmed = song.isMetadataConfirmed; else if (song.isMetadataConfirmed === null) dbUpdates.is_metadata_confirmed = false;
    if (song.isKeyConfirmed !== undefined) dbUpdates.is_key_confirmed = song.isKeyConfirmed; else if (song.isKeyConfirmed === null) dbUpdates.is_key_confirmed = false;
    if (song.notes !== undefined) dbUpdates.notes = song.notes; else if (song.notes === null) dbUpdates.notes = null;
    if (song.lyrics !== undefined) dbUpdates.lyrics = song.lyrics; else if (song.lyrics === null) dbUpdates.lyrics = null;
    if (song.resources !== undefined) dbUpdates.resources = song.resources; else if (song.resources === null) dbUpdates.resources = [];
    if (song.user_tags !== undefined) dbUpdates.user_tags = song.user_tags; else if (song.user_tags === null) dbUpdates.user_tags = [];
    if (song.is_pitch_linked !== undefined) dbUpdates.is_pitch_linked = song.is_pitch_linked; else if (song.is_pitch_linked === null) dbUpdates.is_pitch_linked = true;
    if (song.duration_seconds !== undefined) dbUpdates.duration_seconds = Math.round(song.duration_seconds || 0); else if (song.duration_seconds === null) dbUpdates.duration_seconds = 0;
    if (song.is_active !== undefined) dbUpdates.is_active = song.is_active; else if (song.is_active === null) dbUpdates.is_active = true;
    if (song.isApproved !== undefined) dbUpdates.is_approved = song.isApproved; else if (song.isApproved === null) dbUpdates.is_approved = false;
    if (song.preferred_reader !== undefined) dbUpdates.preferred_reader = song.preferred_reader; else if (song.preferred_reader === null) dbUpdates.preferred_reader = null;
    if (song.ug_chords_text !== undefined) dbUpdates.ug_chords_text = song.ug_chords_text; else if (song.ug_chords_text === null) dbUpdates.ug_chords_text = null;
    if (song.ug_chords_config !== undefined) dbUpdates.ug_chords_config = song.ug_chords_config; else if (song.ug_chords_config === null) dbUpdates.ug_chords_config = DEFAULT_UG_CHORDS_CONFIG;
    if (song.is_ug_chords_present !== undefined) dbUpdates.is_ug_chords_present = song.is_ug_chords_present; else if (song.is_ug_chords_present === null) dbUpdates.is_ug_chords_present = false;
    if (song.highest_note_original !== undefined) dbUpdates.highest_note_original = song.highest_note_original; else if (song.highest_note_original === null) dbUpdates.highest_note_original = null;
    if (song.metadata_source !== undefined) dbUpdates.metadata_source = song.metadata_source; else if (song.metadata_source === null) dbUpdates.metadata_source = null;
    if (song.sync_status !== undefined) dbUpdates.sync_status = song.sync_status; else if (song.sync_status === null) dbUpdates.sync_status = 'IDLE';
    if (song.last_sync_log !== undefined) dbUpdates.last_sync_log = song.last_sync_log; else if (song.last_sync_log === null) dbUpdates.last_sync_log = null;
    if (song.auto_synced !== undefined) dbUpdates.auto_synced = song.auto_synced; else if (song.auto_synced === null) dbUpdates.auto_synced = false;
    if (song.is_sheet_verified !== undefined) dbUpdates.is_sheet_verified = song.is_sheet_verified; else if (song.is_sheet_verified === null) dbUpdates.is_sheet_verified = false;
    if (song.sheet_music_url !== undefined) dbUpdates.sheet_music_url = song.sheet_music_url; else if (song.sheet_music_url === null) dbUpdates.sheet_music_url = null;
    if (song.extraction_status !== undefined) dbUpdates.extraction_status = song.extraction_status; else if (song.extraction_status === null) dbUpdates.extraction_status = 'idle';
    if (song.extraction_error !== undefined) dbUpdates.extraction_error = song.extraction_error; else if (song.extraction_error === null) dbUpdates.extraction_error = null;
    if (song.audio_url !== undefined) dbUpdates.audio_url = song.audio_url; else if (song.audio_url === null) dbUpdates.audio_url = null;
    if (song.comfort_level !== undefined) dbUpdates.comfort_level = song.comfort_level; else if (song.comfort_level === null) dbUpdates.comfort_level = 0;
    if (song.last_extracted_at !== undefined) dbUpdates.last_extracted_at = song.last_extracted_at; else if (song.last_extracted_at === null) dbUpdates.last_extracted_at = null;
    if (song.source_type !== undefined) dbUpdates.source_type = song.source_type; else if (song.source_type === null) dbUpdates.source_type = null;
    if (song.is_in_library !== undefined) dbUpdates.is_in_library = song.is_in_library; else if (song.is_in_library === null) dbUpdates.is_in_library = true;
    
    let result;
    if (song.master_id && isValidUuid(song.master_id)) {
      // Update existing repertoire entry
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
      // Insert new repertoire entry
      const { data, error } = await supabase
        .from('repertoire')
        .insert([dbUpdates])
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    // Map the database result back to a SetlistSong object
    const mappedResult: SetlistSong = {
      id: song.id || result.id, // Keep client-side ID if present, otherwise use DB ID
      master_id: result.id, // Always use DB ID as master_id
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
      isSyncing: false, // Client-side only
      isMetadataConfirmed: result.is_metadata_confirmed,
      isKeyConfirmed: result.is_key_confirmed,
      notes: result.notes,
      lyrics: result.lyrics,
      resources: result.resources || [],
      user_tags: result.user_tags || [],
      is_pitch_linked: result.is_pitch_linked ?? true,
      duration_seconds: result.duration_seconds,
      key_preference: result.key_preference,
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
"use client";
import { supabase } from "@/integrations/supabase/client";
import { SetlistSong, EnergyZone } from "@/components/SetlistManager";
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';

const cleanMetadata = (val: string | undefined | null) => {
  if (!val) return "";
  return val.trim().replace(/^["']+|["']+$/g, '');
};

/**
 * Validates if a string is a valid UUID v4.
 */
const isValidUuid = (uuid: string | undefined | null): boolean => {
  if (!uuid) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(uuid);
};

export const calculateReadiness = (song: Partial<SetlistSong>): number => {
  let score = 0;
  
  const status = (song.extraction_status || "").toLowerCase();
  if (song.audio_url && status === 'completed') score += 25;
  const hasLyrics = (song.lyrics || "").length > 20;
  const hasChordsText = (song.ug_chords_text || "").length > 10;
  if (hasLyrics && hasChordsText) score += 20;
  else if (hasLyrics || hasChordsText) score += 10;
  if (song.isKeyConfirmed) score += 15;
  if (song.bpm) score += 10;
  const hasSheetLink = (song.sheet_music_url || song.pdfUrl || song.leadsheetUrl || "").length > 0;
  if (hasSheetLink) score += 10;
  if (song.artist && song.artist !== "Unknown Artist") score += 5;
  if (song.ugUrl && song.ugUrl.length > 0) score += 5;
  if (song.isMetadataConfirmed) score += 5;
  if (song.isApproved) score += 5;

  if (song.is_ready_to_sing === false) {
    score -= 50;
  }

  return Math.max(0, Math.min(100, score));
};

export const syncToMasterRepertoire = async (userId: string, songsToSync: Partial<SetlistSong>[]): Promise<SetlistSong[]> => {
  const syncedSongs: SetlistSong[] = [];

  for (const song of songsToSync) {
    const dbUpdates: { [key: string]: any } = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    // Determine the target ID (prefer master_id from the object)
    const targetId = song.master_id || song.id;
    const isRealRecord = isValidUuid(targetId);

    if (isRealRecord) {
      dbUpdates.id = targetId;
    }

    if (song.name !== undefined) dbUpdates.title = cleanMetadata(song.name) || 'Untitled Track';
    if (song.artist !== undefined) dbUpdates.artist = cleanMetadata(song.artist) || 'Unknown Artist';

    const now = new Date().toISOString();
    
    if (song.lyrics !== undefined) {
      dbUpdates.lyrics = song.lyrics;
      dbUpdates.lyrics_updated_at = now;
    }
    if (song.ug_chords_text !== undefined) {
      dbUpdates.ug_chords_text = song.ug_chords_text;
      dbUpdates.chords_updated_at = now;
    }
    if (song.ugUrl !== undefined) {
      dbUpdates.ug_url = song.ugUrl;
      dbUpdates.ug_link_updated_at = now;
    }
    if (song.highest_note_original !== undefined) {
      dbUpdates.highest_note_original = song.highest_note_original;
      dbUpdates.highest_note_updated_at = now;
    }
    if (song.originalKey !== undefined && song.originalKey !== "TBC") {
      dbUpdates.original_key = song.originalKey;
      dbUpdates.original_key_updated_at = now;
    }
    if (song.targetKey !== undefined && song.targetKey !== "TBC") {
      dbUpdates.target_key = song.targetKey;
      dbUpdates.target_key_updated_at = now;
    }
    if (song.pdfUrl !== undefined || song.leadsheetUrl !== undefined || song.sheet_music_url !== undefined) {
      dbUpdates.pdf_updated_at = now;
    }

    if (song.previewUrl !== undefined) dbUpdates.preview_url = song.previewUrl;
    if (song.youtubeUrl !== undefined) dbUpdates.youtube_url = song.youtubeUrl;
    if (song.appleMusicUrl !== undefined) dbUpdates.apple_music_url = song.appleMusicUrl;
    if (song.pdfUrl !== undefined) dbUpdates.pdf_url = song.pdfUrl;
    if (song.leadsheetUrl !== undefined) dbUpdates.leadsheet_url = song.leadsheetUrl;
    
    // Numeric fields (defensive casting)
    if (song.pitch !== undefined) dbUpdates.pitch = Number(song.pitch);
    if (song.duration_seconds !== undefined) dbUpdates.duration_seconds = Math.round(Number(song.duration_seconds || 0));
    
    // Text fields
    if (song.bpm !== undefined) dbUpdates.bpm = song.bpm;
    if (song.genre !== undefined) dbUpdates.genre = song.genre;
    if (song.notes !== undefined) dbUpdates.notes = song.notes;
    if (song.preferred_reader !== undefined) dbUpdates.preferred_reader = song.preferred_reader;
    if (song.key_preference !== undefined) dbUpdates.key_preference = song.key_preference;
    if (song.audio_url !== undefined) dbUpdates.audio_url = song.audio_url;
    if (song.extraction_status !== undefined) dbUpdates.extraction_status = song.extraction_status;
    if (song.energy_level !== undefined) dbUpdates.energy_level = song.energy_level;

    // Boolean fields (defensive casting)
    if (song.isMetadataConfirmed !== undefined) dbUpdates.is_metadata_confirmed = Boolean(song.isMetadataConfirmed);
    if (song.isKeyConfirmed !== undefined) dbUpdates.is_key_confirmed = Boolean(song.isKeyConfirmed);
    if (song.is_pitch_linked !== undefined) dbUpdates.is_pitch_linked = Boolean(song.is_pitch_linked);
    if (song.isApproved !== undefined) dbUpdates.is_approved = Boolean(song.isApproved);
    if (song.is_ready_to_sing !== undefined) dbUpdates.is_ready_to_sing = Boolean(song.is_ready_to_sing);
    if (song.is_ug_chords_present !== undefined) dbUpdates.is_ug_chords_present = Boolean(song.is_ug_chords_present);
    if (song.auto_synced !== undefined) dbUpdates.auto_synced = Boolean(song.auto_synced);
    if (song.is_sheet_verified !== undefined) dbUpdates.is_sheet_verified = Boolean(song.is_sheet_verified);
    
    // JSONB fields
    if (song.resources !== undefined) dbUpdates.resources = song.resources;
    if (song.user_tags !== undefined) dbUpdates.user_tags = song.user_tags;
    if (song.ug_chords_config !== undefined) dbUpdates.ug_chords_config = song.ug_chords_config;
    
    let result;
    let error;

    if (isRealRecord) {
      // If we have a valid UUID, we perform a direct update on that record.
      const { data, error: updateError } = await supabase
        .from('repertoire')
        .update(dbUpdates)
        .eq('id', targetId)
        .select()
        .single();
      result = data;
      error = updateError;
    } else {
      // For new records or imports where ID is temporary, use upsert on the unique constraint.
      const { data, error: upsertError } = await supabase
        .from('repertoire')
        .upsert(dbUpdates, { onConflict: 'user_id,title,artist' })
        .select()
        .single();
      result = data;
      error = upsertError;
    }

    if (error) throw error;

    syncedSongs.push({
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
      key_preference: result.key_preference, 
      isApproved: result.is_approved,
      is_ready_to_sing: result.is_ready_to_sing,
      preferred_reader: result.preferred_reader,
      ug_chords_text: result.ug_chords_text,
      ug_chords_config: result.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
      is_ug_chords_present: result.is_ug_chords_present,
      highest_note_original: result.highest_note_original,
      audio_url: result.audio_url,
      extraction_status: result.extraction_status,
      lyrics_updated_at: result.lyrics_updated_at,
      chords_updated_at: result.chords_updated_at,
      ug_link_updated_at: result.ug_link_updated_at,
      highest_note_updated_at: result.highest_note_updated_at,
      original_key_updated_at: result.original_key_updated_at,
      target_key_updated_at: result.target_key_updated_at,
      pdf_updated_at: result.pdf_updated_at,
      energy_level: result.energy_level as EnergyZone,
    } as any);
  }

  return syncedSongs;
};
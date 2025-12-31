"use client";
import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManager";
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';

const cleanMetadata = (val: string | undefined | null) => {
  if (!val) return "";
  return val.trim().replace(/^["']+|["']+$/g, '');
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
  return Math.min(100, score);
};

export const syncToMasterRepertoire = async (userId: string, songsToSync: Partial<SetlistSong>[]): Promise<SetlistSong[]> => {
  const syncedSongs: SetlistSong[] = [];

  for (const song of songsToSync) {
    const dbUpdates: { [key: string]: any } = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    // Use ID if available to ensure we update the correct record
    if (song.master_id || song.id) {
      dbUpdates.id = song.master_id || song.id;
    }

    dbUpdates.title = cleanMetadata(song.name) || 'Untitled Track';
    dbUpdates.artist = cleanMetadata(song.artist) || 'Unknown Artist';

    const now = new Date().toISOString();
    
    // Explicitly update timestamps for goals when fields are present in the update object
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

    if (song.previewUrl !== undefined) dbUpdates.preview_url = song.previewUrl;
    if (song.youtubeUrl !== undefined) dbUpdates.youtube_url = song.youtubeUrl;
    if (song.appleMusicUrl !== undefined) dbUpdates.apple_music_url = song.appleMusicUrl;
    if (song.pdfUrl !== undefined) dbUpdates.pdf_url = song.pdfUrl;
    if (song.leadsheetUrl !== undefined) dbUpdates.leadsheet_url = song.leadsheetUrl;
    
    if (song.pitch !== undefined) dbUpdates.pitch = song.pitch;
    if (song.bpm !== undefined) dbUpdates.bpm = song.bpm;
    if (song.genre !== undefined) dbUpdates.genre = song.genre;
    if (song.isMetadataConfirmed !== undefined) dbUpdates.is_metadata_confirmed = song.isMetadataConfirmed;
    if (song.isKeyConfirmed !== undefined) dbUpdates.is_key_confirmed = song.isKeyConfirmed;
    if (song.notes !== undefined) dbUpdates.notes = song.notes;
    if (song.resources !== undefined) dbUpdates.resources = song.resources;
    if (song.user_tags !== undefined) dbUpdates.user_tags = song.user_tags;
    if (song.is_pitch_linked !== undefined) dbUpdates.is_pitch_linked = song.is_pitch_linked;
    if (song.duration_seconds !== undefined) dbUpdates.duration_seconds = Math.round(song.duration_seconds || 0);
    if (song.isApproved !== undefined) dbUpdates.is_approved = song.isApproved;
    if (song.preferred_reader !== undefined) dbUpdates.preferred_reader = song.preferred_reader;
    if (song.ug_chords_config !== undefined) dbUpdates.ug_chords_config = song.ug_chords_config;
    if (song.is_ug_chords_present !== undefined) dbUpdates.is_ug_chords_present = song.is_ug_chords_present;
    if (song.key_preference !== undefined) dbUpdates.key_preference = song.key_preference;
    if (song.audio_url !== undefined) dbUpdates.audio_url = song.audio_url;
    if (song.extraction_status !== undefined) dbUpdates.extraction_status = song.extraction_status;

    console.log(`[repertoireSync] Sending payload for "${dbUpdates.title}":`, { 
      orig_key: dbUpdates.original_key, 
      target_key: dbUpdates.target_key,
      orig_ts: dbUpdates.original_key_updated_at,
      target_ts: dbUpdates.target_key_updated_at 
    });

    const { data, error } = await supabase
      .from('repertoire')
      .upsert(dbUpdates, { onConflict: 'user_id,title,artist' })
      .select()
      .single();

    if (error) throw error;

    const result = data;
    console.log(`[repertoireSync] Received response for "${result.title}". Updated targets:`, {
      orig_ts: result.original_key_updated_at,
      target_ts: result.target_key_updated_at
    });

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
    } as any);
  }

  return syncedSongs;
};
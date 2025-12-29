"use client";
import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManager";

/**
 * Checks if a given string is a valid UUID.
 */
const isValidUuid = (uuid: string | undefined | null): boolean => {
  if (!uuid) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);
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
  let assetScore = 0;
  
  // 1. Audio Assets (Max 25)
  const preview = song.previewUrl || "";
  const isItunes = preview.includes('apple.com') || preview.includes('itunes-assets') || preview.includes('mzstatic.com');
  if (preview && !isItunes) assetScore += 25;

  // 2. Chords & Lyrics (Max 20)
  const hasLyrics = (song.lyrics || "").length > 20;
  const hasChordsText = (song.ug_chords_text || "").length > 10;
  if (hasLyrics && hasChordsText) assetScore += 20;
  else if (hasLyrics || hasChordsText) assetScore += 10;

  // 3. Harmonic Data (Max 15)
  if (song.isKeyConfirmed) assetScore += 15;

  // 4. BPM & Timing (Max 10)
  if (song.bpm) assetScore += 10;

  // 5. External Assets & Sheet Verification (Max 10)
  const hasSheetLink = (song.sheet_music_url || song.pdfUrl || song.leadsheetUrl || "").length > 0;
  if (hasSheetLink) assetScore += 10;

  // 6. Basic Metadata (Max 5)
  if (song.artist && song.artist !== "Unknown Artist") assetScore += 5;

  // 7. UG Link Presence (Max 5)
  if (song.ugUrl && song.ugUrl.length > 0) assetScore += 5;

  // Final Gate Steps
  let finalScore = Math.min(85, assetScore);
  
  if (song.isMetadataConfirmed) finalScore += 10;
  if (song.isApproved) finalScore += 5;
  
  return finalScore;
};

/**
 * Synchronizes local setlist songs with the master repertoire table.
 * Uses ID for conflict resolution to allow renames without duplication.
 */
export const syncToMasterRepertoire = async (userId: string, songs: SetlistSong | SetlistSong[]): Promise<SetlistSong[]> => {
  if (!userId) return Array.isArray(songs) ? songs : [songs];
  
  const songsArray = Array.isArray(songs) ? songs : [songs];
  if (songsArray.length === 0) return [];
  
  try {
    const payloads = songsArray.map(song => {
      const payload: { [key: string]: any } = {
        user_id: userId,
        title: cleanMetadata(song.name) || 'Untitled Track',
        artist: cleanMetadata(song.artist) || 'Unknown Artist',
        updated_at: new Date().toISOString(),
        readiness_score: calculateReadiness(song),
        is_active: true,
      };

      if (song.originalKey !== undefined) payload.original_key = song.originalKey;
      if (song.targetKey !== undefined) payload.target_key = song.targetKey;
      if (song.pitch !== undefined) payload.pitch = song.pitch;
      if (song.bpm !== undefined) payload.bpm = song.bpm;
      if (song.lyrics !== undefined) payload.lyrics = song.lyrics;
      if (song.notes !== undefined) payload.notes = song.notes;
      if (song.ugUrl !== undefined) payload.ug_url = song.ugUrl;
      if (song.pdfUrl !== undefined) payload.pdf_url = song.pdfUrl;
      if (song.leadsheetUrl !== undefined) payload.leadsheet_url = song.leadsheetUrl;
      if (song.youtubeUrl !== undefined) payload.youtube_url = song.youtubeUrl;
      if (song.previewUrl !== undefined) payload.preview_url = song.previewUrl;
      if (song.appleMusicUrl !== undefined) payload.apple_music_url = song.appleMusicUrl;
      if (song.isMetadataConfirmed !== undefined) payload.is_metadata_confirmed = song.isMetadataConfirmed;
      if (song.isKeyConfirmed !== undefined) payload.is_key_confirmed = song.isKeyConfirmed;
      if (song.duration_seconds !== undefined) payload.duration_seconds = Math.round(song.duration_seconds || 0);
      if (song.genre !== undefined) payload.genre = song.genre;
      if (song.user_tags !== undefined) payload.user_tags = song.user_tags;
      if (song.resources !== undefined) payload.resources = song.resources;
      if (song.preferred_reader !== undefined) payload.preferred_reader = song.preferred_reader;
      if (song.ug_chords_text !== undefined) payload.ug_chords_text = song.ug_chords_text;
      if (song.ug_chords_config !== undefined) payload.ug_chords_config = song.ug_chords_config;
      if (song.is_pitch_linked !== undefined) payload.is_pitch_linked = song.is_pitch_linked;
      if (song.highest_note_original !== undefined) payload.highest_note_original = song.highest_note_original;
      if (song.isApproved !== undefined) payload.is_approved = song.isApproved;
      if (song.sheet_music_url !== undefined) payload.sheet_music_url = song.sheet_music_url;
      if (song.is_sheet_verified !== undefined) payload.is_sheet_verified = song.is_sheet_verified;
      
      if (isValidUuid(song.master_id)) {
        payload.id = song.master_id;
      }
      
      return payload;
    });
    
    // Logic: Use 'id' for conflict resolution if we have it (allows renaming).
    // If no ID is present (new song), default to metadata to match existing entries.
    const hasIds = payloads.some(p => p.id);
    const conflictTarget = hasIds ? 'id' : 'user_id,title,artist';

    const { data, error } = await supabase
      .from('repertoire')
      .upsert(payloads, { onConflict: conflictTarget })
      .select('id, title, artist');
      
    if (error) {
      console.error("[syncToMasterRepertoire] Upsert Failure:", error.message);
      throw error;
    }
    
    return songsArray.map(originalSong => {
      const matchedDbSong = data.find(dbSong => {
        if (originalSong.master_id && dbSong.id === originalSong.master_id) return true;
        if (dbSong.title === cleanMetadata(originalSong.name) && dbSong.artist === (cleanMetadata(originalSong.artist) || 'Unknown Artist')) return true;
        return false;
      });
      
      return matchedDbSong ? { ...originalSong, master_id: matchedDbSong.id, id: originalSong.id } : originalSong;
    });
  } catch (err) {
    throw err;
  }
};
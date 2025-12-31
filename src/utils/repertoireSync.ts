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
        // Ensure title and artist are never null
        title: cleanMetadata(song.name) || 'Untitled Track',
        artist: cleanMetadata(song.artist) || 'Unknown Artist',
        updated_at: new Date().toISOString(),
        readiness_score: calculateReadiness(song),
        is_active: song.is_active ?? true, // Default to true if undefined/null
      };

      // Explicitly map SetlistSong properties to repertoire table columns
      // and ensure nullable fields are explicitly null if undefined.
      payload.original_key = song.originalKey ?? null;
      payload.target_key = song.targetKey ?? null;
      payload.pitch = song.pitch ?? 0; // Default to 0 if undefined/null
      payload.bpm = song.bpm ?? null;
      payload.lyrics = song.lyrics ?? null;
      payload.notes = song.notes ?? null;
      payload.ug_url = song.ugUrl ?? null;
      payload.pdf_url = song.pdfUrl ?? null;
      payload.leadsheet_url = song.leadsheetUrl ?? null;
      payload.youtube_url = song.youtubeUrl ?? null;
      payload.preview_url = song.previewUrl ?? null;
      payload.apple_music_url = song.appleMusicUrl ?? null;
      payload.is_metadata_confirmed = song.isMetadataConfirmed ?? false; // Default to false
      payload.is_key_confirmed = song.isKeyConfirmed ?? false; // Default to false
      payload.duration_seconds = Math.round(song.duration_seconds || 0); // Default to 0
      payload.genre = song.genre ?? null;
      payload.user_tags = song.user_tags ?? []; // Default to empty array
      payload.resources = song.resources ?? []; // Default to empty array
      payload.comfort_level = song.comfort_level ?? 0; // Default to 0 as per schema
      payload.preferred_reader = song.preferred_reader ?? null;
      payload.ug_chords_text = song.ug_chords_text ?? null;
      payload.ug_chords_config = song.ug_chords_config ?? DEFAULT_UG_CHORDS_CONFIG; // Explicitly set default if undefined/null
      payload.is_ug_chords_present = song.is_ug_chords_present ?? false; // Explicitly set default if undefined/null
      payload.is_pitch_linked = song.is_pitch_linked ?? true; // Default to true
      payload.highest_note_original = song.highest_note_original ?? null;
      payload.extraction_status = song.extraction_status ?? 'idle'; // Default to 'idle'
      payload.last_extracted_at = song.last_extracted_at ?? null; // Explicitly set to null if undefined
      payload.source_type = song.source_type ?? 'YOUTUBE'; // Default to 'YOUTUBE' as per schema
      payload.sync_status = song.sync_status ?? 'IDLE'; // Default to 'IDLE' as per schema
      payload.last_sync_log = song.last_sync_log ?? null;
      payload.auto_synced = song.auto_synced ?? false; // Default to false
      payload.metadata_source = song.metadata_source ?? null; // Explicitly set to null if undefined
      payload.is_approved = song.isApproved ?? false; // Default to false
      payload.is_in_library = song.is_in_library ?? true; // Default to true as per schema
      payload.sheet_music_url = song.sheet_music_url ?? null;
      payload.is_sheet_verified = song.is_sheet_verified ?? false; // Default to false
      
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
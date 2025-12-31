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
        title: String(cleanMetadata(song.name) || 'Untitled Track'),
        artist: String(cleanMetadata(song.artist) || 'Unknown Artist'),
        updated_at: new Date().toISOString(),
        readiness_score: Number(calculateReadiness(song)),
        is_active: Boolean(song.is_active ?? true),
      };

      payload.original_key = song.originalKey !== undefined ? String(song.originalKey) : null;
      payload.target_key = song.targetKey !== undefined ? String(song.targetKey) : null;
      payload.pitch = Number(song.pitch ?? 0);
      payload.bpm = song.bpm !== undefined ? String(song.bpm) : null;
      payload.lyrics = song.lyrics !== undefined ? String(song.lyrics) : null;
      payload.notes = song.notes !== undefined ? String(song.notes) : null;
      payload.ug_url = song.ugUrl !== undefined ? String(song.ugUrl) : null;
      payload.pdf_url = song.pdfUrl !== undefined ? String(song.pdfUrl) : null;
      payload.leadsheet_url = song.leadsheetUrl !== undefined ? String(song.leadsheetUrl) : null;
      payload.youtube_url = song.youtubeUrl !== undefined ? String(song.youtubeUrl) : null;
      payload.preview_url = song.previewUrl !== undefined ? String(song.previewUrl) : null;
      payload.apple_music_url = song.appleMusicUrl !== undefined ? String(song.appleMusicUrl) : null;
      payload.is_metadata_confirmed = Boolean(song.isMetadataConfirmed ?? false);
      payload.is_key_confirmed = Boolean(song.isKeyConfirmed ?? false);
      payload.duration_seconds = Number(Math.round(song.duration_seconds || 0));
      payload.genre = song.genre !== undefined ? String(song.genre) : null;
      payload.user_tags = song.user_tags ?? []; 
      payload.resources = song.resources ?? []; 
      payload.comfort_level = Number(song.comfort_level ?? 0);
      payload.preferred_reader = song.preferred_reader !== undefined ? String(song.preferred_reader) : null;
      payload.ug_chords_text = song.ug_chords_text !== undefined ? String(song.ug_chords_text) : null;
      payload.ug_chords_config = song.ug_chords_config ?? DEFAULT_UG_CHORDS_CONFIG; 
      payload.is_ug_chords_present = Boolean(song.is_ug_chords_present ?? false);
      payload.is_pitch_linked = Boolean(song.is_pitch_linked ?? true);
      payload.highest_note_original = song.highest_note_original !== undefined ? String(song.highest_note_original) : null;
      payload.extraction_status = String(song.extraction_status ?? 'idle');
      payload.last_extracted_at = song.last_extracted_at !== undefined ? String(song.last_extracted_at) : null;
      payload.source_type = String(song.source_type ?? 'YOUTUBE');
      payload.sync_status = String(song.sync_status ?? 'IDLE');
      payload.last_sync_log = song.last_sync_log !== undefined ? String(song.last_sync_log) : null;
      payload.auto_synced = Boolean(song.auto_synced ?? false);
      payload.metadata_source = song.metadata_source !== undefined ? String(song.metadata_source) : null;
      payload.is_approved = Boolean(song.isApproved ?? false);
      payload.is_in_library = Boolean(song.is_in_library ?? true);
      payload.sheet_music_url = song.sheet_music_url !== undefined ? String(song.sheet_music_url) : null;
      payload.is_sheet_verified = Boolean(song.is_sheet_verified ?? false);
      
      if (isValidUuid(song.master_id)) {
        payload.id = song.master_id;
      }
      
      return payload;
    });
    
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
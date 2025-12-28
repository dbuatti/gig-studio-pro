"use client";
import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManager";
import { DEFAULT_UG_CHORDS_CONFIG } from "./constants";

/**
 * Checks if a given string is a valid UUID.
 */
const isValidUuid = (uuid: string | undefined | null): boolean => {
  if (!uuid) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid);
};

/**
 * Calculates a readiness score (0-100) based on asset presence.
 * Weights:
 * - Technical Assets: 85% (Audio, Chords, Lyrics, etc.)
 * - Metadata Verified: 10% (Manual Step 1)
 * - Setlist Confirmed: 5%  (Manual Step 2)
 * 
 * NEW LOGIC: Presence-based verification.
 * - ug_url presence counts as verified UG link.
 * - sheet_music_url presence counts as verified Sheet link.
 */
export const calculateReadiness = (song: Partial<SetlistSong>): number => {
  let assetScore = 0;
  
  // 1. Audio Assets (Max 25)
  const preview = song.previewUrl || "";
  const isItunes = preview.includes('apple.com') || preview.includes('itunes-assets');
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
  // Presence-based check: If URL exists, it counts as verified.
  const hasSheetLink = (song.sheet_music_url || song.pdfUrl || song.leadsheetUrl || "").length > 0;
  if (hasSheetLink) assetScore += 10;

  // 6. Basic Metadata (Max 5)
  if (song.artist && song.artist !== "Unknown Artist") assetScore += 5;

  // 7. UG Link Presence (Max 5)
  // Presence-based check: If URL exists, it counts as verified.
  if (song.ugUrl && song.ugUrl.length > 0) assetScore += 5;

  // Final Gate Steps
  let finalScore = Math.min(85, assetScore);
  
  // Metadata Verification (+10)
  if (song.isMetadataConfirmed) finalScore += 10;
  
  // Setlist Confirmation (+5)
  if (song.isApproved) finalScore += 5;
  
  return finalScore;
};

/**
 * Synchronizes local setlist songs with the master repertoire table.
 */
export const syncToMasterRepertoire = async (userId: string, songs: SetlistSong | SetlistSong[]): Promise<SetlistSong[]> => {
  if (!userId) {
    console.warn("[syncToMasterRepertoire] userId is missing. Skipping sync.");
    return Array.isArray(songs) ? songs : [songs];
  }
  
  const songsArray = Array.isArray(songs) ? songs : [songs];
  if (songsArray.length === 0) {
    console.warn("[syncToMasterRepertoire] No songs provided for sync. Skipping.");
    return [];
  }
  
  try {
    const payloads = songsArray.map(song => {
      const payload: { [key: string]: any } = {
        user_id: userId,
        title: song.name.trim() || 'Untitled Track',
        artist: song.artist?.trim() || 'Unknown Artist',
        updated_at: new Date().toISOString(),
        readiness_score: calculateReadiness(song),
        is_active: true, // Default to true, can be overridden if needed
      };

      // Conditionally add fields only if they are defined in the song object
      // This prevents sending 'undefined' or default objects for nullable fields if not explicitly set
      if (song.originalKey !== undefined) payload.original_key = song.originalKey; else payload.original_key = null;
      if (song.targetKey !== undefined) payload.target_key = song.targetKey; else payload.target_key = null;
      if (song.bpm !== undefined) payload.bpm = song.bpm; else payload.bpm = null;
      if (song.lyrics !== undefined) payload.lyrics = song.lyrics; else payload.lyrics = null;
      if (song.notes !== undefined) payload.notes = song.notes; else payload.notes = null;
      if (song.pitch !== undefined) payload.pitch = song.pitch; else payload.pitch = 0; // pitch is NOT NULL with default 0
      if (song.ugUrl !== undefined) payload.ug_url = song.ugUrl; else payload.ug_url = null;
      if (song.pdfUrl !== undefined) payload.pdf_url = song.pdfUrl; else payload.pdf_url = null;
      if (song.leadsheetUrl !== undefined) payload.leadsheet_url = song.leadsheetUrl; else payload.leadsheet_url = null;
      if (song.youtubeUrl !== undefined) payload.youtube_url = song.youtubeUrl; else payload.youtube_url = null;
      if (song.previewUrl !== undefined) payload.preview_url = song.previewUrl; else payload.preview_url = null;
      if (song.appleMusicUrl !== undefined) payload.apple_music_url = song.appleMusicUrl; else payload.apple_music_url = null;
      if (song.isMetadataConfirmed !== undefined) payload.is_metadata_confirmed = song.isMetadataConfirmed; else payload.is_metadata_confirmed = false;
      if (song.isKeyConfirmed !== undefined) payload.is_key_confirmed = song.isKeyConfirmed; else payload.is_key_confirmed = false;
      if (song.duration_seconds !== undefined) payload.duration_seconds = Math.round(song.duration_seconds || 0); else payload.duration_seconds = 0;
      if (song.genre !== undefined) payload.genre = song.genre; else payload.genre = null;
      if (song.user_tags !== undefined) payload.user_tags = song.user_tags; else payload.user_tags = [];
      if (song.resources !== undefined) payload.resources = song.resources; else payload.resources = [];
      if (song.preferred_reader !== undefined) payload.preferred_reader = song.preferred_reader; else payload.preferred_reader = null;
      if (song.ug_chords_text !== undefined) payload.ug_chords_text = song.ug_chords_text; else payload.ug_chords_text = null;
      if (song.ug_chords_config !== undefined) payload.ug_chords_config = song.ug_chords_config; else payload.ug_chords_config = null; // Send null if not explicitly set
      if (song.is_ug_chords_present !== undefined) payload.is_ug_chords_present = song.is_ug_chords_present; else payload.is_ug_chords_present = false;
      if (song.is_pitch_linked !== undefined) payload.is_pitch_linked = song.is_pitch_linked; else payload.is_pitch_linked = true;
      if (song.highest_note_original !== undefined) payload.highest_note_original = song.highest_note_original; else payload.highest_note_original = null;
      if (song.isApproved !== undefined) payload.is_approved = song.isApproved; else payload.is_approved = false;
      if (song.sheet_music_url !== undefined) payload.sheet_music_url = song.sheet_music_url; else payload.sheet_music_url = null;
      if (song.is_sheet_verified !== undefined) payload.is_sheet_verified = song.is_sheet_verified; else payload.is_sheet_verified = false;
      
      // These are internal sync statuses, ensure they are passed if present
      if ((song as any).sync_status !== undefined) payload.sync_status = (song as any).sync_status; else payload.sync_status = 'IDLE';
      if ((song as any).last_sync_log !== undefined) payload.last_sync_log = (song as any).last_sync_log; else payload.last_sync_log = null;
      if ((song as any).auto_synced !== undefined) payload.auto_synced = (song as any).auto_synced; else payload.auto_synced = false;
      if ((song as any).metadata_source !== undefined) payload.metadata_source = (song as any).metadata_source; else payload.metadata_source = null;
      if ((song as any).extraction_status !== undefined) payload.extraction_status = (song as any).extraction_status; else payload.extraction_status = 'PENDING';
      if ((song as any).source_type !== undefined) payload.source_type = (song as any).source_type; else payload.source_type = 'YOUTUBE';

      // Only include 'id' in the payload if it's an existing master_id (a valid UUID)
      if (isValidUuid(song.master_id)) {
        payload.id = song.master_id;
      }
      
      return payload;
    });
    
    console.log("[syncToMasterRepertoire] Sending payloads to Supabase:", JSON.stringify(payloads, null, 2));
    
    const { data, error } = await supabase
      .from('repertoire')
      .upsert(payloads, { onConflict: 'id' })
      .select('id, title, artist');
      
    if (error) {
      console.error("[syncToMasterRepertoire] Supabase upsert error:", error);
      throw error;
    }
    
    console.log("[syncToMasterRepertoire] Supabase upsert successful. Data:", data);
    
    return songsArray.map(originalSong => {
      const matchedDbSong = data.find(dbSong => {
        if (originalSong.master_id && dbSong.id === originalSong.master_id) return true;
        if (!originalSong.master_id && dbSong.title === originalSong.name.trim() && dbSong.artist === (originalSong.artist?.trim() || 'Unknown Artist')) return true;
        return false;
      });
      
      return matchedDbSong ? { ...originalSong, master_id: matchedDbSong.id } : originalSong;
    });
  } catch (err) {
    console.error("[syncToMasterRepertoire] Caught error:", err);
    throw err;
  }
};
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
  if (!userId) return Array.isArray(songs) ? songs : [songs];
  
  const songsArray = Array.isArray(songs) ? songs : [songs];
  if (songsArray.length === 0) return [];
  
  try {
    const payloads = songsArray.map(song => {
      const payload: any = {
        user_id: userId,
        title: song.name.trim() || 'Untitled Track', // Ensure title is not empty
        artist: song.artist?.trim() || 'Unknown Artist', // Ensure artist is not empty
        original_key: song.originalKey || null,
        target_key: song.targetKey || null,
        bpm: song.bpm || null,
        lyrics: song.lyrics || null,
        notes: song.notes || null,
        pitch: song.pitch || 0,
        ug_url: song.ugUrl || null,
        pdf_url: song.pdfUrl || null,
        leadsheet_url: song.leadsheetUrl || null,
        youtube_url: song.youtubeUrl || null,
        preview_url: song.previewUrl || null,
        apple_music_url: song.appleMusicUrl || null,
        is_metadata_confirmed: song.isMetadataConfirmed || false,
        is_key_confirmed: song.isKeyConfirmed || false,
        duration_seconds: Math.round(song.duration_seconds || 0),
        genre: song.genre || (song.user_tags?.[0] ? String(song.user_tags[0]) : null), // Explicitly cast to string
        user_tags: song.user_tags || [],
        resources: song.resources || [],
        readiness_score: calculateReadiness(song),
        is_active: true,
        updated_at: new Date().toISOString(),
        ug_chords_text: song.ug_chords_text || null,
        ug_chords_config: song.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: !!(song.ug_chords_text && song.ug_chords_text.trim().length > 0),
        is_pitch_linked: song.is_pitch_linked ?? true,
        highest_note_original: song.highest_note_original || null,
        is_approved: song.isApproved || false,
        sheet_music_url: song.sheet_music_url || null,
        is_sheet_verified: ((song.sheet_music_url || song.pdfUrl || song.leadsheetUrl || "").length > 0) || false,
        sync_status: (song as any).sync_status || 'IDLE',
        last_sync_log: (song as any).last_sync_log || null,
        auto_synced: (song as any).auto_synced || false,
        metadata_source: (song as any).metadata_source || null,
        extraction_status: (song as any).extraction_status || 'PENDING',
        source_type: (song as any).source_type || 'YOUTUBE'
      };
      
      // Only include 'id' in the payload if it's an existing master_id (a valid UUID)
      // If song.master_id is not a valid UUID (e.g., client-generated string or null),
      // 'id' will be omitted from the payload, and Supabase will generate a new UUID on insert.
      if (isValidUuid(song.master_id)) {
        payload.id = song.master_id;
      }
      
      return payload;
    });
    
    const { data, error } = await supabase
      .from('repertoire')
      .upsert(payloads, { onConflict: 'id' })
      .select('id, title, artist'); // Select generated ID for new inserts
      
    if (error) throw error;
    
    // Map the returned data back to the original songsArray to update master_id for new inserts
    return songsArray.map(originalSong => {
      const matchedDbSong = data.find(dbSong => {
        // If originalSong already had a master_id, match by that
        if (originalSong.master_id && dbSong.id === originalSong.master_id) return true;
        // For newly inserted songs (no master_id), match by title and artist
        // This is a fallback heuristic for new inserts if we can't rely on a temporary client_id
        if (!originalSong.master_id && dbSong.title === originalSong.name.trim() && dbSong.artist === (originalSong.artist?.trim() || 'Unknown Artist')) return true;
        return false;
      });
      
      return matchedDbSong ? { ...originalSong, master_id: matchedDbSong.id } : originalSong;
    });
  } catch (err) {
    throw err; // Re-throw to propagate the error to the caller
  }
};
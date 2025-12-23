"use client";

import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManager";

/**
 * Calculates a readiness score (0-100) based on available assets and metadata.
 */
export const calculateReadiness = (song: Partial<SetlistSong>): number => {
  let score = 0;
  const preview = song.previewUrl || "";
  const isItunes = preview.includes('apple.com') || preview.includes('itunes-assets');
  
  if (preview && !isItunes) score += 25; 
  if (song.isKeyConfirmed) score += 20; 
  if ((song.lyrics || "").length > 20) score += 15; 
  if (song.pdfUrl || song.leadsheetUrl) score += 15; 
  if (song.ugUrl) score += 10; 
  if (song.bpm) score += 5; 
  if ((song.notes || "").length > 10) score += 5; 
  if (song.artist && song.artist !== "Unknown Artist") score += 5; 
  
  return Math.min(100, score);
};

/**
 * Syncs a single song or a batch of songs to the master repertoire table.
 * Uses the ID as the primary sync target to support renames.
 */
export const syncToMasterRepertoire = async (userId: string, songs: SetlistSong | SetlistSong[]) => {
  if (!userId) return;
  
  const songsArray = Array.isArray(songs) ? songs : [songs];
  if (songsArray.length === 0) return;

  try {
    const payloads = songsArray.map(song => ({
      // Prioritize the permanent database ID to allow renames.
      // If missing, database will generate a new UUID and Title constraint will prevent duplicates.
      ...(song.master_id ? { id: song.master_id } : {}),
      user_id: userId,
      title: song.name,
      artist: song.artist || 'Unknown Artist',
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
      genre: song.genre || (song.user_tags?.[0]) || null,
      user_tags: song.user_tags || [],
      resources: song.resources || [],
      readiness_score: calculateReadiness(song),
      is_active: true,
      updated_at: new Date().toISOString()
    }));

    // CRITICAL: Use 'id' for renames. 
    // If id is missing, Supabase creates a new row, and the unique (user_id, title) 
    // constraint on the table ensures we don't accidentally create a title duplicate.
    const { error } = await supabase
      .from('repertoire')
      .upsert(payloads, { 
        onConflict: 'id' 
      });

    if (error) {
      console.error("[Sync Engine] Identity sync failed:", error);
    }
  } catch (err) {
    console.error("[Sync Engine] Critical failure:", err);
  }
};
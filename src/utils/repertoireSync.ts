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
 * Syncs songs to the master repertoire table and returns the updated songs with their DB IDs.
 * Identity is strictly controlled by the 'id' column to allow for renames.
 */
export const syncToMasterRepertoire = async (userId: string, songs: SetlistSong | SetlistSong[]): Promise<SetlistSong[]> => {
  if (!userId) return Array.isArray(songs) ? songs : [songs];
  
  const songsArray = Array.isArray(songs) ? songs : [songs];
  if (songsArray.length === 0) return [];

  try {
    const payloads = songsArray.map(song => ({
      // Identity Pivot: We only include the ID if it's a valid existing UUID.
      // This ensures that if we rename a song, the ID remains the anchor.
      ...(song.master_id && song.master_id.length > 20 ? { id: song.master_id } : {}),
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

    // HARD PIVOT: Target 'id' for conflict resolution.
    // This resolves the 'repertoire_pkey' conflict and supports renames.
    const { data, error } = await supabase
      .from('repertoire')
      .upsert(payloads, { 
        onConflict: 'id' 
      })
      .select();

    if (error) {
      console.error("[Sync Engine] Identity sync failed:", error);
      return songsArray;
    }

    // Map the DB IDs back to the local objects
    return songsArray.map(song => {
      // Find the match in the returned data based on the title we just sent
      const match = data?.find(d => d.title === song.name);
      if (match) {
        return { ...song, master_id: match.id };
      }
      return song;
    });
  } catch (err) {
    console.error("[Sync Engine] Critical failure:", err);
    return songsArray;
  }
};
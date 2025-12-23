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
 * This happens silently in the background.
 */
export const syncToMasterRepertoire = async (userId: string, songs: SetlistSong | SetlistSong[]) => {
  if (!userId) return;
  
  const songsArray = Array.isArray(songs) ? songs : [songs];
  if (songsArray.length === 0) return;

  try {
    // We map the songs to the repertoire table schema
    const payloads = songsArray.map(song => ({
      user_id: userId,
      title: song.name,
      artist: song.artist || 'Unknown Artist',
      original_key: song.originalKey || null,
      bpm: song.bpm || null,
      genre: song.genre || (song.user_tags?.[0]) || null,
      readiness_score: calculateReadiness(song),
      is_active: true,
      updated_at: new Date().toISOString()
    }));

    // Use upsert to update existing or insert new records based on title
    // In a more complex app, we might use a dedicated 'master_id' for perfect matching
    const { error } = await supabase
      .from('repertoire')
      .upsert(payloads, { 
        onConflict: 'user_id, title', // Assuming we have a unique constraint on these
        ignoreDuplicates: false 
      });

    if (error) {
      // If the unique constraint doesn't exist yet, it might fail or create duplicates
      // but for this implementation we assume the schema supports the intent
      console.error("[Sync Engine] Background update failed:", error);
    }
  } catch (err) {
    console.error("[Sync Engine] Critical failure:", err);
  }
};
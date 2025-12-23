"use client";

import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManager";

/**
 * Calculates a readiness score (0-100) based on available assets and personal comfort.
 * Comfort (1-10) now accounts for 40% of the total score.
 */
export const calculateReadiness = (song: Partial<SetlistSong>): number => {
  let score = 0;
  
  // Comfort Contribution (Max 40 points: 4 per level)
  const comfort = song.comfort_level || 0;
  score += (comfort * 4);

  const preview = song.previewUrl || "";
  const isItunes = preview.includes('apple.com') || preview.includes('itunes-assets');
  
  // Asset Contributions (Max 60 points)
  if (preview && !isItunes) score += 15; 
  if (song.isKeyConfirmed) score += 15; 
  if ((song.lyrics || "").length > 20) score += 10; 
  if (song.pdfUrl || song.leadsheetUrl) score += 10; 
  if (song.ugUrl) score += 5; 
  if (song.bpm) score += 5; 
  
  return Math.min(100, score);
};

/**
 * Synchronizes local setlist songs with the master repertoire table.
 */
export const syncToMasterRepertoire = async (userId: string, songs: SetlistSong | SetlistSong[]): Promise<SetlistSong[]> => {
  if (!userId) return Array.isArray(songs) ? songs : [songs];
  
  const songsArray = Array.isArray(songs) ? songs : [songs];
  if (songsArray.length === 0) return [];

  try {
    const payloads = songsArray.map(song => ({
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
      comfort_level: song.comfort_level || 0,
      duration_seconds: Math.round(song.duration_seconds || 0),
      genre: song.genre || (song.user_tags?.[0]) || null,
      user_tags: song.user_tags || [],
      resources: song.resources || [],
      readiness_score: calculateReadiness(song),
      is_active: true,
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('repertoire')
      .upsert(payloads, { onConflict: 'id' })
      .select('id, title, artist');

    if (error) throw error;

    return songsArray.map(song => {
      const dbMatch = data.find(d => 
        (song.master_id && d.id === song.master_id) || 
        (d.title === song.name && d.artist === (song.artist || 'Unknown Artist'))
      );
      return dbMatch ? { ...song, master_id: dbMatch.id } : song;
    });

  } catch (err) {
    console.error("[SYNC ENGINE] Batch sync failed:", err);
    return songsArray;
  }
};
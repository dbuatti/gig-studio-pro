"use client";

import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManager";

/**
 * Calculates a readiness score (0-100) based on available assets and metadata.
 * Updated logic for 100% readiness:
 * - Must be Confirmed for Set
 * - Must have Master Audio (not iTunes)
 * - Must have at least one Reading Source (PDF, Lead, or Pro Chords)
 * - Key must be Confirmed
 */
export const calculateReadiness = (song: Partial<SetlistSong>): number => {
  let score = 0;
  
  // 1. Audio Quality (Max 30)
  const preview = song.previewUrl || "";
  const isItunes = preview.includes('apple.com') || preview.includes('itunes-assets');
  if (preview && !isItunes) score += 30; 
  else if (preview && isItunes) score += 10;

  // 2. Harmonic Data (Max 25)
  if (song.isKeyConfirmed) score += 20; 
  if (song.bpm) score += 5;

  // 3. Performance Assets (Max 25) - Any one high quality source gives bulk
  const hasProChords = (song.chord_content || "").length > 50;
  const hasPdf = !!(song.pdfUrl || song.leadsheetUrl);
  const hasLyrics = (song.lyrics || "").length > 20;
  
  if (hasPdf || hasProChords) score += 20;
  else if (hasLyrics) score += 10;
  
  if (song.ugUrl) score += 5; // Bonus for backup link

  // 4. Verification & Metadata (Max 20)
  if (song.isMetadataConfirmed) score += 10;
  if (song.is_confirmed_for_set) score += 10;

  return Math.min(100, score);
};

/**
 * Synchronizes local setlist songs with the master repertoire table.
 */
export const syncToMasterRepertoire = async (userId: string, songs: SetlistSong | SetlistSong[]): Promise<SetlistSong[]> => {
  if (!userId) return Array.isArray(songs) ? songs : [songs];
  
  const songsArray = Array.isArray(songs) ? songs : [songs];
  if (songsArray.length === 0) return [];

  console.log(`[SYNC ENGINE] Processing ${songsArray.length} items...`);
  
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
      duration_seconds: Math.round(song.duration_seconds || 0),
      genre: song.genre || (song.user_tags?.[0]) || null,
      user_tags: song.user_tags || [],
      resources: song.resources || [],
      chord_content: song.chord_content || null,
      preferred_view: song.preferred_view || 'visualizer',
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
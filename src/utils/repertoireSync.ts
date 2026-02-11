"use client";

import { SetlistSong } from "@/components/SetlistManager";

/**
 * Calculates a readiness score (0-100) for a song based on available resources.
 */
export const calculateReadiness = (song: SetlistSong): number => {
  let score = 0;

  // 1. Metadata (20%)
  if (song.name && song.artist) score += 10;
  if (song.originalKey && song.originalKey !== 'TBC') score += 5;
  if (song.bpm) score += 5;

  // 2. Audio (30%)
  if (song.audio_url) {
    score += 30;
  } else if (song.previewUrl) {
    score += 15;
  }

  // 3. Charts & Lyrics (30%)
  const hasChart = !!(song.pdfUrl || song.leadsheetUrl || song.ugUrl || (song.ug_chords_text && song.ug_chords_text.trim().length > 0));
  if (hasChart) score += 20;
  if (song.lyrics && song.lyrics.length > 20) score += 10;

  // 4. Confirmation & Approval (20%)
  if (song.isKeyConfirmed) score += 10;
  if (song.isApproved) score += 10;

  return Math.min(score, 100);
};

/**
 * Syncs local song updates to the master repertoire in Supabase.
 */
export const syncToMasterRepertoire = async (userId: string, songs: Partial<SetlistSong>[]) => {
  const { supabase } = await import("@/integrations/supabase/client");
  
  const updates = songs.map(song => ({
    id: song.id,
    user_id: userId,
    title: song.name,
    artist: song.artist,
    original_key: song.originalKey,
    target_key: song.targetKey,
    pitch: song.pitch,
    bpm: song.bpm,
    genre: song.genre,
    notes: song.notes,
    lyrics: song.lyrics,
    is_metadata_confirmed: song.isMetadataConfirmed,
    is_key_confirmed: song.isKeyConfirmed,
    is_approved: song.isApproved,
    energy_level: song.energy_level,
    // Add other fields as necessary
  }));

  const { data, error } = await supabase
    .from('repertoire')
    .upsert(updates)
    .select();

  if (error) throw error;
  return data;
};
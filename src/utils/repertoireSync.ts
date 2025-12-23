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
 * Syncs songs to the master repertoire table.
 * Implements a "smart-match" logic:
 * 1. If we have a master_id, use it (allows renames).
 * 2. If no master_id, search for an existing record with the same title+artist.
 * 3. Only if no match is found, create a new record.
 */
export const syncToMasterRepertoire = async (userId: string, songs: SetlistSong | SetlistSong[]): Promise<SetlistSong[]> => {
  if (!userId) return Array.isArray(songs) ? songs : [songs];
  
  const songsArray = Array.isArray(songs) ? songs : [songs];
  if (songsArray.length === 0) return [];

  try {
    const results: SetlistSong[] = [];

    // Process songs sequentially to avoid race conditions with duplicate inserts
    for (const song of songsArray) {
      let targetId = song.master_id;

      // Fallback: If no master_id, try to find an existing record by title + artist
      if (!targetId || targetId.length < 20) {
        const { data: existing } = await supabase
          .from('repertoire')
          .select('id')
          .eq('user_id', userId)
          .eq('title', song.name)
          .eq('artist', song.artist || 'Unknown Artist')
          .maybeSingle();
        
        if (existing) {
          targetId = existing.id;
        }
      }

      const payload = {
        ...(targetId ? { id: targetId } : {}),
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
      };

      const { data, error } = await supabase
        .from('repertoire')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error(`[Sync Engine] Failed for "${song.name}":`, error);
        results.push(song);
      } else {
        results.push({ ...song, master_id: data.id });
      }
    }

    return results;
  } catch (err) {
    console.error("[Sync Engine] Critical failure:", err);
    return songsArray;
  }
};
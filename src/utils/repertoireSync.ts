"use client";

import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManager";

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

export const syncToMasterRepertoire = async (userId: string, songs: SetlistSong | SetlistSong[]): Promise<SetlistSong[]> => {
  if (!userId) return Array.isArray(songs) ? songs : [songs];
  
  const songsArray = Array.isArray(songs) ? songs : [songs];
  if (songsArray.length === 0) return [];

  console.group(`[SYNC ENGINE] Processing ${songsArray.length} items`);
  
  try {
    const results: SetlistSong[] = [];

    for (const song of songsArray) {
      console.log(`[SYNC: ${song.name}] Start. Current Master ID: ${song.master_id || 'NONE'}`);
      
      let targetId = song.master_id;

      // If we don't have a master_id, we MUST check if this title/artist already exists 
      // to avoid creating a duplicate if it's just a "re-import" or a song that lost its link.
      if (!targetId || targetId.length < 10) {
        console.log(`[SYNC: ${song.name}] No Master ID found. Searching DB for existing match...`);
        const { data: existing, error: searchError } = await supabase
          .from('repertoire')
          .select('id, title')
          .eq('user_id', userId)
          .eq('title', song.name)
          .eq('artist', song.artist || 'Unknown Artist')
          .maybeSingle();
        
        if (searchError) console.error(`[SYNC: ${song.name}] Search Error:`, searchError);
        
        if (existing) {
          console.log(`[SYNC: ${song.name}] Found existing entry in DB: ${existing.id}. Linking...`);
          targetId = existing.id;
        } else {
          console.log(`[SYNC: ${song.name}] No existing match in DB. A new record will be created.`);
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

      console.log(`[SYNC: ${song.name}] Executing UPSERT...`, { id: targetId, title: song.name });
      
      const { data, error } = await supabase
        .from('repertoire')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error(`[SYNC: ${song.name}] UPSERT FAILED:`, error);
        results.push(song);
      } else {
        console.log(`[SYNC: ${song.name}] SUCCESS. New/Confirmed Master ID: ${data.id}`);
        results.push({ ...song, master_id: data.id });
      }
    }

    console.groupEnd();
    return results;
  } catch (err) {
    console.error("[SYNC ENGINE] CRITICAL FAILURE:", err);
    console.groupEnd();
    return songsArray;
  }
};
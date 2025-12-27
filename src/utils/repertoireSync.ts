"use client";
import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManager";
import { DEFAULT_UG_CHORDS_CONFIG } from "./constants";

/**
 * Calculates a readiness score (0-100) based on available assets and metadata.
 * Now includes isApproved status as a key component for reaching 100%.
 */
export const calculateReadiness = (song: Partial<SetlistSong>): number => {
  let score = 0;
  const preview = song.previewUrl || "";
  const isItunes = preview.includes('apple.com') || preview.includes('itunes-assets');
  
  if (preview && !isItunes) score += 25;
  if (song.isKeyConfirmed) score += 15;
  if (song.isApproved) score += 20; // Approval is a major weight
  if ((song.lyrics || "").length > 20) score += 10;
  if (song.pdfUrl || song.leadsheetUrl) score += 10;
  if (song.ugUrl) score += 5;
  if (song.bpm) score += 5;
  if ((song.notes || "").length > 10) score += 5;
  if (song.artist && song.artist !== "Unknown Artist") score += 5;
  
  if (song.ug_chords_text && song.ug_chords_text.length > 10) score += 10;
  
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
      leadsheet_url: song.leadsheet_url || null,
      youtube_url: song.youtube_url || null,
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
      updated_at: new Date().toISOString(),
      ug_chords_text: song.ug_chords_text || null,
      ug_chords_config: song.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
      is_ug_chords_present: !!(song.ug_chords_text && song.ug_chords_text.trim().length > 0),
      is_pitch_linked: song.is_pitch_linked ?? true,
      highest_note_original: song.highest_note_original || null,
      is_approved: song.isApproved || false,
      // Sync tracking fields
      sync_status: (song as any).sync_status || 'IDLE',
      last_sync_log: (song as any).last_sync_log || null,
      auto_synced: (song as any).auto_synced || false,
      metadata_source: (song as any).metadata_source || null,
      // Maintenance fields
      extraction_status: (song as any).extraction_status || 'PENDING',
      source_type: (song as any).source_type || 'YOUTUBE'
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
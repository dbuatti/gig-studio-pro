"use client";

import { supabase } from "@/integrations/supabase/client";
import { SetlistSong } from "@/components/SetlistManager";
import { syncToMasterRepertoire } from "./repertoireSync";

/**
 * Automatically performs a vibe check for a song if it's missing energy data.
 */
export const autoVibeCheck = async (userId: string, song: Partial<SetlistSong>) => {
  if (!song.name || !song.artist) return null;

  try {
    const { data, error } = await supabase.functions.invoke('vibe-check', {
      body: {
        title: song.name,
        artist: song.artist,
        bpm: song.bpm,
        genre: song.genre,
        userTags: song.user_tags
      }
    });

    if (error) throw error;

    if (data?.energy_level) {
      const updates = {
        id: song.master_id || song.id,
        energy_level: data.energy_level,
        genre: data.refined_genre || song.genre
      };
      
      await syncToMasterRepertoire(userId, [updates]);
      return data;
    }
  } catch (err) {
    console.error("[autoVibeCheck] Failed:", err);
  }
  return null;
};
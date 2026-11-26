"use client";

import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess, showInfo } from "./toast";

/**
 * Identifies and removes duplicate song entries from a specific setlist.
 * Keeps the first occurrence (based on sort_order) and deletes the rest.
 */
export const cleanSetlistDuplicates = async (setlistId: string, setlistName: string) => {
  try {
    showInfo(`Cleaning duplicates in "${setlistName}"...`);

    // 1. Fetch all junction entries for this setlist
    const { data: junctions, error: fetchError } = await supabase
      .from('setlist_songs')
      .select('id, song_id, sort_order')
      .eq('setlist_id', setlistId)
      .order('sort_order', { ascending: true });

    if (fetchError) throw fetchError;
    if (!junctions || junctions.length === 0) return 0;

    // Fetch master repertoire titles so we can also collapse duplicate titles
    // (e.g. the same song added under two different repertoire records).
    const songIds = Array.from(new Set(junctions.map(j => j.song_id)));
    const { data: masterSongs } = await supabase
      .from('repertoire')
      .select('id, title, artist')
      .in('id', songIds);

    const masterMap = new Map((masterSongs || []).map(s => [s.id, s]));
    const normalize = (str?: string | null) =>
      (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    // 2. Identify duplicates by song_id AND by normalized title+artist.
    // Keeps the first occurrence (lowest sort_order) for each key.
    const seenKeys = new Set<string>();
    const duplicateIds: string[] = [];

    junctions.forEach(j => {
      const master = masterMap.get(j.song_id);
      const key = master?.title
        ? `${normalize(master.title)}|${normalize(master.artist)}`
        : `id:${j.song_id}`;

      if (seenKeys.has(key)) {
        duplicateIds.push(j.id);
      } else {
        seenKeys.add(key);
      }
    });

    if (duplicateIds.length === 0) {
      showSuccess(`No duplicates found in "${setlistName}".`);
      return 0;
    }

    // 3. Delete duplicates
    const { error: deleteError } = await supabase
      .from('setlist_songs')
      .delete()
      .in('id', duplicateIds);

    if (deleteError) throw deleteError;

    showSuccess(`Removed ${duplicateIds.length} duplicate entries from "${setlistName}".`);
    return duplicateIds.length;
  } catch (err: unknown) {
    console.error("[setlistCleanup] Error:", err);
    showError(`Cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
};

/**
 * Cleans duplicates across all setlists for the current user.
 */
export const cleanAllSetlists = async (userId: string) => {
  try {
    showInfo("Starting global setlist cleanup...");
    
    const { data: setlists, error: fetchError } = await supabase
      .from('setlists')
      .select('id, name')
      .eq('user_id', userId);

    if (fetchError) throw fetchError;
    if (!setlists) return;

    let totalRemoved = 0;
    for (const setlist of setlists) {
      const removed = await cleanSetlistDuplicates(setlist.id, setlist.name);
      totalRemoved += removed;
    }

    if (totalRemoved > 0) {
      showSuccess(`Global cleanup complete. Removed ${totalRemoved} total duplicates.`);
    } else {
      showSuccess("No duplicates found in any setlist.");
    }
  } catch (err: unknown) {
    showError(`Global cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
  }
};
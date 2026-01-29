"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong, Setlist } from '@/components/SetlistManager'; // Import SetlistSong and Setlist
import { showSuccess, showError } from '@/utils/toast';

export const useSetlist = (setlistId: string | null) => {
  const { user } = useAuth();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSetlist = useCallback(async () => {
    if (!user || !setlistId) {
      setSetlist(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: setlistData, error: setlistError } = await supabase
        .from('setlists')
        .select(`*, songs:setlist_songs(id, sort_order, is_confirmed, song_id, setlist_id)`)
        .eq('id', setlistId)
        .single();

      if (setlistError) throw setlistError;

      if (setlistData) {
        // Fetch repertoire details for songs in the setlist
        const songIds = setlistData.songs.map((s: any) => s.song_id).filter(id => id);
        let repertoireMap: Record<string, SetlistSong> = {};

        if (songIds.length > 0) {
          const { data: repertoireData, error: repertoireError } = await supabase
            .from('repertoire')
            .select('*')
            .in('id', songIds);
          
          if (repertoireError) throw repertoireError;

          repertoireData?.forEach((row: any) => {
            // Map repertoire data to SetlistSong structure (simplified for this context)
            repertoireMap[row.id] = {
              id: row.id, // Using repertoire ID as instance ID for now if not in setlist_songs
              master_id: row.id,
              name: row.title,
              artist: row.artist,
              originalKey: row.original_key,
              targetKey: row.target_key || row.original_key || 'C',
              pitch: row.pitch || 0,
              previewUrl: row.preview_url,
              audio_url: row.audio_url,
              youtubeUrl: row.youtube_url,
              ugUrl: row.ug_url,
              pdfUrl: row.pdf_url,
              isApproved: row.is_approved || false,
              isKeyConfirmed: row.is_key_confirmed || false,
              bpm: row.bpm,
              extraction_status: row.extraction_status || 'idle',
              is_ready_to_sing: row.is_ready_to_sing,
              // Add other required fields or defaults
            } as SetlistSong;
          });
        }

        const finalSongs: SetlistSong[] = setlistData.songs.map((s: any) => {
          const repertoireSong = repertoireMap[s.song_id];
          return {
            id: s.id, // Setlist_song ID
            isPlayed: s.isPlayed || false,
            isSyncing: false,
            isMetadataConfirmed: repertoireSong?.isMetadataConfirmed || false,
            isKeyConfirmed: repertoireSong?.isKeyConfirmed || false,
            pitch: repertoireSong?.pitch || 0,
            targetKey: repertoireSong?.targetKey || s.targetKey || 'C', // Fallback logic
            previewUrl: repertoireSong?.previewUrl || null,
            audio_url: repertoireSong?.audio_url || null,
            youtubeUrl: repertoireSong?.youtubeUrl || null,
            ugUrl: repertoireSong?.ugUrl || null,
            pdfUrl: repertoireSong?.pdfUrl || null,
            isApproved: repertoireSong?.isApproved || false,
            is_ready_to_sing: repertoireSong?.is_ready_to_sing,
            bpm: repertoireSong?.bpm || "120",
            name: repertoireSong?.name || "Unknown Song",
            artist: repertoireSong?.artist || "Unknown Artist",
            originalKey: repertoireSong?.originalKey || 'TBC',
            duration_seconds: repertoireSong?.duration_seconds || 210,
            // ... other fields needed for SetlistSong
            sort_order: s.sort_order,
            song_id: s.song_id,
            setlist_id: s.setlist_id,
          };
        });

        setSetlist({ ...setlistData, songs: finalSongs } as Setlist);
      } else {
        setSetlist(null);
      }
    } catch (error: any) {
      console.error("Error fetching setlist:", error);
      showError("Failed to load setlist data.");
    } finally {
      setIsLoading(false);
    }
  }, [setlistId, user]);

  useEffect(() => {
    fetchSetlist();
  }, [fetchSetlist]);

  const updateSetlistSongs = async (setlistId: string, songInstanceId: string, action: 'add' | 'remove', songData?: SetlistSong) => {
    if (!user) return;
    
    if (action === 'add' && songData) {
      // Add song instance to setlist_songs table, linking to repertoire master_id
      try {
        const { error } = await supabase
          .from('setlist_songs')
          .insert({
            setlist_id: setlistId,
            song_id: songData.master_id || songData.id, // Use master_id if available, otherwise use instance ID as song_id (if it's a new song)
            sort_order: setlist.songs.length,
            is_confirmed: false,
            isPlayed: false,
            // Copy key/pitch info from repertoire if available, otherwise default
            targetKey: songData.targetKey,
            pitch: songData.pitch,
          });
        if (error) throw error;
        showSuccess(`Song added to setlist.`);
        fetchSetlist(); // Refetch to update list
      } catch (err: any) {
        showError(`Failed to add song: ${err.message}`);
      }
    } else if (action === 'remove') {
      // Remove song instance from setlist_songs table
      try {
        const { error } = await supabase
          .from('setlist_songs')
          .delete()
          .eq('id', songInstanceId); // Assuming songInstanceId here is the setlist_songs PK
        if (error) throw error;
        showSuccess(`Song removed from setlist.`);
        fetchSetlist(); // Refetch to update list
      } catch (err: any) {
        showError(`Failed to remove song: ${err.message}`);
      }
    }
  };

  return { setlist, isLoading, updateSetlistSongs };
};
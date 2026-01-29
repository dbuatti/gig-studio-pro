"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/lib/database.types';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager'; // Import SetlistSong

export const useRepertoire = () => {
  const { user } = useAuth();
  const [repertoire, setRepertoire] = useState<SetlistSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRepertoire = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Map data to SetlistSong structure
      const mappedData: SetlistSong[] = (data || []).map((row: any) => ({
        id: row.id,
        master_id: row.id, // Repertoire ID is the master ID
        title: row.title || 'Untitled',
        artist: row.artist || 'Unknown Artist',
        originalKey: row.original_key,
        targetKey: row.target_key || row.original_key || 'C',
        pitch: row.pitch || 0,
        previewUrl: row.preview_url,
        audio_url: row.audio_url,
        extraction_status: row.extraction_status || 'idle',
        user_tags: row.user_tags || [],
        ugUrl: row.ug_url,
        pdfUrl: row.pdf_url,
        leadsheetUrl: row.leadsheet_url,
        sheet_music_url: row.sheet_music_url,
        ug_chords_text: row.ug_chords_text,
        ug_chords_config: row.ug_chords_config,
        key_preference: row.key_preference,
        isApproved: row.is_approved || false,
        is_ready_to_sing: row.is_ready_to_sing,
        highest_note_original: row.highest_note_original,
        // Include other fields present in SetlistSong structure for consistency
        name: row.title || 'Untitled',
        bpm: row.bpm,
        duration_seconds: row.duration_seconds || 180,
        isMetadataConfirmed: row.is_metadata_confirmed || false,
        isKeyConfirmed: row.is_key_confirmed || false,
        isPlayed: false,
        isSyncing: false,
        notes: row.notes,
        is_pitch_linked: row.is_pitch_linked ?? true,
        fineTune: row.fine_tune,
        tempo: row.tempo,
        volume: row.volume,
      }));

      setRepertoire(mappedData);
    } catch (e) {
      console.error("Error fetching repertoire:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRepertoire();
  }, [fetchRepertoire]);

  return { repertoire, isLoading, fetchRepertoire };
};
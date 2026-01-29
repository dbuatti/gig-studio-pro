"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/lib/database.types';
import { useAuth } from '@/components/AuthProvider';

// Mock type for Repertoire Song based on usage in SetlistManager.tsx
type RepertoireSong = Database['public']['Tables']['repertoire']['Row'] & {
  id: string;
  title: string;
  artist: string;
  original_key: string | null;
  bpm: string | null;
  duration_seconds: number;
  isMetadataConfirmed: boolean;
  isKeyConfirmed: boolean;
  pitch: number;
  targetKey: string;
  previewUrl: string | null;
  audio_url: string | null;
  extraction_status: 'idle' | 'PENDING' | 'queued' | 'processing' | 'completed' | 'failed' | null;
  user_tags: string[] | null;
  ugUrl: string | null;
  pdfUrl: string | null;
  leadsheetUrl: string | null;
  sheet_music_url: string | null;
  ug_chords_text: string | null;
  ug_chords_config: any | null;
  key_preference: 'sharps' | 'flats' | 'neutral' | null;
  isApproved: boolean;
  is_ready_to_sing: boolean | null;
  highest_note_original: string | null;
};

export const useRepertoire = () => {
  const { user } = useAuth();
  const [repertoire, setRepertoire] = useState<RepertoireSong[]>([]);
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
      
      // Mock mapping to satisfy expected structure in SetlistManager
      const mappedData: RepertoireSong[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title || 'Untitled',
        artist: row.artist || 'Unknown Artist',
        original_key: row.original_key,
        bpm: row.bpm,
        duration_seconds: row.duration_seconds || 180,
        isMetadataConfirmed: row.is_metadata_confirmed || false,
        isKeyConfirmed: row.is_key_confirmed || false,
        pitch: row.pitch || 0,
        targetKey: row.target_key || row.original_key || 'C',
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
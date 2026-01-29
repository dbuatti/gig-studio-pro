"use client";

import React from 'react';
import { Database } from '@/lib/database.types';

// --- MOCK TYPES ---
// Define SetlistSong based on usage across components (e.g., repertoire table structure + setlist song specific fields)
export type SetlistSong = Database['public']['Tables']['repertoire']['Row'] & {
  id: string; // Unique ID for this instance in the setlist/gig
  master_id?: string; // Reference to repertoire ID if applicable
  isPlayed: boolean;
  isSyncing: boolean;
  isMetadataConfirmed: boolean;
  isKeyConfirmed: boolean;
  pitch: number;
  targetKey: string;
  previewUrl: string | null;
  audio_url: string | null;
  youtubeUrl: string | null;
  ugUrl: string | null;
  appleMusicUrl: string | null;
  genre?: string | null;
  duration_seconds: number;
  notes: string | null;
  lyrics: string | null;
  resources: string[] | null;
  user_tags: string[] | null;
  pdfUrl: string | null;
  leadsheetUrl: string | null;
  sheet_music_url: string | null;
  ug_chords_text: string | null;
  ug_chords_config: any | null;
  key_preference: 'sharps' | 'flats' | 'neutral' | null;
  isApproved: boolean;
  is_ready_to_sing: boolean | null;
  highest_note_original: string | null;
  extraction_status: 'idle' | 'PENDING' | 'queued' | 'processing' | 'completed' | 'failed' | null;
  last_sync_log: string | null;
  fineTune?: number;
  tempo?: number;
  volume?: number;
};

export type Setlist = Database['public']['Tables']['setlists']['Row'] & {
    songs: SetlistSong[];
};

// Placeholder component for SetlistManager (as it seems to be used as an export container)
const SetlistManager: React.FC = () => {
    return <div className="p-4">Setlist Manager Placeholder</div>;
};

export default SetlistManager;
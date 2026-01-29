"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/lib/database.types';
import { useAuth } from '@/components/AuthProvider';
// Removed import { SetlistSong } from '@/components/SetlistManager'; // Removed problematic import

// Mock type for SetlistSong based on usage in SetlistManager.tsx
export type SetlistSong = {
  id: string;
  name: string;
  artist: string;
  originalKey: string | null;
  bpm: string | null;
  durationSeconds: number;
  isConfirmed: boolean;
  isPlayed: boolean;
  sort_order?: number; // Added sort_order for correct ordering logic
  // Add other necessary fields if needed for full functionality, though these seem sufficient for basic management
};

type MockSetlist = Database['public']['Tables']['setlists']['Row'] & {
    songs: MockSetlistSong[];
};

export const useSetlist = (setlistId: string | null) => {
  const { user } = useAuth();
  const [setlistSongs, setSetlistSongs] = useState<MockSetlistSong[]>([]);
  const [setlist, setSetlist] = useState<MockSetlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeGoal, setTimeGoal] = useState(7200); // Default 2 hours

  const fetchSetlist = useCallback(async () => {
    if (!user || !setlistId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: setlistData, error: sError } = await supabase
        .from('setlists')
        .select('*, songs:setlist_songs(id, name, artist, original_key, bpm, duration_seconds, is_confirmed, isPlayed, sort_order)') // Added sort_order here
        .eq('id', setlistId)
        .single();

      if (sError) throw sError;
      
      const fetchedSetlist = setlistData as unknown as MockSetlist;
      setSetlist(fetchedSetlist);
      setTimeGoal(fetchedSetlist.time_goal || 7200);
      
      // Map and sort songs if necessary
      const songs = fetchedSetlist.songs || [];
      setSetlistSongs(songs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));

    } catch (e) {
      console.error("Error fetching setlist:", e);
    } finally {
      setIsLoading(false);
    }
  }, [user, setlistId]);

  useEffect(() => {
    fetchSetlist();
  }, [fetchSetlist]);

  const updateSetlist = async (updates: Partial<MockSetlist>) => {
    if (!user || !setlistId) return;
    // Mock implementation: only update time goal if provided, otherwise assume array updates are handled elsewhere or via direct song manipulation
    if (updates.time_goal !== undefined) {
        setTimeGoal(updates.time_goal);
    }
    // In a real app, this would update the setlist table.
  };

  const addSongToSetlist = async (masterSongId: string, name: string, artist: string, originalKey: string | null, bpm: string | null, sortOrder: number) => {
    // Mock implementation: Add a simplified song structure
    const newSong: MockSetlistSong = {
        id: crypto.randomUUID(),
        name: name,
        artist: artist,
        originalKey: originalKey,
        bpm: bpm,
        durationSeconds: 210, // Default duration
        isConfirmed: false,
        isPlayed: false,
        sort_order: sortOrder, // Set initial sort order
    };
    setSetlistSongs(prev => [...prev, newSong].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
  };

  const removeSongFromSetlist = async (songId: string) => {
    setSetlistSongs(prev => prev.filter(s => s.id !== songId));
  };
  
  const reorderSongs = async (newOrder: MockSetlistSong[]) => {
    setSetlistSongs(newOrder);
    // In a real app, this would update sort_order in setlist_songs table
  };

  const updateSongInSetlist = async (songId: string, updates: Partial<MockSetlistSong>) => {
    setSetlistSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
  };

  const updateTimeGoal = async (seconds: number) => {
    setTimeGoal(seconds);
    if (setlistId) {
        await supabase.from('setlists').update({ time_goal: seconds }).eq('id', setlistId);
    }
  };

  return {
    setlistSongs,
    setlist,
    isLoading,
    updateSetlist,
    addSongToSetlist,
    removeSongFromSetlist,
    reorderSongs,
    updateSongInSetlist,
    timeGoal,
    updateTimeGoal,
  };
};
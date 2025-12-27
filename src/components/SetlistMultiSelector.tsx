"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { ListMusic, Check, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';

interface SetlistMultiSelectorProps {
  songMasterId: string;
  allSetlists: { id: string; name: string; songs: SetlistSong[] }[];
  songToAssign: SetlistSong; // The full song object from the studio
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
}

const SetlistMultiSelector: React.FC<SetlistMultiSelectorProps> = ({
  songMasterId,
  allSetlists,
  songToAssign,
  onUpdateSetlistSongs,
}) => {
  const [assignedSetlistIds, setAssignedSetlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('setlist_songs')
        .select('setlist_id')
        .eq('song_id', songMasterId);

      if (error) throw error;

      const currentAssignments = new Set(data.map(item => item.setlist_id));
      setAssignedSetlistIds(currentAssignments);
    } catch (err) {
      console.error("Failed to fetch setlist assignments:", err);
      showError("Failed to load setlist assignments.");
    } finally {
      setLoading(false);
    }
  }, [songMasterId]);

  useEffect(() => {
    if (songMasterId) {
      fetchAssignments();
    }
  }, [songMasterId, fetchAssignments]);

  const handleAssignmentChange = async (setlistId: string, isChecked: boolean) => {
    setLoading(true);
    try {
      if (isChecked) {
        // Add to setlist_songs junction table
        const { error } = await supabase
          .from('setlist_songs')
          .insert({ setlist_id: setlistId, song_id: songMasterId, sort_order: 0, is_confirmed: false }); // Default values
        if (error) throw error;
        setAssignedSetlistIds(prev => new Set(prev).add(setlistId));
        showSuccess(`Added to "${allSetlists.find(s => s.id === setlistId)?.name}"`);
        await onUpdateSetlistSongs(setlistId, songToAssign, 'add'); // Update the setlist's songs array
      } else {
        // Remove from setlist_songs junction table
        const { error } = await supabase
          .from('setlist_songs')
          .delete()
          .eq('setlist_id', setlistId)
          .eq('song_id', songMasterId);
        if (error) throw error;
        setAssignedSetlistIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(setlistId);
          return newSet;
        });
        showSuccess(`Removed from "${allSetlists.find(s => s.id === setlistId)?.name}"`);
        await onUpdateSetlistSongs(setlistId, songToAssign, 'remove'); // Update the setlist's songs array
      }
    } catch (err: any) {
      console.error("Failed to update setlist assignment:", err);
      showError(`Failed to update assignment: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const assignedCount = assignedSetlistIds.size;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={loading}
          className={cn(
            "h-11 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 px-6 transition-all shadow-lg",
            assignedCount > 0
              ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
              : "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10"
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            assignedCount > 0 ? <Check className="w-4 h-4" /> : <ListMusic className="w-4 h-4" />
          )}
          {assignedCount > 0 ? `ASSIGNED TO ${assignedCount} GIGS` : "ADD TO SETLISTS"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-slate-950 border-white/10 text-white rounded-xl p-2">
        <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">
          Assign to Gigs
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5" />
        {allSetlists.length === 0 ? (
          <p className="text-xs text-slate-500 px-3 py-2">No setlists available.</p>
        ) : (
          allSetlists.map((setlist) => (
            <DropdownMenuCheckboxItem
              key={setlist.id}
              checked={assignedSetlistIds.has(setlist.id)}
              onCheckedChange={(checked) => handleAssignmentChange(setlist.id, checked)}
              className="text-xs font-bold uppercase h-10 rounded-xl hover:bg-white/10"
              disabled={loading}
            >
              {setlist.name}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SetlistMultiSelector;
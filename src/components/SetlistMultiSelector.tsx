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
import { ListMusic, Check, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';

interface SetlistMultiSelectorProps {
  songMasterId: string; 
  allSetlists: { id: string; name: string; songs: SetlistSong[] }[];
  songToAssign: SetlistSong | null; 
  onUpdateSetlistSongs?: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
}

// Helper to validate UUID
const isValidUuid = (uuid: string | undefined | null): boolean => {
  if (!uuid) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(uuid);
};

const SetlistMultiSelector: React.FC<SetlistMultiSelectorProps> = ({
  songMasterId, 
  allSetlists,
  songToAssign,
  onUpdateSetlistSongs,
}) => {
  const [assignedSetlistIds, setAssignedSetlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const repertoireDbId = songToAssign?.master_id || songToAssign?.id; 
  const isRepertoireSongValid = isValidUuid(repertoireDbId);

  const fetchAssignments = useCallback(async () => {
    if (!isRepertoireSongValid || !repertoireDbId) {
      setAssignedSetlistIds(new Set()); 
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('setlist_songs')
        .select('setlist_id')
        .eq('song_id', repertoireDbId);

      if (error) {
        // Check for network/CORS errors specifically
        if (error.message.includes('Failed to fetch')) {
          console.error("Network/CORS error during assignment fetch. Supabase API might be down or blocked.");
        }
        throw error;
      }

      const currentAssignments = new Set(data.map(item => item.setlist_id));
      setAssignedSetlistIds(currentAssignments);
    } catch (err) {
      // Error handled by toast in parent component
    } finally {
      setLoading(false);
    }
  }, [repertoireDbId, isRepertoireSongValid]);

  useEffect(() => {
    if (repertoireDbId) { 
      fetchAssignments();
    }
  }, [repertoireDbId, fetchAssignments]);

  const handleAssignmentChange = async (setlistId: string, isChecked: boolean) => {
    if (!isRepertoireSongValid || !repertoireDbId) {
      showError("Cannot assign: Song ID is invalid.");
      return;
    }

    setLoading(true);
    try {
      if (isChecked) {
        const { error } = await supabase
          .from('setlist_songs')
          .insert({ setlist_id: setlistId, song_id: repertoireDbId, sort_order: 0, is_confirmed: false }); 
        if (error) throw error;
        setAssignedSetlistIds(prev => new Set(prev).add(setlistId));
        showSuccess(`Added to "${allSetlists.find(s => s.id === setlistId)?.name}"`);
        
        // Defensive check before calling update callback
        if (typeof onUpdateSetlistSongs === 'function') {
          await onUpdateSetlistSongs(setlistId, songToAssign!, 'add');
        }
      } else {
        const { error } = await supabase
          .from('setlist_songs')
          .delete()
          .eq('setlist_id', setlistId)
          .eq('song_id', repertoireDbId); 
        if (error) throw error;
        setAssignedSetlistIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(setlistId);
          return newSet;
        });
        showSuccess(`Removed from "${allSetlists.find(s => s.id === setlistId)?.name}"`);
        
        // Defensive check before calling update callback
        if (typeof onUpdateSetlistSongs === 'function') {
          await onUpdateSetlistSongs(setlistId, songToAssign!, 'remove');
        }
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
          disabled={loading || !isRepertoireSongValid}
          className={cn(
            "h-11 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 px-6 transition-all shadow-lg",
            assignedCount > 0
              ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
              : "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10",
            !isRepertoireSongValid && "opacity-50 cursor-not-allowed" 
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            isRepertoireSongValid ? (
              assignedCount > 0 ? <Check className="w-4 h-4" /> : <ListMusic className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )
          )}
          {isRepertoireSongValid ? (
            assignedCount > 0 ? `ASSIGNED TO ${assignedCount} GIGS` : "ADD TO SETLISTS"
          ) : (
            "INVALID SONG ID"
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-slate-950 border-white/10 text-white rounded-xl p-2">
        <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">
          Assign to Gigs
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5" />
        {!isRepertoireSongValid ? (
          <p className="text-xs text-red-500 px-3 py-2">Cannot assign: Song ID is invalid.</p>
        ) : allSetlists.length === 0 ? (
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
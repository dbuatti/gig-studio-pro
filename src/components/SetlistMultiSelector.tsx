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
import { SetlistSong } from './SetlistManagementModal';
import { cn } from '@/lib/utils';

interface SetlistMultiSelectorProps {
  songMasterId: string;
  allSetlists: { id: string; name: string; songs: SetlistSong[] }[];
  songToAssign: SetlistSong;
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
}

const SetlistMultiSelector: React.FC<SetlistMultiSelectorProps> = ({
  songMasterId,
  allSetlists,
  songToAssign,
  onUpdateSetlistSongs,
}) => {
  const [open, setOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isSongInSetlist = (setlistId: string) => {
    const setlist = allSetlists.find(l => l.id === setlistId);
    if (!setlist) return false;
    // Check if the song exists in the setlist using its master_id or its temporary ID if it's a new song in the setlist
    return setlist.songs.some(s => s.master_id === songMasterId || s.id === songToAssign.id);
  };

  const handleCheckboxChange = useCallback(async (setlistId: string, checked: boolean) => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const setlist = allSetlists.find(l => l.id === setlistId);
      if (!setlist) throw new Error("Setlist not found.");

      if (checked) {
        // Add song to setlist
        await onUpdateSetlistSongs(setlistId, songToAssign, 'add');
      } else {
        // Remove song from setlist
        await onUpdateSetlistSongs(setlistId, songToAssign, 'remove');
      }
      setOpen(true); // Keep dropdown open after successful update
    } catch (err: any) {
      showError(`Failed to update setlist: ${err.message}`);
      setOpen(true); // Keep dropdown open on error
    } finally {
      setIsUpdating(false);
    }
  }, [isUpdating, allSetlists, songToAssign, onUpdateSetlistSongs]);

  const activeSetlistsCount = allSetlists.filter(l => isSongInSetlist(l.id)).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          disabled={isUpdating}
        >
          {activeSetlistsCount > 0 ? <Check className="w-4 h-4 text-indigo-600" /> : <Plus className="w-4 h-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-popover border-border text-foreground rounded-xl p-2">
        <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">
          Assign to Setlist ({activeSetlistsCount}/{allSetlists.length})
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        {isUpdating && (
          <div className="flex items-center gap-2 p-3 text-indigo-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-bold">Updating...</span>
          </div>
        )}
        {allSetlists.map((setlist) => (
          <DropdownMenuCheckboxItem
            key={setlist.id}
            checked={isSongInSetlist(setlist.id)}
            onCheckedChange={(checked) => handleCheckboxChange(setlist.id, checked)}
            disabled={isUpdating}
            className="text-xs font-bold uppercase h-10 rounded-lg px-3"
          >
            {setlist.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SetlistMultiSelector;
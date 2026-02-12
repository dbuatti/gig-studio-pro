"use client";

import React from 'react';
import { Check, ListPlus, Loader2 } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Setlist, SetlistSong } from './SetlistManager';

interface SetlistMultiSelectorProps {
  songMasterId: string;
  allSetlists: Setlist[];
  songToAssign: SetlistSong;
  onUpdateSetlistSongs: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  className?: string;
}

const SetlistMultiSelector: React.FC<SetlistMultiSelectorProps> = ({
  songMasterId,
  allSetlists,
  songToAssign,
  onUpdateSetlistSongs,
  className
}) => {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const handleToggle = async (setlistId: string, isInSetlist: boolean) => {
    setLoadingId(setlistId);
    try {
      await onUpdateSetlistSongs(setlistId, songToAssign, isInSetlist ? 'remove' : 'add');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all", className)}
        >
          <ListPlus className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-2 rounded-2xl bg-slate-950 border-white/10 shadow-2xl backdrop-blur-xl z-[60]">
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-3 py-2">
          Assign to Setlists
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5 mx-1" />
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-1">
          {allSetlists.map((setlist) => {
            const isInSetlist = setlist.songs.some(s => s.master_id === songMasterId || s.id === songMasterId);
            const isLoading = loadingId === setlist.id;

            return (
              <DropdownMenuItem 
                key={setlist.id}
                onSelect={(e) => {
                  e.preventDefault();
                  handleToggle(setlist.id, isInSetlist);
                }}
                className="h-11 rounded-xl text-[11px] font-bold uppercase tracking-tight flex items-center justify-between group cursor-pointer px-3 mb-1 last:mb-0"
              >
                <span className={cn("truncate transition-colors", isInSetlist ? "text-indigo-400" : "text-slate-300 group-hover:text-white")}>
                  {setlist.name}
                </span>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                ) : isInSetlist ? (
                  <div className="h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    <Check className="w-3 h-3" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-lg border-2 border-white/10 bg-black/20 group-hover:border-indigo-500/50 transition-colors" />
                )}
              </DropdownMenuItem>
            );
          })}
          {allSetlists.length === 0 && (
            <div className="px-4 py-6 text-[10px] font-bold text-slate-600 uppercase tracking-widest text-center italic">
              No active setlists found
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SetlistMultiSelector;
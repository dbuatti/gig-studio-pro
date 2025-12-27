"use client";

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Library, Plus, Check, Music, 
  ShieldCheck, Star, X, Filter 
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { cn } from "@/lib/utils";
import { formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';

interface RepertoirePickerProps {
  isOpen: boolean;
  onClose: () => void;
  repertoire: SetlistSong[];
  currentSetlistSongs: SetlistSong[];
  onAdd: (song: SetlistSong) => void;
}

const RepertoirePicker: React.FC<RepertoirePickerProps> = ({ 
  isOpen, 
  onClose, 
  repertoire, 
  currentSetlistSongs,
  onAdd 
}) => {
  const { keyPreference } = useSettings();
  const [query, setQuery] = useState("");
  const [filterReady, setFilterReady] = useState(false);

  const existingIds = useMemo(() => 
    new Set(currentSetlistSongs.map(s => s.master_id || s.id)), 
  [currentSetlistSongs]);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    return repertoire.filter(song => {
      const matchesSearch = song.name.toLowerCase().includes(q) || 
                            song.artist?.toLowerCase().includes(q);
      
      if (!matchesSearch) return false;
      if (filterReady && calculateReadiness(song) < 100) return false;
      
      return true;
    }).sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
  }, [repertoire, query, filterReady]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-indigo-600 shrink-0 relative">
          {/* Removed redundant close button here */}
          
          <DialogHeader className="text-center"> {/* Added text-center */}
            <div className="flex items-center justify-center gap-3 mb-2"> {/* Added justify-center */}
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Library className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Repertoire Browser</DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 font-medium">
              Push songs from your master library into your active gig.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
              <Input 
                placeholder="Search master repertoire..." 
                className="bg-white/10 border-white/20 text-white placeholder:text-indigo-200 h-12 pl-10 rounded-xl focus-visible:ring-white/30"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button 
              variant="outline"
              onClick={() => setFilterReady(!filterReady)}
              className={cn(
                "h-12 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 transition-all",
                filterReady ? "bg-emerald-500 border-emerald-400 text-white" : "bg-white/10 border-white/20 text-white hover:bg-white/20"
              )}
            >
              <ShieldCheck className="w-4 h-4" /> 
              {filterReady ? "READY ONLY" : "ALL TRACKS"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-900/50 flex flex-col"> {/* Added flex flex-col */}
          <ScrollArea className="h-full">
            <div className="p-6 space-y-2">
              {filteredItems.length > 0 ? (
                filteredItems.map((song) => {
                  const isAdded = existingIds.has(song.master_id || song.id);
                  const readiness = calculateReadiness(song);
                  const displayKey = formatKey(song.targetKey || song.originalKey, keyPreference);

                  return (
                    <div 
                      key={song.id}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl transition-all border group",
                        isAdded 
                          ? "bg-indigo-600/5 border-indigo-500/20 opacity-60" 
                          : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10"
                      )}
                    >
                      <div className="bg-slate-800 p-2.5 rounded-xl text-slate-500 shrink-0">
                        <Music className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm uppercase tracking-tight truncate">{song.name}</h4>
                          {readiness === 100 && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{song.artist}</p>
                      </div>

                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Readiness</p>
                          <p className={cn(
                            "text-[10px] font-mono font-black",
                            readiness >= 90 ? "text-emerald-400" : "text-indigo-400"
                          )}>{readiness}%</p>
                        </div>
                        
                        <div className="h-8 w-px bg-white/5 hidden sm:block" />
                        
                        <div className="text-center min-w-[40px]">
                           <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Key</p>
                           <span className="text-[10px] font-mono font-bold text-slate-400">{displayKey}</span>
                        </div>

                        <Button 
                          size="sm"
                          disabled={isAdded}
                          onClick={() => onAdd(song)}
                          className={cn(
                            "h-10 w-10 p-0 rounded-xl transition-all active:scale-95",
                            isAdded 
                              ? "bg-emerald-500/20 text-emerald-500" 
                              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20"
                          )}
                        >
                          {isAdded ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center opacity-30">
                  <Library className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest">No Library Matches</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        
        <div className="p-6 border-t border-white/5 bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Master Repertoire Engine v4.0</span>
          </div>
          <p className="text-[9px] font-mono text-slate-600 uppercase">Selected: {existingIds.size} Tracks</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RepertoirePicker;
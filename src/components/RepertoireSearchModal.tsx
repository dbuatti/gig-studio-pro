"use client";

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Library, Music, Check, X, Star, ShieldCheck, CloudDownload, AlertTriangle, ListMusic } from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { cn } from "@/lib/utils";
import { formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; 

interface RepertoireSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterRepertoire: SetlistSong[]; 
  currentSetlistSongs: SetlistSong[]; 
  onSelectSong: (song: SetlistSong) => void;
}

const RepertoireSearchModal: React.FC<RepertoireSearchModalProps> = ({
  isOpen,
  onClose,
  masterRepertoire, 
  currentSetlistSongs, 
  onSelectSong,
}) => {
  const { keyPreference } = useSettings();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'repertoire' | 'this-set'>('repertoire'); 

  const songsToDisplay = useMemo(() => {
    return activeTab === 'repertoire' ? masterRepertoire : currentSetlistSongs;
  }, [activeTab, masterRepertoire, currentSetlistSongs]);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    return songsToDisplay.filter(song =>
      (song.name || "").toLowerCase().includes(q) ||
      (song.artist || "").toLowerCase().includes(q)
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [songsToDisplay, query]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] bg-popover border-border text-foreground rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-indigo-600 shrink-0 relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tight text-white mb-2">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Library className="w-6 h-6 text-white" />
              </div>
              Repertoire Browser
            </DialogTitle>
            <DialogDescription className="text-indigo-100 font-medium">
              Search and select any track from your master library.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-3 mt-6"> 
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
              <Input
                autoFocus
                placeholder="Search repertoire..."
                className="bg-white/10 border-white/20 text-white placeholder:text-indigo-200 h-12 pl-10 rounded-xl focus-visible:ring-white/30"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'repertoire' | 'this-set')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-10 bg-white/10 p-1 rounded-xl">
                <TabsTrigger value="repertoire" className="text-sm font-black uppercase tracking-tight gap-2 h-8 rounded-lg">
                  <Library className="w-4 h-4" /> Repertoire
                </TabsTrigger>
                <TabsTrigger 
                  value="this-set" 
                  disabled={currentSetlistSongs.length === 0} 
                  className="text-sm font-black uppercase tracking-tight gap-2 h-8 rounded-lg"
                >
                  <ListMusic className="w-4 h-4" /> This Set
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-secondary flex flex-col min-h-0"> 
          <ScrollArea className="h-full">
            <div className="p-6 space-y-2">
              {filteredItems.length > 0 ? (
                filteredItems.map((song) => {
                  const readiness = calculateReadiness(song);
                  const displayKey = formatKey(song.targetKey || song.originalKey, keyPreference);
                  const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
                  const isExtractionFailed = song.extraction_status === 'failed';

                  return (
                    <div 
                      key={song.id}
                      onClick={() => onSelectSong(song)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all border group bg-card border-border hover:border-border/50 hover:bg-accent dark:hover:bg-secondary text-left cursor-pointer"
                    >
                      <div className="bg-secondary p-2.5 rounded-xl text-muted-foreground shrink-0">
                        <Music className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0 max-w-[60%]"> 
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm uppercase tracking-tight truncate line-clamp-1 text-foreground flex-1 min-w-0">{song.name}</h4>
                          {readiness === 100 && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                          {isProcessing && <CloudDownload className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />}
                          {isExtractionFailed && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate line-clamp-1 flex-1 min-w-0">{song.artist}</p>
                        {isExtractionFailed && song.last_sync_log && (
                          <p className="text-[8px] text-destructive mt-1 truncate max-w-[150px]">Error: {song.last_sync_log}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Readiness</p>
                          <p className={cn(
                            "text-[10px] font-mono font-black",
                            readiness >= 90 ? "text-emerald-400" : "text-indigo-400"
                          )}>{readiness}%</p>
                        </div>
                        
                        <div className="h-8 w-px bg-border hidden sm:block" />
                        
                        <div className="text-center min-w-[40px]">
                           <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Key</p>
                           <span className="text-[10px] font-mono font-bold text-muted-foreground">{displayKey}</span>
                        </div>

                        <Button
                          size="sm"
                          className="h-10 w-10 p-0 rounded-xl transition-all active:scale-95 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20"
                        >
                          <Check className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center opacity-30">
                  <Library className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">No Library Matches</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        
        <div className="p-6 border-t border-border bg-secondary flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Master Repertoire Engine v4.0</span>
          </div>
          <p className="text-[9px] font-mono text-muted-foreground uppercase">Total: {songsToDisplay.length} Tracks</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RepertoireSearchModal;
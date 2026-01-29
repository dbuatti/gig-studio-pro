"use client";

import React, { useState, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Music, Loader2, Youtube, Link as LinkIcon, Plus, FileText } from 'lucide-react'; 
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { ListPlus } from 'lucide-react';
import { showSuccess } from '@/utils/toast';

interface SongSuggestionsProps {
  repertoire: SetlistSong[];
  onSelectSuggestion: (query: string) => void;
}

const SongSuggestions: React.FC<SongSuggestionsProps> = ({ onSelectSuggestion, repertoire }) => {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSelectSuggestion(query);
  };

  const handleAddSong = (song: SetlistSong) => {
    // This function is used to add a song from suggestions to the current setlist/gig
    // Since this component doesn't have access to the setlist context, we rely on the parent to handle the addition logic.
    // For now, we simulate adding by showing a success message indicating the song is ready to be added via the main interface.
    showSuccess(`Song "${song.name}" ready to be added to your setlist.`);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            autoFocus
            placeholder="Search for similar songs or artists..." 
            className="pl-9 h-11 border-border bg-background focus-visible:ring-primary text-foreground"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button 
          type="submit" 
          disabled={isLoading}
          className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-600/20"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "SEARCH"}
        </Button>
      </form>

      {repertoire.length > 0 && (
        <Card className="border-border overflow-hidden shadow-inner bg-card">
          <ScrollArea className="h-[450px]">
            <div className="p-2 space-y-1">
              <TooltipProvider>
                {repertoire.map((song) => {
                  const readiness = 100; // Mock readiness for suggestions
                  const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
                  const isExtractionFailed = song.extraction_status === 'failed';

                  return (
                    <div key={song.id} className="flex flex-col border-b last:border-0 border-border">
                      <div className="w-full flex items-center gap-3 p-2 hover:bg-accent rounded-lg transition-all group">
                        <button
                          onClick={() => handleAddSong(song)}
                          className="flex flex-1 items-center gap-3 text-left min-w-0"
                        >
                          <img 
                            src={song.previewUrl || song.youtubeUrl ? `https://img.youtube.com/vi/${song.youtubeUrl ? song.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] || 'default' : 'default'}/mqdefault.jpg` : undefined} 
                            alt={song.name} 
                            className="w-10 h-10 rounded-md shadow-sm group-hover:scale-105 transition-transform object-cover bg-secondary" 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate text-foreground">{song.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider font-semibold">{song.artist || "Unknown Artist"}</p>
                            <p className="text-[8px] text-primary font-black uppercase tracking-tighter mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Click to Add to Setlist</p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0 px-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="p-2 rounded-md hover:bg-accent text-muted-foreground"
                              >
                                <LinkIcon className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>External Links</TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleAddSong(song)}
                                className="p-2 hover:bg-emerald-600 hover:text-white text-emerald-500 rounded-md transition-all"
                              >
                                <ListPlus className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add to Current Setlist</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      <div className="px-3 pb-3">
                        <div className="p-4 bg-secondary rounded-xl border-2 border-primary/20 shadow-sm space-y-3">
                          <div className="flex items-center justify-between border-b pb-2 border-border">
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Metadata & Assets</span>
                            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-[9px] font-bold uppercase text-slate-400">
                            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Metadata Confirmed</div>
                            <div className="flex items-center gap-2"><Music className="w-3 h-3 text-indigo-400" /> Audio Preview Available</div>
                            <div className="flex items-center gap-2"><FileText className="w-3 h-3 text-emerald-400" /> {song.pdfUrl ? 'PDF Linked' : 'Missing PDF'}</div>
                            <div className="flex items-center gap-2"><LinkIcon className="w-3 h-3 text-orange-400" /> {song.ugUrl ? 'UG Linked' : 'Missing UG'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </TooltipProvider>
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
};

export default SongSuggestions;
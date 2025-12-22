"use client";

import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Music, Loader2, Youtube, ExternalLink, Link as LinkIcon, Check } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SongSearchProps {
  onSelectSong: (url: string, name: string, youtubeUrl?: string) => void;
}

const SongSearch: React.FC<SongSearchProps> = ({ onSelectSong }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandingId, setExpandingId] = useState<number | null>(null);
  const [ytLink, setYtLink] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setExpandingId(null);
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getYoutubeSearchUrl = (track: string, artist: string) => {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(artist + " " + track + " official video")}`;
  };

  const toggleExpand = (id: number) => {
    setExpandingId(expandingId === id ? null : id);
    setYtLink("");
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search for a song or artist..." 
            className="pl-9 h-11 border-indigo-100 focus-visible:ring-indigo-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button 
          type="submit" 
          disabled={isLoading}
          className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {results.length > 0 && (
        <Card className="border-indigo-50 overflow-hidden">
          <ScrollArea className="h-[350px]">
            <div className="p-2 space-y-1">
              <TooltipProvider>
                {results.map((song) => (
                  <div key={song.trackId} className="flex flex-col border-b last:border-0 border-slate-50">
                    <div className="w-full flex items-center gap-3 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors group">
                      <button
                        onClick={() => onSelectSong(song.previewUrl, `${song.trackName} - ${song.artistName}`)}
                        className="flex flex-1 items-center gap-3 text-left min-w-0"
                      >
                        <img 
                          src={song.artworkUrl60} 
                          alt={song.trackName} 
                          className="w-10 h-10 rounded shadow-sm group-hover:scale-105 transition-transform" 
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{song.trackName}</p>
                          <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">{song.artistName}</p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0 px-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={() => toggleExpand(song.trackId)}
                              className={cn(
                                "p-2 rounded-md transition-colors",
                                expandingId === song.trackId ? "bg-red-500 text-white" : "hover:bg-red-50 text-red-500"
                              )}
                            >
                              <Youtube className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Associate with YouTube Video</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a 
                              href={song.trackViewUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-indigo-50 text-indigo-500 rounded-md transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>View on Apple Music</TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onSelectSong(song.previewUrl, `${song.trackName} - ${song.artistName}`)}
                              className="p-2 hover:bg-indigo-600 hover:text-white text-indigo-400 rounded-md transition-all"
                            >
                              <Music className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Load Studio Engine</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {expandingId === song.trackId && (
                      <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-red-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Visual Reference Engine</span>
                            <a 
                              href={getYoutubeSearchUrl(song.trackName, song.artistName)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-1"
                            >
                              Open Search <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <Input 
                                placeholder="Paste YouTube Link here..." 
                                className="h-9 pl-8 text-xs bg-white"
                                value={ytLink}
                                onChange={(e) => setYtLink(e.target.value)}
                              />
                            </div>
                            <Button 
                              size="sm"
                              disabled={!ytLink}
                              onClick={() => {
                                onSelectSong(song.previewUrl, `${song.trackName} - ${song.artistName}`, ytLink);
                                setExpandingId(null);
                              }}
                              className="bg-red-600 hover:bg-red-700 h-9"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-[9px] text-muted-foreground italic leading-tight">
                            YouTube audio cannot be pitch-shifted directly. This will embed the video as a visual guide while transposing the high-quality preview.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </TooltipProvider>
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
};

export default SongSearch;
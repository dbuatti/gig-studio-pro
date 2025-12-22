"use client";

import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Music, Loader2, Youtube, ExternalLink } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface SongSearchProps {
  onSelectSong: (url: string, name: string) => void;
}

const SongSearch: React.FC<SongSearchProps> = ({ onSelectSong }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
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
          <ScrollArea className="h-[320px]">
            <div className="p-2 space-y-1">
              <TooltipProvider>
                {results.map((song) => (
                  <div 
                    key={song.trackId}
                    className="w-full flex items-center gap-3 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors group"
                  >
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
                          <a 
                            href={getYoutubeSearchUrl(song.trackName, song.artistName)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-red-50 text-red-500 rounded-md transition-colors"
                          >
                            <Youtube className="w-4 h-4" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>Find official video on YouTube</TooltipContent>
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
                        <TooltipContent>Load preview into Transposer</TooltipContent>
                      </Tooltip>
                    </div>
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
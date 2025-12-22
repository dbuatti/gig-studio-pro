"use client";

import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Music, Loader2 } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=8`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsLoading(false);
    }
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
          <ScrollArea className="h-[280px]">
            <div className="p-2 space-y-1">
              {results.map((song) => (
                <button
                  key={song.trackId}
                  onClick={() => onSelectSong(song.previewUrl, `${song.trackName} - ${song.artistName}`)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors text-left group"
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
                  <Music className="w-4 h-4 text-indigo-200 group-hover:text-indigo-500 transition-colors" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
};

export default SongSearch;
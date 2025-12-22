"use client";

import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Music, Loader2, Youtube, ExternalLink, Link as LinkIcon, Check, PlayCircle, AlertCircle, RefreshCw } from 'lucide-react';
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
  
  const [ytSearchLoading, setYtSearchLoading] = useState(false);
  const [ytResults, setYtResults] = useState<any[]>([]);
  const [ytError, setYtError] = useState(false);

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

  const fetchYoutubeResults = async (track: string, artist: string) => {
    setYtSearchLoading(true);
    setYtResults([]);
    setYtError(false);
    
    // Expanded list of public instances to bypass potential CORS/downtime
    const instances = [
      'https://iv.ggtyler.dev',
      'https://invidious.flokinet.to',
      'https://invidious.projectsegfau.lt',
      'https://yewtu.be',
      'https://inv.vern.cc'
    ];

    let success = false;
    for (const instance of instances) {
      if (success) break;
      try {
        const searchQuery = encodeURIComponent(`${artist} ${track} official music video`);
        // We add a timeout to each fetch to keep the UI responsive
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(`${instance}/api/v1/search?q=${searchQuery}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) continue;
        
        const data = await response.json();
        const videos = data.filter((item: any) => item.type === "video").slice(0, 3);
        
        if (videos.length > 0) {
          setYtResults(videos);
          success = true;
        }
      } catch (err) {
        console.warn(`Instance ${instance} failed or timed out, trying next...`);
      }
    }

    if (!success) setYtError(true);
    setYtSearchLoading(false);
  };

  const toggleExpand = (song: any) => {
    if (expandingId === song.trackId) {
      setExpandingId(null);
    } else {
      setExpandingId(song.trackId);
      fetchYoutubeResults(song.trackName, song.artistName);
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
          className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 font-bold uppercase tracking-wider text-xs"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {results.length > 0 && (
        <Card className="border-indigo-50 overflow-hidden shadow-inner bg-slate-50/30">
          <ScrollArea className="h-[400px]">
            <div className="p-2 space-y-1">
              <TooltipProvider>
                {results.map((song) => (
                  <div key={song.trackId} className="flex flex-col border-b last:border-0 border-slate-100 dark:border-slate-800">
                    <div className="w-full flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-indigo-950/30 rounded-lg transition-all group">
                      <button
                        onClick={() => onSelectSong(song.previewUrl, `${song.trackName} - ${song.artistName}`)}
                        className="flex flex-1 items-center gap-3 text-left min-w-0"
                      >
                        <img 
                          src={song.artworkUrl60} 
                          alt={song.trackName} 
                          className="w-10 h-10 rounded-md shadow-sm group-hover:scale-105 transition-transform" 
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{song.trackName}</p>
                          <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider font-semibold">{song.artistName}</p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0 px-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={() => toggleExpand(song)}
                              className={cn(
                                "p-2 rounded-md transition-all",
                                expandingId === song.trackId ? "bg-red-600 text-white shadow-lg rotate-90" : "hover:bg-red-50 text-red-500"
                              )}
                            >
                              <Youtube className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Associate YouTube Video</TooltipContent>
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
                          <TooltipContent>Load High-Fidelity Preview</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {expandingId === song.trackId && (
                      <div className="px-3 pb-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border-2 border-red-50 shadow-sm space-y-3">
                          <div className="flex items-center justify-between border-b pb-2">
                            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Visual Reference Provider</span>
                            {ytSearchLoading && <Loader2 className="w-3 h-3 animate-spin text-red-500" />}
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {ytResults.map((yt) => (
                              <button
                                key={yt.videoId}
                                onClick={() => onSelectSong(song.previewUrl, `${song.trackName} - ${song.artistName}`, `https://youtube.com/watch?v=${yt.videoId}`)}
                                className="flex items-center gap-3 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-left transition-all border border-transparent hover:border-red-100 group/item"
                              >
                                <div className="relative w-20 aspect-video rounded overflow-hidden shadow-sm bg-slate-100">
                                  {yt.videoThumbnails?.[0]?.url && (
                                    <img src={yt.videoThumbnails[0].url} className="w-full h-full object-cover" alt="Thumbnail" />
                                  )}
                                  <div className="absolute inset-0 bg-black/20 group-hover/item:bg-black/0 transition-colors flex items-center justify-center">
                                    <PlayCircle className="w-5 h-5 text-white opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold leading-tight line-clamp-2">{yt.title}</p>
                                  <p className="text-[8px] text-muted-foreground mt-0.5">{yt.author} • {yt.viewCountText}</p>
                                </div>
                                <Check className="w-3 h-3 text-red-500 opacity-0 group-hover/item:opacity-100" />
                              </button>
                            ))}
                            
                            {!ytSearchLoading && ytError && (
                              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                                <AlertCircle className="w-6 h-6 text-red-500 mb-1" />
                                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">All Search Nodes Busy</p>
                                <p className="text-[9px] text-muted-foreground max-w-[180px]">Browser security (CORS) is blocking direct visual matching. Try one more time?</p>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => fetchYoutubeResults(song.trackName, song.artistName)}
                                  className="h-7 text-[9px] mt-2 gap-2 border-red-100"
                                >
                                  <RefreshCw className="w-3 h-3" /> Retry Visual Search
                                </Button>
                              </div>
                            )}

                            {!ytSearchLoading && !ytError && ytResults.length === 0 && (
                              <p className="text-[10px] text-center py-2 text-muted-foreground italic">No matching videos found.</p>
                            )}
                          </div>
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
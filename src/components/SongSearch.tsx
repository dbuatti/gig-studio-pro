"use client";

import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Music, Loader2, Youtube, ExternalLink, Link as LinkIcon, Check, PlayCircle, AlertCircle, RefreshCw, Plus, FileText } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SongSearchProps {
  onSelectSong: (url: string, name: string, artist: string, youtubeUrl?: string) => void;
  onAddToSetlist: (url: string, name: string, artist: string, youtubeUrl?: string, ugUrl?: string) => void;
  externalQuery?: string;
}

const SongSearch: React.FC<SongSearchProps> = ({ onSelectSong, onAddToSetlist, externalQuery }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandingId, setExpandingId] = useState<number | null>(null);
  
  const [ytSearchLoading, setYtSearchLoading] = useState(false);
  const [ytResults, setYtResults] = useState<any[]>([]);
  const [ytError, setYtError] = useState(false);
  const [manualYtUrl, setManualYtUrl] = useState("");
  const [manualUgUrl, setManualUgUrl] = useState("");

  useEffect(() => {
    if (externalQuery) {
      setQuery(externalQuery);
      performSearch(externalQuery);
    }
  }, [externalQuery]);

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setExpandingId(null);
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=10`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      // Silent failure
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const openYoutubeSearch = (track: string, artist: string) => {
    const searchQuery = encodeURIComponent(`${artist} ${track} official music video`);
    window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
  };

  const openUgSearch = (track: string, artist: string) => {
    const searchQuery = encodeURIComponent(`${artist} ${track} chords`);
    window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${searchQuery}`, '_blank');
  };

  const fetchYoutubeResults = async (track: string, artist: string) => {
    setYtSearchLoading(true);
    setYtResults([]);
    setYtError(false);
    
    const proxies = [
      "https://api.allorigins.win/get?url=",
      "https://corsproxy.io/?"
    ];
    
    const instances = [
      'https://iv.ggtyler.dev',
      'https://yewtu.be',
      'https://invidious.flokinet.to'
    ];

    let success = false;
    
    for (const proxy of proxies) {
      if (success) break;
      for (const instance of instances) {
        if (success) break;
        try {
          const searchQuery = encodeURIComponent(`${artist} ${track} official music video`);
          const targetUrl = encodeURIComponent(`${instance}/api/v1/search?q=${searchQuery}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);

          const response = await fetch(`${proxy}${targetUrl}`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          if (!response.ok) continue;
          
          const data = await response.json();
          const rawData = typeof data.contents === 'string' ? JSON.parse(data.contents) : data;
          
          const videos = rawData?.filter?.((item: any) => item.type === "video").slice(0, 3);
          
          if (videos && videos.length > 0) {
            setYtResults(videos);
            success = true;
          }
        } catch (err) {
          // Fail silently
        }
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
      setManualYtUrl("");
      setManualUgUrl("");
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
          <ScrollArea className="h-[450px]">
            <div className="p-2 space-y-1">
              <TooltipProvider>
                {results.map((song) => (
                  <div key={song.trackId} className="flex flex-col border-b last:border-0 border-slate-100 dark:border-slate-800">
                    <div className="w-full flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-indigo-950/30 rounded-lg transition-all group">
                      <button
                        onClick={() => onAddToSetlist(song.previewUrl, song.trackName, song.artistName, manualYtUrl, manualUgUrl)}
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
                          <p className="text-[8px] text-indigo-500 font-black uppercase tracking-tighter mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">Click to Add to Gig</p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0 px-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={() => toggleExpand(song)}
                              className={cn(
                                "p-2 rounded-md transition-all",
                                expandingId === song.trackId ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-slate-100 text-slate-500"
                              )}
                            >
                              <LinkIcon className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Link External References</TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onSelectSong(song.previewUrl, song.trackName, song.artistName)}
                              className="p-2 hover:bg-indigo-600 hover:text-white text-indigo-400 rounded-md transition-all"
                            >
                              <Music className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Preview Audio</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {expandingId === song.trackId && (
                      <div className="px-3 pb-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border-2 border-indigo-50 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b pb-2">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Library Engine Configuration</span>
                            {ytSearchLoading && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
                          </div>

                          <div className="space-y-4">
                            {/* YouTube Section */}
                            <div className="space-y-2">
                              <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Youtube className="w-3 h-3 text-red-600" /> YouTube Master / Reference
                              </Label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                  <Input 
                                    placeholder="Paste video URL..." 
                                    className="h-9 pl-7 text-[10px] bg-slate-50 border-slate-100"
                                    value={manualYtUrl}
                                    onChange={(e) => setManualYtUrl(e.target.value)}
                                  />
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-9 border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 text-[10px] font-bold uppercase"
                                  onClick={() => openYoutubeSearch(song.trackName, song.artistName)}
                                >
                                  <Search className="w-3 h-3 mr-1" /> Find
                                </Button>
                              </div>
                            </div>

                            {/* UG Section */}
                            <div className="space-y-2">
                              <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <FileText className="w-3 h-3 text-orange-500" /> Ultimate Guitar Tab Link
                              </Label>
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <LinkIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                  <Input 
                                    placeholder="Paste UG tab URL..." 
                                    className="h-9 pl-7 text-[10px] bg-slate-50 border-slate-100"
                                    value={manualUgUrl}
                                    onChange={(e) => setManualUgUrl(e.target.value)}
                                  />
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-9 border-slate-200 text-slate-600 hover:bg-orange-50 hover:text-orange-600 text-[10px] font-bold uppercase"
                                  onClick={() => openUgSearch(song.trackName, song.artistName)}
                                >
                                  <Search className="w-3 h-3 mr-1" /> Find
                                </Button>
                              </div>
                            </div>

                            <Button 
                              onClick={() => onAddToSetlist(song.previewUrl, song.trackName, song.artistName, manualYtUrl, manualUgUrl)}
                              className="w-full bg-indigo-600 hover:bg-indigo-700 h-9 font-black uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-indigo-600/20"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add to Gig with Links
                            </Button>
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
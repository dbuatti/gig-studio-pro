"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Youtube, Loader2, Play, Check, ExternalLink, Globe, Globe2, Music, Clock, User } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface YoutubeSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (videoUrl: string) => void;
  initialQuery?: string;
}

const YoutubeSearchModal: React.FC<YoutubeSearchModalProps> = ({ isOpen, onClose, onSelect, initialQuery }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setError(null);
    
    // Using a robust search matrix (Invidious API + CORS Proxy)
    // to provide high-fidelity results without requiring a private API Key
    const instances = [
      'https://iv.ggtyler.dev',
      'https://yewtu.be',
      'https://invidious.flokinet.to',
      'https://invidious.projectsegfau.lt'
    ];

    let success = false;
    
    for (const instance of instances) {
      if (success) break;
      try {
        const targetUrl = `${instance}/api/v1/search?q=${encodeURIComponent(searchTerm)}&type=video`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) continue;
        
        const rawData = await response.json();
        const data = typeof rawData.contents === 'string' ? JSON.parse(rawData.contents) : rawData.contents;
        
        if (data && Array.isArray(data) && data.length > 0) {
          setResults(data.slice(0, 15));
          success = true;
        }
      } catch (err) {
        console.warn(`Search attempt on ${instance} failed, trying next...`);
      }
    }

    if (!success) {
      setError("Discovery engine is under heavy load. Please try a more specific search.");
    }
    setIsLoading(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  useEffect(() => {
    if (isOpen && initialQuery) {
      const q = initialQuery.includes('Unknown') ? initialQuery.replace('Unknown Artist', '').trim() : initialQuery;
      setQuery(q);
      performSearch(q);
    } else if (!isOpen) {
      setResults([]);
      setError(null);
    }
  }, [isOpen, initialQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-red-600 shrink-0 relative">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Youtube className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Visual Discovery Engine</DialogTitle>
            </div>
            <DialogDescription className="text-red-100 font-medium">
              Search the global YouTube index for high-fidelity master records and performance videos.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleFormSubmit} className="flex gap-3 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-200" />
              <Input 
                autoFocus
                placeholder="Search song, artist, or official video..." 
                className="bg-white/10 border-white/20 text-white placeholder:text-red-200 h-12 pl-10 rounded-xl focus-visible:ring-white/30"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-white text-red-600 hover:bg-red-50 h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Discover"}
            </Button>
          </form>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-900/50 p-4">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-4 pb-4">
              {results.length > 0 ? (
                results.map((video) => (
                  <button
                    key={video.videoId}
                    onClick={() => onSelect(`https://www.youtube.com/watch?v=${video.videoId}`)}
                    className="flex flex-col bg-white/5 border border-white/5 rounded-2xl overflow-hidden hover:border-red-500/50 transition-all group text-left"
                  >
                    <div className="aspect-video relative overflow-hidden bg-black">
                      <img 
                        src={video.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`} 
                        alt={video.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="bg-red-600 p-3 rounded-full text-white shadow-xl">
                          <Check className="w-6 h-6" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono font-bold text-white">
                        {Math.floor(video.lengthSeconds / 60)}:{(video.lengthSeconds % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <h4 className="font-bold text-sm leading-tight line-clamp-2 uppercase tracking-tight group-hover:text-red-400 transition-colors">
                        {video.title}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{video.author}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3 h-3" />
                          <span>{video.viewCountText?.split(' ')[0] || 'Vivid'}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                !isLoading && query && (
                  <div className="col-span-full py-24 text-center space-y-4 opacity-30">
                    <Youtube className="w-16 h-16 mx-auto" />
                    <p className="text-sm font-black uppercase tracking-[0.3em]">
                      {error || "Standby for Discovery Signal"}
                    </p>
                  </div>
                )
              )}
            </div>
          </ScrollArea>
        </div>
        
        <div className="p-6 border-t border-white/5 bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Globe2 className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cross-Platform Discovery Active</span>
          </div>
          <p className="text-[9px] font-mono text-slate-600 uppercase">Engine Version 3.5.0-STAGE</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default YoutubeSearchModal;
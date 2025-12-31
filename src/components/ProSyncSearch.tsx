"use client";

import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Music, Loader2, Check, Globe, Disc, Star, X } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ProSyncSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (song: any) => void;
  initialQuery?: string;
}

const ProSyncSearch: React.FC<ProSyncSearchProps> = ({ isOpen, onClose, onSelect, initialQuery }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=song&limit=25`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      // console.error("Search failed", err); // Removed console.error
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  useEffect(() => {
    if (isOpen && initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    } else if (!isOpen) {
      setResults([]);
    }
  }, [isOpen, initialQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-[90vw] max-h-[85vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-indigo-600 shrink-0 relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Pro Sync Search</DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 font-medium">
              Find the master record in the Apple Music global library to sync high-fidelity metadata.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleFormSubmit} className="flex gap-3 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
              <Input 
                autoFocus
                placeholder="Search song, artist, or album..." 
                className="bg-white/10 border-white/20 text-white placeholder:text-indigo-200 h-12 pl-10 rounded-xl focus-visible:ring-white/30"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-white text-indigo-600 hover:bg-indigo-50 h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
            </Button>
          </form>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-900/50 p-4">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-4">
              {results.length > 0 ? (
                results.map((song) => (
                  <button
                    key={song.trackId}
                    onClick={() => onSelect(song)}
                    className="w-full flex items-center gap-4 p-3 hover:bg-white/5 rounded-2xl transition-all group border border-transparent hover:border-white/5 text-left"
                  >
                    <div className="relative shrink-0">
                      <img 
                        src={song.artworkUrl100} 
                        alt={song.trackName} 
                        className="w-14 h-14 rounded-xl shadow-lg group-hover:scale-105 transition-transform object-cover" 
                      />
                      <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm uppercase tracking-tight truncate">{song.trackName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{song.artistName}</span>
                        <span className="text-slate-700 text-[8px]">•</span>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase truncate">{song.collectionName}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[9px] font-black bg-white/5 text-slate-500 px-2 py-0.5 rounded border border-white/5 uppercase tracking-tighter">
                          {song.primaryGenreName}
                        </span>
                        {song.trackExplicitness === 'explicit' && (
                          <span className="text-[9px] font-black bg-red-600/10 text-red-500 px-2 py-0.5 rounded border border-red-500/10 uppercase">Explicit</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1 ml-auto">
                      <Disc className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                      <span className="text-[9px] font-mono font-bold text-slate-500">
                        {new Date(song.releaseDate).getFullYear()}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                !isLoading && query && (
                  <div className="py-20 text-center space-y-4 opacity-30">
                    <Search className="w-12 h-12 mx-auto" />
                    <p className="text-sm font-black uppercase tracking-widest">No Library Matches Found</p>
                  </div>
                )
              )}
            </div>
          </ScrollArea>
        </div>
        
        <div className="p-6 border-t border-white/5 bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Master Library Active</span>
          </div>
          <p className="text-[9px] font-mono text-slate-600 uppercase">Pro Sync Engine v2.5</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProSyncSearch;
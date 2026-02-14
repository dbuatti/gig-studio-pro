"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Globe, Music, Plus, Loader2, X, Sparkles } from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import SongSuggestions from './SongSuggestions';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSong: (url: string, name: string, artist: string, yt?: string, ug?: string, apple?: string, gen?: string) => Promise<void>;
  repertoire: SetlistSong[];
  onAddExistingSong: (song: SetlistSong) => Promise<void>;
}

const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ 
  isOpen, 
  onClose, 
  onAddSong, 
  repertoire,
  onAddExistingSong
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      showError("Global search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 2) handleSearch();
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const handleAdd = async (itunesSong: any) => {
    // Check if already in repertoire
    const existing = repertoire.find(s => 
      s.name.toLowerCase() === itunesSong.trackName.toLowerCase() && 
      s.artist?.toLowerCase() === itunesSong.artistName.toLowerCase()
    );

    if (existing) {
      await onAddExistingSong(existing);
      showSuccess(`"${itunesSong.trackName}" added from your library.`);
    } else {
      await onAddSong(
        itunesSong.previewUrl,
        itunesSong.trackName,
        itunesSong.artistName,
        undefined, // yt
        undefined, // ug
        itunesSong.trackViewUrl,
        itunesSong.primaryGenreName
      );
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] bg-slate-950 border-white/10 text-white rounded-[2.5rem] p-0 overflow-hidden shadow-2xl">
        <div className="p-8 bg-indigo-600 relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/70 transition-colors">
            <X className="w-5 h-5" />
          </button>
          
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Discovery Engine</DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 font-medium">
              Search the global music database to instantly expand your repertoire.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-8 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300 group-focus-within:text-white transition-colors" />
            <Input 
              placeholder="Search by track, artist, or album..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-14 pl-12 bg-white/10 border-white/20 rounded-2xl text-white placeholder-indigo-200 focus:ring-white/30 focus:bg-white/20 transition-all text-lg font-bold"
              autoFocus
            />
          </div>
        </div>

        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-950">
          {query.length > 0 ? (
            <SongSuggestions 
              suggestions={results} 
              onAdd={handleAdd} 
              isLoading={isSearching} 
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-white/5">
                <Sparkles className="w-12 h-12 text-indigo-500/50" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-slate-500">Ready for Discovery</p>
                <p className="text-xs text-slate-600 mt-2 max-w-xs mx-auto">Enter a song title or artist above to scan the global database for high-quality metadata and previews.</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20 flex items-center justify-center">
          <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">Powered by Apple Music Discovery API</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearchModal;
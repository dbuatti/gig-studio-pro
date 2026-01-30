"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Sparkles, X } from 'lucide-react';
import { SongSearch } from './SongSearch';
import { SetlistSong } from './SetlistManager';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSong: (url: string, name: string, artist: string, youtubeUrl?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string) => void;
}

const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose, onAddSong }) => {
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
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Search className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Discovery Engine</DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 font-medium">
              Search the global library to add new tracks to your repertoire.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden bg-secondary p-6">
          <SongSearch 
            onSelectSong={() => {}} 
            onAddToSetlist={(url, name, artist, yt, ug, apple, gen) => {
              onAddSong(url, name, artist, yt, ug, apple, gen);
              onClose();
            }}
          />
        </div>
        
        <div className="p-6 border-t border-border bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Powered by iTunes Global Matrix</span>
          </div>
          <p className="text-[9px] font-mono text-muted-foreground uppercase">Discovery v4.2</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearchModal;
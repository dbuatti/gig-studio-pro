"use client";

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import SongStudioView, { StudioTab } from './SongStudioView'; // Import StudioTab
import { useNavigate } from 'react-router-dom';
import { SetlistSong } from './SetlistManager';
import { X } from 'lucide-react'; // Import X icon

interface SongStudioSheetProps {
  isOpen: boolean;
  onClose: () => void;
  gigId: string | 'library';
  songId: string | null; // Allow songId to be null
  visibleSongs?: SetlistSong[];
  onSelectSong?: (id: string) => void;
  allSetlists?: { id: string; name: string; songs: SetlistSong[] }[]; // New prop
  masterRepertoire?: SetlistSong[]; // New prop
  onUpdateSetlistSongs?: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>; // New prop
  defaultTab?: StudioTab; // New prop for default active tab
}

const SongStudioSheet: React.FC<SongStudioSheetProps> = ({ 
  isOpen, 
  onClose, 
  gigId, 
  songId,
  visibleSongs = [],
  onSelectSong,
  allSetlists, // Destructure new prop
  masterRepertoire, // Destructure new prop
  onUpdateSetlistSongs, // Destructure new prop
  defaultTab // Destructure new prop
}) => {
  const navigate = useNavigate();

  console.log(`[SongStudioSheet] Rendered. isOpen: ${isOpen}, gigId: ${gigId}, songId: ${songId}, defaultTab: ${defaultTab}`);

  // Allow songId to be null if gigId is 'library' for the search view
  if (!gigId || (gigId !== 'library' && !songId)) {
    console.warn(`[SongStudioSheet] Not rendering due to invalid gigId or songId. gigId: ${gigId}, songId: ${songId}`);
    return null;
  }

  // The onExpand functionality is now handled by the Sheet's open/close state
  // and the full-page SongStudio component if navigated to directly.

  return (
    <Sheet open={isOpen} onOpenChange={(open) => {
      console.log(`[SongStudioSheet] Sheet onOpenChange: ${open}`);
      !open && onClose();
    }}>
      <SheetContent 
        side="right" 
        className="w-full md:w-[600px] lg:w-[700px] bg-slate-950 text-white border-l border-white/10 p-0 flex flex-col shadow-2xl z-[100]"
      >
        <SheetHeader className="p-6 bg-indigo-600 shrink-0 relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
              {/* Icon for Song Studio */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-music w-6 h-6 text-white"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
            <SheetTitle className="text-2xl font-black uppercase tracking-tight text-white">Song Studio</SheetTitle>
          </div>
          <SheetDescription className="text-indigo-100 font-medium">
            Configure audio processing, metadata, and charts for the selected track.
          </SheetDescription>
        </SheetHeader>

        <SongStudioView 
          gigId={gigId} 
          songId={songId} 
          onClose={onClose} 
          isModal 
          // onExpand is not directly used here as Sheet handles its own expansion
          visibleSongs={visibleSongs}
          onSelectSong={onSelectSong}
          allSetlists={allSetlists}
          masterRepertoire={masterRepertoire}
          onUpdateSetlistSongs={onUpdateSetlistSongs}
          defaultTab={defaultTab}
        />
      </SheetContent>
    </Sheet>
  );
};

export default SongStudioSheet;
"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import SongStudioView, { StudioTab } from './SongStudioView';
import { useNavigate } from 'react-router-dom';
import { SetlistSong, Setlist } from './SetlistManager';

interface SongStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  gigId: string | 'library' | null;
  songId: string | null;
  visibleSongs?: SetlistSong[];
  onSelectSong?: (id: string) => void;
  allSetlists?: Setlist[]; // Corrected type
  masterRepertoire?: SetlistSong[];
  onUpdateSetlistSongs?: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  defaultTab?: StudioTab;
  // New prop to handle auto-saving from the parent context
  handleAutoSave?: (updates: Partial<SetlistSong>) => void;
  preventStageKeyOverwrite?: boolean; // NEW: Add this prop
}

const SongStudioModal: React.FC<SongStudioModalProps> = ({ 
  isOpen, 
  onClose, 
  gigId, 
  songId,
  visibleSongs = [],
  onSelectSong,
  allSetlists,
  masterRepertoire,
  onUpdateSetlistSongs,
  defaultTab,
  handleAutoSave, // Destructure the new prop
  preventStageKeyOverwrite // Destructure the new prop
}) => {
  const navigate = useNavigate();

  const handleExpand = () => {
    onClose();
    if (gigId && songId) {
      navigate(`/gig/${gigId}/song/${songId}`);
    } else {
      navigate('/dashboard'); 
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[95vw] w-[1200px] h-[90vh] p-0 bg-slate-950 border-white/10 overflow-hidden rounded-[2rem] shadow-2xl"
        aria-labelledby="song-studio-title"
        aria-describedby="song-studio-description"
      >
        <DialogHeader>
          <DialogTitle id="song-studio-title" className="sr-only">Song Studio - Editing Song</DialogTitle>
          <DialogDescription id="song-studio-description" className="sr-only">
            Configure audio processing, metadata, and charts for the selected track.
          </DialogDescription>
        </DialogHeader>

        <SongStudioView 
          gigId={gigId || 'library'} 
          songId={songId} 
          onClose={onClose} 
          isModal 
          onExpand={handleExpand}
          visibleSongs={visibleSongs}
          onSelectSong={onSelectSong}
          allSetlists={allSetlists}
          masterRepertoire={masterRepertoire}
          onUpdateSetlistSongs={onUpdateSetlistSongs}
          defaultTab={defaultTab}
          // Pass the handleAutoSave function to enable auto-saving within the modal
          handleAutoSave={handleAutoSave}
          preventStageKeyOverwrite={preventStageKeyOverwrite} // NEW: Pass the prop
        />
      </DialogContent>
    </Dialog>
  );
};

export default SongStudioModal;
"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import SongStudioView, { StudioTab } from './SongStudioView';
import { useNavigate } from 'react-router-dom';
import { SetlistSong } from './SetlistManager';

interface SongStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  gigId: string | null;
  songId: string | null;
  visibleSongs?: SetlistSong[];
  onSelectSong?: (id: string) => void;
  allSetlists?: { id: string; name: string; songs: SetlistSong[] }[];
  masterRepertoire?: SetlistSong[];
  onUpdateSetlistSongs?: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  defaultTab?: StudioTab;
  // New prop to handle auto-saving from the parent context
  handleAutoSave?: (updates: Partial<SetlistSong>) => void;
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
  handleAutoSave // Destructure the new prop
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
      <DialogHeader className="sr-only">
        <DialogTitle>Song Studio - Editing Song</DialogTitle>
        <DialogDescription>
          Configure audio processing, metadata, and charts for the selected track.
        </DialogDescription>
      </DialogHeader>

      <SongStudioView 
        gigId={gigId} 
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
      />
    </Dialog>
  );
};

export default SongStudioModal;
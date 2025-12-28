"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import SongStudioView from './SongStudioView';
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
  onUpdateSetlistSongs
}) => {
  const navigate = useNavigate();

  if (!gigId || !songId) return null;

  const handleExpand = () => {
    onClose();
    navigate(`/gig/${gigId}/song/${songId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] p-0 overflow-hidden bg-slate-950 border-white/10 rounded-[2.5rem] shadow-2xl">
        {/* Accessible Header (Hidden visually) */}
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
        />
      </DialogContent>
    </Dialog>
  );
};

export default SongStudioModal;
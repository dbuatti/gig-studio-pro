"use client";

import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import SongStudioView from './SongStudioView';
import { useNavigate } from 'react-router-dom';

interface SongStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  gigId: string | null;
  songId: string | null;
}

const SongStudioModal: React.FC<SongStudioModalProps> = ({ isOpen, onClose, gigId, songId }) => {
  const navigate = useNavigate();

  if (!gigId || !songId) return null;

  const handleExpand = () => {
    onClose();
    navigate(`/gig/${gigId}/song/${songId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] p-0 overflow-hidden bg-slate-950 border-white/10 rounded-[2.5rem] shadow-2xl">
        <SongStudioView 
          gigId={gigId} 
          songId={songId} 
          onClose={onClose} 
          isModal 
          onExpand={handleExpand}
        />
      </DialogContent>
    </Dialog>
  );
};

export default SongStudioModal;
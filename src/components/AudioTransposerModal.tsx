"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import AudioTransposer, { AudioTransposerRef } from '@/components/AudioTransposer';
import { SetlistSong, Setlist } from './SetlistManager';
import { AudioEngineControls } from '@/hooks/use-tone-audio';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

interface AudioTransposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExistingSong?: (song: SetlistSong) => void;
  repertoire?: SetlistSong[];
  currentList?: { id: string; name: string; songs: SetlistSong[] };
  onAddToSetlist?: (previewUrl: string, name: string, artist: string, youtubeUrl?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string, pitch?: number, audioUrl?: string, extractionStatus?: 'idle' | 'PENDING' | 'queued' | 'processing' | 'completed' | 'failed') => void;
}

const AudioTransposerModal: React.FC<AudioTransposerModalProps> = ({ 
  isOpen, 
  onClose, 
  onAddExistingSong, 
  repertoire = [],
  currentList,
  onAddToSetlist
}) => {
  const navigate = useNavigate();
  const audioTransposerRef = React.useRef<AudioTransposerRef>(null);

  const handleClose = () => {
    audioTransposerRef.current?.stopPlayback();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-slate-950 border-white/10 overflow-hidden rounded-[2rem] shadow-2xl flex flex-col"
      >
        <div className="p-6 bg-indigo-600 shrink-0 relative">
          <button onClick={handleClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/70">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">Audio Transposer & Discovery</h2>
          <p className="text-indigo-100 font-medium text-xs mt-1">Load audio, adjust pitch/tempo, and find new tracks.</p>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <AudioTransposer 
            ref={audioTransposerRef}
            onAddToSetlist={onAddToSetlist}
            onAddExistingSong={onAddExistingSong}
            repertoire={repertoire}
            currentList={currentList}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AudioTransposerModal;
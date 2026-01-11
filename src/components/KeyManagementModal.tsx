"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Music, X, Hash } from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { KeyPreference } from '@/hooks/use-settings';
import KeyManagementMatrix from './KeyManagementMatrix';

interface KeyManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  repertoire: SetlistSong[];
  onUpdateKey: (songId: string, updates: { originalKey?: string | null, targetKey?: string | null, pitch?: number }) => Promise<void>;
  keyPreference: KeyPreference;
}

const KeyManagementModal: React.FC<KeyManagementModalProps> = ({ 
  isOpen, 
  onClose, 
  repertoire, 
  onUpdateKey, 
  keyPreference 
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl z-[100]">
        <div className="p-6 sm:p-8 bg-indigo-600 shrink-0 relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/70">
            <X className="w-5 h-5" />
          </button>
          
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 mb-2 text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Hash className="w-6 h-6 text-white" />
              </div>
              Harmonic Management Matrix
            </DialogTitle>
            <DialogDescription className="text-indigo-100 font-medium text-xs sm:text-sm">
              Diagnose and set original and stage keys for your master repertoire.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden p-6 bg-secondary">
          <KeyManagementMatrix
            repertoire={repertoire}
            onUpdateKey={onUpdateKey}
            keyPreference={keyPreference}
          />
        </div>

        <div className="p-6 border-t border-border bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Music className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Tracks: {repertoire.length}</span>
          </div>
          <p className="text-[9px] font-mono text-muted-foreground uppercase">Stage Key Engine v1.0</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyManagementModal;
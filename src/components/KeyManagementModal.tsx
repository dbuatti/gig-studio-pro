"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Music, X, Hash } from 'lucide-react';
import { SetlistSong } from './SetlistManagementModal';
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
  keyPreference,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] h-[85vh] bg-popover border-border rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-indigo-600/10 border-b border-border shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-600 p-2 rounded-xl backdrop-blur-md">
              <Hash className="w-6 h-6 text-white" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Harmonic Matrix</DialogTitle>
          </div>
          <DialogDescription className="text-indigo-200 font-medium">
            Review and adjust the original and stage keys for your entire repertoire.
          </DialogDescription>
        </div>

        <div className="flex-1 overflow-hidden">
          <KeyManagementMatrix
            repertoire={repertoire}
            onUpdateKey={onUpdateKey}
            keyPreference={keyPreference}
          />
        </div>

        <DialogFooter className="p-6 border-t border-border bg-secondary">
          <Button onClick={onClose} variant="ghost" className="flex-1 font-black uppercase tracking-widest text-xs h-12 rounded-xl text-foreground hover:bg-accent">
            Close Matrix
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KeyManagementModal;
"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings2, Trash2, Edit3, ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';
import { cleanSetlistDuplicates } from '@/utils/setlistCleanup';

interface SetlistSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  setlistId: string;
  setlistName: string;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

const SetlistSettingsModal: React.FC<SetlistSettingsModalProps> = ({
  isOpen,
  onClose,
  setlistId,
  setlistName,
  onDelete,
  onRename,
  onRefresh
}) => {
  const [isCleaning, setIsCleaning] = useState(false);

  const handleCleanup = async () => {
    setIsCleaning(true);
    const removedCount = await cleanSetlistDuplicates(setlistId, setlistName);
    if (removedCount > 0 && onRefresh) {
      await onRefresh();
    }
    setIsCleaning(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-slate-950 border-white/10 text-white rounded-[2rem] p-8 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-600/20 p-2 rounded-xl">
              <Settings2 className="w-5 h-5 text-indigo-400" />
            </div>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Gig Settings</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 font-medium">
            Manage configuration for <span className="text-white font-bold">"{setlistName}"</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Maintenance</h4>
            
            <Button
              variant="ghost"
              onClick={handleCleanup}
              disabled={isCleaning}
              className="w-full justify-start gap-3 h-12 rounded-xl hover:bg-indigo-600/10 hover:text-indigo-400 text-slate-300 transition-all"
            >
              {isCleaning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldAlert className="w-4 h-4" />
              )}
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-tight">Fix Duplicate Songs</p>
                <p className="text-[9px] opacity-60">Removes redundant entries from this setlist</p>
              </div>
            </Button>
          </div>

          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</h4>
            
            <Button
              variant="ghost"
              onClick={() => onRename(setlistId)}
              className="w-full justify-start gap-3 h-12 rounded-xl hover:bg-white/10 text-slate-300 transition-all"
            >
              <Edit3 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-tight">Rename Setlist</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => onDelete(setlistId)}
              className="w-full justify-start gap-3 h-12 rounded-xl hover:bg-red-600/10 hover:text-red-400 text-slate-300 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-tight">Delete Setlist</span>
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-8">
          <Button
            onClick={onClose}
            className="w-full bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest text-[10px] h-12 rounded-xl transition-all"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SetlistSettingsModal;
"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Settings, ShieldCheck, QrCode, Trash2, Edit3, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import GigSessionManager from './GigSessionManager';

interface SetlistSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  setlistId: string | null;
  setlistName: string;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
}

const SetlistSettingsModal: React.FC<SetlistSettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  setlistId, 
  setlistName,
  onDelete,
  onRename
}) => {
  if (!setlistId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-[90vw] bg-popover border-border text-foreground rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
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
                <Settings className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Setlist Settings</DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 font-medium">
              Administrative controls and public access for <span className="text-white font-bold">"{setlistName}"</span>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-10 overflow-y-auto custom-scrollbar">
          {/* Section: Management */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Core Management</h4>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                onClick={() => onRename(setlistId)}
                className="h-16 bg-secondary border-border hover:bg-accent text-foreground font-black uppercase tracking-widest text-[10px] rounded-2xl gap-3 transition-all"
              >
                <Edit3 className="w-4 h-4 text-indigo-400" /> Rename Gig
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onDelete(setlistId)}
                className="h-16 bg-destructive/5 border-destructive/10 hover:bg-destructive/10 text-destructive font-black uppercase tracking-widest text-[10px] rounded-2xl gap-3 transition-all"
              >
                <Trash2 className="w-4 h-4" /> Delete Gig
              </Button>
            </div>
          </section>

          {/* Section: Gig Access (Relocated) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Public Setlist Portals</h4>
              <span className="text-[8px] font-black bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded uppercase">Encrypted</span>
            </div>
            <GigSessionManager setlistId={setlistId} />
          </section>

          <div className="p-6 bg-card rounded-[2rem] border border-border flex items-start gap-4">
            <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black uppercase text-foreground">Performance Security Policy</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Public access codes allow clients to view your setlist in real-time. Audio and technical metadata are restricted to this studio view only.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border bg-card flex items-center justify-center shrink-0">
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
            Setlist ID: {setlistId} // Studio Engine v4.0
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SetlistSettingsModal;
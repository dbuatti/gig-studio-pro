"use client";

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  ExternalLink, 
  AlertTriangle, 
  Search, 
  ShieldCheck,
  X,
  Music,
  Edit2,
  RotateCcw,
  Link2,
  SearchCode
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { sanitizeUGUrl } from '@/utils/ugUtils';
import { showSuccess } from '@/utils/toast';

interface UGLinkAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: SetlistSong[];
  onVerify: (songId: string, updates: Partial<SetlistSong>) => void;
}

const UGLinkAuditModal: React.FC<UGLinkAuditModalProps> = ({ isOpen, onClose, songs, onVerify }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const unverifiedSongs = useMemo(() => {
    return songs.filter(s => 
      // Include anything not verified (which covers both missing links and unverified links)
      !s.is_ug_link_verified && 
      (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       s.artist?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [songs, searchTerm]);

  const handleVerify = (song: SetlistSong, customUrl?: string) => {
    const urlToVerify = customUrl || song.ugUrl;
    if (!urlToVerify || !urlToVerify.includes('ultimate-guitar.com')) return;
    
    const cleanUrl = sanitizeUGUrl(urlToVerify);
    onVerify(song.id, { 
      ugUrl: cleanUrl, 
      is_ug_link_verified: true 
    });
    
    if (editingId === song.id) {
      setEditingId(null);
      setEditValue("");
    }
    showSuccess(`Verified: ${song.name}`);
  };

  const startEditing = (song: SetlistSong) => {
    setEditingId(song.id);
    setEditValue(song.ugUrl || "");
  };

  const handleRebind = (song: SetlistSong) => {
    setEditingId(song.id);
    setEditValue("");
    window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent((song.artist || '') + ' ' + song.name)}`, '_blank');
  };

  const isValidUrl = (url: string) => url.trim().includes('ultimate-guitar.com');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-orange-600 shrink-0 relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Link2 className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">UG Link Audit</DialogTitle>
            </div>
            <DialogDescription className="text-orange-100 font-medium">
              Validate or bind Ultimate Guitar links to eliminate "Link Drift" during live sets.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-300" />
            <input 
              placeholder="Search unverified tracks..." 
              className="w-full bg-white/10 border border-white/20 rounded-xl h-12 pl-12 pr-4 text-white placeholder-orange-200 focus:ring-2 focus:ring-white/30 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-900/50">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-3">
              {unverifiedSongs.length > 0 ? (
                unverifiedSongs.map((song) => {
                  const isEditing = editingId === song.id;
                  const isMissing = !song.ugUrl || song.ugUrl.trim() === "";
                  
                  return (
                    <div key={song.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-4 group hover:bg-white/10 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="bg-slate-800 p-2.5 rounded-xl text-slate-500">
                            <Music className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-black text-sm uppercase tracking-tight truncate">{song.name}</h4>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{song.artist || "Unknown Artist"}</span>
                            
                            {isEditing ? (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-[9px] font-black text-amber-500 uppercase flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Awaiting Link Entry
                                </span>
                              </div>
                            ) : isMissing ? (
                              <p className="text-[9px] font-black text-red-500 uppercase mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> MISSING DIRECT LINK
                              </p>
                            ) : (
                              <p className="text-[9px] font-mono text-indigo-400 mt-1 truncate max-w-[300px]">{song.ugUrl}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setEditingId(null);
                                  setEditValue("");
                                }}
                                className="h-10 px-4 text-slate-400 font-bold text-[10px] uppercase rounded-xl"
                              >
                                Cancel
                              </Button>
                              <Button 
                                onClick={() => handleVerify(song, editValue)}
                                disabled={!isValidUrl(editValue)}
                                className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 text-white font-black uppercase text-[10px] tracking-widest gap-2 rounded-xl shadow-lg transition-all"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Verify Link
                              </Button>
                            </>
                          ) : (
                            <>
                              {!isMissing && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => window.open(song.ugUrl, '_blank')}
                                    className="h-10 px-4 bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] uppercase gap-2 rounded-xl"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" /> Test
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => startEditing(song)}
                                    className="h-10 px-4 bg-white/5 hover:bg-white/10 text-indigo-400 font-bold text-[10px] uppercase gap-2 rounded-xl"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" /> Edit
                                  </Button>
                                </>
                              )}
                              
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleRebind(song)}
                                className={cn(
                                  "h-10 px-4 font-bold text-[10px] uppercase gap-2 rounded-xl",
                                  isMissing ? "bg-orange-600/10 text-orange-500 hover:bg-orange-600/20" : "bg-white/5 hover:bg-white/10 text-orange-400"
                                )}
                              >
                                {isMissing ? (
                                  <><SearchCode className="w-3.5 h-3.5" /> Find & Bind</>
                                ) : (
                                  <><RotateCcw className="w-3.5 h-3.5" /> Re-bind</>
                                )}
                              </Button>

                              {!isMissing && (
                                <Button 
                                  onClick={() => handleVerify(song)}
                                  className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest gap-2 rounded-xl shadow-lg"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" /> Verify
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="flex gap-2 animate-in slide-in-from-top-2 duration-300">
                          <div className="relative flex-1">
                            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <Input 
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              placeholder="Paste the official Ultimate Guitar URL here..."
                              className="bg-black/40 border-white/10 h-12 pl-10 text-sm font-mono text-indigo-300 rounded-xl focus:ring-indigo-500/20"
                              autoFocus
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center space-y-4 opacity-30">
                  <ShieldCheck className="w-16 h-16 mx-auto text-emerald-500" />
                  <p className="text-lg font-black uppercase tracking-widest">Audit Complete</p>
                  <p className="text-sm font-medium">All tracks in this setlist have verified links.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="p-6 border-t border-white/5 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {unverifiedSongs.length} Tracks Require Attention
            </span>
          </div>
          <p className="text-[9px] font-mono text-slate-700 uppercase">Audit Mode: Missing & Unverified Filter Active</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UGLinkAuditModal;
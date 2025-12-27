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
  SearchCode,
  FileX2,
  FileCheck2,
  Link2Off,
  Copy
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
  onOpenStudio?: (songId: string) => void;
}

type AuditFilter = 'all' | 'missing-content' | 'missing-link' | 'unverified';

const UGLinkAuditModal: React.FC<UGLinkAuditModalProps> = ({ isOpen, onClose, songs, onVerify, onOpenStudio }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<AuditFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const auditList = useMemo(() => {
    return songs.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            s.artist?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const hasLink = !!s.ugUrl && s.ugUrl.trim() !== "";
      const hasChords = !!s.ug_chords_text && s.ug_chords_text.trim() !== "";
      
      if (!matchesSearch) return false;

      switch (activeFilter) {
        case 'missing-content':
          return hasLink && !hasChords;
        case 'missing-link':
          return !hasLink;
        case 'unverified':
          return !s.is_ug_link_verified;
        default:
          return !s.is_ug_link_verified; // Default to showing what needs attention
      }
    });
  }, [songs, searchTerm, activeFilter]);

  const stats = useMemo(() => {
    const missingChords = songs.filter(s => (!!s.ugUrl) && (!s.ug_chords_text || s.ug_chords_text.trim() === "")).length;
    const missingLinks = songs.filter(s => !s.ugUrl || s.ugUrl.trim() === "").length;
    return { missingChords, missingLinks };
  }, [songs]);

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

  const handleJumpToStudio = (song: SetlistSong) => {
    if (song.ugUrl) {
      window.open(song.ugUrl, '_blank');
    }
    if (onOpenStudio) {
      onOpenStudio(song.id);
    }
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
              Eliminate "Link Drift" and ensure all charts are synced for live performance.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col md:flex-row gap-4 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-300" />
              <input 
                placeholder="Search tracks..." 
                className="w-full bg-white/10 border border-white/20 rounded-xl h-12 pl-12 pr-4 text-white placeholder-orange-200 focus:ring-2 focus:ring-white/30 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex bg-black/20 p-1 rounded-xl shrink-0">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setActiveFilter('unverified')}
                className={cn("text-[9px] font-black uppercase tracking-widest h-10 px-4 rounded-lg", activeFilter === 'unverified' ? "bg-white text-orange-600 shadow-lg" : "text-white/60")}
              >
                Needs Audit
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setActiveFilter('missing-content')}
                className={cn("text-[9px] font-black uppercase tracking-widest h-10 px-4 rounded-lg", activeFilter === 'missing-content' ? "bg-white text-orange-600 shadow-lg" : "text-white/60")}
              >
                Empty Sheets
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setActiveFilter('missing-link')}
                className={cn("text-[9px] font-black uppercase tracking-widest h-10 px-4 rounded-lg", activeFilter === 'missing-link' ? "bg-white text-orange-600 shadow-lg" : "text-white/60")}
              >
                No Links
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-900/50">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-3">
              {auditList.length > 0 ? (
                auditList.map((song) => {
                  const isEditing = editingId === song.id;
                  const hasLink = !!song.ugUrl && song.ugUrl.trim() !== "";
                  const hasChords = !!song.ug_chords_text && song.ug_chords_text.trim() !== "";
                  
                  return (
                    <div key={song.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-4 group hover:bg-white/10 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="bg-slate-800 p-2.5 rounded-xl text-slate-500">
                            <Music className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-black text-sm uppercase tracking-tight truncate">{song.name}</h4>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{song.artist || "Unknown Artist"}</span>
                                <div className="h-1 w-1 rounded-full bg-slate-700" />
                                {hasLink ? (
                                    hasChords ? (
                                        <span className="text-[9px] font-black text-emerald-500 uppercase flex items-center gap-1">
                                            <FileCheck2 className="w-3 h-3" /> CONTENT SYNCED
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-black text-amber-500 uppercase flex items-center gap-1">
                                            <FileX2 className="w-3 h-3" /> EMPTY SHEET
                                        </span>
                                    )
                                ) : (
                                    <span className="text-[9px] font-black text-red-500 uppercase flex items-center gap-1">
                                        <Link2Off className="w-3 h-3" /> MISSING LINK
                                    </span>
                                )}
                            </div>
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
                              {hasLink && !hasChords && (
                                <Button 
                                  onClick={() => handleJumpToStudio(song)}
                                  className="h-10 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest gap-2 rounded-xl shadow-lg animate-pulse"
                                >
                                  <Copy className="w-3.5 h-3.5" /> COPY FROM UG
                                </Button>
                              )}

                              {hasLink && (
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
                                  !hasLink ? "bg-orange-600/10 text-orange-500 hover:bg-orange-600/20" : "bg-white/5 hover:bg-white/10 text-orange-400"
                                )}
                              >
                                {!hasLink ? (
                                  <><SearchCode className="w-3.5 h-3.5" /> Find & Bind</>
                                ) : (
                                  <><RotateCcw className="w-3.5 h-3.5" /> Re-bind</>
                                )}
                              </Button>

                              {hasLink && (
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
                  <p className="text-lg font-black uppercase tracking-widest">Audit View Empty</p>
                  <p className="text-sm font-medium">No tracks match the current filter criteria.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="p-6 border-t border-white/5 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {stats.missingChords} Songs require chord import
                </span>
            </div>
            <div className="flex items-center gap-2 border-l border-white/5 pl-6">
                <Link2Off className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {stats.missingLinks} Songs missing links
                </span>
            </div>
          </div>
          <p className="text-[9px] font-mono text-slate-700 uppercase">Engine: Combined Link & Content Audit v5.0</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UGLinkAuditModal;
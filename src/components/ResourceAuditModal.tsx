"use client";

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  ExternalLink, 
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
  ClipboardPaste,
  AlertTriangle,
  AlertCircle, 
  FileText,
  Guitar,
  Check
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { sanitizeUGUrl } from '@/utils/ugUtils';
import { showSuccess, showError } from '@/utils/toast';

interface ResourceAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: SetlistSong[];
  onVerify: (songId: string, updates: Partial<SetlistSong>) => void;
  onOpenStudio?: (songId: string) => void;
}

type AuditTab = 'ug' | 'sheets';
type AuditFilter = 'all' | 'missing-content' | 'missing-link' | 'unverified';

const ResourceAuditModal: React.FC<ResourceAuditModalProps> = ({ isOpen, onClose, songs, onVerify }) => {
  const [activeTab, setActiveTab] = useState<AuditTab>('ug');
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<AuditFilter>('unverified');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const auditList = useMemo(() => {
    return songs.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            s.artist?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (activeTab === 'ug') {
        const hasLink = !!s.ugUrl && s.ugUrl.trim() !== "";
        const hasChords = !!s.ug_chords_text && s.ug_chords_text.trim() !== "";
        
        switch (activeFilter) {
          case 'missing-content': return hasLink && !hasChords;
          case 'missing-link': return !hasLink;
          case 'all': return true;
          case 'unverified':
          default: return !s.is_ug_link_verified;
        }
      } else {
        const sheetUrl = (s as any).sheet_music_url || s.pdfUrl || s.leadsheetUrl;
        const hasLink = !!sheetUrl && sheetUrl.trim() !== "";
        const isVerified = (s as any).is_sheet_verified;

        switch (activeFilter) {
          case 'missing-link': return !hasLink;
          case 'all': return true;
          case 'unverified':
          default: return !isVerified;
        }
      }
    });
  }, [songs, searchTerm, activeFilter, activeTab]);

  const handleVerify = (song: SetlistSong, customUrl?: string) => {
    if (activeTab === 'ug') {
      const urlToVerify = customUrl || song.ugUrl;
      if (!urlToVerify) return;
      onVerify(song.id, { ugUrl: sanitizeUGUrl(urlToVerify), is_ug_link_verified: true });
    } else {
      const urlToVerify = customUrl || (song as any).sheet_music_url || song.pdfUrl || song.leadsheetUrl;
      if (!urlToVerify) return;
      onVerify(song.id, { sheet_music_url: urlToVerify, is_sheet_verified: true } as any);
    }
    
    setEditingId(null);
    setEditValue("");
    showSuccess(`Verified: ${song.name}`);
  };

  const handleRebind = (song: SetlistSong) => {
    setEditingId(song.id);
    const currentUrl = activeTab === 'ug' 
      ? song.ugUrl 
      : ((song as any).sheet_music_url || song.pdfUrl || song.leadsheetUrl);
    setEditValue(currentUrl || "");
    
    const query = encodeURIComponent(`${song.artist || ''} ${song.name} ${activeTab === 'ug' ? 'chords' : 'sheet music pdf'}`);
    // Corrected: Navigate to Ultimate Guitar search for UG tabs, Google for other sheets
    if (activeTab === 'ug') {
      window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`, '_blank');
    } else {
      window.open(`https://www.google.com/search?q=${query}`, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl z-[100]">
        <div className="p-6 sm:p-8 bg-indigo-600 shrink-0 relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/70">
            <X className="w-5 h-5" />
          </button>
          
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">Resource Audit Matrix</DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 font-medium text-xs sm:text-sm">
              Sync and verify technical assets across your entire repertoire.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-8 flex bg-black/20 p-1 rounded-2xl w-fit">
            <Button 
              variant="ghost" 
              onClick={() => setActiveTab('ug')}
              className={cn("h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2", activeTab === 'ug' ? "bg-white text-indigo-600 shadow-lg" : "text-white/60")}
            >
              <Guitar className="w-3.5 h-3.5" /> Chart Links
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setActiveTab('sheets')}
              className={cn("h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2", activeTab === 'sheets' ? "bg-white text-indigo-600 shadow-lg" : "text-white/60")}
            >
              <FileText className="w-3.5 h-3.5" /> Sheet Music
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
              <input 
                placeholder="Search tracks..." 
                className="w-full bg-white/10 border border-white/20 rounded-xl h-12 pl-12 pr-4 text-white placeholder-indigo-200 outline-none text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex bg-black/20 p-1 rounded-xl shrink-0 overflow-x-auto no-scrollbar">
              <Button 
                variant="ghost" size="sm" 
                onClick={() => setActiveFilter('unverified')}
                className={cn("text-[9px] font-black uppercase tracking-widest h-10 px-4 rounded-lg", activeFilter === 'unverified' ? "bg-white text-indigo-600" : "text-white/60")}
              >
                Needs Audit
              </Button>
              {activeTab === 'ug' && (
                <Button 
                  variant="ghost" size="sm" 
                  onClick={() => setActiveFilter('missing-content')}
                  className={cn("text-[9px] font-black uppercase tracking-widest h-10 px-4 rounded-lg", activeFilter === 'missing-content' ? "bg-white text-indigo-600" : "text-white/60")}
                >
                  Empty Sheets
                </Button>
              )}
              <Button 
                variant="ghost" size="sm" 
                onClick={() => setActiveFilter('missing-link')}
                className={cn("text-[9px] font-black uppercase tracking-widest h-10 px-4 rounded-lg", activeFilter === 'missing-link' ? "bg-white text-indigo-600" : "text-white/60")}
              >
                No Links
              </Button>
              <Button 
                variant="ghost" size="sm" 
                onClick={() => setActiveFilter('all')}
                className={cn("text-[9px] font-black uppercase tracking-widest h-10 px-4 rounded-lg", activeFilter === 'all' ? "bg-white text-indigo-600" : "text-white/60")}
              >
                All Songs
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden bg-slate-900/50">
          <ScrollArea className="h-full w-full">
            <div className="p-4 sm:p-6 space-y-3">
              {auditList.map((song) => {
                const isEditing = editingId === song.id;
                const sheetUrl = (song as any).sheet_music_url || song.pdfUrl || song.leadsheetUrl;
                const hasLink = activeTab === 'ug' ? !!song.ugUrl : !!sheetUrl;
                const isVerified = activeTab === 'ug' ? song.is_ug_link_verified : (song as any).is_sheet_verified;

                return (
                  <div key={song.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-4 group hover:bg-white/10 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="bg-slate-800 p-2.5 rounded-xl text-slate-500">
                          <Music className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-sm uppercase tracking-tight truncate">{song.name}</h4>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{song.artist || "Unknown Artist"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Paste URL..." className="h-9 w-48 bg-black/40 text-[10px]" />
                            <Button onClick={() => handleVerify(song, editValue)} className="h-9 px-3 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-lg">Save</Button>
                          </div>
                        ) : (
                          <>
                            {hasLink && (
                              <Button variant="ghost" size="sm" onClick={() => window.open(activeTab === 'ug' ? song.ugUrl : sheetUrl, '_blank')} className="h-9 px-3 bg-white/5 text-white font-bold text-[9px] uppercase rounded-xl gap-2">
                                <ExternalLink className="w-3.5 h-3.5" /> Test
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleRebind(song)} className="h-9 px-3 bg-white/5 text-orange-400 font-bold text-[9px] uppercase rounded-xl gap-2">
                              <SearchCode className="w-3.5 h-3.5" /> Find & Bind
                            </Button>
                            {hasLink && !isVerified && (
                              <Button onClick={() => handleVerify(song)} className="h-9 px-4 bg-emerald-600 text-white font-black uppercase text-[9px] rounded-xl gap-2 shadow-lg shadow-emerald-600/20">
                                <ShieldCheck className="w-3.5 h-3.5" /> Verify
                              </Button>
                            )}
                            {isVerified && (
                              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="text-[8px] font-black text-emerald-500 uppercase">Verified</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="p-6 border-t border-white/5 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{auditList.length} Tracks in Scope</span>
             </div>
          </div>
          <p className="text-[9px] font-mono text-slate-700 uppercase">Resource Engine v6.0 // Readiness Impact: High</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResourceAuditModal;
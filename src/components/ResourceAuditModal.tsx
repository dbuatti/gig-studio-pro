"use client";

import React, { useState, useMemo, useCallback } from 'react';
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
  Check,
  Sparkles,
  Loader2
} from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { sanitizeUGUrl } from '@/utils/ugUtils';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { isChordLine, transposeChords, extractKeyFromChords } from '@/utils/chordUtils';
import { calculateSemitones, formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';

interface ResourceAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: SetlistSong[];
  onVerify: (songId: string, updates: Partial<SetlistSong>) => void;
  onOpenStudio?: (songId: string) => void;
  onRefreshRepertoire: () => void;
}

type AuditTab = 'ug' | 'sheets';
type AuditFilter = 'all' | 'missing-content' | 'missing-link' | 'unverified';

const ResourceAuditModal: React.FC<ResourceAuditModalProps> = ({ isOpen, onClose, songs, onVerify, onRefreshRepertoire }) => {
  const { user } = useAuth();
  const { keyPreference: globalPreference } = useSettings();
  const [activeTab, setActiveTab] = useState<AuditTab>('ug');
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<AuditFilter>('missing-content');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isBulkPullingKeys, setIsBulkPullingKeys] = useState(false);

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
          default: return true;
        }
      } else {
        const sheetUrl = (s as any).sheet_music_url || s.pdfUrl || s.leadsheetUrl;
        const hasLink = !!sheetUrl && sheetUrl.trim() !== "";
        switch (activeFilter) {
          case 'missing-link': return !hasLink;
          case 'all': return true;
          default: return true;
        }
      }
    });
  }, [songs, searchTerm, activeFilter, activeTab]);

  const handleVerify = (song: SetlistSong, customUrl?: string) => {
    if (activeTab === 'ug') {
      const urlToVerify = customUrl || song.ugUrl;
      if (!urlToVerify) return;
      onVerify(song.id, { ugUrl: sanitizeUGUrl(urlToVerify) }); 
    } else {
      const urlToVerify = customUrl || (song as any).sheet_music_url || song.pdfUrl || song.leadsheetUrl;
      if (!urlToVerify) return;
      onVerify(song.id, { sheet_music_url: urlToVerify } as any);
    }
    setEditingId(null);
    setEditValue("");
    showSuccess(`Link Saved: ${song.name}`);
  };

  const handleRebind = (song: SetlistSong) => {
    setEditingId(song.id);
    const currentUrl = activeTab === 'ug' ? song.ugUrl : ((song as any).sheet_music_url || song.pdfUrl || song.leadsheetUrl);
    setEditValue(currentUrl || "");
    const query = encodeURIComponent(`${song.artist || ''} ${song.name} ${activeTab === 'ug' ? 'chords' : 'sheet music pdf'}`);
    window.open(activeTab === 'ug' ? `https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}` : `https://www.google.com/search?q=${query}`, '_blank');
  };

  const handlePasteToAudit = useCallback(async (song: SetlistSong) => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) return;
      const resolvedPref = (globalPreference === 'neutral' ? (song.key_preference || 'sharps') : globalPreference) as 'sharps' | 'flats';
      let processedChords = clipboardText;
      const originalKey = song.originalKey || 'C';
      const targetKey = song.targetKey || originalKey;
      const semitones = calculateSemitones(originalKey, targetKey);
      if (semitones !== 0) {
        processedChords = transposeChords(processedChords, semitones, resolvedPref);
      }
      let extractedOriginalKey = song.originalKey;
      if (!extractedOriginalKey || extractedOriginalKey === "TBC") {
        const rawPulledKey = extractKeyFromChords(clipboardText);
        if (rawPulledKey) extractedOriginalKey = formatKey(rawPulledKey, resolvedPref);
      }
      onVerify(song.id, { ug_chords_text: processedChords, is_ug_chords_present: true, originalKey: extractedOriginalKey, isKeyConfirmed: true });
      showSuccess(`Chords for "${song.name}" verified!`);
    } catch (err) {
      showError("Failed to paste chords.");
    }
  }, [onVerify, globalPreference]);

  const handleBulkPullKeys = async () => {
    if (!user) return;
    const songsToProcess = songs.filter(s => s.ug_chords_text && s.ug_chords_text.trim() !== "" && (!s.originalKey || s.originalKey === "TBC"));
    if (songsToProcess.length === 0) return;
    setIsBulkPullingKeys(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-pull-keys', { body: { songIds: songsToProcess.map(s => s.id), userId: user.id } });
      if (error) throw error;
      showSuccess("Bulk Key Pull Complete!");
      onRefreshRepertoire();
    } catch (err: any) {
      showError("Bulk key pull failed.");
    } finally {
      setIsBulkPullingKeys(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl z-[100]">
        <div className="p-6 sm:p-8 bg-indigo-600 shrink-0 relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/70"><X className="w-5 h-5" /></button>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md"><ShieldCheck className="w-6 h-6 text-white" /></div>
              <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">Resource Audit Matrix</DialogTitle>
            </div>
          </DialogHeader>
          <div className="mt-8 flex bg-black/20 p-1 rounded-2xl w-fit">
            <Button variant="ghost" onClick={() => setActiveTab('ug')} className={cn("h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2", activeTab === 'ug' ? "bg-white text-indigo-600 shadow-lg" : "text-white/60")}><Guitar className="w-3.5 h-3.5" /> Chart Links</Button>
            <Button variant="ghost" onClick={() => setActiveTab('sheets')} className={cn("h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2", activeTab === 'sheets' ? "bg-white text-indigo-600 shadow-lg" : "text-white/60")}><FileText className="w-3.5 h-3.5" /> Sheet Music</Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden bg-slate-900/50">
          <ScrollArea className="h-full w-full">
            <div className="p-4 sm:p-6 space-y-3">
              {activeTab === 'ug' && (
                <div className="flex justify-end mb-4">
                  <Button onClick={handleBulkPullKeys} disabled={isBulkPullingKeys} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] rounded-xl gap-2 h-10 px-6">
                    {isBulkPullingKeys ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Bulk Pull Keys
                  </Button>
                </div>
              )}
              {auditList.map((song) => (
                <div key={song.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-4 group hover:bg-white/10 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="bg-slate-800 p-2.5 rounded-xl text-slate-500 shrink-0"><Music className="w-5 h-5" /></div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-sm md:text-base uppercase tracking-tight truncate">{song.name}</h4>
                        <p className="text-xs md:text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 truncate">{song.artist || "Unknown Artist"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {editingId === song.id ? (
                        <div className="flex gap-2 w-full md:w-auto">
                          <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Paste URL..." className="h-9 w-full md:w-48 bg-black/40 text-[10px]" />
                          <Button onClick={() => handleVerify(song, editValue)} className="h-9 px-3 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-lg">Save</Button>
                        </div>
                      ) : (
                        <>
                          {activeTab === 'ug' && activeFilter === 'missing-content' && !!song.ugUrl && !song.ug_chords_text && (
                            <Button onClick={() => handlePasteToAudit(song)} className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] rounded-xl gap-2 shadow-lg shadow-indigo-600/20"><ClipboardPaste className="w-3.5 h-3.5" /> Paste Chords</Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleRebind(song)} className="h-8 px-2 bg-white/5 text-orange-400 font-bold text-[8px] uppercase rounded-xl gap-2"><SearchCode className="w-3 h-3" /> Find & Bind</Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResourceAuditModal;
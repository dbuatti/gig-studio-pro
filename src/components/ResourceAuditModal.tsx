"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  onRefreshRepertoire: () => void; // New prop to refresh parent's repertoire
}

type AuditTab = 'ug' | 'sheets';
type AuditFilter = 'all' | 'missing-content' | 'missing-link' | 'unverified';

const ResourceAuditModal: React.FC<ResourceAuditModalProps> = ({ isOpen, onClose, songs, onVerify, onRefreshRepertoire }) => {
  const { user } = useAuth();
  const { keyPreference } = useSettings();
  const [activeTab, setActiveTab] = useState<AuditTab>('ug');
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<AuditFilter>('unverified');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [hoveredSongId, setHoveredSongId] = useState<string | null>(null);
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
          case 'missing-content': return hasLink && !hasChords; // Refined logic
          case 'missing-link': return !hasLink;
          case 'all': return true;
          case 'unverified':
          default: return hasLink && !hasChords; // If UG link exists but no chords, it needs audit
        }
      } else {
        const sheetUrl = (s as any).sheet_music_url || s.pdfUrl || s.leadsheetUrl;
        const hasLink = !!sheetUrl && sheetUrl.trim() !== "";
        const isVerified = (s as any).is_sheet_verified;

        switch (activeFilter) {
          case 'missing-link': return !hasLink;
          case 'all': return true;
          case 'unverified':
          default: return hasLink && !isVerified; // Only unverified if there's a link
        }
      }
    });
  }, [songs, searchTerm, activeFilter, activeTab]);

  const handleVerify = (song: SetlistSong, customUrl?: string) => {
    if (activeTab === 'ug') {
      const urlToVerify = customUrl || song.ugUrl;
      if (!urlToVerify) return;
      onVerify(song.id, { ugUrl: sanitizeUGUrl(urlToVerify) }); // No is_ug_link_verified
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
    if (activeTab === 'ug') {
      window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`, '_blank');
    } else {
      window.open(`https://www.google.com/search?q=${query}`, '_blank');
    }
  };

  const handlePasteToAudit = useCallback(async (song: SetlistSong) => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        showError("Clipboard is empty.");
        return;
      }

      if (!isChordLine(clipboardText) && !clipboardText.includes('[Verse]') && !clipboardText.includes('[Chorus]')) {
        showError("Clipboard content does not appear to be chord data.");
        return;
      }

      let processedChords = clipboardText;
      const originalKey = song.originalKey || 'C';
      const targetKey = song.targetKey || originalKey;
      const semitones = calculateSemitones(originalKey, targetKey);

      if (semitones !== 0) {
        processedChords = transposeChords(processedChords, semitones, keyPreference);
      }

      let extractedOriginalKey = song.originalKey;
      let newTargetKey = song.targetKey;
      let newPitch = song.pitch;
      let isKeyConfirmed = song.isKeyConfirmed;

      if (!extractedOriginalKey || extractedOriginalKey === "TBC") {
        const rawPulledKey = extractKeyFromChords(clipboardText);
        if (rawPulledKey) {
          extractedOriginalKey = formatKey(rawPulledKey, keyPreference);
          newTargetKey = extractedOriginalKey; // Set targetKey to be the same
          newPitch = 0; // Reset pitch to 0
          isKeyConfirmed = true; // Mark as confirmed
          showInfo(`Automatically pulled key "${extractedOriginalKey}" from pasted chords.`);
        }
      }

      onVerify(song.id, {
        ug_chords_text: processedChords,
        is_ug_chords_present: true,
        isMetadataConfirmed: true,
        originalKey: extractedOriginalKey,
        targetKey: newTargetKey,
        pitch: newPitch,
        isKeyConfirmed: isKeyConfirmed,
      });
      showSuccess(`Chords for "${song.name}" pasted & verified!`);

    } catch (err) {
      console.error("Failed to paste chords:", err);
      showError("Failed to paste chords. Ensure clipboard access is granted.");
    }
  }, [onVerify, keyPreference]);

  const handleBulkPullKeys = async () => {
    if (!user) {
      showError("User not authenticated.");
      return;
    }

    const songsToProcess = songs.filter(s => 
      s.ug_chords_text && s.ug_chords_text.trim() !== "" && (!s.originalKey || s.originalKey === "TBC")
    );

    if (songsToProcess.length === 0) {
      showInfo("No songs found with chords but missing original key.");
      return;
    }

    if (!confirm(`Are you sure you want to pull keys for ${songsToProcess.length} songs? This will update their original key, target key, and pitch.`)) {
      return;
    }

    setIsBulkPullingKeys(true);
    showInfo(`Initiating bulk key extraction for ${songsToProcess.length} songs...`);

    try {
      const { data, error } = await supabase.functions.invoke('bulk-pull-keys', {
        body: { songIds: songsToProcess.map(s => s.id), userId: user.id }
      });

      if (error) throw error;

      const successful = data.results.filter((r: any) => r.status === 'SUCCESS').length;
      const failed = data.results.filter((r: any) => r.status === 'ERROR').length;
      const skipped = data.results.filter((r: any) => r.status === 'SKIPPED').length;

      showSuccess(`Bulk Key Pull Complete! ${successful} successful, ${failed} failed, ${skipped} skipped.`);
      onRefreshRepertoire(); // Refresh the parent component's repertoire data
    } catch (err: any) {
      console.error("Bulk key pull failed:", err);
      showError(`Bulk key pull failed: ${err.message}`);
    } finally {
      setIsBulkPullingKeys(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (isOpen && (event.metaKey || event.ctrlKey) && event.key === 'v') {
        event.preventDefault();
        if (hoveredSongId && activeTab === 'ug' && activeFilter === 'missing-content') {
          const songToPaste = songs.find(s => s.id === hoveredSongId);
          if (songToPaste) {
            await handlePasteToAudit(songToPaste);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hoveredSongId, activeTab, activeFilter, handlePasteToAudit, songs]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl z-[100]">
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

            {/* RESPONSIVE FILTER BUTTONS - FIXED SECTION */}
            <div className="flex flex-wrap gap-2 bg-black/20 p-2 rounded-xl shrink-0">
              <Button 
                variant="ghost" size="sm" 
                onClick={() => setActiveFilter('unverified')}
                className={cn(
                  "text-[9px] font-black uppercase tracking-widest h-9 px-3 rounded-lg flex-shrink-0",
                  activeFilter === 'unverified' ? "bg-white text-indigo-600" : "text-white/60"
                )}
              >
                Needs Audit
              </Button>
              {activeTab === 'ug' && (
                <Button 
                  variant="ghost" size="sm" 
                  onClick={() => setActiveFilter('missing-content')}
                  className={cn(
                    "text-[9px] font-black uppercase tracking-widest h-9 px-3 rounded-lg flex-shrink-0",
                    activeFilter === 'missing-content' ? "bg-white text-indigo-600" : "text-white/60"
                  )}
                >
                  Empty Sheets
                </Button>
              )}
              <Button 
                variant="ghost" size="sm" 
                onClick={() => setActiveFilter('missing-link')}
                className={cn(
                  "text-[9px] font-black uppercase tracking-widest h-9 px-3 rounded-lg flex-shrink-0",
                  activeFilter === 'missing-link' ? "bg-white text-indigo-600" : "text-white/60"
                )}
              >
                No Links
              </Button>
              <Button 
                variant="ghost" size="sm" 
                onClick={() => setActiveFilter('all')}
                className={cn(
                  "text-[9px] font-black uppercase tracking-widest h-9 px-3 rounded-lg flex-shrink-0",
                  activeFilter === 'all' ? "bg-white text-indigo-600" : "text-white/60"
                )}
              >
                All Songs
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden bg-slate-900/50">
          <ScrollArea className="h-full w-full">
            <div className="p-4 sm:p-6 space-y-3">
              {activeTab === 'ug' && (
                <div className="flex justify-end mb-4">
                  <Button 
                    onClick={handleBulkPullKeys}
                    disabled={isBulkPullingKeys}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] rounded-xl gap-2 shadow-lg shadow-indigo-600/20 h-10 px-6"
                  >
                    {isBulkPullingKeys ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Bulk Pull Keys
                  </Button>
                </div>
              )}
              {auditList.map((song) => {
                const isEditing = editingId === song.id;
                const sheetUrl = (song as any).sheet_music_url || song.pdfUrl || song.leadsheetUrl;
                const hasLink = activeTab === 'ug' ? !!song.ugUrl : !!sheetUrl;
                const isVerified = activeTab === 'ug' ? !!song.ugUrl && !!song.ug_chords_text : (song as any).is_sheet_verified; // UG is verified if link and chords exist
                const hasChords = !!song.ug_chords_text && song.ug_chords_text.trim() !== "";

                return (
                  <div 
                    key={song.id} 
                    className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-4 group hover:bg-white/10 transition-all"
                    onMouseEnter={() => setHoveredSongId(song.id)}
                    onMouseLeave={() => setHoveredSongId(null)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="bg-slate-800 p-2.5 rounded-xl text-slate-500 shrink-0">
                          <Music className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-sm md:text-base uppercase tracking-tight truncate">{song.name}</h4>
                          <p className="text-xs md:text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 truncate">{song.artist || "Unknown Artist"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Paste URL..." className="h-9 w-48 bg-black/40 text-[10px]" />
                            <Button onClick={() => handleVerify(song, editValue)} className="h-9 px-3 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-lg">Save</Button>
                          </div>
                        ) : (
                          <>
                            {activeTab === 'ug' && activeFilter === 'missing-content' && hasLink && ( // Only show if link exists but chords are missing
                              <Button 
                                onClick={() => handlePasteToAudit(song)}
                                className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] rounded-xl gap-2 shadow-lg shadow-indigo-600/20"
                              >
                                <ClipboardPaste className="w-3.5 h-3.5" /> Paste Chords
                              </Button>
                            )}
                            {hasLink && (
                              <Button variant="ghost" size="sm" onClick={() => window.open(activeTab === 'ug' ? song.ugUrl : sheetUrl, '_blank')} className="h-8 px-2 bg-white/5 text-white font-bold text-[8px] uppercase rounded-xl gap-2">
                                <ExternalLink className="w-3 h-3" /> Test
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleRebind(song)} className="h-8 px-2 bg-white/5 text-orange-400 font-bold text-[8px] uppercase rounded-xl gap-2">
                              <SearchCode className="w-3 h-3" /> Find & Bind
                            </Button>
                            {hasLink && !isVerified && (
                              <Button onClick={() => handleVerify(song)} className="h-9 px-3 bg-emerald-600 text-white font-black uppercase text-[9px] rounded-xl gap-2 shadow-lg shadow-emerald-600/20">
                                <ShieldCheck className="w-3.5 h-3.5" /> Verify
                              </Button>
                            )}
                            {hasLink && isVerified && ( // Show verified badge if link exists and is verified
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
"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ClipboardPaste, AlertCircle, ListPlus, Youtube, Wand2, Music } from 'lucide-react';
import { SetlistSong } from './SetlistManagementModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError } from '@/utils/toast';
import { syncToMasterRepertoire } from '@/utils/repertoireSync'; // Import syncToMasterRepertoire

interface ImportSetlistProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (songs: Partial<SetlistSong>[]) => Promise<void>;
}

const ImportSetlist: React.FC<ImportSetlistProps> = ({ isOpen, onClose, onImport }) => {
  const { user } = useAuth();
  const [rawText, setRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isYoutubeMode, setIsYoutubeMode] = useState(false);
  const [parsedSongs, setParsedSongs] = useState<SetlistSong[]>([]);

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    setParsedSongs([]);
    
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 5);
    const importedSongs: SetlistSong[] = [];

    for (const line of lines) {
      let name = line;
      let artist = "Unknown Artist";
      let youtubeUrl = undefined;
      let ugUrl = undefined;

      // Simple heuristic: split by common delimiters if not in YouTube mode
      if (!isYoutubeMode) {
        const parts = line.split(/ - | by /i).map(p => p.trim());
        if (parts.length >= 2) {
          name = parts[0];
          artist = parts.slice(1).join(' - ');
        }
      }

      // Simple URL detection (can be improved)
      const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        const url = urlMatch[0];
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          youtubeUrl = url;
          name = line.replace(urlMatch[0], '').trim() || `${artist} Track`;
        } else if (url.includes('ultimate-guitar.com')) {
          ugUrl = url;
          name = line.replace(urlMatch[0], '').trim() || `${artist} Tab`;
        }
      }

      if (name === "Unknown Artist Track" || name === "Unknown Artist Tab") {
        name = line; // Fallback if parsing failed badly
      }

      importedSongs.push({
        id: crypto.randomUUID(),
        name: name,
        artist: artist,
        youtubeUrl: youtubeUrl,
        ugUrl: ugUrl,
        originalKey: 'TBC',
        targetKey: 'TBC',
        isPlayed: false,
        is_ready_to_sing: true,
        is_pitch_linked: true,
        isKeyConfirmed: false,
        isApproved: false,
        extraction_status: 'idle',
        sync_status: 'IDLE',
        metadata_source: 'manual_import',
      });
    }

    setParsedSongs(importedSongs);
    setIsParsing(false);
  };

  const handleImportToMaster = async () => {
    if (!user || parsedSongs.length === 0) return;
    setIsAdding(true);
    
    const songsToSync = parsedSongs.map(s => ({
      title: s.name,
      artist: s.artist,
      youtube_url: s.youtubeUrl,
      ug_url: s.ugUrl,
      original_key: s.originalKey,
      target_key: s.targetKey,
      is_pitch_linked: s.is_pitch_linked,
      is_ready_to_sing: s.is_ready_to_sing,
      metadata_source: 'manual_import',
      sync_status: 'IDLE',
      extraction_status: 'idle',
    }));

    try {
      const syncedData = await syncToMasterRepertoire(user.id, songsToSync);
      await onImport(syncedData);
      showSuccess(`Successfully imported ${syncedData.length} songs to master repertoire.`);
      onClose();
    } catch (err: any) {
      showError(`Import failed: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-popover border-border rounded-[2rem] p-0 shadow-2xl">
        <DialogHeader className="p-6 bg-indigo-600/10 border-b border-border">
          <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tight text-white">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <ClipboardPaste className="w-6 h-6 text-white" />
            </div>
            Setlist Importer
          </DialogTitle>
          <DialogDescription className="text-indigo-200 font-medium">
            Paste raw text or URLs to quickly populate a setlist or repertoire.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Input Mode</Label>
            <div className="flex items-center gap-2">
              <Switch checked={isYoutubeMode} onCheckedChange={setIsYoutubeMode} className="data-[state=checked]:bg-red-600" />
              <Label htmlFor="yt-mode" className="text-xs font-bold text-foreground">YouTube/URL Focus</Label>
            </div>
          </div>
          
          <Textarea
            placeholder={isYoutubeMode ? "Paste one YouTube URL per line..." : "Paste song list (e.g., Song Name - Artist, or URL)"}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="min-h-[150px] bg-background border-border rounded-xl text-sm font-medium placeholder:text-slate-600"
          />

          <Button 
            onClick={handleParse} 
            disabled={isParsing || !rawText.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] h-10 rounded-xl gap-2"
          >
            {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Parse Input ({rawText.split('\n').filter(l => l.trim()).length} Lines)
          </Button>

          {parsedSongs.length > 0 && (
            <div className="border border-indigo-500/30 bg-indigo-900/10 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                <h5 className="text-sm font-bold text-indigo-300 flex items-center gap-2"><ListPlus className="w-4 h-4" /> Parsed Songs ({parsedSongs.length})</h5>
                <p className="text-[9px] font-mono text-indigo-400">{parsedSongs.filter(s => s.youtubeUrl).length} YT links found</p>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                {parsedSongs.map((song, index) => (
                  <div key={index} className="flex items-center justify-between text-xs text-white/90">
                    <span className="truncate flex-1">{song.name} - {song.artist}</span>
                    {song.youtubeUrl && <Youtube className="w-3 h-3 text-red-400 ml-2 shrink-0" />}
                    {song.ugUrl && <Guitar className="w-3 h-3 text-green-400 ml-1 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t border-border bg-secondary">
          <Button onClick={onClose} variant="ghost" className="flex-1 font-black uppercase tracking-widest text-xs h-12 rounded-xl text-foreground hover:bg-accent">
            Cancel
          </Button>
          <Button 
            onClick={handleImportToMaster} 
            disabled={parsedSongs.length === 0 || isAdding}
            className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-[0.2em] text-xs h-12 rounded-xl shadow-xl shadow-emerald-600/20 gap-3"
          >
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Import to Master Library ({parsedSongs.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportSetlist;
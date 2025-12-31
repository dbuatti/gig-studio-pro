"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ClipboardPaste, AlertCircle, HelpCircle, ListPlus, Youtube, Wand2, Music } from 'lucide-react';
import { SetlistSong } from './SetlistManager';

interface ImportSetlistProps {
  onImport: (songs: SetlistSong[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

const ImportSetlist: React.FC<ImportSetlistProps> = ({ onImport, isOpen, onClose }) => {
  const [text, setText] = useState("");
  const [includeYoutube, setIncludeYoutube] = useState(true);

  const parseText = (content: string): SetlistSong[] => {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const newSongs: SetlistSong[] = [];

    lines.forEach(line => {
      let title = "";
      let artist = "Unknown Artist";
      let originalKey = "C";
      let youtubeUrl = undefined;

      // Pattern 1: Markdown Table | # | Title | Artist | Key | ...
      if (line.includes('|') && !line.includes('---') && !line.includes('Song Title')) {
        const columns = line.split('|').map(c => c.trim()).filter(c => c !== "");
        if (columns.length >= 2) {
          // Detect if col 0 is a number, if so shift
          const startIdx = /^\d+$/.test(columns[0]) ? 1 : 0;
          title = columns[startIdx].replace(/\*\*/g, '');
          artist = columns[startIdx + 1]?.replace(/\*\*/g, '') || "Unknown Artist";
          
          // Look for key in remaining columns
          const possibleKey = columns.find((c, i) => i > startIdx + 1 && /^[A-G][#b]?m?$/.test(c));
          if (possibleKey) originalKey = possibleKey;
        }
      } 
      // Pattern 2: OnSong / Standard List "Artist - Title" or "Title - Artist"
      else if (line.includes(' - ')) {
        const parts = line.split(' - ').map(p => p.trim());
        // Simple heuristic: Usually longer part or part with spaces is title, 
        // but often it's Artist - Title.
        artist = parts[0];
        title = parts[1];
        
        // Check for trailing key like "Artist - Title (G)"
        const keyMatch = line.match(/\((([A-G][#b]?m?))\)$/);
        if (keyMatch) originalKey = keyMatch[1];
      }
      // Pattern 3: Simple "Title by Artist"
      else if (line.toLowerCase().includes(' by ')) {
        const parts = line.split(/ by /i).map(p => p.trim());
        title = parts[0];
        artist = parts[1];
      }
      // Pattern 4: Just the title (with optional number prefix)
      else {
        // Remove leading numbers like "01. " or "1) "
        title = line.replace(/^\d+[\.\)\-\s]+/, '');
      }

      // Cleanup Title/Artist (remove quotes, etc)
      title = title.replace(/^["']|["']$/g, '').trim();
      artist = artist.replace(/^["']|["']$/g, '').trim();

      if (title) {
        if (includeYoutube) {
          const ytMatch = line.match(/\((https:\/\/www\.youtube\.com\/watch\?v=[^)]+)\)/);
          youtubeUrl = ytMatch ? ytMatch[1] : undefined;
        }

        newSongs.push({
          id: crypto.randomUUID(),
          name: title,
          artist: artist,
          previewUrl: "", 
          youtubeUrl,
          originalKey: originalKey,
          targetKey: originalKey,
          pitch: 0,
          isplayed: false, // <-- Fixed here
          isSyncing: true,
          isMetadataConfirmed: false
        });
      }
    });

    return newSongs;
  };

  const handleImport = () => {
    const songs = parseText(text);
    if (songs.length > 0) {
      onImport(songs);
      onClose();
      setText("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold uppercase tracking-tight shadow-sm hover:shadow-md transition-all">
          <ClipboardPaste className="w-4 h-4" /> Smart Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-popover border-none shadow-2xl rounded-[2rem] p-0 overflow-hidden">
        <div className="bg-indigo-600 p-8 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <ListPlus className="w-8 h-8" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Gig Ingest Engine</DialogTitle>
              <DialogDescription className="text-indigo-100 font-medium">Supporting OnSong, Markdown, and Plain Text formats.</DialogDescription>
            </div>
          </div>
          <Wand2 className="w-8 h-8 opacity-20 animate-pulse" />
        </div>
        
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 dark:bg-red-600/10 p-2.5 rounded-xl">
                  <Youtube className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <Label htmlFor="yt-toggle" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Audio Discovery</Label>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5">Auto-link Reference Media</p>
                </div>
              </div>
              <Switch 
                id="yt-toggle" 
                checked={includeYoutube} 
                onCheckedChange={setIncludeYoutube}
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <div className="bg-emerald-100 dark:bg-emerald-600/10 p-2.5 rounded-xl">
                <Music className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Auto-Metadata</Label>
                <p className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5">AI Engine Level 2 Active</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Pasted Content Buffer</Label>
              <span className="text-[10px] font-black text-indigo-500 uppercase">Pro Tip: Use 'Artist - Title'</span>
            </div>
            <Textarea 
              placeholder="Paste your OnSong list, Markdown table, or plain song list here..." 
              className="min-h-[300px] font-mono text-sm bg-card border-border focus-visible:ring-indigo-500 rounded-2xl p-6 shadow-inner resize-none text-foreground"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-4 p-5 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
            <AlertCircle className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-tight">Intelligence Report</p>
              <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 mt-1 leading-relaxed">
                The engine will attempt to extract the song name, artist, and musical key automatically. After import, the AI background worker will verify these details and link professional reference audio.
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 bg-secondary border-t border-border flex flex-col sm:flex-row gap-4">
          <Button variant="ghost" onClick={onClose} className="flex-1 font-black uppercase tracking-widest text-xs h-12 rounded-xl text-foreground hover:bg-accent dark:hover:bg-secondary">Discard</Button>
          <Button 
            onClick={handleImport} 
            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-xs h-12 rounded-xl shadow-xl shadow-indigo-500/20 gap-3"
            disabled={!text.trim()}
          >
            <ListPlus className="w-4 h-4" /> Deploy to Setlist
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportSetlist;
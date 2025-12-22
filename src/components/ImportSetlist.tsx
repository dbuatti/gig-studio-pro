"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileDown, ClipboardPaste, AlertCircle } from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { calculateSemitones } from '@/utils/keyUtils';

interface ImportSetlistProps {
  onImport: (songs: SetlistSong[]) => void;
}

const ImportSetlist: React.FC<ImportSetlistProps> = ({ onImport }) => {
  const [text, setText] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleImport = () => {
    const lines = text.split('\n');
    const newSongs: SetlistSong[] = [];
    
    // Simple Markdown table parser
    // Looks for rows like | Seq | Song Title | ... | Key | ... | [Watch](url) |
    lines.forEach(line => {
      if (line.includes('|') && !line.includes('---') && !line.includes('Song Title')) {
        const columns = line.split('|').map(c => c.trim()).filter(c => c !== "");
        
        if (columns.length >= 2) {
          // Assuming common structure from user prompt
          // | Seq | Title | Artist/Ref | Genre | Energy | Key | Dur | Played | YT |
          // Title is usually index 1, Key is index 5 or 4
          const title = columns[1].replace(/\*\*/g, '');
          const originalKey = columns[5] || "C";
          
          // Extract URL from [Watch](url)
          const ytMatch = line.match(/\((https:\/\/www\.youtube\.com\/watch\?v=[^)]+)\)/);
          const youtubeUrl = ytMatch ? ytMatch[1] : undefined;

          newSongs.push({
            id: Math.random().toString(36).substr(2, 9),
            name: title,
            previewUrl: "", // Needs linking
            youtubeUrl,
            originalKey: originalKey,
            targetKey: originalKey, // Default to original
            pitch: 0
          });
        }
      }
    });

    if (newSongs.length > 0) {
      onImport(newSongs);
      setIsOpen(false);
      setText("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
          <FileDown className="w-4 h-4" /> Import Markdown
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-indigo-600" />
            Setlist Markdown Importer
          </DialogTitle>
          <DialogDescription>
            Paste your Markdown table below. It will automatically detect titles, keys, and YouTube links.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Textarea 
            placeholder="| Seq | Song Title | Key | YouTube Reference | ..." 
            className="min-h-[300px] font-mono text-xs bg-slate-50 border-indigo-100"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-800 leading-relaxed">
              Songs imported from tables will be marked as <b>"Offline/Metadata Only"</b>. 
              You will need to search for them or upload an audio file to enable the Transposer Studio playback engine.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleImport} className="bg-indigo-600 hover:bg-indigo-700" disabled={!text.trim()}>
            Populate Setlist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportSetlist;
"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ClipboardPaste, AlertCircle, HelpCircle, ListPlus, Youtube } from 'lucide-react';
import { SetlistSong } from './SetlistManager';

interface ImportSetlistProps {
  onImport: (songs: SetlistSong[]) => void;
}

const ImportSetlist: React.FC<ImportSetlistProps> = ({ onImport }) => {
  const [text, setText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [includeYoutube, setIncludeYoutube] = useState(true);

  const handleImport = () => {
    const lines = text.split('\n');
    const newSongs: SetlistSong[] = [];
    
    lines.forEach(line => {
      // Look for standard table/list patterns
      if (line.includes('|') && !line.includes('---') && !line.includes('Song Title')) {
        const columns = line.split('|').map(c => c.trim()).filter(c => c !== "");
        
        if (columns.length >= 2) {
          const title = columns[1].replace(/\*\*/g, '');
          const artist = columns[2]?.replace(/\*\*/g, '') || "Unknown Artist";
          
          // Smart detection for columns 3 and 4
          // Often tables are: | # | Title | Artist | Duration | Key |
          // or: | # | Title | Artist | Key | BPM |
          let originalKey = "C";
          let durationSeconds = 210; // Default 3:30

          // Check if column 3 is a duration (e.g., 5:55)
          const col3 = columns[3]?.replace(/\*\*/g, '') || "";
          const col4 = columns[4]?.replace(/\*\*/g, '') || "";

          const isDuration = (val: string) => /^\d{1,2}:\d{2}$/.test(val);

          if (isDuration(col3)) {
            // Col 3 is duration, Col 4 is likely Key
            const parts = col3.split(':');
            durationSeconds = (parseInt(parts[0]) * 60) + parseInt(parts[1]);
            originalKey = col4 || "C";
          } else if (isDuration(col4)) {
            // Col 4 is duration, Col 3 is likely Key
            const parts = col4.split(':');
            durationSeconds = (parseInt(parts[0]) * 60) + parseInt(parts[1]);
            originalKey = col3 || "C";
          } else {
            // Fallback: Col 3 is Key
            originalKey = col3 || "C";
          }
          
          let youtubeUrl = undefined;
          if (includeYoutube) {
            const ytMatch = line.match(/\((https:\/\/www\.youtube\.com\/watch\?v=[^)]+)\)/);
            youtubeUrl = ytMatch ? ytMatch[1] : undefined;
          }

          newSongs.push({
            id: Math.random().toString(36).substr(2, 9),
            name: title,
            artist: artist,
            previewUrl: "", 
            youtubeUrl,
            originalKey: originalKey,
            targetKey: originalKey,
            pitch: 0,
            duration_seconds: durationSeconds
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
        <Button variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold uppercase tracking-tight">
          <ClipboardPaste className="w-4 h-4" /> Paste Song List
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
            <ListPlus className="w-6 h-6 text-indigo-600" />
            Add Songs in Bulk
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Copy a table from Google Docs, ChatGPT, or Excel and paste it below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-slate-50 dark:bg-slate-900 border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <Youtube className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <Label htmlFor="yt-toggle" className="text-sm font-bold">Import YouTube References</Label>
                <p className="text-[10px] text-slate-500">Extracts video links if present in the pasted text.</p>
              </div>
            </div>
            <Switch 
              id="yt-toggle" 
              checked={includeYoutube} 
              onCheckedChange={setIncludeYoutube}
            />
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 border rounded-lg p-4 space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <HelpCircle className="w-3 h-3" /> Quick Instructions
            </h4>
            <ol className="text-xs space-y-1 text-slate-600 dark:text-slate-400 list-decimal list-inside">
              <li>Highlight the table in your document.</li>
              <li>Press <b>Ctrl+C</b> (or Cmd+C) to copy.</li>
              <li>Paste it into the box below.</li>
            </ol>
            <div className="p-2 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 rounded font-mono text-[9px] text-slate-400 italic">
              Example: | 01 | At Last | Michael Bublé | 3:30 | B |
            </div>
          </div>

          <Textarea 
            placeholder="Paste your table text here..." 
            className="min-h-[250px] font-mono text-xs bg-slate-50 dark:bg-slate-900 border-indigo-100 focus-visible:ring-indigo-500"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/50">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400 leading-tight">Smart Column Detection</p>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-500/80 mt-1 leading-relaxed">
                The engine now automatically detects durations (like 5:55) and skips them to find the correct musical key.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="font-bold uppercase tracking-widest text-[10px]">Cancel</Button>
          <Button onClick={handleImport} className="bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-widest text-[10px] px-8" disabled={!text.trim()}>
            Build Gig List
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportSetlist;
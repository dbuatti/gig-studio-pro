"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardPaste, AlertCircle, HelpCircle, ListPlus } from 'lucide-react';
import { SetlistSong } from './SetlistManager';

interface ImportSetlistProps {
  onImport: (songs: SetlistSong[]) => void;
}

const ImportSetlist: React.FC<ImportSetlistProps> = ({ onImport }) => {
  const [text, setText] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleImport = () => {
    const lines = text.split('\n');
    const newSongs: SetlistSong[] = [];
    
    lines.forEach(line => {
      if (line.includes('|') && !line.includes('---') && !line.includes('Song Title')) {
        const columns = line.split('|').map(c => c.trim()).filter(c => c !== "");
        
        if (columns.length >= 2) {
          const title = columns[1].replace(/\*\*/g, '');
          const originalKey = columns[5] || "C";
          
          const ytMatch = line.match(/\((https:\/\/www\.youtube\.com\/watch\?v=[^)]+)\)/);
          const youtubeUrl = ytMatch ? ytMatch[1] : undefined;

          newSongs.push({
            id: Math.random().toString(36).substr(2, 9),
            name: title,
            previewUrl: "", 
            youtubeUrl,
            originalKey: originalKey,
            targetKey: originalKey,
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
              Example: | 01 | At Last | Michael Bublé | B | ...
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
              <p className="text-[11px] font-bold text-amber-800 dark:text-amber-400 leading-tight">Link Audio Later</p>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-500/80 mt-1 leading-relaxed">
                Pasting a list adds song titles and keys only. Once added, click <b>"Link Engine"</b> in your setlist to connect them to the audio transposer.
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
"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ClipboardPaste, AlertCircle, HelpCircle, ListPlus, Youtube, Wand2, Music, Link as LinkIcon, Globe, Loader2 } from 'lucide-react';
import { SetlistSong } from './SetlistManager';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from "@/lib/utils";

interface ImportSetlistProps {
  onImport: (songs: SetlistSong[]) => void;
}

const ImportSetlist: React.FC<ImportSetlistProps> = ({ onImport }) => {
  const [text, setText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [includeYoutube, setIncludeYoutube] = useState(true);
  const [activeMode, setActiveMode] = useState<'text' | 'url'>('text');

  const parseText = (content: string): SetlistSong[] => {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const newSongs: SetlistSong[] = [];

    lines.forEach(line => {
      let title = "";
      let artist = "Unknown Artist";
      let originalKey = "C";
      let youtubeUrl = undefined;

      if (line.includes('|') && !line.includes('---') && !line.includes('Song Title')) {
        const columns = line.split('|').map(c => c.trim()).filter(c => c !== "");
        if (columns.length >= 2) {
          const startIdx = /^\d+$/.test(columns[0]) ? 1 : 0;
          title = columns[startIdx].replace(/\*\*/g, '');
          artist = columns[startIdx + 1]?.replace(/\*\*/g, '') || "Unknown Artist";
          const possibleKey = columns.find((c, i) => i > startIdx + 1 && /^[A-G][#b]?m?$/.test(c));
          if (possibleKey) originalKey = possibleKey;
        }
      } 
      else if (line.includes(' - ')) {
        const parts = line.split(' - ').map(p => p.trim());
        artist = parts[0];
        title = parts[1];
        const keyMatch = line.match(/\((([A-G][#b]?m?))\)$/);
        if (keyMatch) originalKey = keyMatch[1];
      }
      else if (line.toLowerCase().includes(' by ')) {
        const parts = line.split(/ by /i).map(p => p.trim());
        title = parts[0];
        artist = parts[1];
      }
      else {
        title = line.replace(/^\d+[\.\)\-\s]+/, '');
      }

      title = title.replace(/^["']|["']$/g, '').trim();
      artist = artist.replace(/^["']|["']$/g, '').trim();

      if (title) {
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
          isPlayed: false,
          isSyncing: true,
          isMetadataConfirmed: false
        });
      }
    });

    return newSongs;
  };

  const handleUrlImport = async () => {
    if (!urlInput.trim()) return;
    setIsUrlLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: [urlInput], mode: 'metadata' }
      });

      if (error) throw error;
      
      const result = Array.isArray(data) ? data[0] : data;
      if (result) {
        const newSong: SetlistSong = {
          id: Math.random().toString(36).substr(2, 9),
          name: result.name || "Unknown Song",
          artist: result.artist || "Unknown Artist",
          previewUrl: "",
          ugUrl: urlInput.includes('ultimate-guitar.com') ? urlInput : result.ugUrl,
          originalKey: result.originalKey || "C",
          targetKey: result.originalKey || "C",
          pitch: 0,
          bpm: result.bpm?.toString(),
          genre: result.genre,
          isPlayed: false,
          isSyncing: false,
          isMetadataConfirmed: true
        };
        onImport([newSong]);
        setIsOpen(false);
        setUrlInput("");
        showSuccess(`Imported "${newSong.name}" from URL`);
      }
    } catch (err) {
      showError("URL Analysis failed. Try manual search.");
    } finally {
      setIsUrlLoading(false);
    }
  };

  const handleImport = () => {
    if (activeMode === 'url') {
      handleUrlImport();
      return;
    }
    const songs = parseText(text);
    if (songs.length > 0) {
      onImport(songs);
      setIsOpen(false);
      setText("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold uppercase tracking-tight shadow-sm hover:shadow-md transition-all">
          <ClipboardPaste className="w-4 h-4" /> Smart Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-slate-50 dark:bg-slate-950 border-none shadow-2xl rounded-[2rem] p-0 overflow-hidden">
        <div className="bg-indigo-600 p-8 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <ListPlus className="w-8 h-8" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Gig Ingest Engine</DialogTitle>
              <DialogDescription className="text-indigo-100 font-medium">Supporting OnSong, Ultimate Guitar Links, and Plain Text.</DialogDescription>
            </div>
          </div>
          <div className="flex bg-black/20 p-1 rounded-xl">
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => setActiveMode('text')}
               className={cn("h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg", activeMode === 'text' ? "bg-white text-indigo-600" : "text-white/60 hover:text-white")}
             >
               <Music className="w-3.5 h-3.5" /> Text
             </Button>
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => setActiveMode('url')}
               className={cn("h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg", activeMode === 'url' ? "bg-white text-indigo-600" : "text-white/60 hover:text-white")}
             >
               <LinkIcon className="w-3.5 h-3.5" /> URL
             </Button>
          </div>
        </div>
        
        <div className="p-8 space-y-6">
          {activeMode === 'url' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Target Ultimate Guitar or Web Link</Label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                    <Input 
                      placeholder="https://tabs.ultimate-guitar.com/tab/..." 
                      className="h-16 pl-12 text-base font-bold bg-white dark:bg-slate-900 border-indigo-100 dark:border-slate-800 focus-visible:ring-indigo-500 rounded-2xl shadow-inner"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                    />
                  </div>
               </div>
               <div className="flex items-start gap-4 p-5 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                <Wand2 className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-tight">AI Metadata Parsing</p>
                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 mt-1 leading-relaxed">
                    Paste an Ultimate Guitar URL. Our engine will visit the link (virtually), identify the song details, artist, and musical key, and prepare it for your performance.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 dark:bg-red-900/30 p-2.5 rounded-xl">
                      <Youtube className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <Label htmlFor="yt-toggle" className="text-xs font-black uppercase tracking-widest text-slate-500">Audio Discovery</Label>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Auto-link Reference Media</p>
                    </div>
                  </div>
                  <Switch id="yt-toggle" checked={includeYoutube} onCheckedChange={setIncludeYoutube} />
                </div>
                <div className="bg-white dark:bg-slate-900 border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2.5 rounded-xl">
                    <Music className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Auto-Metadata</Label>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">AI Engine Level 2 Active</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pasted Content Buffer</Label>
                  <span className="text-[10px] font-black text-indigo-500 uppercase">Pro Tip: Use 'Artist - Title'</span>
                </div>
                <Textarea 
                  placeholder="Paste your OnSong list, Markdown table, or plain song list here..." 
                  className="min-h-[250px] font-mono text-sm bg-white dark:bg-slate-900 border-indigo-100 dark:border-slate-800 focus-visible:ring-indigo-500 rounded-2xl p-6 shadow-inner resize-none"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-100 dark:bg-slate-900/50 border-t flex flex-col sm:flex-row gap-4">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="flex-1 font-black uppercase tracking-widest text-xs h-12 rounded-xl">Discard</Button>
          <Button 
            onClick={handleImport} 
            disabled={activeMode === 'url' ? (!urlInput.trim() || isUrlLoading) : !text.trim()}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-xs h-12 rounded-xl shadow-xl shadow-indigo-500/20 gap-3"
          >
            {isUrlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : activeMode === 'url' ? <Globe className="w-4 h-4" /> : <ListPlus className="w-4 h-4" />}
            {activeMode === 'url' ? "Process URL & Import" : "Deploy to Setlist"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportSetlist;
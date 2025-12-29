"use client";

import React from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon, Youtube, FileText, Printer, Search } from 'lucide-react';
import { showSuccess } from '@/utils/toast';

interface ManualLinkEditorProps {
  activeYoutubeUrl?: string;
  setActiveYoutubeUrl: (url: string) => void;
  activeUgUrl?: string;
  setActiveUgUrl: (url: string) => void;
  songName: string;
  artistName: string;
  handleUgPrint: () => void;
}

const ManualLinkEditor: React.FC<ManualLinkEditorProps> = ({
  activeYoutubeUrl,
  setActiveYoutubeUrl,
  activeUgUrl,
  setActiveUgUrl,
  songName,
  artistName,
  handleUgPrint,
}) => {
  const openYoutubeSearch = (track: string, artist: string) => {
    const searchQuery = encodeURIComponent(`${artist} ${track} official music video`);
    window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
  };

  const openUgSearch = (track: string, artist: string) => {
    const searchQuery = encodeURIComponent(`${artist} ${track} chords`);
    window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${searchQuery}`, '_blank');
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
      <div className="flex items-center justify-between border-b pb-2 mb-2">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <LinkIcon className="w-3.5 h-3.5 text-indigo-500" /> Manual Metadata Links
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[9px] font-bold text-slate-500 uppercase flex items-center justify-between">
            <span>YouTube Full Version</span>
            <button 
              onClick={() => openYoutubeSearch(songName, artistName)}
              className="text-red-500 hover:text-red-600 flex items-center gap-1"
            >
              <Youtube className="w-3 h-3" /> Find
            </button>
          </Label>
          <Input 
            placeholder="Paste YouTube Link..." 
            className="h-8 text-[10px] bg-white border-slate-100" 
            value={activeYoutubeUrl || ""} 
            onChange={(e) => setActiveYoutubeUrl(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[9px] font-bold text-slate-500 uppercase flex items-center justify-between">
            <span>Ultimate Guitar Tab</span>
            <div className="flex gap-2">
              <button onClick={handleUgPrint} className="text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                <Printer className="w-3 h-3" /> Print
              </button>
              <button 
                onClick={() => openUgSearch(songName, artistName)}
                className="text-orange-500 hover:text-orange-600 flex items-center gap-1"
              >
                <FileText className="w-3 h-3" /> Search
              </button>
            </div>
          </Label>
          <Input 
            placeholder="Paste UG Tab Link..." 
            className="h-8 text-[10px] bg-white border-slate-100" 
            value={activeUgUrl || ""} 
            onChange={(e) => setActiveUgUrl(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default ManualLinkEditor;
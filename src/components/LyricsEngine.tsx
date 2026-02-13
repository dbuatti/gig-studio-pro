"use client";

import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Copy, Check, Trash2, Type } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface LyricsEngineProps {
  lyrics: string;
  onUpdate: (newLyrics: string) => void;
  artist?: string;
  title?: string;
  isMobile: boolean;
}

const LyricsEngine: React.FC<LyricsEngineProps> = ({ lyrics, onUpdate, artist, title, isMobile }) => {
  const [isFetching, setIsFetching] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleFetchLyrics = async () => {
    if (!title || !artist) {
      showError("Missing song title or artist for search.");
      return;
    }

    setIsFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-lyrics', {
        body: { title, artist }
      });

      if (error) throw error;

      if (data?.lyrics) {
        onUpdate(data.lyrics);
        showSuccess("Lyrics fetched successfully!");
      } else {
        showError("Could not find lyrics for this track.");
      }
    } catch (err: any) {
      showError("Failed to fetch lyrics. Please try again.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(lyrics);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    showSuccess("Lyrics copied to clipboard");
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight text-white">Lyrics Engine</h3>
          <p className="text-sm text-slate-400 mt-1">Manage and automate lyrics for your performance</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleFetchLyrics}
            disabled={isFetching || !title || !artist}
            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[10px] gap-2.5 rounded-xl shadow-xl shadow-indigo-600/20"
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Auto-Fetch Lyrics
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleCopy}
            disabled={!lyrics}
            className="h-11 w-11 rounded-xl border-white/10 bg-white/5 text-slate-400 hover:text-white"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => onUpdate("")}
            disabled={!lyrics}
            className="h-11 w-11 rounded-xl border-white/10 bg-white/5 text-slate-400 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-slate-900/50 rounded-[2rem] border border-white/10 p-6 flex flex-col relative overflow-hidden">
        <div className="absolute top-6 left-6 pointer-events-none opacity-10">
          <Type className="w-32 h-32 text-white" />
        </div>
        
        <Textarea 
          value={lyrics}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Lyrics will appear here after fetching, or you can paste them manually..."
          className="flex-1 bg-transparent border-none focus-visible:ring-0 text-lg font-medium text-white placeholder-slate-600 resize-none custom-scrollbar leading-relaxed z-10"
        />

        {!lyrics && !isFetching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 pointer-events-none">
            <div className="bg-indigo-600/10 p-6 rounded-[2rem] mb-4">
              <Sparkles className="w-12 h-12 text-indigo-400" />
            </div>
            <h4 className="text-lg font-black text-white uppercase">Empty Lyrics Sheet</h4>
            <p className="text-sm text-slate-500 mt-2 max-w-xs">
              Use the Auto-Fetch button above to instantly pull lyrics for <span className="text-indigo-400 font-bold">"{title}"</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LyricsEngine;
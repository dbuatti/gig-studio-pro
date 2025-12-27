"use client";

import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sparkles, Search, Loader2, PlusCircle } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { AddToGigButton } from './AddToGigButton';
import { useIsMobile } from '@/hooks/use-mobile';

interface LyricsEngineProps {
  lyrics: string;
  onUpdate: (newLyrics: string) => void;
  artist?: string;
  title?: string;
  isMobile: boolean;
}

const LyricsEngine: React.FC<LyricsEngineProps> = ({ lyrics, onUpdate, artist, title, isMobile }) => {
  const [isFormatting, setIsFormatting] = useState(false);
  const isMobileDevice = useIsMobile();

  const handleMagicFormatLyrics = async () => {
    if (!lyrics?.trim()) {
      showError("Paste lyrics first.");
      return;
    }
    setIsFormatting(true);
    try {
      const { data, error = null } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: [lyrics], mode: 'lyrics' }
      });
      if (error) throw error;
      if (data?.lyrics) {
        onUpdate(data.lyrics);
        showSuccess("Lyrics Structuring Complete");
      }
    } catch (err) {
      showError("Lyrics Engine Error.");
    } finally {
      setIsFormatting(false);
    }
  };

  const handleLyricsSearch = () => {
    const query = encodeURIComponent(`${artist || ""} ${title || ""} lyrics`);
    window.open(`https://www.google.com/search?q=${query}`, '_blank');
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-pink-400">Lyrics Engine</h3>
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleLyricsSearch} className="bg-white/5 text-slate-400 text-[9px] h-10 px-4 rounded-xl font-black uppercase gap-2">
            <Search className="w-3.5 h-3.5" /> Search
          </Button>
          <Button variant="outline" onClick={handleMagicFormatLyrics} disabled={isFormatting || !lyrics} className="bg-indigo-600 text-white text-[9px] h-10 px-4 rounded-xl font-black uppercase gap-2">
            {isFormatting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Magic Format
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Textarea 
          placeholder="Paste lyrics..." 
          value={lyrics} 
          onChange={(e) => onUpdate(e.target.value)} 
          className={cn("bg-white/5 border-white/10 text-xl leading-relaxed p-10 font-medium whitespace-pre-wrap h-full", isMobile ? "rounded-2xl" : "rounded-[2.5rem]")} 
        />
      </div>

      {/* NEW: Add to Gig Button for Mobile */}
      {isMobileDevice && (
        <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 p-4 pb-safe -mx-4">
          <AddToGigButton
            songData={{
              name: title,
              artist: artist,
              lyrics: lyrics
            }}
            onAdded={() => {}}
            className="w-full h-14 text-base font-black uppercase tracking-widest gap-3"
            size="lg"
            variant="default"
          />
        </div>
      )}
    </div>
  );
};

export default LyricsEngine;
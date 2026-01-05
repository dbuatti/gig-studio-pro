"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Globe, Music, Loader2, Plus, ShieldCheck, User, Star, FileText, CloudDownload, AlertTriangle } from 'lucide-react'; // NEW: Import CloudDownload and AlertTriangle
import { ScrollArea } from "@/components/ui/scroll-area";
import { SetlistSong } from './SetlistManager';
import { supabase } from '@/integrations/supabase/client';
import { cn } from "@/lib/utils";
import { formatKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';

interface GlobalLibraryProps {
  onImport: (song: Partial<SetlistSong>) => void;
}

const GlobalLibrary: React.FC<GlobalLibraryProps> = ({ onImport }) => {
  const { keyPreference } = useSettings();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const searchGlobal = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select(`
          *,
          profiles!inner(first_name, last_name, is_repertoire_public)
        `)
        .or(`title.ilike.%${searchTerm}%,artist.ilike.%${searchTerm}%`)
        .eq('profiles.is_repertoire_public', true)
        .order('readiness_score', { ascending: false })
        .limit(30);

      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      // console.error("Global search failed:", err); // Removed console.error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) searchGlobal(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 px-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Community Library</span>
          </div>
          {isLoading && <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />}
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input 
            placeholder="Search verified community tracks..." 
            className="pl-9 h-10 border-border bg-background text-xs focus-visible:ring-emerald-500 text-foreground"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-2 pr-4">
          {results.length > 0 ? (
            results.map((song) => {
              const displayKey = formatKey(song.target_key || song.original_key, keyPreference);
              const readiness = song.readiness_score || 0;
              const isProcessing = song.extraction_status === 'processing' || song.extraction_status === 'queued';
              const isExtractionFailed = song.extraction_status === 'failed';
              
              return (
                <div 
                  key={song.id}
                  className="group p-4 bg-card border border-border rounded-2xl hover:border-emerald-200 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black uppercase tracking-tight truncate text-foreground">{song.title}</h4>
                        {readiness >= 90 && <ShieldCheck className="w-3 h-3 text-emerald-500" />}
                        {isProcessing && <CloudDownload className="w-3.5 h-3.5 text-primary animate-bounce" />}
                        {isExtractionFailed && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                      </div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">{song.artist}</p>
                      
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-secondary rounded-md border border-border">
                          <User className="w-2.5 h-2.5 text-muted-foreground" />
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">{song.profiles?.first_name || 'Artist'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                          <span className="text-[9px] font-black text-muted-foreground">{readiness}% READY</span>
                        </div>
                        {song.pdf_url && <FileText className="w-2.5 h-2.5 text-primary" />}
                      </div>
                      {isExtractionFailed && song.last_sync_log && (
                        <p className="text-[8px] text-destructive mt-1 truncate max-w-[150px]">Error: {song.last_sync_log}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[10px] font-mono font-black bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded">
                        {displayKey}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onImport({
                          name: song.title,
                          artist: song.artist,
                          originalKey: song.original_key,
                          targetKey: song.target_key,
                          bpm: song.bpm,
                          lyrics: song.lyrics,
                          // Prioritize audio_url if extraction is completed, otherwise fallback to preview_url
                          previewUrl: song.extraction_status === 'completed' && song.audio_url ? song.audio_url : song.preview_url,
                          youtubeUrl: song.youtube_url,
                          ugUrl: song.ug_url,
                          pdfUrl: song.pdf_url,
                          user_tags: song.user_tags,
                          duration_seconds: song.duration_seconds,
                          isMetadataConfirmed: true,
                          extraction_status: song.extraction_status,
                          last_sync_log: song.last_sync_log,
                          audio_url: song.audio_url, // Map audio_url
                        })}
                        className="h-8 px-3 text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl gap-1.5 transition-all"
                      >
                        <Plus className="w-3 h-3" /> Clone Track
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            query ? (
              !isLoading && (
                <div className="py-20 text-center opacity-30">
                  <Globe className="w-10 h-10 mb-4 mx-auto" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">No community matches found</p>
                </div>
              )
            ) : (
              <div className="py-20 text-center space-y-4 px-6">
                <div className="bg-emerald-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto text-emerald-500">
                  <Globe className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.1em] text-foreground">Verified Community Sourcing</p>
                  <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">Search thousands of tracks with master audio and charts already linked by other pros.</p>
                </div>
              </div>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default GlobalLibrary;
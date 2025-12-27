"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SetlistSong } from './SetlistManager';
import { transposeChords } from '@/utils/chordUtils';
import { useSettings } from '@/hooks/use-settings';
import { cn } from "@/lib/utils";
import { Play, RotateCcw, Download, Palette, Type, AlignCenter, AlignLeft, AlignRight, ExternalLink, Search, Check, Link as LinkIcon, Loader2, PlusCircle } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { AddToGigButton } from './AddToGigButton';
import { useIsMobile } from '@/hooks/use-mobile';

interface UGChordsEditorProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
}

const UGChordsEditor: React.FC<UGChordsEditorProps> = ({ song, formData, handleAutoSave, isMobile }) => {
  const { keyPreference } = useSettings();
  const [chordsText, setChordsText] = useState(formData.ug_chords_text || "");
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [isFetchingUg, setIsFetchingUg] = useState(false);
  const [config, setConfig] = useState(formData.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG);
  const isMobileDevice = useIsMobile();

  const transposedText = useMemo(() => {
    if (!chordsText || transposeSemitones === 0) return chordsText;
    return transposeChords(chordsText, transposeSemitones, keyPreference);
  }, [chordsText, transposeSemitones, keyPreference]);

  useEffect(() => {
    if (chordsText !== formData.ug_chords_text) {
      handleAutoSave({ 
        ug_chords_text: chordsText,
        is_ug_chords_present: !!(chordsText && chordsText.trim().length > 0) // NEW: Update is_ug_chords_present
      });
    }
  }, [chordsText, formData.ug_chords_text, handleAutoSave]);

  useEffect(() => {
    handleAutoSave({
      ug_chords_config: {
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        chordBold: config.chordBold,
        chordColor: config.chordColor,
        lineSpacing: config.lineSpacing,
        textAlign: config.textAlign
      }
    });
  }, [config, handleAutoSave]);

  const handleResetTranspose = () => {
    setTransposeSemitones(0);
    showSuccess("Transpose reset");
  };

  const handleApplyTranspose = () => {
    if (transposedText && transposedText !== chordsText) {
      setChordsText(transposedText);
      setTransposeSemitones(0);
      showSuccess("Transpose applied");
    }
  };

  const handleOpenInUG = () => {
    let url = formData.ugUrl;
    if (!url) {
      const query = encodeURIComponent(`${formData.artist || ''} ${formData.name || ''} chords`.trim());
      url = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`;
      showSuccess("Searching Ultimate Guitar...");
    } else {
      showSuccess("Opening linked UG tab...");
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleFetchUgChords = async () => {
    if (!formData.ugUrl?.trim()) {
      showError("Please paste an Ultimate Guitar URL.");
      console.error("[UGChordsEditor] Fetch failed: No Ultimate Guitar URL provided.");
      return;
    }

    setIsFetchingUg(true);
    let targetUrl = formData.ugUrl;

    // Attempt to convert /tab/ to /chords/ if it's a tab URL
    if (targetUrl.includes('/tab/')) {
      const chordsUrl = targetUrl.replace('/tab/', '/chords/');
      console.log(`[UGChordsEditor] Detected tab URL. Attempting to fetch from chords URL: ${chordsUrl}`);
      targetUrl = chordsUrl;
    } else {
      console.log(`[UGChordsEditor] Fetching from provided URL: ${targetUrl}`);
    }

    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        console.error(`[UGChordsEditor] Failed to fetch content from UG. Status: ${response.status}`);
        throw new Error(`Failed to fetch content from UG. Status: ${response.status}`);
      }

      const data = await response.json();
      const htmlContent = data.contents;
      console.log("[UGChordsEditor] HTML content fetched. Attempting to parse...");

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      let extractedContent = null;

      // Strategy 1: Look for window.UGAPP.store.page JSON in script tags
      const scriptTags = doc.querySelectorAll('script');
      for (const script of scriptTags) {
        if (script.textContent?.includes('window.UGAPP.store.page')) {
          const scriptMatch = script.textContent.match(/window\.UGAPP\.store\.page = (\{[\s\S]*?\});/);
          if (scriptMatch && scriptMatch[1]) {
            try {
              const ugData = JSON.parse(scriptMatch[1]);
              extractedContent = ugData?.data?.tab_view?.wiki_tab?.content;
              if (extractedContent) {
                console.log("[UGChordsEditor] Chords extracted from UGAPP.store.page JSON.");
                break;
              }
            } catch (jsonError) {
              console.warn("[UGChordsEditor] Failed to parse UGAPP.store.page JSON:", jsonError);
            }
          }
        }
      }

      // Strategy 2: Fallback to old method if JSON not found or content empty
      if (!extractedContent) {
        console.log("[UGChordsEditor] UGAPP.store.page JSON not found or content empty. Falling back to HTML parsing...");
        const tabContentElement = doc.querySelector('pre.js-tab-content') || 
                                 doc.querySelector('div.js-tab-content') ||
                                 doc.querySelector('pre');

        if (tabContentElement && tabContentElement.textContent) {
          extractedContent = tabContentElement.textContent;
          console.log("[UGChordsEditor] Chords extracted from HTML fallback elements.");
        } else {
          console.warn("[UGChordsEditor] Chords content not found in HTML fallback elements.");
        }
      }

      if (extractedContent) {
        setChordsText(extractedContent);
        showSuccess("Chords fetched successfully!");
      } else {
        showError("Could not find chords content on the page. Try a different URL or paste manually.");
      }

    } catch (error: any) {
      console.error("[UGChordsEditor] Error fetching UG chords:", error);
      showError(`Failed to fetch chords: ${error.message || "Network error"}`);
    } finally {
      setIsFetchingUg(false);
      console.log("[UGChordsEditor] UG chord fetch process finished.");
    }
  };

  const readableChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  return (
    <div className="flex flex-col h-full gap-6 text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight text-white">UG Chords Editor</h3>
          <p className="text-sm text-slate-400 mt-1">Paste, transpose, and style your Ultimate Guitar chords</p>
          {formData.ugUrl ? (
            <p className="text-sm text-orange-400 font-bold mt-1">✓ Linked to official UG tab</p>
          ) : (
            <p className="text-sm text-slate-500">No UG link — will search on open</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleResetTranspose}
            className="h-10 px-4 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-[10px] uppercase gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Transpose
          </Button>
          <Button 
            size="sm" 
            onClick={handleApplyTranspose}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase gap-2 rounded-xl"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Button 
            onClick={handleOpenInUG}
            className={cn(
              "h-10 px-4 rounded-xl font-black uppercase tracking-wider text-xs gap-2 transition-all flex items-center",
              formData.ugUrl 
                ? "bg-orange-6I'll fix the mobile song addition workflow by implementing a robust current gig context system and adding clear "Add to Gig" buttons throughout the app.

Let me start by creating the global gig context store and updating the necessary components.

<dyad-write path="src/hooks/use-current-gig.ts" description="Create a global hook for managing current gig context with localStorage persistence">
"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

interface CurrentGigState {
  currentGigId: string | null;
  currentGigName: string | null;
  setCurrentGig: (id: string, name: string) => void;
  clearCurrentGig: () => void;
  ensureGig: () => Promise<{ id: string; name: string } | null>;
  fetchCurrentGig: () => Promise<void>;
}

export const useCurrentGig = create<CurrentGigState>()(
  persist(
    (set, get) => ({
      currentGigId: null,
      currentGigName: null,
      
      setCurrentGig: (id: string, name: string) => {
        set({ currentGigId: id, currentGigName: name });
        showSuccess(`Active gig set to: ${name}`);
      },
      
      clearCurrentGig: () => {
        set({ currentGigId: null, currentGigName: null });
      },
      
      ensureGig: async () => {
        const { currentGigId, currentGigName } = get();
        
        if (currentGigId && currentGigName) {
          return { id: currentGigId, name: currentGigName };
        }
        
        // Try to fetch the most recent gig
        try {
          const { data, error } = await supabase
            .from('setlists')
            .select('id, name')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (error) throw error;
          
          if (data) {
            setCurrentGig(data.id, data.name);
            return { id: data.id, name: data.name };
          }
        } catch (err) {
          console.error("Failed to fetch recent gig:", err);
        }
        
        return null;
      },
      
      fetchCurrentGig: async () => {
        const { currentGigId } = get();
        if (!currentGigId) return;
        
        try {
          const { data, error } = await supabase
            .from('setlists')
            .select('name')
            .eq('id', currentGigId)
            .single();
            
          if (error) throw error;
          
          if (data) {
            set({ currentGigName: data.name });
          } else {
            // Gig was deleted
            set({ currentGigId: null, currentGigName: null });
          }
        } catch (err) {
          console.error("Failed to fetch current gig:", err);
        }
      }
    }),
    {
      name: 'current-gig-storage',
      partialize: (state) => ({ 
        currentGigId: state.currentGigId, 
        currentGigName: state.currentGigName 
      })
    }
  )
);
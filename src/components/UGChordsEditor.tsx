"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon, Download, Loader2, Sparkles } from 'lucide-react';
import { SetlistSong } from './SetlistManager'; // Assuming SetlistSong is defined here or imported
import { showSuccess, showError } from '@/utils/toast';
import { sanitizeUGUrl } from '@/utils/ugUtils';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/use-settings';
import { extractKeyFromChords, formatChordText, transposeChords } from '@/utils/chordUtils';
import { calculateSemitones, formatKey } from '@/utils/keyUtils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { supabase } from '@/integrations/supabase/client'; // Assuming supabase is needed for fetching UG chords

export interface UGChordsConfig {
  fontFamily: string;
  fontSize: number;
  chordBold: boolean;
  chordColor: string;
  lineSpacing: number;
  textAlign: 'left' | 'center' | 'right';
}

interface UGChordsEditorProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
  // Harmonic Sync Props
  pitch: number;
  setPitch: (pitch: number) => void;
  targetKey: string;
  setTargetKey: (targetKey: string) => void;
  isPitchLinked: boolean;
  setIsPitchLinked: (linked: boolean) => void;
}

const UGChordsEditor: React.FC<UGChordsEditorProps> = ({
  song,
  formData,
  handleAutoSave,
  isMobile,
  pitch,
  setPitch,
  targetKey,
  setTargetKey,
  isPitchLinked,
  setIsPitchLinked,
}) => {
  const { keyPreference: globalPreference } = useSettings();
  const [chordsText, setChordsText] = useState(formData.ug_chords_text || "");
  const [isFetchingUg, setIsFetchingUg] = useState(false);

  // Sync local chordsText with formData.ug_chords_text if it changes externally
  useEffect(() => {
    if (formData.ug_chords_text !== chordsText) {
      setChordsText(formData.ug_chords_text || "");
    }
  }, [formData.ug_chords_text]);

  // Auto-save chordsText when it changes locally
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (chordsText !== formData.ug_chords_text) {
        handleAutoSave({ ug_chords_text: chordsText, is_ug_chords_present: !!chordsText.trim() });
        showSuccess("Chords text saved!");
      }
    }, 1000); // Debounce save
    return () => clearTimeout(timeout);
  }, [chordsText, formData.ug_chords_text, handleAutoSave]);

  const resolvedPreference = globalPreference === 'neutral'
    ? (formData.key_preference || 'sharps')
    : globalPreference;

  const config = formData.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG;

  const handleUgBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    if (newUrl) {
      const cleanUrl = sanitizeUGUrl(newUrl);
      if (cleanUrl !== newUrl) {
        handleAutoSave({ ugUrl: cleanUrl });
      }
      showSuccess("UG Link Saved");
    }
  };

  const handleFetchUgChords = async () => {
    if (!formData.ugUrl) {
      showError("Please provide a Ultimate Guitar URL.");
      return;
    }
    setIsFetchingUg(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-ug-chords', {
        body: { url: formData.ugUrl }
      });

      if (error) throw error;

      if (data?.chords) {
        setChordsText(data.chords);
        handleAutoSave({ ug_chords_text: data.chords, is_ug_chords_present: true });
        showSuccess("Ultimate Guitar chords fetched!");
      } else {
        showError("Failed to fetch chords from Ultimate Guitar.");
      }
    } catch (err: any) {
      showError(`Error fetching UG chords: ${err.message}`);
    } finally {
      setIsFetchingUg(false);
    }
  };

  const handlePullKey = () => {
    if (!chordsText.trim()) {
      showError("Paste chords first to pull key.");
      return;
    }
    const rawExtractedKey = extractKeyFromChords(chordsText);
    if (rawExtractedKey) {
      const formattedKey = formatKey(rawExtractedKey, resolvedPreference);
      handleAutoSave({
        originalKey: formattedKey,
        targetKey: formattedKey,
        pitch: 0,
        isKeyConfirmed: true,
      });
      showSuccess(`Pulled key: ${formattedKey}`);
    } else {
      showError("Could not extract key from chords.");
    }
  };

  const displayChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  return (
    <div className={cn(
      "flex flex-col gap-6 flex-1",
      isMobile ? "flex-col" : "md:w-1/2"
    )}>
      <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
          Ultimate Guitar Link
        </Label>
        <div className="flex gap-3 mt-3">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={formData.ugUrl || ""}
              onChange={(e) => handleAutoSave({ ugUrl: e.target.value })}
              onBlur={handleUgBlur}
              placeholder="Paste Ultimate Guitar tab URL here..."
              className={cn(
                "w-full bg-black/40 border border-white/20 rounded-xl p-4 pl-10 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm",
                formData.ugUrl ? "text-orange-400" : ""
              )}
            />
          </div>
          <Button
            onClick={handleFetchUgChords}
            disabled={isFetchingUg || !formData.ugUrl?.trim()}
            className="h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase gap-2 rounded-xl"
          >
            {isFetchingUg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Fetch Chords
          </Button>
        </div>
      </div>

      <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex-1 flex flex-col">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
          Paste Chords & Lyrics
        </Label>
        <Textarea
          value={chordsText}
          onChange={(e) => setChordsText(e.target.value)}
          placeholder="Paste your chords and lyrics here..."
          className="w-full mt-3 bg-black/40 border border-white/20 rounded-xl p-4 pl-10 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[300px] font-mono text-sm resize-none flex-1"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {chordsText.length} characters
          </span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {chordsText.split('\n').length} lines
          </span>
        </div>
        <div className="flex justify-end mt-4">
          <Button
            onClick={handlePullKey}
            disabled={!chordsText.trim()}
            className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase gap-2 rounded-xl"
          >
            <Sparkles className="w-3.5 h-3.5" /> Pull Key from Chords
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UGChordsEditor;
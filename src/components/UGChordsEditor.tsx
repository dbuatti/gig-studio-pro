"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SetlistSong, UGChordsConfig } from './SetlistManager';
import { transposeChords, extractKeyFromChords } from '@/utils/chordUtils';
import { useSettings } from '@/hooks/use-settings';
import { cn } from "@/lib/utils";
import { Play, RotateCcw, Download, Palette, Type, AlignCenter, AlignLeft, AlignRight, ExternalLink, Search, Check, Link as LinkIcon, Loader2, Music, Eye, Sparkles, Hash, Music2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { calculateSemitones, formatKey } from '@/utils/keyUtils';
import { supabase } from '@/integrations/supabase/client';

interface UGChordsEditorProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
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
  const { 
    keyPreference: globalPreference,
    ugChordsFontFamily,
    ugChordsFontSize,
    ugChordsChordBold,
    ugChordsChordColor,
    ugChordsLineSpacing,
    ugChordsTextAlign,
  } = useSettings(); 
  
  const resolvedPreference = (globalPreference === 'neutral' 
    ? (formData.key_preference || 'sharps') 
    : globalPreference) as 'sharps' | 'flats';

  const [chordsText, setChordsText] = useState(formData.ug_chords_text || "");
  const [localTransposeSemitones, setLocalTransposeSemitones] = useState(0);
  const [isFetchingUg, setIsFetchingUg] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  
  const [config, setConfig] = useState<UGChordsConfig>(() => {
    const songSpecificConfig = formData.ug_chords_config;
    if (songSpecificConfig) {
      return { ...DEFAULT_UG_CHORDS_CONFIG, ...songSpecificConfig };
    }
    return {
      fontFamily: ugChordsFontFamily,
      fontSize: ugChordsFontSize,
      chordBold: ugChordsChordBold,
      chordColor: ugChordsChordColor,
      lineSpacing: ugChordsLineSpacing,
      textAlign: ugChordsTextAlign,
    };
  });

  useEffect(() => {
    if (!formData.ug_chords_config) {
      setConfig({
        fontFamily: ugChordsFontFamily,
        fontSize: ugChordsFontSize,
        chordBold: ugChordsChordBold,
        chordColor: ugChordsChordColor,
        lineSpacing: ugChordsLineSpacing,
        textAlign: ugChordsTextAlign,
      });
    }
  }, [ugChordsFontFamily, ugChordsFontSize, ugChordsChordBold, ugChordsChordColor, ugChordsLineSpacing, ugChordsTextAlign, formData.ug_chords_config]);

  const activeTransposeOffset = isPitchLinked ? pitch : localTransposeSemitones;

  const transposedText = useMemo(() => {
    if (!chordsText) return chordsText;
    const safeOriginalKey = formData.originalKey || 'C';
    const safeTargetKey = targetKey || safeOriginalKey;
    const n = calculateSemitones(safeOriginalKey, safeTargetKey);
    return transposeChords(chordsText, n, resolvedPreference);
  }, [chordsText, formData.originalKey, targetKey, resolvedPreference]);

  useEffect(() => {
    if (chordsText !== formData.ug_chords_text) {
      handleAutoSave({ 
        ug_chords_text: chordsText,
        is_ug_chords_present: !!(chordsText && chordsText.trim().length > 0)
      });
    }
  }, [chordsText, formData.ug_chords_text, handleAutoSave]);

  useEffect(() => {
    const isDefault = config.fontFamily === ugChordsFontFamily &&
                      config.fontSize === ugChordsFontSize &&
                      config.chordBold === ugChordsChordBold &&
                      config.chordColor === ugChordsChordColor &&
                      config.lineSpacing === ugChordsLineSpacing &&
                      config.textAlign === ugChordsTextAlign;

    handleAutoSave({
      ug_chords_config: isDefault ? null : config
    });
  }, [config, handleAutoSave, ugChordsFontFamily, ugChordsFontSize, ugChordsChordBold, ugChordsChordColor, ugChordsLineSpacing, ugChordsTextAlign]);

  const handleResetTranspose = () => {
    if (isPitchLinked) setPitch(0);
    else setLocalTransposeSemitones(0);
    showSuccess("Transpose reset");
  };

  const handleApplyTranspose = () => {
    if (isPitchLinked) {
      showError("Transpose is linked to audio. Cannot apply directly.");
      return;
    }
    if (transposedText && transposedText !== chordsText) {
      setChordsText(transposedText);
      setLocalTransposeSemitones(0);
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

  const handleTogglePreference = () => {
    const next = resolvedPreference === 'sharps' ? 'flats' : 'sharps';
    handleAutoSave({ key_preference: next });
    showSuccess(`Notation set to ${next === 'sharps' ? 'Sharps' : 'Flats'}`);
  };

  const handleFetchUgChords = async () => {
    if (!formData.ugUrl?.trim()) {
      showError("Please paste an Ultimate Guitar URL.");
      return;
    }
    setIsFetchingUg(true);
    try {
      const targetUrl = formData.ugUrl.includes('/tab/') ? formData.ugUrl.replace('/tab/', '/chords/') : formData.ugUrl;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      const htmlContent = data.contents;
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      let extractedContent = null;
      const scriptTags = doc.querySelectorAll('script');
      for (const script of scriptTags) {
        if (script.textContent?.includes('window.UGAPP.store.page')) {
          const scriptMatch = script.textContent.match(/window\.UGAPP\.store\.page = (\{[\s\S]*?\});/);
          if (scriptMatch && scriptMatch[1]) {
            try {
              const ugData = JSON.parse(scriptMatch[1]);
              extractedContent = ugData?.data?.tab_view?.wiki_tab?.content;
              if (extractedContent) break;
            } catch (e) {}
          }
        }
      }
      if (extractedContent) {
        setChordsText(extractedContent);
        showSuccess("Chords fetched successfully!");
      } else {
        showError("Could not find chords content.");
      }
    } catch (error: any) {
      showError(`Failed to fetch chords: ${error.message}`);
    } finally {
      setIsFetchingUg(false);
    }
  };

  const handlePullKey = () => {
    if (!chordsText.trim()) return;
    const rawExtractedKey = extractKeyFromChords(chordsText);
    if (rawExtractedKey) {
      const formattedKey = formatKey(rawExtractedKey, resolvedPreference);
      handleAutoSave({ originalKey: formattedKey, targetKey: formattedKey, pitch: 0, isKeyConfirmed: true });
      showSuccess(`Pulled key: ${formattedKey}`);
    }
  };

  const handleMagicClean = async () => {
    if (!chordsText.trim()) return;
    setIsCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: [chordsText], mode: 'chords-cleanup' }
      });
      if (error) throw error;
      if (data?.cleaned_text) {
        setChordsText(data.cleaned_text);
        showSuccess("Chords Text Cleaned");
      }
    } catch (err) {
      showError("Chords Cleanup Error");
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 text-white">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight text-white">UG Chords Editor</h3>
          <p className="text-sm text-slate-400 mt-1">Paste, transpose, and style your Ultimate Guitar chords</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleResetTranspose} className="h-10 px-4 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-[10px] uppercase gap-2">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={handleApplyTranspose} disabled={isPitchLinked || activeTransposeOffset === 0} className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase gap-2 rounded-xl">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Button onClick={handleOpenInUG} className={cn("h-10 px-4 rounded-xl font-black uppercase tracking-wider text-xs gap-2 transition-all flex items-center", formData.ugUrl ? "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30" : "bg-white/10 hover:bg-white/20 text-slate-300 border border-white/20")}>
            {formData.ugUrl ? <Check className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />} OPEN IN UG
          </Button>
        </div>
      </div>

      <div className={cn("flex flex-col gap-6 flex-1", isMobile ? "flex-col" : "md:flex-row")}>
        <div className={cn("flex flex-col gap-4", isMobile ? "w-full" : "md:w-1/2")}>
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ultimate Guitar Link</Label>
            <div className="flex gap-3 mt-3">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={formData.ugUrl || ""} onChange={(e) => handleAutoSave({ ugUrl: e.target.value })} placeholder="Paste URL..." className="w-full bg-black/40 border border-white/20 rounded-xl p-4 pl-10 text-white text-sm" />
              </div>
              <Button onClick={handleFetchUgChords} disabled={isFetchingUg || !formData.ugUrl?.trim()} className="h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase gap-2 rounded-xl">
                {isFetchingUg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Fetch
              </Button>
            </div>
          </div>
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paste Chords & Lyrics</Label>
              <Button variant="ghost" size="sm" onClick={handleMagicClean} disabled={isCleaning || !chordsText.trim()} className="h-8 px-3 bg-pink-600/10 text-pink-400 font-black uppercase text-[9px] gap-2 rounded-xl hover:bg-pink-600/20">
                {isCleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Magic Clean
              </Button>
            </div>
            <Textarea value={chordsText} onChange={(e) => setChordsText(e.target.value)} placeholder="Paste here..." className="w-full mt-3 bg-black/40 border border-white/20 rounded-xl p-4 pl-10 text-white min-h-[300px] font-mono text-sm resize-none flex-1" />
          </div>
        </div>

        <div className={cn("flex flex-col gap-4", isMobile ? "w-full" : "md:w-1/2")}>
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transpose</Label>
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-2 h-8">
                  <span className={cn("text-[9px] font-black uppercase", resolvedPreference === 'flats' ? "text-indigo-400" : "text-slate-500")}>b</span>
                  <Switch checked={resolvedPreference === 'sharps'} onCheckedChange={handleTogglePreference} className="data-[state=checked]:bg-indigo-600 scale-75" />
                  <span className={cn("text-[9px] font-black uppercase", resolvedPreference === 'sharps' ? "text-indigo-400" : "text-slate-500")}>#</span>
                </div>
                <span className="text-sm font-mono font-bold text-indigo-400">{activeTransposeOffset > 0 ? '+' : ''}{activeTransposeOffset} ST</span>
              </div>
            </div>
            <Slider value={[activeTransposeOffset]} min={-12} max={12} step={1} onValueChange={([value]) => isPitchLinked ? setPitch(value) : setLocalTransposeSemitones(value)} className="flex-1" />
          </div>
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col flex-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Live Preview</Label>
            <div className="flex-1 bg-slate-950 rounded-xl p-4 overflow-auto border border-white/10 font-mono" style={{ fontFamily: config.fontFamily, fontSize: `${config.fontSize}px`, lineHeight: config.lineSpacing, textAlign: config.textAlign as any, color: config.chordColor }}>
              <pre className="whitespace-pre-wrap">{transposedText || "Chords will appear here..."}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UGChordsEditor;
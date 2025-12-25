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
import { Play, RotateCcw, Download, Palette, Type, AlignCenter, AlignLeft, AlignRight, ExternalLink, Search, Check, Link as LinkIcon, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

interface UGChordsEditorProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
}

const UGChordsEditor: React.FC<UGChordsEditorProps> = ({ song, formData, handleAutoSave, isMobile }) => {
  const { keyPreference } = useSettings();
  const [chordsText, setChordsText] = useState(formData.ug_chords_text || "");
  // Removed ugLink state, now using formData.ugUrl directly
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [isFetchingUg, setIsFetchingUg] = useState(false);
  const [config, setConfig] = useState({
    fontFamily: formData.ug_chords_config?.fontFamily || "monospace",
    fontSize: formData.ug_chords_config?.fontSize || 16,
    chordBold: formData.ug_chords_config?.chordBold ?? true,
    chordColor: formData.ug_chords_config?.chordColor || "#ffffff", // Changed default to white
    lineSpacing: formData.ug_chords_config?.lineSpacing || 1.5,
    textAlign: formData.ug_chords_config?.textAlign || "left" as "left" | "center" | "right"
  });

  // Apply transposition to the chords text
  const transposedText = useMemo(() => {
    if (!chordsText || transposeSemitones === 0) return chordsText;
    return transposeChords(chordsText, transposeSemitones, keyPreference);
  }, [chordsText, transposeSemitones, keyPreference]);

  // Update form data when chords text changes
  useEffect(() => {
    if (chordsText !== formData.ug_chords_text) {
      handleAutoSave({ ug_chords_text: chordsText });
    }
  }, [chordsText, formData.ug_chords_text, handleAutoSave]);

  // Update form data when config changes
  useEffect(() => {
    handleAutoSave({
      ug_chords_config: {
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        chordBold: config.chordBold,
        chordColor: config.chordColor,
        lineSpacing: config.lineSpacing,
        textAlign: config.textAlign // ADDED: Include textAlign
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

  const handleExport = () => {
    // In a real implementation, this would generate a PDF or other export format
    showSuccess("Export functionality would be implemented here");
  };

  const handleOpenInUG = () => {
    let url = formData.ugUrl; // Use formData.ugUrl
    if (!url) {
      // Fallback search
      const query = encodeURIComponent(`${formData.artist || ''} ${formData.name || ''} chords`.trim());
      url = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`;
      showSuccess("Searching Ultimate Guitar...");
    } else {
      showSuccess("Opening linked UG tab...");
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleFetchUgChords = async () => {
    if (!formData.ugUrl?.trim()) { // Use formData.ugUrl
      showError("Please paste an Ultimate Guitar URL.");
      return;
    }

    setIsFetchingUg(true);
    try {
      // Use a CORS proxy
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(formData.ugUrl)}`; // Use formData.ugUrl
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Failed to fetch content from UG.");

      const data = await response.json();
      const htmlContent = data.contents;

      // Attempt to parse HTML and extract chords
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // Common selectors for UG tab content
      const tabContentElement = doc.querySelector('pre.js-tab-content') || 
                               doc.querySelector('div.js-tab-content') ||
                               doc.querySelector('pre'); // Fallback to any pre tag

      if (tabContentElement && tabContentElement.textContent) {
        setChordsText(tabContentElement.textContent);
        showSuccess("Chords fetched successfully!");
      } else {
        showError("Could not find chords content on the page. Try a different URL or paste manually.");
      }

    } catch (error: any) {
      console.error("Error fetching UG chords:", error);
      showError(`Failed to fetch chords: ${error.message || "Network error"}`);
    } finally {
      setIsFetchingUg(false);
    }
  };

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
                ? "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30" 
                : "bg-white/10 hover:bg-white/20 text-slate-300 border border-white/20"
            )}
          >
            {formData.ugUrl ? <Check className="w-4 h-4" /> : <Search className="w-4 h-4" />} 
            OPEN IN UG
          </Button>
        </div>
      </div>

      <div className={cn(
        "flex flex-col gap-6 flex-1",
        isMobile ? "flex-col" : "md:flex-row"
      )}>
        {/* Left Panel - Editor */}
        <div className={cn(
          "flex flex-col gap-4",
          isMobile ? "w-full" : "md:w-1/2"
        )}>
          {/* UG Link Input */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Ultimate Guitar Link
            </Label>
            <div className="flex gap-3 mt-3">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={formData.ugUrl || ""} // Use formData.ugUrl
                  onChange={(e) => handleAutoSave({ ugUrl: e.target.value })} // Update formData.ugUrl
                  placeholder="Paste Ultimate Guitar tab URL here..."
                  className="w-full bg-black/40 border border-white/20 rounded-xl p-4 pl-10 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
              </div>
              <Button
                onClick={handleFetchUgChords}
                disabled={isFetchingUg || !formData.ugUrl?.trim()} // Use formData.ugUrl
                className="h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase gap-2 rounded-xl"
              >
                {isFetchingUg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Fetch Chords
              </Button>
            </div>
          </div>

          {/* Chords Input */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex-1 flex flex-col">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Paste Chords & Lyrics
            </Label>
            <Textarea
              value={chordsText}
              onChange={(e) => setChordsText(e.target.value)}
              placeholder="Paste your chords and lyrics here. Example: [Verse] C G Am F When I find myself in times of trouble, Mother Mary comes to me"
              className="w-full mt-3 bg-black/40 border border-white/20 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[300px] font-mono text-sm resize-none flex-1"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {chordsText.length} characters
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {chordsText.split('\n').length} lines
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel - Controls and Preview */}
        <div className={cn(
          "flex flex-col gap-4",
          isMobile ? "w-full" : "md:w-1/2"
        )}>
          {/* Transpose Controls */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Transpose
              </Label>
              <div className="flex gap-2">
                <span className="text-sm font-mono font-bold text-indigo-400">
                  {transposeSemitones > 0 ? '+' : ''}{transposeSemitones} ST
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleApplyTranspose}
                  disabled={transposeSemitones === 0}
                  className="h-7 px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-lg"
                >
                  Apply
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setTransposeSemitones(prev => Math.max(-12, prev - 1))}
                disabled={transposeSemitones <= -12}
                className="h-9 w-9 p-0 rounded-lg border border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
              >
                -1
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setTransposeSemitones(prev => Math.max(-12, prev - 12))}
                disabled={transposeSemitones <= -12}
                className="h-9 w-9 p-0 rounded-lg border border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
              >
                -12
              </Button>
              <Slider 
                value={[transposeSemitones]} 
                min={-12} 
                max={12} 
                step={1} 
                onValueChange={([value]) => setTransposeSemitones(value)}
                className="flex-1"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setTransposeSemitones(prev => Math.min(12, prev + 12))}
                disabled={transposeSemitones >= 12}
                className="h-9 w-9 p-0 rounded-lg border border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
              >
                +12
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setTransposeSemitones(prev => Math.min(12, prev + 1))}
                disabled={transposeSemitones >= 12}
                className="h-9 w-9 p-0 rounded-lg border border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
              >
                +1
              </Button>
            </div>
            <div className="flex justify-between text-[10px] font-mono font-black text-slate-400 mt-2">
              <span>-12</span>
              <span>0</span>
              <span>+12</span>
            </div>
          </div>

          {/* Styling Controls */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-indigo-500" />
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Styling
              </Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Font Family */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-400 uppercase">Font Family</Label>
                <Select 
                  value={config.fontFamily} 
                  onValueChange={(value) => setConfig(prev => ({ ...prev, fontFamily: value }))}
                >
                  <SelectTrigger className="h-9 text-xs bg-black/40 border border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border border-white/10 text-white">
                    <SelectItem value="monospace" className="text-xs">Monospace</SelectItem>
                    <SelectItem value="sans-serif" className="text-xs">Sans Serif</SelectItem>
                    <SelectItem value="serif" className="text-xs">Serif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-400 uppercase">Font Size</Label>
                <div className="flex items-center gap-2">
                  <Slider 
                    value={[config.fontSize]} 
                    min={12} 
                    max={24} 
                    step={1} 
                    onValueChange={([value]) => setConfig(prev => ({ ...prev, fontSize: value }))}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono font-bold w-8 text-center text-white">{config.fontSize}px</span>
                </div>
              </div>

              {/* Line Spacing */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-400 uppercase">Line Spacing</Label>
                <div className="flex items-center gap-2">
                  <Slider 
                    value={[config.lineSpacing]} 
                    min={1} 
                    max={2.5} 
                    step={0.1} 
                    onValueChange={([value]) => setConfig(prev => ({ ...prev, lineSpacing: value }))}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono font-bold w-8 text-center text-white">{config.lineSpacing}x</span>
                </div>
              </div>

              {/* Chord Bold */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-400 uppercase">Chord Bold</Label>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={config.chordBold} 
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, chordBold: checked }))}
                    className="data-[state=checked]:bg-indigo-600"
                  />
                  <span className="text-xs font-bold text-white">{config.chordBold ? 'ON' : 'OFF'}</span>
                </div>
              </div>

              {/* Text Alignment */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-400 uppercase">Alignment</Label>
                <div className="flex gap-1">
                  <Button 
                    variant={config.textAlign === "left" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setConfig(prev => ({ ...prev, textAlign: "left" }))}
                    className={cn(
                      "h-8 w-8 p-0",
                      config.textAlign === "left" 
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white" 
                        : "border border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
                    )}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    variant={config.textAlign === "center" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setConfig(prev => ({ ...prev, textAlign: "center" }))}
                    className={cn(
                      "h-8 w-8 p-0",
                      config.textAlign === "center" 
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white" 
                        : "border border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
                    )}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    variant={config.textAlign === "right" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setConfig(prev => ({ ...prev, textAlign: "right" }))}
                    className={cn(
                      "h-8 w-8 p-0",
                      config.textAlign === "right" 
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white" 
                        : "border border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
                    )}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Chord Color */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-400 uppercase">Chord Color</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="color" 
                    value={config.chordColor} 
                    onChange={(e) => setConfig(prev => ({ ...prev, chordColor: e.target.value }))}
                    className="h-8 w-12 p-1 rounded border border-white/20 bg-black/40"
                  />
                  <span className="text-xs font-mono text-white">{config.chordColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col flex-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Preview
            </Label>
            <div 
              className="flex-1 bg-slate-950 rounded-xl p-4 overflow-auto border border-white/10 font-mono"
              style={{ 
                fontFamily: config.fontFamily, 
                fontSize: `${config.fontSize}px`, 
                lineHeight: config.lineSpacing,
                textAlign: config.textAlign as any,
                color: config.chordColor
              }}
            >
              {transposedText ? (
                <pre className="whitespace-pre-wrap font-inherit text-white">
                  {transposedText}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  <p>Chords will appear here after you paste them</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UGChordsEditor;
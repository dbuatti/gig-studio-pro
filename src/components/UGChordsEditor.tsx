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
import { Play, RotateCcw, Download, Palette, Type, AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { showSuccess } from '@/utils/toast';

interface UGChordsEditorProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
}

const UGChordsEditor: React.FC<UGChordsEditorProps> = ({ 
  song, 
  formData, 
  handleAutoSave,
  isMobile
}) => {
  const { keyPreference } = useSettings();
  const [chordsText, setChordsText] = useState(formData.ug_chords_text || "");
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [config, setConfig] = useState({
    fontFamily: formData.ug_chords_config?.fontFamily || "monospace",
    fontSize: formData.ug_chords_config?.fontSize || 16,
    chordBold: formData.ug_chords_config?.chordBold ?? true,
    chordColor: formData.ug_chords_config?.chordColor || "#000000",
    lineSpacing: formData.ug_chords_config?.lineSpacing || 1.5,
    textAlign: "left" as "left" | "center" | "right"
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
        lineSpacing: config.lineSpacing
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

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight text-indigo-400">UG Chords Editor</h3>
          <p className="text-sm text-slate-500 mt-1">Paste, transpose, and style your Ultimate Guitar chords</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleResetTranspose}
            className="h-10 px-4 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold text-[10px] uppercase gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Transpose
          </Button>
          <Button 
            size="sm"
            onClick={handleExport}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase gap-2 rounded-xl"
          >
            <Download className="w-3.5 h-3.5" />
            Export
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
          {/* Chords Input */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col h-full">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Paste Chords & Lyrics
            </Label>
            <Textarea
              value={chordsText}
              onChange={(e) => setChordsText(e.target.value)}
              placeholder="Paste your chords and lyrics here. Example:
[Verse]
C              G              Am             F
When I find myself in times of trouble, Mother Mary comes to me"
              className="flex-1 min-h-[300px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-mono text-sm resize-none rounded-xl p-4"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {chordsText.length} characters
              </span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Transpose
              </Label>
              <div className="flex gap-2">
                <span className="text-sm font-mono font-bold text-indigo-600">
                  {transposeSemitones > 0 ? '+' : ''}{transposeSemitones} ST
                </span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleApplyTranspose}
                  disabled={transposeSemitones === 0}
                  className="h-7 px-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-lg"
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
                className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-800"
              >
                -1
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setTransposeSemitones(prev => Math.max(-12, prev - 12))}
                disabled={transposeSemitones <= -12}
                className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-800"
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
                className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-800"
              >
                +12
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setTransposeSemitones(prev => Math.min(12, prev + 1))}
                disabled={transposeSemitones >= 12}
                className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-800"
              >
                +1
              </Button>
            </div>
            
            <div className="flex justify-between text-[10px] font-mono font-black text-slate-500 mt-2">
              <span>-12</span>
              <span>0</span>
              <span>+12</span>
            </div>
          </div>

          {/* Styling Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-indigo-500" />
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Styling
              </Label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Font Family */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-500 uppercase">Font Family</Label>
                <Select 
                  value={config.fontFamily} 
                  onValueChange={(value) => setConfig(prev => ({ ...prev, fontFamily: value }))}
                >
                  <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monospace" className="text-xs">Monospace</SelectItem>
                    <SelectItem value="sans-serif" className="text-xs">Sans Serif</SelectItem>
                    <SelectItem value="serif" className="text-xs">Serif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Font Size */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-500 uppercase">Font Size</Label>
                <div className="flex items-center gap-2">
                  <Slider 
                    value={[config.fontSize]} 
                    min={12} 
                    max={24} 
                    step={1}
                    onValueChange={([value]) => setConfig(prev => ({ ...prev, fontSize: value }))}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono font-bold w-8 text-center">{config.fontSize}px</span>
                </div>
              </div>
              
              {/* Line Spacing */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-500 uppercase">Line Spacing</Label>
                <div className="flex items-center gap-2">
                  <Slider 
                    value={[config.lineSpacing]} 
                    min={1} 
                    max={2.5} 
                    step={0.1}
                    onValueChange={([value]) => setConfig(prev => ({ ...prev, lineSpacing: value }))}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono font-bold w-8 text-center">{config.lineSpacing}x</span>
                </div>
              </div>
              
              {/* Chord Bold */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-500 uppercase">Chord Bold</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.chordBold}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, chordBold: checked }))}
                  />
                  <span className="text-xs font-bold">{config.chordBold ? 'ON' : 'OFF'}</span>
                </div>
              </div>
              
              {/* Text Alignment */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-500 uppercase">Alignment</Label>
                <div className="flex gap-1">
                  <Button 
                    variant={config.textAlign === "left" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConfig(prev => ({ ...prev, textAlign: "left" }))}
                    className="h-8 w-8 p-0"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    variant={config.textAlign === "center" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConfig(prev => ({ ...prev, textAlign: "center" }))}
                    className="h-8 w-8 p-0"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    variant={config.textAlign === "right" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConfig(prev => ({ ...prev, textAlign: "right" }))}
                    className="h-8 w-8 p-0"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              
              {/* Chord Color */}
              <div className="space-y-2">
                <Label className="text-[9px] font-bold text-slate-500 uppercase">Chord Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={config.chordColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, chordColor: e.target.value }))}
                    className="h-8 w-12 p-1 rounded border-slate-200 dark:border-slate-800"
                  />
                  <span className="text-xs font-mono">{config.chordColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col flex-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Preview
            </Label>
            <div 
              className="flex-1 bg-slate-50 dark:bg-slate-950 rounded-xl p-4 overflow-auto border border-slate-200 dark:border-slate-800"
              style={{
                fontFamily: config.fontFamily,
                fontSize: `${config.fontSize}px`,
                lineHeight: config.lineSpacing,
                textAlign: config.textAlign as any,
                color: config.chordColor
              }}
            >
              {transposedText ? (
                <pre className="whitespace-pre-wrap font-inherit">
                  {transposedText}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
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
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { SetlistSong } from './SetlistManager';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, calculateSemitones, formatKey, transposeKey } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { showSuccess, showError } from '@/utils/toast';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { RESOURCE_TYPES } from '@/utils/constants';
import {
  Check, Plus, Tag, X, Hash, Music2, Link as LinkIcon,
  AlertTriangle, ChevronUp, ChevronDown, Sparkles, Loader2, Disc, SearchCode,
  Cloud, Volume2 // Added Cloud and Volume2
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { detectKeyFromBuffer, KeyCandidate } from '@/utils/keyDetector';

interface SongConfigTabProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  setPitch: (pitch: number) => void; // From useToneAudio
  currentBuffer: AudioBuffer | null; // From useToneAudio
  isMobile: boolean;
}

const SongConfigTab: React.FC<SongConfigTabProps> = ({
  song,
  formData,
  handleAutoSave,
  onUpdateKey,
  setPitch,
  currentBuffer,
  isMobile,
}) => {
  const { keyPreference: globalPreference } = useSettings();
  const [newTag, setNewTag] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetectingKey, setIsDetectingKey] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [keyCandidates, setKeyCandidates] = useState<KeyCandidate[]>([]);

  const currentKeyPreference = formData.key_preference || globalPreference;
  const keysToUse = currentKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  const addTag = () => {
    if (!newTag.trim() || !song) return;
    const currentTags = formData.user_tags || [];
    if (!currentTags.includes(newTag.trim())) {
      const updated = [...currentTags, newTag.trim()];
      handleAutoSave({ user_tags: updated });
    }
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    if (!song) return;
    const updated = (formData.user_tags || []).filter(t => t !== tag);
    handleAutoSave({ user_tags: updated });
  };

  const toggleResource = (id: string) => {
    if (!song) return;
    const current = formData.resources || [];
    const updated = current.includes(id) ? current.filter(rid => rid !== id) : [...current, id];
    handleAutoSave({ resources: updated });
  };

  const updateHarmonics = useCallback((updates: Partial<SetlistSong>) => {
    if (!song) return;
    
    const nextFormData = { ...formData, ...updates };

    if (nextFormData.isKeyLinked) {
      const diff = calculateSemitones(nextFormData.originalKey || "C", nextFormData.targetKey || "C");
      nextFormData.pitch = diff;
      setPitch(nextFormData.pitch);
    }
    handleAutoSave(nextFormData);
  }, [song, formData, handleAutoSave, setPitch]);

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const currentPitch = formData.pitch || 0;
    const shift = direction === 'up' ? 12 : -12;
    const newPitch = currentPitch + shift;
    
    if (newPitch > 24 || newPitch < -24) {
      showError("Maximum transposition range reached.");
      return;
    }
    
    const newTarget = transposeKey(formData.originalKey || "C", newPitch);
    handleAutoSave({ pitch: newPitch, targetKey: newTarget });
    setPitch(newPitch);
    onUpdateKey(song!.id, newTarget);
    showSuccess(`Octave Shift Applied: ${newPitch > 0 ? '+' : ''}${newPitch} ST`);
  };

  const handleDetectBPM = async () => {
    if (!currentBuffer) return;
    setIsAnalyzing(true);
    try {
      const { analyze } = await import('web-audio-beat-detector'); // Dynamic import
      const bpm = await analyze(currentBuffer);
      const roundedBpm = Math.round(bpm);
      handleAutoSave({ bpm: roundedBpm.toString() });
      showSuccess(`BPM Detected: ${roundedBpm}`);
    } catch (err) {
      showError("BPM detection failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDetectKey = async () => {
    if (!currentBuffer) {
      showError("Load audio first.");
      return;
    }
    setIsDetectingKey(true);
    setKeyCandidates([]);
    try {
      const candidates = await detectKeyFromBuffer(currentBuffer);
      const normalizedCandidates = candidates.map(c => ({
        ...c,
        key: formatKey(c.key, currentKeyPreference)
      }));
      setKeyCandidates(normalizedCandidates);
      showSuccess(`Harmonic Matrix: ${normalizedCandidates.length} potential matches found.`);
    } catch (err) {
      showError("Key detection failed.");
    } finally {
      setIsDetectingKey(false);
    }
  };

  const handleCloudKeySync = async () => {
    if (!formData.name || !formData.artist) {
      showError("Song Title and Artist required for Cloud Sync.");
      return;
    }
    setIsCloudSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: [`${formData.name} by ${formData.artist}`] }
      });
      if (error) throw error;
      
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.originalKey) {
        const normalized = formatKey(result.originalKey, currentKeyPreference);
        updateHarmonics({ 
          originalKey: normalized, 
          isKeyConfirmed: true,
          bpm: result.bpm?.toString() || formData.bpm,
          genre: result.genre || formData.genre
        });
        showSuccess(`Cloud AI Verified: Song is in ${normalized}`);
      } else {
        showError("Cloud AI could not find definitive metadata for this track.");
      }
    } catch (err) {
      showError("Cloud Sync Error.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const confirmCandidateKey = (key: string) => {
    if (!song) return;
    updateHarmonics({ 
      originalKey: key,
      isKeyConfirmed: true 
    });
    setKeyCandidates([]);
    showSuccess(`Original Key set to ${key}`);
  };

  return (
    <div className={cn("flex-1 p-6 md:p-8 space-y-8 md:space-y-10", isMobile ? "overflow-y-auto" : "")}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Harmonic Engine</Label>
          <TooltipProvider>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const nextPref = currentKeyPreference === 'sharps' ? 'flats' : 'sharps';
                      const updates: Partial<SetlistSong> = { key_preference: nextPref };
                      
                      if (formData.originalKey) {
                        updates.originalKey = formatKey(formData.originalKey, nextPref);
                      }
                      
                      if (formData.targetKey) {
                        const newTarget = formatKey(formData.targetKey, nextPref);
                        updates.targetKey = newTarget;
                        if (newTarget !== formData.targetKey && song) {
                          onUpdateKey(song.id, newTarget);
                        }
                      }
                      
                      handleAutoSave(updates);
                    }}
                    className={cn(
                      "p-1.5 rounded-lg border transition-all flex items-center gap-2 px-3",
                      formData.key_preference ? "bg-indigo-600 border-indigo-500 text-white shadow-lg" : "bg-white/5 border-white/10 text-slate-500"
                    )}
                  >
                    {currentKeyPreference === 'sharps' ? <Hash className="w-3.5 h-3.5" /> : <Music2 className="w-3.5 h-3.5" />}
                    <span className="text-[9px] font-black uppercase">{currentKeyPreference}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px] font-black uppercase">
                  Notation Preference
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => updateHarmonics({ isKeyConfirmed: !formData.isKeyConfirmed })}
                    className={cn(
                      "p-1.5 rounded-lg border transition-all",
                      formData.isKeyConfirmed ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20" : "bg-white/5 border-white/10 text-slate-500"
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px] font-black uppercase">
                  Verify Stage Key
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => updateHarmonics({ isKeyLinked: !formData.isKeyLinked })}
                    className={cn(
                      "p-1.5 rounded-lg border transition-all",
                      formData.isKeyLinked ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20" : "bg-white/5 border-white/10 text-slate-500"
                    )}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px] font-black uppercase">
                  Link Pitch to Key
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[9px] font-bold text-slate-400 uppercase">Original Key</Label>
            <Select 
              value={formatKey(formData.originalKey || "C", currentKeyPreference)} 
              onValueChange={(val) => updateHarmonics({ originalKey: val })}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white font-bold font-mono h-12 text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-[9px] font-bold text-indigo-400 uppercase">Stage Key</Label>
              <span className="text-[9px] font-mono text-slate-500">{(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span>
            </div>
            <Select 
              value={formatKey(formData.targetKey || formData.originalKey || "C", currentKeyPreference)} 
              onValueChange={(val) => {
                updateHarmonics({ targetKey: val });
                if (song) onUpdateKey(song.id, val);
              }}
            >
              <SelectTrigger className={cn(
                "border-none text-white font-bold font-mono h-12 shadow-xl text-lg transition-colors",
                formData.isKeyConfirmed ? "bg-emerald-600 shadow-emerald-500/20" : "bg-indigo-600 shadow-indigo-500/20"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Asset Matrix</Label>
        <div className="grid grid-cols-1 gap-2.5">
          {RESOURCE_TYPES.map(res => {
            const isActive = formData.resources?.includes(res.id) ||
                           (res.id === 'UG' && formData.ugUrl) ||
                           (res.id === 'LYRICS' && formData.lyrics) ||
                           (res.id === 'LEAD' && formData.leadsheetUrl);
            return (
              <button
                key={res.id}
                onClick={() => toggleResource(res.id)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border transition-all text-left group",
                  isActive
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
                    : "bg-white/5 text-slate-500 border-white/5 hover:border-white/10"
                )}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{res.label}</span>
                {isActive ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4 opacity-30 group-hover:opacity-100" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-4">
        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Custom Tags</Label>
        <div className="flex flex-wrap gap-2 mb-3">
          {(formData.user_tags || []).map(t => (
            <Badge key={t} variant="secondary" className="bg-white/5 text-indigo-300 border-white/10 px-3 py-1.5 gap-2 text-[10px] font-bold uppercase rounded-lg">
              {t} <button onClick={() => removeTag(t)}><X className="w-3 h-3 hover:text-white" /></button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            className="h-10 text-xs bg-white/5 border-white/10 font-bold uppercase"
          />
          <Button size="icon" variant="ghost" className="h-10 w-10 bg-white/5" onClick={addTag}><Tag className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* BPM & Key Detection */}
      <div className={cn("bg-slate-900 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6", isMobile ? "p-6 rounded-3xl" : "p-8 rounded-[2.5rem]")}>
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Telemetry</span>
            <div className="flex items-center gap-8 mt-2">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase">Tempo</span>
                <div className="flex items-center gap-3">
                  <Input value={formData.bpm || ""} onChange={(e) => handleAutoSave({ bpm: e.target.value })} className="bg-transparent border-none p-0 h-auto text-xl font-black font-mono text-indigo-400 focus-visible:ring-0 w-16" />
                </div>
              </div>
              <div className="h-10 w-px bg-white/5" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase">Analysis Choice</span>
                <div className="flex gap-2 mt-1">
                    {keyCandidates.map((c, i) => (
                      <Button key={i} onClick={() => confirmCandidateKey(c.key)} className={cn("h-8 px-3 text-[10px] font-black uppercase rounded-lg gap-2", i === 0 ? "bg-emerald-600 text-white" : "bg-white/5 text-slate-400")}>
                        {c.key} <span className="opacity-50 text-[8px]">{c.confidence}%</span>
                      </Button>
                    ))}
                    {keyCandidates.length === 0 && <span className="text-xl font-black font-mono text-slate-700">--</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={handleDetectBPM} disabled={isAnalyzing || !formData.previewUrl} className="h-10 px-4 bg-indigo-600/10 text-indigo-400 font-black uppercase text-[9px] gap-2 rounded-xl">
              {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Disc className="w-3.5 h-3.5" />} Scan BPM
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDetectKey} disabled={isDetectingKey || !formData.previewUrl} className="h-10 px-4 bg-emerald-600/10 text-emerald-400 font-black uppercase text-[9px] gap-2 rounded-xl">
              {isDetectingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SearchCode className="w-3.5 h-3.5" />} Analyse Key
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCloudKeySync} disabled={isCloudSyncing || !formData.name || !formData.artist} className="h-10 px-4 bg-purple-600/10 text-purple-400 font-black uppercase text-[9px] gap-2 rounded-xl">
              {isCloudSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />} Cloud Sync
            </Button>
          </div>
        </div>
      </div>

      {/* Pitch & Tempo Sliders */}
      <div className={cn("grid gap-6 md:gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        <div className={cn("space-y-10 bg-white/5 border border-white/5", isMobile ? "p-6 rounded-3xl" : "p-10 rounded-[2.5rem]")}>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pitch Processor</Label>
              <span className="text-sm md:text-lg font-mono font-black text-indigo-400">{(formData.pitch || 0) > 0 ? '+' : ''}{formData.pitch || 0} ST</span>
            </div>
            <Slider value={[formData.pitch || 0]} min={-24} max={24} step={1} onValueChange={(v) => {
              const newPitch = v[0];
              const newTargetKey = transposeKey(formData.originalKey || "C", newPitch);
              handleAutoSave({ pitch: newPitch, targetKey: newTargetKey });
              setPitch(newPitch);
              if (song) {
                onUpdateKey(song.id, newTargetKey);
              }
            }} />
          </div>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Fine Tune Matrix</Label>
              <span className="text-sm font-mono font-black text-slate-500">{(formData.fineTune || 0) > 0 ? '+' : ''}{formData.fineTune || 0} Cents</span>
            </div>
            <Slider value={[formData.fineTune || 0]} min={-100} max={100} step={1} onValueChange={([v]) => handleAutoSave({ fineTune: v })} />
          </div>
        </div>
        <div className={cn("space-y-10 bg-white/5 border border-white/5", isMobile ? "p-6 rounded-3xl" : "p-10 rounded-[2.5rem]")}>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tempo Stretch</Label>
              <span className="text-sm font-mono font-black text-indigo-400">{(formData.tempo || 1).toFixed(2)}x</span>
            </div>
            <Slider value={[formData.tempo || 1]} min={0.5} max={1.5} step={0.01} onValueChange={([v]) => handleAutoSave({ tempo: v })} />
          </div>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5"><Volume2 className="w-3 h-3 text-indigo-500" /> Master Gain</Label>
              <span className="text-sm font-mono font-black text-slate-500">{Math.round(((formData.volume || -6) + 60) * 1.66)}%</span>
            </div>
            <Slider value={[formData.volume || -6]} min={-60} max={0} step={1} onValueChange={([v]) => handleAutoSave({ volume: v })} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongConfigTab;
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { SetlistSong } from './SetlistManager';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, calculateSemitones, formatKey, transposeKey } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { showSuccess, showError } from '@/utils/toast';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import {
  Check, Hash, Music2, Link as LinkIcon,
  ChevronUp, ChevronDown, Sparkles,
} from 'lucide-react';
import SongAssetMatrix from './SongAssetMatrix';
import SongTagManager from './SongTagManager';
import SongAnalysisTools from './SongAnalysisTools';
import SongAudioControls from './SongAudioControls';

interface SongConfigTabProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  setPitch: (pitch: number) => void; // From useToneAudio
  setTempo: (tempo: number) => void; // From useToneAudio
  setVolume: (volume: number) => void; // From useToneAudio
  setFineTune: (fineTune: number) => void; // From useToneAudio
  currentBuffer: AudioBuffer | null; // From useToneAudio
  isMobile: boolean;
}

const SongConfigTab: React.FC<SongConfigTabProps> = ({
  song,
  formData,
  handleAutoSave,
  onUpdateKey,
  setPitch,
  setTempo,
  setVolume,
  setFineTune,
  currentBuffer,
  isMobile,
}) => {
  const { keyPreference: globalPreference } = useSettings();

  const currentKeyPreference = formData.key_preference || globalPreference;
  const keysToUse = currentKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

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
      
      <SongAssetMatrix formData={formData} handleAutoSave={handleAutoSave} />
      <SongTagManager formData={formData} handleAutoSave={handleAutoSave} />
      <SongAnalysisTools 
        song={song}
        formData={formData}
        handleAutoSave={handleAutoSave}
        currentBuffer={currentBuffer}
        isMobile={isMobile}
      />
      <SongAudioControls
        song={song}
        formData={formData}
        handleAutoSave={handleAutoSave}
        onUpdateKey={onUpdateKey}
        setPitch={setPitch}
        setTempo={setTempo}
        setVolume={setVolume}
        setFineTune={setFineTune}
        isMobile={isMobile}
      />
    </div>
  );
};

export default SongConfigTab;
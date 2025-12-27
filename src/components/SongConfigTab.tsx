"use client";
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { SetlistSong } from './SetlistManager';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, calculateSemitones, formatKey, transposeKey } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { showSuccess, showError } from '@/utils/toast';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { Check, Hash, Music2, Link as LinkIcon, ChevronUp, ChevronDown, Sparkles, Play, Pause, RotateCcw, Activity } from 'lucide-react';
import SongAssetMatrix from './SongAssetMatrix';
import SongTagManager from './SongTagManager';
import SheetMusicRecommender from './SheetMusicRecommender';

interface SongConfigTabProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  setPitch: (pitch: number) => void;
  setTempo: (tempo: number) => void;
  setVolume: (volume: number) => void;
  setFineTune: (fineTune: number) => void;
  currentBuffer: AudioBuffer | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  togglePlayback: () => void;
  stopPlayback: () => void;
  isMobile: boolean;
  onOpenInApp?: (app: string, url?: string) => void;
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
  isPlaying,
  progress,
  duration,
  togglePlayback,
  stopPlayback,
  isMobile,
  onOpenInApp
}) => {
  const { keyPreference: globalPreference } = useSettings();
  const currentKeyPreference = formData.key_preference || globalPreference;
  const keysToUse = currentKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  // Logic: When Stage Key changes, if Linked is ON, update pitch to match semitone delta
  const updateHarmonics = useCallback((updates: Partial<SetlistSong>) => {
    if (!song) return;
    const nextFormData = { ...formData, ...updates };
    
    // Core Engine Logic: Linking Pitch to Keys
    if (nextFormData.is_pitch_linked) {
      const n = calculateSemitones(nextFormData.originalKey || "C", nextFormData.targetKey || "C");
      nextFormData.pitch = n;
      setPitch(n);
    } else if (updates.is_pitch_linked === false) {
      // If we just unlinked, snap audio back to original pitch (0) as per requirements
      nextFormData.pitch = 0;
      setPitch(0);
    }
    
    handleAutoSave(nextFormData);
  }, [song, formData, handleAutoSave, setPitch]);

  const formatTime = (seconds: number) => 
    new Date(seconds * 1000).toISOString().substr(14, 5);

  return (
    <div className={cn("flex-1 p-6 md:p-8 space-y-8 md:space-y-10 overflow-y-auto")}>
      {/* Mini Audio Playback Controls */}
      {formData.previewUrl && (
        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
              Audio Playback
            </Label>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>{formatTime((progress / 100) * duration)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-center gap-6">
              <button 
                onClick={stopPlayback}
                className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button 
                onClick={togglePlayback}
                className="h-16 w-16 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-2xl flex items-center justify-center text-white"
              >
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>

              <div className="w-10" />
            </div>
          </div>
        </div>
      )}

      {/* Harmonic Engine Section */}
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
                <TooltipContent className="text-[10px] font-black uppercase">Notation Preference</TooltipContent>
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
                <TooltipContent className="text-[10px] font-black uppercase">Verify Stage Key</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => updateHarmonics({ is_pitch_linked: !formData.is_pitch_linked })}
                    className={cn(
                      "p-1.5 rounded-lg border transition-all",
                      formData.is_pitch_linked !== false ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20" : "bg-white/5 border-white/10 text-slate-500"
                    )}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px] font-black uppercase">Master Link: Sync Pitch & Chords</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[9px] font-bold text-slate-400 uppercase">Original Key (K_orig)</Label>
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
              <Label className="text-[9px] font-bold text-indigo-400 uppercase">Stage Key (K_stage)</Label>
              <span className="text-[9px] font-mono text-slate-500">Offset: {calculateSemitones(formData.originalKey || "C", formData.targetKey || "C")} ST</span>
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
      
      <SheetMusicRecommender 
        song={song} 
        formData={formData} 
        handleAutoSave={handleAutoSave}
        onOpenInApp={onOpenInApp}
      />
      
      <SongAssetMatrix formData={formData} handleAutoSave={handleAutoSave} />
      <SongTagManager formData={formData} handleAutoSave={handleAutoSave} />
    </div>
  );
};

export default SongConfigTab;
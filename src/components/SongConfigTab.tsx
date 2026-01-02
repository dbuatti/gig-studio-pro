"use client";
import React, { useCallback } from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { SetlistSong } from './SetlistManager';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, calculateSemitones, formatKey, transposeKey, transposeNote, PURE_NOTES_SHARP, PURE_NOTES_FLAT } from '@/utils/keyUtils';
import { cn } from "@/lib/utils";
import { useSettings } from '@/hooks/use-settings';
import { Check, Hash, Music2, Link as LinkIcon, Play, Pause, RotateCcw, Music, CloudDownload, AlertTriangle } from 'lucide-react';
import SongAssetMatrix from './SongAssetMatrix';
import SongTagManager from './SongTagManager';
import SheetMusicRecommender from './SheetMusicRecommender';

interface SongConfigTabProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  pitch: number;
  setPitch: (pitch: number) => void;
  targetKey: string;
  setTargetKey: (targetKey: string) => void;
  isPitchLinked: boolean;
  setIsPitchLinked: (linked: boolean) => void;
  setTempo: (tempo: number) => void;
  setVolume: (volume: number) => void;
  setFineTune: (fineTune: number) => void;
  currentBuffer: AudioBuffer | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  setProgress: (p: number) => void;
  togglePlayback: () => void;
  stopPlayback: () => void;
  isMobile: boolean;
  onOpenInApp?: (app: string, url?: string) => void;
}

const SongConfigTab: React.FC<SongConfigTabProps> = ({
  song,
  formData,
  handleAutoSave,
  pitch,
  setPitch,
  targetKey,
  setTargetKey,
  isPitchLinked,
  setIsPitchLinked,
  setTempo,
  setVolume,
  setFineTune,
  currentBuffer,
  isPlaying,
  progress,
  duration,
  setProgress,
  togglePlayback,
  stopPlayback,
  isMobile,
  onOpenInApp
}) => {
  const { keyPreference: globalPreference, preventStageKeyOverwrite } = useSettings(); // NEW: Get preventStageKeyOverwrite
  
  // Resolve effective notation preference: if global is neutral, use song preference, else global.
  const resolvedPreference = globalPreference === 'neutral' 
    ? (formData.key_preference || 'sharps') 
    : globalPreference;

  const keysToUse = resolvedPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;
  const pureNotes = resolvedPreference === 'sharps' ? PURE_NOTES_SHARP : PURE_NOTES_FLAT;

  const handleOriginalKeyChange = useCallback((val: string) => {
    const updates: Partial<SetlistSong> = { originalKey: val };
    if (isPitchLinked) {
      const newPitch = calculateSemitones(val, targetKey);
      updates.pitch = newPitch;
      const newTarget = transposeKey(val, newPitch);
      updates.targetKey = newTarget;
    }
    handleAutoSave(updates);
  }, [handleAutoSave, isPitchLinked, targetKey]);

  const handleTargetKeyChange = useCallback((val: string) => {
    setTargetKey(val);
  }, [setTargetKey]);

  const handleTogglePitchLinked = useCallback(() => {
    setIsPitchLinked(!isPitchLinked);
  }, [isPitchLinked, setIsPitchLinked]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isProcessing = formData.extraction_status === 'processing' || formData.extraction_status === 'queued';
  const isExtractionFailed = formData.extraction_status === 'failed';

  const audioSourceUrl = formData.extraction_status === 'completed' && formData.audio_url ? formData.audio_url : formData.previewUrl;

  // NEW: Determine if Stage Key should be disabled
  const isStageKeyDisabled = preventStageKeyOverwrite && formData.isKeyConfirmed;

  return (
    <div className={cn("flex-1 p-6 md:p-8 space-y-8 md:space-y-10 overflow-y-auto")}>
      {audioSourceUrl ? (
        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
              Audio Control Center
            </Label>
            {isProcessing && (
              <div className="flex items-center gap-2 text-indigo-400">
                <CloudDownload className="w-4 h-4 animate-bounce" />
                <span className="text-[9px] font-black uppercase">Extracting Audio...</span>
              </div>
            )}
            {isExtractionFailed && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-[9px] font-black uppercase">Extraction Failed</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Slider 
                value={[progress]} 
                max={100} 
                step={0.1} 
                onValueChange={([v]) => setProgress(v)} 
                className="w-full"
              />
              <div className="flex justify-between text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest">
                <span className="text-indigo-400">{formatTime((progress / 100) * duration)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-6">
              <button 
                onClick={stopPlayback}
                className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button 
                onClick={togglePlayback}
                className="h-16 w-16 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-2xl flex items-center justify-center text-white transition-all active:scale-95"
              >
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>

              <div className="w-10" />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl text-center">
          <Music className="w-12 h-12 text-slate-700 mx-auto" />
          <p className="text-sm text-slate-500">No audio linked. Use the 'Visual' tab to link a YouTube video and queue extraction.</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Harmonic Engine</Label>
          <TooltipProvider>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => {
                      const nextPref = resolvedPreference === 'sharps' ? 'flats' : 'sharps';
                      const updates: Partial<SetlistSong> = { key_preference: nextPref };
                      if (formData.originalKey) {
                        updates.originalKey = formatKey(formData.originalKey, nextPref);
                      }
                      if (formData.targetKey) {
                        updates.targetKey = formatKey(formData.targetKey, nextPref);
                      }
                      handleAutoSave(updates);
                    }}
                    className={cn(
                      "p-1.5 rounded-lg border transition-all flex items-center gap-2 px-3",
                      formData.key_preference ? "bg-indigo-600 border-indigo-500 text-white shadow-lg" : "bg-white/5 border-white/10 text-slate-500"
                    )}
                  >
                    {resolvedPreference === 'sharps' ? <Hash className="w-3.5 h-3.5" /> : <Music2 className="w-3.5 h-3.5" />}
                    <span className="text-[9px] font-black uppercase">{resolvedPreference}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px] font-black uppercase">Notation Preference</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => handleAutoSave({ isKeyConfirmed: !formData.isKeyConfirmed })}
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
                    onClick={handleTogglePitchLinked}
                    className={cn(
                      "p-1.5 rounded-lg border transition-all",
                      isPitchLinked ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20" : "bg-white/5 border-white/10 text-slate-500"
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
              value={formatKey(formData.originalKey || "C", resolvedPreference)} 
              onValueChange={handleOriginalKeyChange}
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
              <span className="text-[9px] font-mono text-slate-500">Offset: {calculateSemitones(formData.originalKey || "C", targetKey)} ST</span>
            </div>
            <Select 
              value={formatKey(targetKey, resolvedPreference)}
              onValueChange={handleTargetKeyChange}
              disabled={isStageKeyDisabled} // NEW: Disable if preventStageKeyOverwrite is active and key is confirmed
            >
              <SelectTrigger className={cn(
                "border-none text-white font-bold font-mono h-12 shadow-xl text-lg transition-colors",
                formData.isKeyConfirmed ? "bg-emerald-600 shadow-emerald-500/20" : "bg-indigo-600 shadow-indigo-500/20",
                isStageKeyDisabled && "opacity-50 cursor-not-allowed" // NEW: Visual cue for disabled state
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 pt-2 border-t border-white/5">
            <Label className="text-[9px] font-bold text-indigo-400 uppercase">Highest Note (Original)</Label>
            <div className="flex gap-2">
              <Select 
                value={formData.highest_note_original?.slice(0, -1) || "C"} 
                onValueChange={(note) => 
                  handleAutoSave({ highest_note_original: `${note}${formData.highest_note_original?.slice(-1) || '4'}` })
                }
              >
                <SelectTrigger className="w-full bg-white/5 border-white/10 text-white font-bold font-mono h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                  {pureNotes.map(n => <SelectItem key={n} value={n} className="font-mono">{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select 
                value={formData.highest_note_original?.slice(-1) || "4"} 
                onValueChange={(oct) => 
                  handleAutoSave({ highest_note_original: `${formData.highest_note_original?.slice(0, -1) || 'C'}${oct}` })
                }
              >
                <SelectTrigger className="w-24 bg-white/5 border-white/10 text-white font-bold font-mono h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                  {[...Array(9)].map((_, i) => <SelectItem key={i} value={`${i}`}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {formData.highest_note_original && (
              <div className="flex items-center gap-2 mt-2 px-1">
                <Music className="w-3 h-3 text-emerald-400" />
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                  Stage Max: <span className="text-white font-mono">{transposeNote(formData.highest_note_original, pitch, resolvedPreference)}</span>
                </p>
              </div>
            )}
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
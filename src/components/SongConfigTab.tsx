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
import { Check, Hash, Music2, Link as LinkIcon, Play, Pause, RotateCcw, Music, CloudDownload, AlertTriangle, Mic2, Gauge, Zap } from 'lucide-react';
import SongAssetMatrix from './SongAssetMatrix';
import SongTagManager from './SongTagManager';
import SheetMusicRecommender from './SheetMusicRecommender';
import { Switch } from "@/components/ui/switch";

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
  const { keyPreference: globalPreference, preventStageKeyOverwrite } = useSettings(); 
  
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
  const isStageKeyDisabled = preventStageKeyOverwrite && formData.isKeyConfirmed;

  return (
    <div className={cn("flex-1 p-6 md:p-10 space-y-10 overflow-y-auto custom-scrollbar")}>
      {/* Status Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-8 bg-indigo-600/5 border border-indigo-500/20 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[80px] rounded-full -mr-32 -mt-32 pointer-events-none" />
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-xl shadow-indigo-600/20">
            <Mic2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight text-white">Performance Readiness</h3>
            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Vocal & Technical Status Matrix</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 relative z-10 bg-black/20 p-2 rounded-2xl border border-white/5">
          <div className="px-4 py-2">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em]",
              formData.is_ready_to_sing !== false ? "text-emerald-400" : "text-red-400"
            )}>
              {formData.is_ready_to_sing !== false ? "PRO READY" : "IN PROGRESS"}
            </span>
          </div>
          <Switch 
            checked={formData.is_ready_to_sing !== false} 
            onCheckedChange={(v) => handleAutoSave({ is_ready_to_sing: v })}
            className="data-[state=checked]:bg-emerald-500 scale-125"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Audio & Harmonic Engine */}
        <div className="lg:col-span-2 space-y-8">
          {/* Audio Control Center */}
          <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/20 rounded-xl">
                  <Gauge className="w-5 h-5 text-indigo-400" />
                </div>
                <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
                  Audio Control Center
                </Label>
              </div>
              {isProcessing && (
                <div className="flex items-center gap-2 text-indigo-400 animate-pulse">
                  <CloudDownload className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase">Extracting...</span>
                </div>
              )}
            </div>

            {audioSourceUrl ? (
              <div className="space-y-8">
                <div className="space-y-4">
                  <Slider 
                    value={[progress]} 
                    max={100} 
                    step={0.1} 
                    onValueChange={([v]) => setProgress(v)} 
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest">
                    <span className="text-indigo-400">{formatTime((progress / 100) * duration)}</span>
                    <span className="opacity-40">Transport Master Clock</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-8">
                  <button 
                    onClick={stopPlayback}
                    className="h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-all active:scale-90"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  <button 
                    onClick={togglePlayback}
                    className="h-20 w-20 rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 shadow-2xl shadow-indigo-600/20 flex items-center justify-center text-white transition-all active:scale-95"
                  >
                    {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1.5" />}
                  </button>

                  <div className="w-12" />
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-4 opacity-40">
                <Music className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No Audio Linked</p>
              </div>
            )}
          </div>

          {/* Harmonic Engine */}
          <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600/20 rounded-xl">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">
                  Harmonic Engine
                </Label>
              </div>
              
              <div className="flex gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => {
                          const nextPref = resolvedPreference === 'sharps' ? 'flats' : 'sharps';
                          handleAutoSave({ key_preference: nextPref });
                        }}
                        className={cn(
                          "p-2 rounded-xl border transition-all flex items-center gap-2 px-4",
                          formData.key_preference ? "bg-indigo-600 border-indigo-500 text-white shadow-lg" : "bg-white/5 border-white/10 text-slate-500"
                        )}
                      >
                        {resolvedPreference === 'sharps' ? <Hash className="w-4 h-4" /> : <Music2 className="w-4 h-4" />}
                        <span className="text-[10px] font-black uppercase">{resolvedPreference}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px] font-black uppercase">Notation Preference</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => handleAutoSave({ isKeyConfirmed: !formData.isKeyConfirmed })}
                        className={cn(
                          "p-2 rounded-xl border transition-all",
                          formData.isKeyConfirmed ? "bg-emerald-600 border-emerald-500 text-white shadow-lg" : "bg-white/5 border-white/10 text-slate-500"
                        )}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px] font-black uppercase">Verify Stage Key</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Original Key (K_orig)</Label>
                <Select 
                  value={formatKey(formData.originalKey || "C", resolvedPreference)} 
                  onValueChange={handleOriginalKeyChange}
                >
                  <SelectTrigger className="bg-black/40 border-white/10 text-white font-black font-mono h-14 text-xl rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                    {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono font-bold">{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center ml-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Stage Key (K_stage)</Label>
                  <span className="text-[10px] font-mono font-black text-slate-600">Offset: {calculateSemitones(formData.originalKey || "C", targetKey)} ST</span>
                </div>
                <Select 
                  value={formatKey(targetKey, resolvedPreference)}
                  onValueChange={handleTargetKeyChange}
                  disabled={isStageKeyDisabled}
                >
                  <SelectTrigger className={cn(
                    "border-none text-white font-black font-mono h-14 text-xl rounded-2xl shadow-2xl transition-all",
                    formData.isKeyConfirmed ? "bg-emerald-600 shadow-emerald-500/20" : "bg-indigo-600 shadow-indigo-500/20",
                    isStageKeyDisabled && "opacity-50 cursor-not-allowed"
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                    {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono font-bold">{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5 space-y-6">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Vocal Range Analysis</Label>
                {formData.highest_note_original && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <Music className="w-3 h-3 text-emerald-400" />
                    <span className="text-[9px] font-black uppercase text-emerald-400">
                      Stage Max: <span className="font-mono">{transposeNote(formData.highest_note_original, pitch, resolvedPreference)}</span>
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <Select 
                    value={formData.highest_note_original?.slice(0, -1) || "C"} 
                    onValueChange={(note) => 
                      handleAutoSave({ highest_note_original: `${note}${formData.highest_note_original?.slice(-1) || '4'}` })
                    }
                  >
                    <SelectTrigger className="bg-black/40 border-white/10 text-white font-bold font-mono h-12 rounded-xl">
                      <SelectValue placeholder="Note" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                      {pureNotes.map(n => <SelectItem key={n} value={n} className="font-mono">{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Select 
                    value={formData.highest_note_original?.slice(-1) || "4"} 
                    onValueChange={(oct) => 
                      handleAutoSave({ highest_note_original: `${formData.highest_note_original?.slice(0, -1) || 'C'}${oct}` })
                    }
                  >
                    <SelectTrigger className="bg-black/40 border-white/10 text-white font-bold font-mono h-12 rounded-xl">
                      <SelectValue placeholder="Oct" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                      {[...Array(9)].map((_, i) => <SelectItem key={i} value={`${i}`}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Assets & Tags */}
        <div className="space-y-8">
          <SheetMusicRecommender 
            song={song} 
            formData={formData} 
            handleAutoSave={handleAutoSave}
            onOpenInApp={onOpenInApp}
          />
          
          <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
            <SongAssetMatrix formData={formData} handleAutoSave={handleAutoSave} />
          </div>

          <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
            <SongTagManager formData={formData} handleAutoSave={handleAutoSave} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongConfigTab;
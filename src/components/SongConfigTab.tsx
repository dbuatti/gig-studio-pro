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
    <div className={cn("flex-1 space-y-6 md:space-y-10 overflow-y-auto custom-scrollbar", isMobile ? "p-4" : "p-10")}>
      {/* Status Header */}
      <div className={cn(
        "flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 bg-indigo-600/5 border border-indigo-500/20 shadow-2xl relative overflow-hidden",
        isMobile ? "p-6 rounded-3xl" : "p-8 rounded-[2.5rem]"
      )}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[80px] rounded-full -mr-32 -mt-32 pointer-events-none" />
        
        <div className="flex items-center gap-4 md:gap-6 relative z-10">
          <div className="bg-indigo-600 p-3 md:p-4 rounded-xl md:rounded-2xl shadow-xl shadow-indigo-600/20">
            <Mic2 className="w-6 h-6 md:w-8 md:h-8 text-white" />
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-white">Readiness</h3>
            <p className="text-[9px] md:text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Vocal & Technical Status</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4 relative z-10 bg-black/20 p-1.5 md:p-2 rounded-xl md:rounded-2xl border border-white/5">
          <div className="px-3 md:px-4 py-1 md:py-2">
            <span className={cn(
              "text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em]",
              formData.is_ready_to_sing !== false ? "text-emerald-400" : "text-red-400"
            )}>
              {formData.is_ready_to_sing !== false ? "PRO READY" : "IN PROGRESS"}
            </span>
          </div>
          <Switch 
            checked={formData.is_ready_to_sing !== false} 
            onCheckedChange={(v) => handleAutoSave({ is_ready_to_sing: v })}
            className="data-[state=checked]:bg-emerald-500 scale-110 md:scale-125"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column: Audio & Harmonic Engine */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* Audio Control Center */}
          <div className={cn(
            "bg-slate-900/50 border border-white/10 space-y-6 md:space-y-8 shadow-2xl",
            isMobile ? "p-6 rounded-3xl" : "p-8 rounded-[2.5rem]"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-indigo-600/20 rounded-lg md:rounded-xl">
                  <Gauge className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                </div>
                <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-indigo-400">
                  Audio Control
                </Label>
              </div>
              {isProcessing && (
                <div className="flex items-center gap-2 text-indigo-400 animate-pulse">
                  <CloudDownload className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Extracting...</span>
                </div>
              )}
            </div>

            {audioSourceUrl ? (
              <div className="space-y-6 md:space-y-8">
                <div className="space-y-3 md:space-y-4">
                  <Slider 
                    value={[progress]} 
                    max={100} 
                    step={0.1} 
                    onValueChange={([v]) => setProgress(v)} 
                    className="w-full"
                  />
                  <div className="flex justify-between text-[9px] md:text-[10px] font-mono font-black text-slate-500 uppercase tracking-widest">
                    <span className="text-indigo-400">{formatTime((progress / 100) * duration)}</span>
                    <span className="hidden xs:inline opacity-40">Transport Master Clock</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-6 md:gap-8">
                  <button 
                    onClick={stopPlayback}
                    className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-all active:scale-90"
                  >
                    <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
                  </button>

                  <button 
                    onClick={togglePlayback}
                    className="h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 shadow-2xl shadow-indigo-600/20 flex items-center justify-center text-white transition-all active:scale-95"
                  >
                    {isPlaying ? <Pause className="w-8 h-8 md:w-10 md:h-10 fill-current" /> : <Play className="w-8 h-8 md:w-10 md:h-10 fill-current ml-1 md:ml-1.5" />}
                  </button>

                  <div className="w-10 md:w-12" />
                </div>
              </div>
            ) : (
              <div className="py-8 md:py-12 text-center space-y-3 md:space-y-4 opacity-40">
                <Music className="w-10 h-10 md:w-12 md:h-12 mx-auto text-slate-600" />
                <p className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-widest">No Audio Linked</p>
              </div>
            )}
          </div>

          {/* Harmonic Engine */}
          <div className={cn(
            "bg-slate-900/50 border border-white/10 space-y-6 md:space-y-8 shadow-2xl",
            isMobile ? "p-6 rounded-3xl" : "p-8 rounded-[2.5rem]"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-emerald-600/20 rounded-lg md:rounded-xl">
                  <Zap className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                </div>
                <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-emerald-400">
                  Harmonic Engine
                </Label>
              </div>
              
              <div className="flex gap-1.5 md:gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => {
                          const nextPref = resolvedPreference === 'sharps' ? 'flats' : 'sharps';
                          handleAutoSave({ key_preference: nextPref });
                        }}
                        className={cn(
                          "p-1.5 md:p-2 rounded-lg md:rounded-xl border transition-all flex items-center gap-1.5 md:gap-2 px-3 md:px-4",
                          formData.key_preference ? "bg-indigo-600 border-indigo-500 text-white shadow-lg" : "bg-white/5 border-white/10 text-slate-500"
                        )}
                      >
                        {resolvedPreference === 'sharps' ? <Hash className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Music2 className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                        <span className="text-[8px] md:text-[10px] font-black uppercase">{resolvedPreference}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px] font-black uppercase">Notation Preference</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => handleAutoSave({ isKeyConfirmed: !formData.isKeyConfirmed })}
                        className={cn(
                          "p-1.5 md:p-2 rounded-lg md:rounded-xl border transition-all",
                          formData.isKeyConfirmed ? "bg-emerald-600 border-emerald-500 text-white shadow-lg" : "bg-white/5 border-white/10 text-slate-500"
                        )}
                      >
                        <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px] font-black uppercase">Verify Stage Key</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-2 md:space-y-3">
                <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Original Key</Label>
                <Select 
                  value={formatKey(formData.originalKey || "C", resolvedPreference)} 
                  onValueChange={handleOriginalKeyChange}
                >
                  <SelectTrigger className="bg-black/40 border-white/10 text-white font-black font-mono h-12 md:h-14 text-lg md:text-xl rounded-xl md:rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                    {keysToUse.map(k => <SelectItem key={k} value={k} className="font-mono font-bold">{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:space-y-3">
                <div className="flex justify-between items-center ml-1">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-indigo-400">Stage Key</Label>
                  <span className="text-[8px] md:text-[10px] font-mono font-black text-slate-600">Offset: {calculateSemitones(formData.originalKey || "C", targetKey)} ST</span>
                </div>
                <Select 
                  value={formatKey(targetKey, resolvedPreference)}
                  onValueChange={handleTargetKeyChange}
                  disabled={isStageKeyDisabled}
                >
                  <SelectTrigger className={cn(
                    "border-none text-white font-black font-mono h-12 md:h-14 text-lg md:text-xl rounded-xl md:rounded-2xl shadow-2xl transition-all",
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

            <div className="pt-6 md:pt-8 border-t border-white/5 space-y-4 md:space-y-6">
              <div className="flex items-center justify-between">
                <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Vocal Range</Label>
                {formData.highest_note_original && (
                  <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-0.5 md:py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <Music className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-400" />
                    <span className="text-[8px] md:text-[9px] font-black uppercase text-emerald-400">
                      Max: <span className="font-mono">{transposeNote(formData.highest_note_original, pitch, resolvedPreference)}</span>
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 md:gap-4">
                <div className="flex-1">
                  <Select 
                    value={formData.highest_note_original?.slice(0, -1) || "C"} 
                    onValueChange={(note) => 
                      handleAutoSave({ highest_note_original: `${note}${formData.highest_note_original?.slice(-1) || '4'}` })
                    }
                  >
                    <SelectTrigger className="bg-black/40 border-white/10 text-white font-bold font-mono h-10 md:h-12 rounded-lg md:rounded-xl">
                      <SelectValue placeholder="Note" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                      {pureNotes.map(n => <SelectItem key={n} value={n} className="font-mono">{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 md:w-32">
                  <Select 
                    value={formData.highest_note_original?.slice(-1) || "4"} 
                    onValueChange={(oct) => 
                      handleAutoSave({ highest_note_original: `${formData.highest_note_original?.slice(0, -1) || 'C'}${oct}` })
                    }
                  >
                    <SelectTrigger className="bg-black/40 border-white/10 text-white font-bold font-mono h-10 md:h-12 rounded-lg md:rounded-xl">
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
        <div className="space-y-6 md:space-y-8">
          <SheetMusicRecommender 
            song={song} 
            formData={formData} 
            handleAutoSave={handleAutoSave}
            onOpenInApp={onOpenInApp}
          />
          
          <div className={cn(
            "bg-slate-900/50 border border-white/10 shadow-2xl",
            isMobile ? "p-6 rounded-3xl" : "p-8 rounded-[2.5rem]"
          )}>
            <SongAssetMatrix formData={formData} handleAutoSave={handleAutoSave} />
          </div>

          <div className={cn(
            "bg-slate-900/50 border border-white/10 shadow-2xl",
            isMobile ? "p-6 rounded-3xl" : "p-8 rounded-[2.5rem]"
          )}>
            <SongTagManager formData={formData} handleAutoSave={handleAutoSave} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongConfigTab;
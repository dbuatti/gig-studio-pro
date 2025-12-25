"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SetlistSong } from './SetlistManager';
import { Play, Pause, Volume2, VolumeX, RotateCcw, Upload, Loader2, Music, Headphones, Zap, Disc, Gauge, ExternalLink, Link2, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { showSuccess, showError } from '@/utils/toast';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, transposeKey, calculateSemitones } from '@/utils/keyUtils';
import { detectKeyFromBuffer, KeyCandidate } from '@/utils/keyDetector';
import * as Tone from 'tone';
import { supabase } from '@/integrations/supabase/client'; // Imported supabase

interface SongAudioPlaybackTabProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void; // Added handleAutoSave
  audioEngine: ReturnType<typeof useToneAudio>;
  isMobile: boolean;
  onLoadAudioFromUrl: (url: string, pitch: number) => Promise<void>;
}

const SongAudioPlaybackTab: React.FC<SongAudioPlaybackTabProps> = ({
  song,
  formData,
  handleAutoSave, // Destructure handleAutoSave
  audioEngine,
  isMobile,
  onLoadAudioFromUrl
}) => {
  const { keyPreference: globalPreference } = useSettings();
  const {
    isPlaying,
    progress,
    duration,
    pitch,
    tempo,
    volume,
    fineTune,
    currentBuffer,
    setPitch,
    setTempo,
    setVolume,
    setFineTune,
    setProgress,
    loadFromUrl,
    togglePlayback,
    stopPlayback,
    resetEngine
  } = audioEngine;

  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [keyDetectionLoading, setKeyDetectionLoading] = useState(false);
  const [detectedKeys, setDetectedKeys] = useState<KeyCandidate[]>([]);
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const metronomeSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const metronomeLoopRef = useRef<Tone.Loop | null>(null);

  const currentKeyPreference = formData.key_preference || globalPreference;
  const keysToUse = currentKeyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;

  useEffect(() => {
    if (song && formData.previewUrl) {
      loadFromUrl(formData.previewUrl, formData.pitch || 0);
    }
    return () => {
      resetEngine();
      stopMetronome();
    };
  }, [song?.id, formData.previewUrl, formData.pitch]); // Only re-load audio if song ID or previewUrl changes

  useEffect(() => {
    setPitch(formData.pitch || 0);
    setTempo(formData.tempo || 1);
    setVolume(formData.volume || -6);
    setFineTune(formData.fineTune || 0);
  }, [formData.pitch, formData.tempo, formData.volume, formData.fineTune, setPitch, setTempo, setVolume, setFineTune]);

  const handlePitchChange = (newPitch: number) => {
    setPitch(newPitch);
    handleAutoSave({ pitch: newPitch });
  };

  const handleTempoChange = (newTempo: number) => {
    setTempo(newTempo);
    handleAutoSave({ tempo: newTempo });
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    handleAutoSave({ volume: newVolume });
  };

  const handleFineTuneChange = (newFineTune: number) => {
    setFineTune(newFineTune);
    handleAutoSave({ fineTune: newFineTune });
  };

  const handleTargetKeyChange = (newKey: string) => {
    if (!formData.originalKey) {
      showError("Original key not set. Cannot transpose.");
      return;
    }
    const semitones = calculateSemitones(formData.originalKey, newKey);
    handlePitchChange(semitones);
    handleAutoSave({ targetKey: newKey, isKeyConfirmed: true });
    showSuccess(`Key set to ${formatKey(newKey, currentKeyPreference)}`);
  };

  const handleResetPitch = () => {
    handlePitchChange(0);
    handleAutoSave({ targetKey: formData.originalKey, isKeyConfirmed: false });
    showSuccess("Pitch reset to original key");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file || !song) return;

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const isAudio = ['mp3', 'wav', 'm4a', 'aac'].includes(fileExt?.toLowerCase() || '');

      if (!isAudio) {
        showError("Only audio files are supported for upload here.");
        return;
      }

      const fileName = `${song.id}/${Date.now()}.${fileExt}`;
      const bucket = 'public_assets'; // Assuming 'public_assets' is your bucket name

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      handleAutoSave({ previewUrl: publicUrl });
      await onLoadAudioFromUrl(publicUrl, formData.pitch || 0);
      showSuccess("Master Audio Linked");
    } catch (err: any) {
      console.error("Upload Error:", err);
      showError(`Upload failed: ${err.message || "Unknown Error"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const stopMetronome = () => {
    Tone.getTransport().stop();
    metronomeLoopRef.current?.stop();
    setIsMetronomeActive(false);
  };

  const toggleMetronome = async () => {
    if (!formData.bpm) {
      showError("Set a BPM first.");
      return;
    }

    if (isMetronomeActive) {
      stopMetronome();
    } else {
      if (Tone.getContext().state !== 'running') await Tone.start();

      if (!metronomeSynthRef.current) {
        metronomeSynthRef.current = new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 4,
          oscillator: {
            type: "sine"
          }
        }).toDestination();
      }

      const bpmValue = parseInt(formData.bpm);
      if (isNaN(bpmValue) || bpmValue <= 0) return;

      Tone.getTransport().bpm.value = bpmValue;

      if (!metronomeLoopRef.current) {
        metronomeLoopRef.current = new Tone.Loop((time) => {
          metronomeSynthRef.current?.triggerAttackRelease("C4", "32n", time);
        }, "4n").start(0);
      } else {
        metronomeLoopRef.current.start(0);
      }

      Tone.getTransport().start();
      setIsMetronomeActive(true);
    }
  };

  const handleDetectKey = async () => {
    if (!currentBuffer) {
      showError("No audio loaded to detect key.");
      return;
    }
    setKeyDetectionLoading(true);
    try {
      const candidates = await detectKeyFromBuffer(currentBuffer);
      setDetectedKeys(candidates);
      if (candidates.length > 0) {
        handleAutoSave({ originalKey: candidates[0].key, isKeyConfirmed: true });
        showSuccess(`Key detected as ${formatKey(candidates[0].key, currentKeyPreference)}`);
      } else {
        showError("Could not detect key.");
      }
    } catch (error) {
      console.error("Key detection failed:", error);
      showError("Key detection failed.");
    } finally {
      setKeyDetectionLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">Audio Playback</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDetectKey}
            disabled={!currentBuffer || keyDetectionLoading}
            className="text-slate-400 hover:text-white font-black uppercase tracking-[0.2em] text-[10px] gap-2"
          >
            {keyDetectionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
            Detect Key
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetPitch}
            disabled={pitch === 0}
            className="text-slate-400 hover:text-white font-black uppercase tracking-[0.2em] text-[10px] gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Pitch
          </Button>
        </div>
      </div>

      {/* Audio Player */}
      <div
        className={cn(
          "bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col gap-6",
          isDragOver ? "border-indigo-500 ring-2 ring-indigo-500/50" : ""
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              className="h-12 w-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
              onClick={togglePlayback}
              disabled={!formData.previewUrl || isUploading}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </Button>
            <div>
              <p className="text-sm font-black uppercase tracking-tight text-white leading-none">{formData.name || "No Song Loaded"}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{formData.artist || "Unknown Artist"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            ) : formData.previewUrl ? (
              <a href={formData.previewUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
                <Link2 className="w-4 h-4" />
              </a>
            ) : (
              <div className="text-slate-600">
                <Link2 className="w-4 h-4" />
              </div>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-full text-slate-400 hover:bg-white/10"
              onClick={() => handleAutoSave({ previewUrl: undefined })}
              disabled={!formData.previewUrl}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-slate-400">{formatTime(progress * duration)}</span>
          <Slider
            value={[progress * 100]}
            max={100}
            step={0.1}
            onValueChange={([value]) => setProgress(value / 100)}
            className="flex-1"
            disabled={!formData.previewUrl}
          />
          <span className="text-[10px] font-mono text-slate-400">{formatTime(duration)}</span>
        </div>

        {formData.previewUrl ? (
          <div className="text-center text-slate-500 text-xs font-medium">
            Drag & drop an audio file here to replace master audio.
          </div>
        ) : (
          <div className="text-center text-slate-500 text-xs font-medium">
            Drag & drop an audio file here to link master audio.
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Harmonic Controls</h4>
          <div>
            <Label htmlFor="originalKey" className="text-[9px] font-bold text-slate-400 uppercase">Original Key</Label>
            <Input
              id="originalKey"
              value={formData.originalKey || ""}
              onChange={(e) => handleAutoSave({ originalKey: e.target.value, isKeyConfirmed: false })}
              placeholder="e.g., C, Am"
              className="mt-2 bg-black/40 border border-white/20 rounded-xl p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <Label htmlFor="targetKey" className="text-[9px] font-bold text-slate-400 uppercase">Target Key</Label>
            <Select
              value={formData.targetKey || formData.originalKey || "C"}
              onValueChange={handleTargetKeyChange}
              disabled={!formData.originalKey}
            >
              <SelectTrigger className="mt-2 h-10 text-sm bg-black/40 border border-white/20 text-white rounded-xl">
                <Music className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Select target key" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border border-white/10 text-white">
                {keysToUse.map(key => (
                  <SelectItem key={key} value={key} className="text-sm">
                    {formatKey(key, currentKeyPreference)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pitch" className="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
              <span>Pitch Shift</span>
              <span className="text-xs font-mono font-bold text-indigo-400">{pitch} ST</span>
            </Label>
            <Slider
              value={[pitch]}
              min={-12}
              max={12}
              step={1}
              onValueChange={([value]) => handlePitchChange(value)}
              className="mt-2"
              disabled={!formData.previewUrl}
            />
          </div>
          <div>
            <Label htmlFor="fineTune" className="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
              <span>Fine Tune</span>
              <span className="text-xs font-mono font-bold text-indigo-400">{fineTune.toFixed(2)} Cents</span>
            </Label>
            <Slider
              value={[fineTune]}
              min={-50}
              max={50}
              step={0.01}
              onValueChange={([value]) => handleFineTuneChange(value)}
              className="mt-2"
              disabled={!formData.previewUrl}
            />
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Performance Controls</h4>
          <div>
            <Label htmlFor="tempo" className="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
              <span>Tempo</span>
              <span className="text-xs font-mono font-bold text-indigo-400">x{tempo.toFixed(2)}</span>
            </Label>
            <Slider
              value={[tempo]}
              min={0.5}
              max={2}
              step={0.01}
              onValueChange={([value]) => handleTempoChange(value)}
              className="mt-2"
              disabled={!formData.previewUrl}
            />
          </div>
          <div>
            <Label htmlFor="volume" className="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
              <span>Volume</span>
              <span className="text-xs font-mono font-bold text-indigo-400">{volume.toFixed(1)} dB</span>
            </Label>
            <Slider
              value={[volume]}
              min={-40}
              max={0}
              step={0.1}
              onValueChange={([value]) => handleVolumeChange(value)}
              className="mt-2"
              disabled={!formData.previewUrl}
            />
          </div>
          <div>
            <Label htmlFor="metronome" className="text-[9px] font-bold text-slate-400 uppercase flex items-center justify-between">
              <span>Metronome</span>
              <Button
                size="sm"
                onClick={toggleMetronome}
                disabled={!formData.bpm}
                className={cn(
                  "h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest gap-2",
                  isMetronomeActive ? "bg-emerald-600 hover:bg-emerald-500" : "bg-white/10 hover:bg-white/20"
                )}
              >
                {isMetronomeActive ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                {isMetronomeActive ? "ON" : "OFF"}
              </Button>
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongAudioPlaybackTab;
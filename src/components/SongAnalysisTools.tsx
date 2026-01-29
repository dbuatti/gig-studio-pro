"use client";

import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SetlistSong } from './SetlistManager';
import { cn } from "@/lib/utils";
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/use-settings';
import { detectKeyFromBuffer, KeyCandidate } from '@/utils/keyDetector';
import { formatKey } from '@/utils/keyUtils';
import {
  Loader2, Disc, SearchCode, Cloud
} from 'lucide-react';
import { analyze } from 'web-audio-beat-detector';

interface SongAnalysisToolsProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void; // Changed signature
  currentBuffer: AudioBuffer | null;
  isMobile: boolean;
}

const SongAnalysisTools: React.FC<SongAnalysisToolsProps> = ({
  song,
  formData,
  handleAutoSave, // Changed signature
  currentBuffer,
  isMobile,
}) => {
  const { keyPreference: globalPreference } = useSettings();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetectingKey, setIsDetectingKey] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [keyCandidates, setKeyCandidates] = useState<KeyCandidate[]>([]);

  const currentKeyPreference = formData.key_preference || globalPreference;

  const handleDetectBPM = async () => {
    if (!currentBuffer) {
      showError("Load audio first.");
      return;
    }
    setIsAnalyzing(true);
    try {
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
        handleAutoSave({ 
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
    handleAutoSave({ 
      originalKey: key,
      isKeyConfirmed: true 
    });
    setKeyCandidates([]);
    showSuccess(`Original Key set to ${key}`);
  };

  return (
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
  );
};

export default SongAnalysisTools;
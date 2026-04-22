"use client";

import React, { useState, useEffect } from 'react';
import { SetlistSong, EnergyZone } from '@/components/SetlistManager';
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT } from '@/utils/keyUtils';
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Save, Music, User, Key, Zap, Tag, FileText, Layout, Guitar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChartType } from '@/pages/AuditReaderMode';

interface RehearsalPanelProps {
  song: SetlistSong;
  onUpdate: (updates: Partial<SetlistSong>) => Promise<void>;
  keyPreference: 'sharps' | 'flats';
  selectedChartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
}

const RehearsalPanel: React.FC<RehearsalPanelProps> = ({ 
  song, 
  onUpdate, 
  keyPreference,
  selectedChartType,
  onChartTypeChange
}) => {
  const [localSong, setLocalSong] = useState<SetlistSong>(song);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSong(song);
  }, [song]);

  const handleUpdate = async (updates: Partial<SetlistSong>) => {
    setLocalSong(prev => ({ ...prev, ...updates }));
    setIsSaving(true);
    try {
      await onUpdate(updates);
    } finally {
      setIsSaving(false);
    }
  };

  const keys = keyPreference === 'sharps' ? ALL_KEYS_SHARP : ALL_KEYS_FLAT;
  const energyZones: EnergyZone[] = ['Ambient', 'Pulse', 'Groove', 'Peak'];

  const hasPdf = !!(localSong.pdfUrl || localSong.sheet_music_url);
  const hasLeadsheet = !!localSong.leadsheetUrl;
  const hasChords = !!(localSong.ug_chords_text || localSong.ugUrl);

  return (
    <div className="w-80 h-full bg-slate-900/50 border-l border-white/10 flex flex-col overflow-y-auto custom-scrollbar p-6 space-y-8">
      <div className="space-y-2">
        <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
          Rehearsal Tools
          {isSaving && <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />}
        </h3>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Audit & Practice Mode</p>
      </div>

      {/* Chart Selection Matrix */}
      <div className="space-y-4">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chart Source</Label>
        <div className="grid grid-cols-3 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => onChartTypeChange('pdf')}
            disabled={!hasPdf}
            className={cn(
              "flex flex-col items-center justify-center py-3 rounded-lg transition-all gap-1.5",
              selectedChartType === 'pdf' 
                ? "bg-indigo-600 text-white shadow-lg" 
                : "text-slate-500 hover:text-slate-300 disabled:opacity-20"
            )}
          >
            <FileText className="w-4 h-4" />
            <span className="text-[8px] font-black uppercase">Score</span>
          </button>
          <button
            onClick={() => onChartTypeChange('leadsheet')}
            disabled={!hasLeadsheet}
            className={cn(
              "flex flex-col items-center justify-center py-3 rounded-lg transition-all gap-1.5",
              selectedChartType === 'leadsheet' 
                ? "bg-indigo-600 text-white shadow-lg" 
                : "text-slate-500 hover:text-slate-300 disabled:opacity-20"
            )}
          >
            <Layout className="w-4 h-4" />
            <span className="text-[8px] font-black uppercase">Lead</span>
          </button>
          <button
            onClick={() => onChartTypeChange('chords')}
            disabled={!hasChords}
            className={cn(
              "flex flex-col items-center justify-center py-3 rounded-lg transition-all gap-1.5",
              selectedChartType === 'chords' 
                ? "bg-indigo-600 text-white shadow-lg" 
                : "text-slate-500 hover:text-slate-300 disabled:opacity-20"
            )}
          >
            <Guitar className="w-4 h-4" />
            <span className="text-[8px] font-black uppercase">Chords</span>
          </button>
        </div>
      </div>

      {/* Confidence Slider */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confidence</Label>
          <span className={cn(
            "text-xs font-mono font-bold px-2 py-0.5 rounded-lg",
            localSong.comfort_level && localSong.comfort_level >= 80 ? "bg-emerald-500/20 text-emerald-400" :
            localSong.comfort_level && localSong.comfort_level >= 50 ? "bg-amber-500/20 text-amber-400" :
            "bg-red-500/20 text-red-400"
          )}>
            {localSong.comfort_level || 0}%
          </span>
        </div>
        <Slider
          value={[localSong.comfort_level || 0]}
          max={100}
          step={1}
          onValueChange={(val) => handleUpdate({ comfort_level: val[0] })}
          className="py-4"
        />
      </div>

      {/* Needs Improvement Toggle */}
      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
        <div className="space-y-0.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-white">Needs Work</Label>
          <p className="text-[9px] text-slate-500 font-medium">Flag for more practice</p>
        </div>
        <Switch
          checked={localSong.needs_improvement || false}
          onCheckedChange={(checked) => handleUpdate({ needs_improvement: checked })}
        />
      </div>

      {/* Metadata Editor */}
      <div className="space-y-6">
        <div className="space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Music className="w-3 h-3" /> Title
          </Label>
          <Input
            value={localSong.name}
            onChange={(e) => setLocalSong(prev => ({ ...prev, name: e.target.value }))}
            onBlur={() => handleUpdate({ name: localSong.name })}
            className="bg-black/20 border-white/5 h-10 text-xs font-bold rounded-xl focus-visible:ring-indigo-500/50"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <User className="w-3 h-3" /> Artist
          </Label>
          <Input
            value={localSong.artist || ""}
            onChange={(e) => setLocalSong(prev => ({ ...prev, artist: e.target.value }))}
            onBlur={() => handleUpdate({ artist: localSong.artist })}
            className="bg-black/20 border-white/5 h-10 text-xs font-bold rounded-xl focus-visible:ring-indigo-500/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Key className="w-3 h-3" /> Key
            </Label>
            <Select
              value={localSong.targetKey || localSong.originalKey || "TBC"}
              onValueChange={(val) => handleUpdate({ targetKey: val })}
            >
              <SelectTrigger className="bg-black/20 border-white/5 h-10 text-xs font-bold rounded-xl">
                <SelectValue placeholder="Key" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-white/10 text-white">
                {keys.map(k => (
                  <SelectItem key={k} value={k} className="text-xs font-mono font-bold">{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Zap className="w-3 h-3" /> Energy
            </Label>
            <Select
              value={localSong.energy_level || ""}
              onValueChange={(val) => handleUpdate({ energy_level: val as EnergyZone })}
            >
              <SelectTrigger className="bg-black/20 border-white/5 h-10 text-xs font-bold rounded-xl">
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-white/10 text-white">
                {energyZones.map(z => (
                  <SelectItem key={z} value={z} className="text-xs font-bold">{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Tag className="w-3 h-3" /> Genre
          </Label>
          <Input
            value={localSong.genre || ""}
            onChange={(e) => setLocalSong(prev => ({ ...prev, genre: e.target.value }))}
            onBlur={() => handleUpdate({ genre: localSong.genre })}
            className="bg-black/20 border-white/5 h-10 text-xs font-bold rounded-xl focus-visible:ring-indigo-500/50"
          />
        </div>
      </div>

      {/* Rehearsal Notes */}
      <div className="space-y-3 flex-1 flex flex-col">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <FileText className="w-3 h-3" /> Rehearsal Notes
        </Label>
        <Textarea
          value={localSong.notes || ""}
          onChange={(e) => setLocalSong(prev => ({ ...prev, notes: e.target.value }))}
          onBlur={() => handleUpdate({ notes: localSong.notes })}
          placeholder="Add practice notes, arrangement details..."
          className="bg-black/20 border-white/5 flex-1 min-h-[150px] text-xs font-medium rounded-2xl focus-visible:ring-indigo-500/50 resize-none p-4"
        />
      </div>

      <div className="pt-4 border-t border-white/5">
        <div className="flex items-center gap-3 text-slate-500">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-[9px] font-black uppercase tracking-widest">Auto-saving active</span>
        </div>
      </div>
    </div>
  );
};

export default RehearsalPanel;
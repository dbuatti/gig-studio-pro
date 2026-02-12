"use client";

import React from 'react';
import { SetlistSong, EnergyZone } from './SetlistManager';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Music, Tag, FileText, Clock, FileType } from 'lucide-react';
import { cn } from '@/lib/utils';
import PDFUploadZone from './PDFUploadZone';

interface SongDetailsTabProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
}

const ENERGY_ZONES: EnergyZone[] = ['Ambient', 'Pulse', 'Groove', 'Peak'];

const SongDetailsTab: React.FC<SongDetailsTabProps> = ({ formData, handleAutoSave, isMobile }) => {
  const handleUploadComplete = (url: string, type: 'pdf' | 'leadsheet') => {
    if (type === 'pdf') {
      handleAutoSave({ pdfUrl: url });
    } else {
      handleAutoSave({ leadsheetUrl: url });
    }
  };

  const handleRemoveFile = (type: 'pdf' | 'leadsheet') => {
    if (type === 'pdf') {
      handleAutoSave({ pdfUrl: undefined });
    } else {
      handleAutoSave({ leadsheetUrl: undefined });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Metadata & Classification */}
        <div className="space-y-8">
          {/* Basic Info Section */}
          <div className="space-y-6 bg-white/5 p-6 rounded-[2rem] border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-indigo-600/20 p-2 rounded-xl">
                <Music className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Basic Metadata</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Track Title</Label>
                <Input 
                  value={formData.name || ""} 
                  onChange={(e) => handleAutoSave({ name: e.target.value })}
                  className="bg-black/40 border-white/10 h-12 rounded-xl font-bold text-white focus:ring-indigo-500/50"
                  placeholder="e.g. Superstition"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Artist / Composer</Label>
                <Input 
                  value={formData.artist || ""} 
                  onChange={(e) => handleAutoSave({ artist: e.target.value })}
                  className="bg-black/40 border-white/10 h-12 rounded-xl font-bold text-white focus:ring-indigo-500/50"
                  placeholder="e.g. Stevie Wonder"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">BPM</Label>
                  <Input 
                    value={formData.bpm || ""} 
                    onChange={(e) => handleAutoSave({ bpm: e.target.value })}
                    className="bg-black/40 border-white/10 h-12 rounded-xl font-mono font-bold text-white focus:ring-indigo-500/50"
                    placeholder="120"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Duration (Sec)</Label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input 
                      type="number"
                      value={formData.duration_seconds || ""} 
                      onChange={(e) => handleAutoSave({ duration_seconds: parseInt(e.target.value) || 0 })}
                      className="bg-black/40 border-white/10 h-12 pl-11 rounded-xl font-mono font-bold text-white focus:ring-indigo-500/50"
                      placeholder="240"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Classification Section */}
          <div className="space-y-6 bg-white/5 p-6 rounded-[2rem] border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-purple-600/20 p-2 rounded-xl">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Vibe & Classification</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Energy Zone</Label>
                <Select 
                  value={formData.energy_level || ""} 
                  onValueChange={(val) => handleAutoSave({ energy_level: val as EnergyZone })}
                >
                  <SelectTrigger className="bg-black/40 border-white/10 h-12 rounded-xl font-bold text-white focus:ring-purple-500/50">
                    <SelectValue placeholder="Select Energy Zone" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
                    {ENERGY_ZONES.map(zone => (
                      <SelectItem key={zone} value={zone} className="font-bold uppercase text-[10px] tracking-widest focus:bg-purple-600 focus:text-white">
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Genre</Label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input 
                    value={formData.genre || ""} 
                    onChange={(e) => handleAutoSave({ genre: e.target.value })}
                    className="bg-black/40 border-white/10 h-12 pl-11 rounded-xl font-bold text-white focus:ring-purple-500/50"
                    placeholder="e.g. Funk / Soul"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">User Tags</Label>
                <Input 
                  value={formData.user_tags?.join(', ') || ""} 
                  onChange={(e) => handleAutoSave({ user_tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  className="bg-black/40 border-white/10 h-12 rounded-xl font-bold text-white focus:ring-purple-500/50"
                  placeholder="e.g. Wedding, Upbeat, Request"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Charts & Notes */}
        <div className="space-y-8">
          {/* Charts & Scores Section */}
          <div className="space-y-6 bg-white/5 p-6 rounded-[2rem] border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-emerald-600/20 p-2 rounded-xl">
                <FileType className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Charts & Scores</h3>
            </div>
            
            <PDFUploadZone 
              onUploadComplete={handleUploadComplete}
              currentPdfUrl={formData.pdfUrl}
              currentLeadsheetUrl={formData.leadsheetUrl}
              onRemove={handleRemoveFile}
              songId={formData.master_id || formData.id}
              songTitle={formData.name}
            />
          </div>

          {/* Notes Section */}
          <div className="space-y-4 bg-white/5 p-6 rounded-[2rem] border border-white/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-amber-600/20 p-2 rounded-xl">
                <FileText className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Performance Notes</h3>
            </div>
            <Textarea 
              value={formData.notes || ""} 
              onChange={(e) => handleAutoSave({ notes: e.target.value })}
              className="bg-black/40 border-white/10 min-h-[180px] rounded-[1.5rem] font-medium text-white focus:ring-amber-500/50 p-4 leading-relaxed"
              placeholder="Add specific performance instructions, cues, or arrangement notes here..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongDetailsTab;
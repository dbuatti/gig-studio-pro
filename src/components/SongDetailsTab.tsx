"use client";

import React from 'react';
import { SetlistSong, EnergyZone } from './SetlistManager';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Music, Tag, FileText, Clock, FileType, Search, Globe, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import PDFUploadZone from './PDFUploadZone';
import { Button } from './ui/button';

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

  const handleSearchChart = () => {
    const query = encodeURIComponent(`${formData.name} ${formData.artist} sheet music pdf free`);
    window.open(`https://www.google.com/search?q=${query}`, '_blank');
  };

  return (
    <div className={cn(
      "space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12",
      isMobile ? "px-0" : ""
    )}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Left Column: Metadata & Classification */}
        <div className="space-y-6 md:space-y-8">
          {/* Basic Info Section */}
          <div className={cn(
            "space-y-4 md:space-y-6 bg-white/5 border border-white/10",
            isMobile ? "p-5 rounded-3xl" : "p-6 rounded-[2rem]"
          )}>
            <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
              <div className="bg-indigo-600/20 p-1.5 md:p-2 rounded-lg md:rounded-xl">
                <Music className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
              </div>
              <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-white">Basic Metadata</h3>
            </div>
            
            <div className="space-y-3 md:space-y-4">
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Track Title</Label>
                <Input 
                  value={formData.name || ""} 
                  onChange={(e) => handleAutoSave({ name: e.target.value })}
                  className="bg-black/40 border-white/10 h-11 md:h-12 rounded-xl font-bold text-white focus:ring-indigo-500/50"
                  placeholder="e.g. Superstition"
                />
              </div>
              
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Artist / Composer</Label>
                <Input 
                  value={formData.artist || ""} 
                  onChange={(e) => handleAutoSave({ artist: e.target.value })}
                  className="bg-black/40 border-white/10 h-11 md:h-12 rounded-xl font-bold text-white focus:ring-indigo-500/50"
                  placeholder="e.g. Stevie Wonder"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">BPM</Label>
                  <Input 
                    value={formData.bpm || ""} 
                    onChange={(e) => handleAutoSave({ bpm: e.target.value })}
                    className="bg-black/40 border-white/10 h-11 md:h-12 rounded-xl font-mono font-bold text-white focus:ring-indigo-500/50"
                    placeholder="120"
                  />
                </div>
                <div className="space-y-1.5 md:space-y-2">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Duration (Sec)</Label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
                    <Input 
                      type="number"
                      value={formData.duration_seconds || ""} 
                      onChange={(e) => handleAutoSave({ duration_seconds: parseInt(e.target.value) || 0 })}
                      className="bg-black/40 border-white/10 h-11 md:h-12 pl-10 md:pl-11 rounded-xl font-mono font-bold text-white focus:ring-indigo-500/50"
                      placeholder="240"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Classification Section */}
          <div className={cn(
            "space-y-4 md:space-y-6 bg-white/5 border border-white/10",
            isMobile ? "p-5 rounded-3xl" : "p-6 rounded-[2rem]"
          )}>
            <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
              <div className="bg-purple-600/20 p-1.5 md:p-2 rounded-lg md:rounded-xl">
                <Zap className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
              </div>
              <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-white">Vibe & Classification</h3>
            </div>

            <div className="space-y-3 md:space-y-4">
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Energy Zone</Label>
                <Select 
                  value={formData.energy_level || ""} 
                  onValueChange={(val) => handleAutoSave({ energy_level: val as EnergyZone })}
                >
                  <SelectTrigger className="bg-black/40 border-white/10 h-11 md:h-12 rounded-xl font-bold text-white focus:ring-purple-500/50">
                    <SelectValue placeholder="Select Energy Zone" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
                    {ENERGY_ZONES.map(zone => (
                      <SelectItem key={zone} value={zone} className="font-bold uppercase text-[9px] md:text-[10px] tracking-widest focus:bg-purple-600 focus:text-white">
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Genre</Label>
                <div className="relative">
                  <Tag className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
                  <Input 
                    value={formData.genre || ""} 
                    onChange={(e) => handleAutoSave({ genre: e.target.value })}
                    className="bg-black/40 border-white/10 h-11 md:h-12 pl-10 md:pl-11 rounded-xl font-bold text-white focus:ring-purple-500/50"
                    placeholder="e.g. Funk / Soul"
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">User Tags</Label>
                <Input 
                  value={formData.user_tags?.join(', ') || ""} 
                  onChange={(e) => handleAutoSave({ user_tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                  className="bg-black/40 border-white/10 h-11 md:h-12 rounded-xl font-bold text-white focus:ring-purple-500/50"
                  placeholder="e.g. Wedding, Upbeat, Request"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Charts & Notes */}
        <div className="space-y-6 md:space-y-8">
          {/* Charts & Scores Section */}
          <div className={cn(
            "space-y-4 md:space-y-6 bg-white/5 border border-white/10",
            isMobile ? "p-5 rounded-3xl" : "p-6 rounded-[2rem]"
          )}>
            <div className="flex items-center justify-between mb-1 md:mb-2">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="bg-emerald-600/20 p-1.5 md:p-2 rounded-lg md:rounded-xl">
                  <FileType className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                </div>
                <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-white">Charts & Scores</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSearchChart}
                className="h-8 md:h-9 px-3 md:px-4 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/10 gap-1.5 md:gap-2"
              >
                <Search className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="hidden xs:inline">Search Web</span>
              </Button>
            </div>
            
            <PDFUploadZone 
              onUploadComplete={handleUploadComplete}
              currentPdfUrl={formData.pdfUrl}
              currentLeadsheetUrl={formData.leadsheetUrl}
              onRemove={handleRemoveFile}
              songId={formData.master_id || formData.id}
              songTitle={formData.name}
            />

            <div className="space-y-3 md:space-y-4 pt-3 md:pt-4 border-t border-white/5">
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">External PDF Link</Label>
                <div className="relative">
                  <Globe className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
                  <Input 
                    value={formData.pdfUrl || ""} 
                    onChange={(e) => handleAutoSave({ pdfUrl: e.target.value })}
                    className="bg-black/40 border-white/10 h-11 md:h-12 pl-10 md:pl-11 rounded-xl font-bold text-white focus:ring-indigo-500/50"
                    placeholder="Paste PDF URL here..."
                  />
                </div>
              </div>
              <div className="space-y-1.5 md:space-y-2">
                <Label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">External Lead Sheet Link</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
                  <Input 
                    value={formData.leadsheetUrl || ""} 
                    onChange={(e) => handleAutoSave({ leadsheetUrl: e.target.value })}
                    className="bg-black/40 border-white/10 h-11 md:h-12 pl-10 md:pl-11 rounded-xl font-bold text-white focus:ring-indigo-500/50"
                    placeholder="Paste Lead Sheet URL here..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className={cn(
            "space-y-3 md:space-y-4 bg-white/5 border border-white/10",
            isMobile ? "p-5 rounded-3xl" : "p-6 rounded-[2rem]"
          )}>
            <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
              <div className="bg-amber-600/20 p-1.5 md:p-2 rounded-lg md:rounded-xl">
                <FileText className="w-4 h-4 md:w-5 md:h-5 text-amber-400" />
              </div>
              <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-white">Performance Notes</h3>
            </div>
            <Textarea 
              value={formData.notes || ""} 
              onChange={(e) => handleAutoSave({ notes: e.target.value })}
              className="bg-black/40 border-white/10 min-h-[140px] md:min-h-[180px] rounded-2xl md:rounded-[1.5rem] font-medium text-white focus:ring-amber-500/50 p-4 leading-relaxed text-sm md:text-base"
              placeholder="Add specific performance instructions, cues, or arrangement notes here..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongDetailsTab;
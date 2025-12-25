"use client";
import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { Settings2, ShieldCheck, ExternalLink } from 'lucide-react';

interface SongDetailsTabProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
  onOpenAdmin?: () => void; // Added onOpenAdmin prop
}

const SongDetailsTab: React.FC<SongDetailsTabProps> = ({
  formData,
  handleAutoSave,
  isMobile,
  onOpenAdmin
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400">Song Details</h3>
        {onOpenAdmin && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onOpenAdmin}
            className="text-slate-400 hover:text-white font-black uppercase tracking-[0.2em] text-[10px] gap-2"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Admin
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Song Title</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => handleAutoSave({ name: e.target.value })}
              placeholder="Enter song title"
              className="mt-2 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <Label htmlFor="artist" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Artist</Label>
            <Input
              id="artist"
              value={formData.artist || ""}
              onChange={(e) => handleAutoSave({ artist: e.target.value })}
              placeholder="Enter artist name"
              className="mt-2 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <Label htmlFor="bpm" className="text-[10px] font-black uppercase tracking-widest text-slate-400">BPM</Label>
            <Input
              id="bpm"
              type="number"
              value={formData.bpm || ""}
              onChange={(e) => handleAutoSave({ bpm: e.target.value })}
              placeholder="Enter BPM"
              className="mt-2 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="youtubeUrl" className="text-[10px] font-black uppercase tracking-widest text-slate-400">YouTube URL</Label>
            <Input
              id="youtubeUrl"
              value={formData.youtubeUrl || ""}
              onChange={(e) => handleAutoSave({ youtubeUrl: e.target.value })}
              placeholder="Paste YouTube URL"
              className="mt-2 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <Label htmlFor="ugUrl" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ultimate Guitar URL</Label>
            <Input
              id="ugUrl"
              value={formData.ugUrl || ""}
              onChange={(e) => handleAutoSave({ ugUrl: e.target.value })}
              placeholder="Paste Ultimate Guitar URL"
              className="mt-2 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <Label htmlFor="pdfUrl" className="text-[10px] font-black uppercase tracking-widest text-slate-400">PDF Chart URL</Label>
            <Input
              id="pdfUrl"
              value={formData.pdfUrl || ""}
              onChange={(e) => handleAutoSave({ pdfUrl: e.target.value })}
              placeholder="Paste PDF chart URL"
              className="mt-2 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => handleAutoSave({ notes: e.target.value })}
          placeholder="Add any performance notes or reminders"
          className="mt-2 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm min-h-[100px]"
        />
      </div>

      <div className="flex items-center gap-3 mt-6">
        <div className={cn(
          "h-5 w-5 rounded-full flex items-center justify-center",
          formData.isMetadataConfirmed ? "bg-emerald-500" : "bg-slate-500"
        )}>
          <ShieldCheck className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
          Metadata {formData.isMetadataConfirmed ? "Confirmed" : "Unconfirmed"}
        </span>
      </div>
    </div>
  );
};

export default SongDetailsTab;
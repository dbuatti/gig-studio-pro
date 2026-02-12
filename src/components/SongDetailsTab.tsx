"use client";

import React from 'react';
import { SetlistSong } from './SetlistManager';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Music, User, Hash, Tag, FileText, BookOpen } from 'lucide-react';
import PdfUploadZone from './PdfUploadZone';

interface SongDetailsTabProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
}

const SongDetailsTab: React.FC<SongDetailsTabProps> = ({
  formData,
  handleAutoSave,
  isMobile
}) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Metadata Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-600/20 p-2 rounded-xl text-indigo-400">
              <Tag className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Core Metadata</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Song Title</Label>
              <div className="relative">
                <Music className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  value={formData.name || ""} 
                  onChange={(e) => handleAutoSave({ name: e.target.value })}
                  placeholder="Enter song title"
                  className="pl-11 h-12 bg-white/5 border-white/10 rounded-xl font-bold text-sm focus:ring-indigo-500/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Artist / Composer</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  value={formData.artist || ""} 
                  onChange={(e) => handleAutoSave({ artist: e.target.value })}
                  placeholder="Enter artist name"
                  className="pl-11 h-12 bg-white/5 border-white/10 rounded-xl font-bold text-sm focus:ring-indigo-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">BPM</Label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input 
                    value={formData.bpm || ""} 
                    onChange={(e) => handleAutoSave({ bpm: e.target.value })}
                    placeholder="120"
                    className="pl-11 h-12 bg-white/5 border-white/10 rounded-xl font-bold text-sm focus:ring-indigo-500/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Genre</Label>
                <Input 
                  value={formData.genre || ""} 
                  onChange={(e) => handleAutoSave({ genre: e.target.value })}
                  placeholder="Pop, Jazz, etc."
                  className="h-12 bg-white/5 border-white/10 rounded-xl font-bold text-sm focus:ring-indigo-500/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sheet Music Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-600/20 p-2 rounded-xl text-emerald-400">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Sheet Music Assets</h3>
          </div>

          <div className="space-y-4">
            <PdfUploadZone 
              label="Full Score / PDF"
              type="pdf"
              currentUrl={formData.pdfUrl}
              onUploadComplete={(url) => handleAutoSave({ pdfUrl: url })}
              onRemove={() => handleAutoSave({ pdfUrl: "" })}
            />

            <PdfUploadZone 
              label="Lead Sheet"
              type="leadsheet"
              currentUrl={formData.leadsheetUrl}
              onUploadComplete={(url) => handleAutoSave({ leadsheetUrl: url })}
              onRemove={() => handleAutoSave({ leadsheetUrl: "" })}
            />
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-amber-600/20 p-2 rounded-xl text-amber-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Performance Notes</h3>
        </div>
        <Textarea 
          value={formData.notes || ""} 
          onChange={(e) => handleAutoSave({ notes: e.target.value })}
          placeholder="Add specific performance instructions, structure notes, or cues..."
          className="min-h-[150px] bg-white/5 border-white/10 rounded-2xl font-medium text-sm p-6 focus:ring-indigo-500/50 resize-none"
        />
      </div>
    </div>
  );
};

export default SongDetailsTab;
"use client";

import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ShieldCheck, Link2, FileText, ExternalLink, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';
import { sanitizeUGUrl } from '@/utils/ugUtils';
import { showSuccess } from '@/utils/toast';

interface SongDetailsTabProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
}

const SongDetailsTab: React.FC<SongDetailsTabProps> = ({ formData, handleAutoSave, isMobile }) => {
  // --- UG Link Handlers ---
  const handleUgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    console.log("[SongDetailsTab] UG URL changed:", newUrl); // Log change
    // Save immediately to parent state
    handleAutoSave({ ugUrl: newUrl });
  };

  const handleUgBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    if (newUrl) {
      const cleanUrl = sanitizeUGUrl(newUrl);
      if (cleanUrl !== newUrl) {
        console.log("[SongDetailsTab] UG URL sanitized:", cleanUrl); // Log sanitization
        // If the URL was cleaned, save the cleaned version
        handleAutoSave({ ugUrl: cleanUrl });
      }
      showSuccess("UG Link Saved");
    }
  };

  const handleRebindUg = () => {
    handleAutoSave({ ugUrl: "" }); // Reset link
    const query = encodeURIComponent((formData.artist || '') + ' ' + (formData.name || '') + ' chords');
    window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`, '_blank');
  };

  // --- Sheet Music Link Handlers ---
  const handleSheetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    console.log("[SongDetailsTab] Sheet URL changed:", newUrl); // Log change
    // Save immediately to parent state
    handleAutoSave({ sheet_music_url: newUrl });
  };

  const handleSheetBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    if (newUrl) {
      showSuccess("Sheet Music Link Saved");
    }
  };

  const handleRebindSheet = () => {
    handleAutoSave({ sheet_music_url: "" });
    const query = encodeURIComponent((formData.artist || '') + ' ' + (formData.name || '') + ' sheet music pdf');
    window.open(`https://www.google.com/search?q=${query}`, '_blank');
  };

  // --- Open Link Handlers ---
  const handleOpenUgLink = () => {
    if (formData.ugUrl) {
      window.open(formData.ugUrl, '_blank');
    }
  };

  const handleOpenSheetLink = () => {
    const url = formData.sheet_music_url || formData.pdfUrl || formData.leadsheetUrl;
    if (url) {
      window.open(url, '_blank');
    }
  };

  // Determine verification status based on presence
  const isUgVerified = !!formData.ugUrl;
  const isSheetVerified = !!(formData.sheet_music_url || formData.pdfUrl || formData.leadsheetUrl);

  console.log("[SongDetailsTab] Rendering with formData.ugUrl:", formData.ugUrl); // Log on render

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className={cn("grid gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        <div className="space-y-4">
          <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Title</Label>
          <Input 
            value={formData.name || ""} 
            onChange={(e) => handleAutoSave({ name: e.target.value })}
            className="bg-white/5 border-white/10 text-xl font-black h-16 rounded-2xl"
          />
        </div>
        <div className="space-y-4">
          <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Artist</Label>
          <Input 
            value={formData.artist || ""} 
            onChange={(e) => handleAutoSave({ artist: e.target.value })}
            className="bg-white/5 border-white/10 text-xl font-black h-16 rounded-2xl"
          />
        </div>
      </div>

      <div className={cn("grid gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        {/* Ultimate Guitar Link Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Ultimate Guitar</Label>
            {isUgVerified && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase flex items-center gap-1">
                <Check className="w-2.5 h-2.5" /> Linked
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="relative w-full">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  value={formData.ugUrl || ""} 
                  onChange={handleUgChange}
                  onBlur={handleUgBlur}
                  placeholder="Paste direct UG URL..." 
                  className={cn(
                    "bg-white/5 border-white/10 font-bold h-12 rounded-xl w-full pl-10",
                    isUgVerified ? "text-emerald-400" : "text-slate-400"
                  )} 
                />
              </div>
              {isUgVerified ? (
                <Button variant="outline" className="h-12 border-emerald-500/30 text-emerald-500 px-4 rounded-xl font-bold text-[10px] uppercase gap-2 shrink-0" onClick={handleOpenUgLink}>
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </Button>
              ) : (
                <Button variant="outline" className="h-12 border-white/10 text-orange-400 px-4 rounded-xl font-bold text-[10px] uppercase gap-2 shrink-0" onClick={handleRebindUg}>
                  <Link2 className="w-3.5 h-3.5" /> Find
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sheet Music Link Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Sheet Music / PDF</Label>
            {isSheetVerified && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase flex items-center gap-1">
                <Check className="w-2.5 h-2.5" /> Linked
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="relative w-full">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  value={formData.sheet_music_url || ""} 
                  onChange={handleSheetChange}
                  onBlur={handleSheetBlur}
                  placeholder="Paste PDF, Leadsheet, or UG URL..." 
                  className={cn(
                    "bg-white/5 border-white/10 font-bold h-12 rounded-xl w-full pl-10",
                    isSheetVerified ? "text-emerald-400" : "text-slate-400"
                  )} 
                />
              </div>
              {isSheetVerified ? (
                <Button variant="outline" className="h-12 border-emerald-500/30 text-emerald-500 px-4 rounded-xl font-bold text-[10px] uppercase gap-2 shrink-0" onClick={handleOpenSheetLink}>
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </Button>
              ) : (
                <Button variant="outline" className="h-12 border-white/10 text-indigo-400 px-4 rounded-xl font-bold text-[10px] uppercase gap-2 shrink-0" onClick={handleRebindSheet}>
                  <Link2 className="w-3.5 h-3.5" /> Find
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Stage Notes</Label>
        <Textarea 
          value={formData.notes || ""} 
          onChange={(e) => handleAutoSave({ notes: e.target.value })}
          placeholder="Cues..." 
          className={cn("bg-white/5 border-white/10 text-lg leading-relaxed p-8", isMobile ? "min-h-[200px] rounded-2xl" : "min-h-[350px] rounded-[2.5rem]")} 
        />
      </div>
    </div>
  );
};

export default SongDetailsTab;
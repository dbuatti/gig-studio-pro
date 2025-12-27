"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';
import { AddToGigButton } from './AddToGigButton';
import { useIsMobile } from '@/hooks/use-mobile';

// Memoized input component for better performance
const StudioInput = React.memo(({ label, value, onChange, placeholder, className, isTextarea = false, type = "text" }: {
  label?: string;
  value: string | undefined;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  isTextarea?: boolean;
  type?: string;
}) => {
  const [localValue, setLocalValue] = useState(value || "");

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const Comp = isTextarea ? Textarea : Input;

  return (
    <div className={cn("space-y-4", isTextarea && "flex-1 flex flex-col h-full")}>
      {label && <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{label}</Label>}
      <Comp
        type={type}
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(className, isTextarea && "flex-1")}
      />
    </div>
  );
});

StudioInput.displayName = 'StudioInput';

interface SongDetailsTabProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
}

const SongDetailsTab: React.FC<SongDetailsTabProps> = ({ formData, handleAutoSave, isMobile }) => {
  const isMobileDevice = useIsMobile();

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className={cn("grid gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        <StudioInput label="Title" value={formData.name} onChange={(val: string) => handleAutoSave({ name: val })} className="bg-white/5 border-white/10 text-xl font-black h-16 rounded-2xl" />
        <StudioInput label="Artist" value={formData.artist} onChange={(val: string) => handleAutoSave({ artist: val })} className="bg-white/5 border-white/10 text-xl font-black h-16 rounded-2xl" />
      </div>
      <div className={cn("grid gap-10", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        <div className="space-y-4">
          <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Chart Link</Label>
          <div className="flex gap-3">
            <StudioInput value={formData.pdfUrl} onChange={(val: string) => handleAutoSave({ pdfUrl: val })} placeholder="Paste URL..." className="bg-white/5 border-white/10 font-bold h-12 rounded-xl w-full" />
            <Button variant="outline" className="h-12 border-white/10 text-slate-400 px-4 rounded-xl font-bold text-[10px] uppercase gap-2 shrink-0 min-w-[120px]" onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent((formData.artist || '') + ' ' + (formData.name || '') + ' sheet music pdf')}`, '_blank')}><Search className="w-3.5 h-3.5" /> Find</Button>
          </div>
        </div>
        <div className="space-y-4">
          <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Ultimate Guitar</Label>
          <div className="flex gap-3">
            <StudioInput value={formData.ugUrl} onChange={(val: string) => handleAutoSave({ ugUrl: val })} placeholder="Paste URL..." className="bg-white/5 border-white/10 font-bold text-orange-400 h-12 rounded-xl w-full" />
            <Button variant="outline" className="h-12 border-white/10 text-orange-400 px-4 rounded-xl font-bold text-[10px] uppercase gap-2 shrink-0 min-w-[120px]" onClick={() => window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent((formData.artist || '') + ' ' + (formData.name || '') + ' chords')}`, '_blank')}><Search className="w-3.5 h-3.5" /> Find</Button>
          </div>
        </div>
      </div>
      <StudioInput label="Stage Notes" isTextarea value={formData.notes} onChange={(val: string) => handleAutoSave({ notes: val })} placeholder="Cues..." className={cn("bg-white/5 border-white/10 text-lg leading-relaxed p-8", isMobile ? "min-h-[200px] rounded-2xl" : "min-h-[350px] rounded-[2.5rem]")} />
      
      {/* NEW: Add to Gig Button for Mobile */}
      {isMobileDevice && (
        <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 p-4 pb-safe -mx-4">
          <AddToGigButton
            songData={formData}
            onAdded={() => {}}
            className="w-full h-14 text-base font-black uppercase tracking-widest gap-3"
            size="lg"
            variant="default"
          />
        </div>
      )}
    </div>
  );
};

export default SongDetailsTab;
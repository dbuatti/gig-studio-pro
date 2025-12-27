"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, AlertTriangle, CheckCircle2, ShieldCheck, Link2, RotateCcw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';
import { sanitizeUGUrl } from '@/utils/ugUtils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

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
  const [localUgUrl, setLocalUgUrl] = useState(formData.ugUrl || "");
  const [isModified, setIsModified] = useState(false);

  useEffect(() => {
    setLocalUgUrl(formData.ugUrl || "");
    setIsModified(false);
  }, [formData.ugUrl]);

  const handleUGChange = (val: string) => {
    setLocalUgUrl(val);
    setIsModified(val !== (formData.ugUrl || ""));
  };

  const handleUGBlur = () => {
    if (localUgUrl !== formData.ugUrl) {
      const cleanUrl = sanitizeUGUrl(localUgUrl);
      handleAutoSave({ ugUrl: cleanUrl, is_ug_link_verified: false });
    }
  };

  const handleVerifyLink = () => {
    handleAutoSave({ is_ug_link_verified: true });
  };

  const handleRebind = () => {
    handleAutoSave({ ugUrl: "", is_ug_link_verified: false });
    window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent((formData.artist || '') + ' ' + (formData.name || ''))}`, '_blank');
  };

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
          <div className="flex justify-between items-center">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Ultimate Guitar</Label>
            <div className="flex gap-2">
              {isModified ? (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" /> Modified
                </Badge>
              ) : formData.ugUrl ? (
                formData.is_ug_link_verified ? (
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 text-[8px] font-black uppercase flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> Unverified
                  </Badge>
                )
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="relative w-full">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  value={localUgUrl} 
                  onChange={(e) => handleUGChange(e.target.value)}
                  onBlur={handleUGBlur}
                  placeholder="Paste direct UG URL..." 
                  className={cn(
                    "bg-white/5 border-white/10 font-bold h-12 rounded-xl w-full pl-10",
                    isModified ? "text-amber-400" : "text-orange-400"
                  )} 
                />
              </div>
              <Button variant="outline" className="h-12 border-white/10 text-orange-400 px-4 rounded-xl font-bold text-[10px] uppercase gap-2 shrink-0" onClick={handleRebind}>
                <RotateCcw className="w-3.5 h-3.5" /> Re-bind
              </Button>
            </div>
            
            {formData.ugUrl && !formData.is_ug_link_verified && (
              <Button 
                onClick={handleVerifyLink}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[9px] h-10 rounded-xl gap-2 shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm & Verify This Link
              </Button>
            )}
          </div>
        </div>
      </div>
      <StudioInput label="Stage Notes" isTextarea value={formData.notes} onChange={(val: string) => handleAutoSave({ notes: val })} placeholder="Cues..." className={cn("bg-white/5 border-white/10 text-lg leading-relaxed p-8", isMobile ? "min-h-[200px] rounded-2xl" : "min-h-[350px] rounded-[2.5rem]")} />
    </div>
  );
};

export default SongDetailsTab;
"use client";

import React, { useState, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ShieldCheck, Link2, FileText, ExternalLink, Check, UploadCloud, Loader2, AlertCircle, Layout } from 'lucide-react'; // Added Layout
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';
import { sanitizeUGUrl } from '@/utils/ugUtils';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface SongDetailsTabProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  isMobile: boolean;
}

const SongDetailsTab: React.FC<SongDetailsTabProps> = ({ formData, handleAutoSave, isMobile }) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ file: File; type: 'pdf' | 'leadsheet' } | null>(null);

  // --- UG Link Handlers ---
  const handleUgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleAutoSave({ ugUrl: e.target.value });
  };

  const handleUgBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    if (newUrl) {
      const cleanUrl = sanitizeUGUrl(newUrl);
      if (cleanUrl !== newUrl) {
        handleAutoSave({ ugUrl: cleanUrl });
      }
      showSuccess("UG Link Saved");
    }
  };

  const handleRebindUg = () => {
    handleAutoSave({ ugUrl: "" });
    const query = encodeURIComponent((formData.artist || '') + ' ' + (formData.name || '') + ' chords');
    window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`, '_blank');
  };

  // --- Sheet Music Link Handlers ---
  const handleSheetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleAutoSave({ sheet_music_url: e.target.value });
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

  // --- Drag and Drop Handlers ---
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setPendingUpload({ file, type: 'pdf' }); // Default to PDF, user will confirm type
      } else {
        showError("Only PDF files are allowed.");
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/pdf") {
        setPendingUpload({ file, type: 'pdf' });
      } else {
        showError("Only PDF files are allowed.");
      }
    }
  };

  // --- Upload Logic ---
  const confirmUpload = async (designation: 'pdf' | 'leadsheet') => {
    if (!user || !pendingUpload || !formData.name) return;

    setIsUploading(true);
    try {
      const fileExt = pendingUpload.file.name.split('.').pop();
      // Sanitize filename
      const sanitizedName = formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `${user.id}/${formData.id || 'temp'}_${sanitizedName}_${designation}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('public_audio') // Using existing bucket, could create 'charts' if preferred
        .upload(fileName, pendingUpload.file, { upsert: true, contentType: 'application/pdf' });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('public_audio').getPublicUrl(fileName);

      const updates: any = { 
        sheet_music_url: publicUrl,
        is_sheet_verified: true 
      };

      if (designation === 'pdf') {
        updates.pdfUrl = publicUrl;
      } else {
        updates.leadsheetUrl = publicUrl;
      }

      handleAutoSave(updates);
      showSuccess(`Uploaded ${designation === 'pdf' ? 'Full Score' : 'Leadsheet'} successfully!`);
      setPendingUpload(null);

    } catch (err: any) {
      showError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Determine verification status based on presence
  const isUgVerified = !!formData.ugUrl;
  const isSheetVerified = !!(formData.sheet_music_url || formData.pdfUrl || formData.leadsheetUrl);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Drag & Drop Zone Overlay */}
      <div 
        className={cn(
          "fixed inset-0 z-[100] bg-indigo-600/90 backdrop-blur-sm flex flex-col items-center justify-center transition-all duration-300",
          dragActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <UploadCloud className="w-24 h-24 text-white mb-6" />
        <h2 className="text-4xl font-black text-white uppercase tracking-tight">Drop PDF Here</h2>
        <p className="text-xl text-white/80 mt-2">Upload Full Score or Leadsheet</p>
      </div>

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

      {/* Upload Area */}
      <div 
        className={cn(
          "border-2 border-dashed rounded-3xl p-8 text-center transition-colors cursor-pointer group",
          dragActive ? "border-indigo-500 bg-indigo-500/10" : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('pdf-upload')?.click()}
      >
        <input type="file" id="pdf-upload" className="hidden" accept="application/pdf" onChange={handleFileSelect} />
        <div className="flex flex-col items-center gap-4">
          <div className="bg-slate-900 p-4 rounded-full border border-slate-700 group-hover:border-slate-500">
            <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-indigo-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-300">Drag & Drop PDF or Click to Upload</p>
            <p className="text-sm text-slate-500 mt-1">Upload Full Score or Leadsheet directly</p>
          </div>
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

      {/* Upload Confirmation Dialog */}
      <Dialog open={!!pendingUpload} onOpenChange={(open) => !open && setPendingUpload(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Designate PDF</DialogTitle>
            <DialogDescription className="text-slate-400">
              How should this PDF be classified?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-6">
            <Button 
              onClick={() => confirmUpload('pdf')}
              disabled={isUploading}
              className="h-24 flex flex-col items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 rounded-2xl"
            >
              {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Layout className="w-8 h-8" />}
              <span className="font-bold uppercase">Full Score</span>
            </Button>
            <Button 
              onClick={() => confirmUpload('leadsheet')}
              disabled={isUploading}
              className="h-24 flex flex-col items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 rounded-2xl"
            >
              {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileText className="w-8 h-8" />}
              <span className="font-bold uppercase">Leadsheet</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingUpload(null)} className="text-slate-400">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SongDetailsTab;
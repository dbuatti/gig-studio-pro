"use client";

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Upload, Loader2, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

interface PdfUploadZoneProps {
  label: string;
  type: 'pdf' | 'leadsheet';
  currentUrl?: string;
  onUploadComplete: (url: string) => void;
  onRemove: () => void;
}

const PdfUploadZone: React.FC<PdfUploadZoneProps> = ({
  label,
  type,
  currentUrl,
  onUploadComplete,
  onRemove
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showError("Only PDF files are supported.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `sheets/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('repertoire')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('repertoire')
        .getPublicUrl(filePath);

      onUploadComplete(publicUrl);
      showSuccess(`${label} uploaded successfully!`);
    } catch (error: any) {
      showError(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [label, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: isUploading
  });

  if (currentUrl) {
    return (
      <div className="relative group bg-slate-900/50 border-2 border-indigo-500/30 rounded-2xl p-4 flex items-center gap-4 transition-all hover:border-indigo-500/50">
        <div className="bg-indigo-600/20 p-3 rounded-xl text-indigo-400">
          <FileText className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</p>
          <p className="text-xs font-bold text-white truncate">File Registered</p>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-2 rounded-lg bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div 
      {...getRootProps()} 
      className={cn(
        "relative border-2 border-dashed rounded-2xl p-6 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-3",
        isDragActive ? "border-indigo-500 bg-indigo-500/5 scale-[0.98]" : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
        isUploading && "pointer-events-none opacity-80"
      )}
    >
      <input {...getInputProps()} />
      
      {isUploading ? (
        <div className="w-full space-y-4">
          <div className="flex items-center justify-center gap-3 text-indigo-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest">Uploading {label}...</span>
          </div>
          <Progress value={uploadProgress} className="h-1 bg-slate-800" />
        </div>
      ) : (
        <>
          <div className="bg-white/5 p-3 rounded-2xl text-slate-400 group-hover:text-indigo-400 transition-colors">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white mb-1">Upload {label}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Drag & drop or click to browse</p>
          </div>
        </>
      )}
    </div>
  );
};

export default PdfUploadZone;
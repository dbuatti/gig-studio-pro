"use client";

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Upload, Loader2, CheckCircle2, X, AlertCircle, FileType } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

interface PDFUploadZoneProps {
  onUploadComplete: (url: string, type: 'pdf' | 'leadsheet') => void;
  currentPdfUrl?: string;
  currentLeadsheetUrl?: string;
  onRemove: (type: 'pdf' | 'leadsheet') => void;
  songId?: string;
  songTitle?: string;
}

const PDFUploadZone: React.FC<PDFUploadZoneProps> = ({ 
  onUploadComplete, 
  currentPdfUrl, 
  currentLeadsheetUrl,
  onRemove,
  songId,
  songTitle
}) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'pdf' | 'leadsheet'>('pdf');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user || acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    if (file.type !== 'application/pdf') {
      showError("Only PDF files are supported.");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      
      // Sanitize title for filename
      const sanitizedTitle = (songTitle || 'document')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_');

      // Use the public_audio bucket as per reference
      // Path structure: {user_id}/{song_id}_{title}_{type}.pdf
      const fileName = `${songId || Date.now()}_${sanitizedTitle}_${uploadType}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('public_audio')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true // Allow overwriting if the user re-uploads
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public_audio')
        .getPublicUrl(filePath);

      onUploadComplete(publicUrl, uploadType);
      showSuccess(`${uploadType === 'pdf' ? 'Full Score' : 'Lead Sheet'} uploaded successfully.`);
    } catch (error: any) {
      console.error('Upload error:', error);
      showError(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  }, [user, uploadType, onUploadComplete, songId, songTitle]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: isUploading
  });

  return (
    <div className="space-y-6">
      {/* Type Selector */}
      <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 w-full sm:w-fit">
        <button
          onClick={() => setUploadType('pdf')}
          className={cn(
            "flex-1 sm:flex-none px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
            uploadType === 'pdf' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
          )}
        >
          Full Score
        </button>
        <button
          onClick={() => setUploadType('leadsheet')}
          className={cn(
            "flex-1 sm:flex-none px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
            uploadType === 'leadsheet' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
          )}
        >
          Lead Sheet
        </button>
      </div>

      {/* Dropzone */}
      <div 
        {...getRootProps()} 
        className={cn(
          "relative group cursor-pointer transition-all duration-300 rounded-[2rem] border-2 border-dashed p-10 flex flex-col items-center justify-center text-center gap-4",
          isDragActive ? "border-indigo-500 bg-indigo-500/5" : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30",
          isUploading && "opacity-50 cursor-wait"
        )}
      >
        <input {...getInputProps()} />
        
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500",
          isDragActive ? "bg-indigo-600 text-white scale-110 rotate-3" : "bg-white/5 text-slate-500 group-hover:text-indigo-400 group-hover:scale-105"
        )}>
          {isUploading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : isDragActive ? (
            <Upload className="w-8 h-8" />
          ) : (
            <FileType className="w-8 h-8" />
          )}
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-tight text-white">
            {isUploading ? "Uploading Asset..." : isDragActive ? "Drop to Upload" : `Upload ${uploadType === 'pdf' ? 'Full Score' : 'Lead Sheet'}`}
          </p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            Drag & drop PDF or click to browse
          </p>
        </div>

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm rounded-[2rem]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white">Processing PDF...</span>
            </div>
          </div>
        )}
      </div>

      {/* Current Files List */}
      {(currentPdfUrl || currentLeadsheetUrl) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentPdfUrl && (
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-600/20 p-2 rounded-lg">
                  <FileText className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Full Score</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">PDF Document Linked</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onRemove('pdf')}
                className="h-8 w-8 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          {currentLeadsheetUrl && (
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600/20 p-2 rounded-lg">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Lead Sheet</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">PDF Document Linked</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onRemove('leadsheet')}
                className="h-8 w-8 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PDFUploadZone;
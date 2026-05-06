"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Database, Trash2, Loader2, AlertTriangle, CheckCircle2, 
  FileText, Music, HardDrive, RefreshCw, ShieldAlert, X, ExternalLink
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: any;
  path: string;
}

interface StorageAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  repertoire: any[];
}

const StorageAuditModal: React.FC<StorageAuditModalProps> = ({ isOpen, onClose, repertoire }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [storageFiles, setStorageFiles] = useState<StorageFile[]>([]);
  
  const fetchStorageFiles = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // List files in the user's folder
      const { data, error } = await supabase.storage.from('public_audio').list(user.id, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'desc' },
      });

      if (error) throw error;

      // For each folder (song_id), list its contents
      const allFiles: StorageFile[] = [];
      for (const folder of data || []) {
        if (folder.id === null) { // It's a folder
          const { data: files, error: fileError } = await supabase.storage
            .from('public_audio')
            .list(`${user.id}/${folder.name}`);
          
          if (!fileError && files) {
            files.forEach(f => {
              allFiles.push({
                ...f,
                path: `${user.id}/${folder.name}/${f.name}`
              } as StorageFile);
            });
          }
        } else {
          allFiles.push({
            ...folder,
            path: `${user.id}/${folder.name}`
          } as StorageFile);
        }
      }
      setStorageFiles(allFiles);
    } catch (err: any) {
      showError(`Failed to scan storage: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStorageFiles();
    }
  }, [isOpen]);

  const auditResults = useMemo(() => {
    const dbUrls = new Set();
    repertoire.forEach(song => {
      if (song.audio_url) dbUrls.add(song.audio_url);
      if (song.pdfUrl) dbUrls.add(song.pdfUrl);
      if (song.leadsheetUrl) dbUrls.add(song.leadsheetUrl);
      if (song.sheet_music_url) dbUrls.add(song.sheet_music_url);
    });

    return storageFiles.map(file => {
      const publicUrl = supabase.storage.from('public_audio').getPublicUrl(file.path).data.publicUrl;
      const isOrphaned = !dbUrls.has(publicUrl);
      return { ...file, publicUrl, isOrphaned };
    });
  }, [storageFiles, repertoire]);

  const orphanedFiles = auditResults.filter(f => f.isOrphaned);

  const handleDeleteFile = async (path: string) => {
    try {
      const { error } = await supabase.storage.from('public_audio').remove([path]);
      if (error) throw error;
      setStorageFiles(prev => prev.filter(f => f.path !== path));
      showSuccess("File purged from storage.");
    } catch (err: any) {
      showError(`Purge failed: ${err.message}`);
    }
  };

  const handlePurgeAllOrphans = async () => {
    if (!confirm(`Are you sure you want to delete ${orphanedFiles.length} orphaned files?`)) return;
    
    setIsPurging(true);
    try {
      const paths = orphanedFiles.map(f => f.path);
      const { error } = await supabase.storage.from('public_audio').remove(paths);
      if (error) throw error;
      
      setStorageFiles(prev => prev.filter(f => !paths.includes(f.path)));
      showSuccess(`Successfully purged ${paths.length} files.`);
    } catch (err: any) {
      showError(`Bulk purge failed: ${err.message}`);
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] bg-slate-950 border-white/10 text-white rounded-[2.5rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-indigo-600 shrink-0 relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/70">
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4 mb-2">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <HardDrive className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Storage Optimization Matrix</DialogTitle>
              <DialogDescription className="text-indigo-100 font-bold uppercase tracking-widest text-[10px] mt-1">
                Identify and purge orphaned assets to reclaim quota
              </DialogDescription>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between bg-black/20 p-4 rounded-2xl border border-white/10">
            <div className="flex gap-8">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-indigo-200">Total Files</span>
                <span className="text-xl font-black font-mono">{storageFiles.length}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-red-300">Orphaned Assets</span>
                <span className="text-xl font-black font-mono text-red-400">{orphanedFiles.length}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="ghost" 
                onClick={fetchStorageFiles} 
                disabled={isLoading}
                className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl gap-2 text-[10px] font-black uppercase"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} /> Rescan
              </Button>
              <Button 
                onClick={handlePurgeAllOrphans} 
                disabled={isPurging || orphanedFiles.length === 0}
                className="h-10 px-6 bg-red-500 hover:bg-red-600 text-white rounded-xl gap-2 text-[10px] font-black uppercase shadow-lg shadow-red-900/20"
              >
                {isPurging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Purge All Orphans
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden bg-slate-900/50">
          <ScrollArea className="h-full">
            <div className="p-8 space-y-3">
              {isLoading ? (
                <div className="py-20 flex flex-col items-center gap-4 opacity-40">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Scanning Cloud Infrastructure...</p>
                </div>
              ) : auditResults.length === 0 ? (
                <div className="py-20 text-center opacity-30">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest">Storage is Clean</p>
                </div>
              ) : (
                auditResults.map((file, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "p-4 rounded-2xl border flex items-center justify-between group transition-all",
                      file.isOrphaned ? "bg-red-500/5 border-red-500/20 hover:bg-red-500/10" : "bg-white/5 border-white/5 hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        "p-2.5 rounded-xl shrink-0",
                        file.name.endsWith('.mp3') ? "bg-indigo-600/20 text-indigo-400" : "bg-emerald-600/20 text-emerald-400"
                      )}>
                        {file.name.endsWith('.mp3') ? <Music className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-tight truncate">{file.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[9px] font-mono text-slate-500">{(file.metadata?.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span className="text-slate-800 text-[8px]">•</span>
                          <span className="text-[9px] font-mono text-slate-500">{new Date(file.created_at).toLocaleDateString()}</span>
                          {file.isOrphaned && (
                            <Badge variant="outline" className="bg-red-500/10 border-red-500/20 text-red-400 text-[8px] font-black uppercase px-1.5 py-0">Orphaned</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => window.open(file.publicUrl, '_blank')}
                        className="h-9 w-9 rounded-xl bg-white/5 text-slate-400 hover:text-white"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteFile(file.path)}
                        className="h-9 w-9 rounded-xl bg-white/5 text-slate-500 hover:text-red-400 hover:bg-red-400/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="p-6 border-t border-white/5 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Purging files is permanent and cannot be undone</span>
          </div>
          <p className="text-[9px] font-mono text-slate-700 uppercase">Storage Engine v2.1 // Quota Impact: High</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StorageAuditModal;
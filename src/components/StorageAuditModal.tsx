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
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { r2Storage } from '@/utils/r2Storage';

interface StorageFile {
  Key: string;
  LastModified: string;
  Size: number;
  path: string;
}

interface StorageAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  repertoire: Record<string, unknown>[];
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
      const files = await r2Storage.list(`${user.id}/`);
      setStorageFiles(files.map(f => ({ ...f, path: f.Key })));
    } catch (err: unknown) {
      showError(`Failed to scan R2 storage: ${err instanceof Error ? err.message : String(err)}`);
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
      if (song.audio_url) dbUrls.add(song.audio_url.split('?')[0]);
      if (song.pdfUrl) dbUrls.add(song.pdfUrl.split('?')[0]);
      if (song.leadsheetUrl) dbUrls.add(song.leadsheetUrl.split('?')[0]);
      if (song.sheet_music_url) dbUrls.add(song.sheet_music_url.split('?')[0]);
    });

    return storageFiles.map(file => {
      const isOrphaned = !Array.from(dbUrls).some((url: unknown) => typeof url === 'string' && url.endsWith(file.path));
      return { ...file, isOrphaned };
    });
  }, [storageFiles, repertoire]);

  const orphanedFiles = auditResults.filter(f => f.isOrphaned);

  const handleDeleteFile = async (path: string) => {
    try {
      await r2Storage.delete(path);
      setStorageFiles(prev => prev.filter(f => f.path !== path));
      showSuccess("File purged from R2 storage.");
    } catch (err: unknown) {
      showError(`Purge failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePurgeAllOrphans = async () => {
    if (!confirm(`Are you sure you want to delete ${orphanedFiles.length} orphaned files from R2?`)) return;
    
    setIsPurging(true);
    try {
      for (const file of orphanedFiles) {
        await r2Storage.delete(file.path);
      }
      setStorageFiles(prev => prev.filter(f => !orphanedFiles.some(of => of.path === f.path)));
      showSuccess(`Successfully purged ${orphanedFiles.length} files from R2.`);
    } catch (err: unknown) {
      showError(`Bulk purge failed: ${err instanceof Error ? err.message : String(err)}`);
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
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">R2 Storage Optimization</DialogTitle>
              <DialogDescription className="text-indigo-100 font-bold uppercase tracking-widest text-[10px] mt-1">
                Identify and purge orphaned R2 assets to reclaim quota
              </DialogDescription>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between bg-black/20 p-4 rounded-2xl border border-white/10">
            <div className="flex gap-8">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-indigo-200">Total R2 Files</span>
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
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} /> Rescan R2
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
                  <p className="text-[10px] font-black uppercase tracking-widest">Scanning Cloudflare Infrastructure...</p>
                </div>
              ) : auditResults.length === 0 ? (
                <div className="py-20 text-center opacity-30">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest">R2 Storage is Clean</p>
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
                        file.path.endsWith('.mp3') ? "bg-indigo-600/20 text-indigo-400" : "bg-emerald-600/20 text-emerald-400"
                      )}>
                        {file.path.endsWith('.mp3') ? <Music className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-tight truncate">{file.path.split('/').pop()}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[9px] font-mono text-slate-500">{(file.Size / 1024 / 1024).toFixed(2)} MB</span>
                          <span className="text-slate-800 text-[8px]">•</span>
                          <span className="text-[9px] font-mono text-slate-500">{new Date(file.LastModified).toLocaleDateString()}</span>
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
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Purging R2 files is permanent</span>
          </div>
          <p className="text-[9px] font-mono text-slate-700 uppercase">R2 Storage Engine v1.0</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StorageAuditModal;
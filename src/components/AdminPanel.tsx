"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldAlert, 
  Activity,
  Wifi,
  WifiOff,
  Loader2,
  Upload,
  Download,
  Terminal,
  Copy,
  Check,
  Lock,
  History,
  AlertCircle,
  X,
  Cloud,
  Trash2,
  FileText,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from "@/lib/utils";
import { useAuth } from './AuthProvider';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isCreatingBucket, setIsCreatingBucket] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'online' | 'offline' | 'error' | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [cookieSize, setCookieSize] = useState<number | null>(null);

  const API_BASE = "https://yt-audio-api-docker.onrender.com";

  useEffect(() => {
    const saved = localStorage.getItem('gig_admin_last_sync');
    if (saved) setLastSync(saved);
    // Don't auto-check size on mount to avoid 400 errors if bucket doesn't exist
  }, [isOpen]);

  // Manual check function
  const checkBucketStatus = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('cookies')
        .list('', { search: 'cookies.txt' });
      
      if (!error && data && data.length > 0) {
        setCookieSize(data[0].metadata?.size || null);
        showSuccess("Bucket found and cookies exist.");
      } else if (error && error.message.includes("not found")) {
        setCookieSize(null);
        showError("Bucket 'cookies' does not exist yet.");
      } else {
        setCookieSize(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createBucket = async () => {
    setIsCreatingBucket(true);
    try {
      const { error } = await supabase.storage.createBucket('cookies', {
        public: false,
        allowedMimeTypes: ['text/plain'],
        fileSizeLimit: 1024 * 1024 // 1MB
      });
      
      if (error) {
        // If it already exists, that's fine
        if (error.message.includes("already exists")) {
          showSuccess("Bucket already exists.");
        } else {
          throw error;
        }
      } else {
        showSuccess("Bucket 'cookies' created successfully.");
      }
    } catch (err: any) {
      showError(`Failed to create bucket: ${err.message}`);
    } finally {
      setIsCreatingBucket(false);
    }
  };

  const checkHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch(`${API_BASE}/health`, { mode: 'cors' });
      if (res.ok) {
        const data = await res.json();
        setHealthStatus('online');
        if (data.cookie_age_minutes !== null) {
          setLastSync(new Date().toLocaleString());
        }
      } else {
        setHealthStatus('offline');
      }
    } catch (e) {
      setHealthStatus('error');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const triggerRenderRefresh = async () => {
    setIsCheckingHealth(true);
    try {
      const refreshRes = await fetch(`${API_BASE}/refresh-cookies`, {
        method: 'POST'
      });
      if (!refreshRes.ok) throw new Error('API refresh failed');
      showSuccess("Render API triggered to fetch cookies from Supabase");
      setLastSync(new Date().toLocaleString());
      localStorage.setItem('gig_admin_last_sync', new Date().toLocaleString());
    } catch (err: any) {
      showError(`Failed to trigger refresh: ${err.message}`);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!user) {
      showError("You must be logged in to upload cookies.");
      return;
    }

    const isTxt = file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain';
    if (!isTxt) {
      showError("Please upload a valid .txt file.");
      return;
    }

    setIsUploading(true);
    try {
      // Ensure bucket exists first
      const { error: createError } = await supabase.storage.createBucket('cookies', {
        public: false,
        allowedMimeTypes: ['text/plain'],
        fileSizeLimit: 1024 * 1024
      });

      if (createError && !createError.message.includes("already exists")) {
        throw createError;
      }

      // Upload as cookies.txt
      const { error } = await supabase.storage
        .from('cookies')
        .upload('cookies.txt', file, {
          upsert: true,
          contentType: 'text/plain'
        });

      if (error) throw error;

      // Trigger Render refresh
      await triggerRenderRefresh();
      
      setCookieSize(file.size);
      showSuccess(`"${file.name}" processed and synced.`);
    } catch (err: any) {
      showError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const downloadCookies = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('cookies')
        .download('cookies.txt');
      
      if (error) throw error;
      
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cookies.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showSuccess("Cookies downloaded");
    } catch (err) {
      showError("No cookies found in storage");
    }
  };

  const deleteCookies = async () => {
    try {
      const { error } = await supabase.storage
        .from('cookies')
        .remove(['cookies.txt']);
      
      if (error) throw error;
      
      setCookieSize(null);
      showSuccess("Cookies deleted from storage");
    } catch (err) {
      showError("Failed to delete cookies");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[98vw] max-h-[95vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden shadow-2xl flex flex-col">
        <div className="bg-red-600 p-6 md:p-8 flex items-center justify-between shrink-0 relative">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md">
              <ShieldAlert className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight">System Core Admin</DialogTitle>
              <DialogDescription className="text-red-100 font-medium text-xs md:text-sm">Production Environment Master Controls</DialogDescription>
            </div>
          </div>
          <Lock className="w-8 h-8 opacity-20 hidden sm:block" />
          <Button variant="ghost" size="icon" onClick={onClose} className="sm:hidden text-white/50 hover:text-white rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6 md:p-8 space-y-6 md:space-y-8">
              <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-[2rem] p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="bg-indigo-600 p-2.5 rounded-xl text-white">
                      <Cloud className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg md:text-xl font-black uppercase tracking-tight">Supabase Storage</h4>
                      <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-0.5">Instant Cookie Updates</p>
                    </div>
                  </div>
                  <Badge className="bg-indigo-600 text-white font-mono text-[10px] shrink-0">v2.2 STABLE</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div 
                      className={cn(
                        "bg-white/5 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[180px] transition-all duration-300",
                        isDragOver ? "border-indigo-500 bg-indigo-600/10 scale-[0.98]" : "border-white/10 hover:border-white/20"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleFileDrop}
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-3xl flex items-center justify-center mb-4 transition-all",
                        isDragOver ? "bg-indigo-600 scale-110" : "bg-slate-900"
                      )}>
                        {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : isDragOver ? <Download className="w-8 h-8" /> : <FileText className="w-8 h-8 text-indigo-400" />}
                      </div>
                      <h5 className="text-sm font-black uppercase tracking-tight mb-2">Smart Cookie Ingest</h5>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-4">Drop any .txt file here</p>
                      <input 
                        type="file" 
                        accept=".txt" 
                        onChange={handleFileSelect}
                        className="hidden"
                        id="cookie-upload"
                      />
                      <Button 
                        variant="outline" 
                        className="bg-white/5 border-white/10 hover:bg-white/10 text-white font-black uppercase text-[10px] h-10 px-6 rounded-xl"
                        onClick={() => document.getElementById('cookie-upload')?.click()}
                      >
                        Select File
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Storage Status</span>
                        {cookieSize !== null ? (
                          <Badge className="bg-emerald-600 text-white font-mono text-[9px]">ACTIVE</Badge>
                        ) : (
                          <Badge className="bg-slate-700 text-slate-400 font-mono text-[9px]">CHECK</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                        <span className="text-xs font-bold text-slate-400">Target File</span>
                        <span className="text-sm font-mono font-black text-indigo-400">cookies.txt</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                        <span className="text-xs font-bold text-slate-400">Last Sync</span>
                        <span className="text-[10px] font-mono font-black text-indigo-400">{lastSync || 'Never'}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-white font-black uppercase text-[9px] h-10 rounded-xl"
                          onClick={checkBucketStatus}
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Check
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 bg-indigo-600/10 border-indigo-600/20 hover:bg-indigo-600/20 text-indigo-400 font-black uppercase text-[9px] h-10 rounded-xl"
                          onClick={createBucket}
                          disabled={isCreatingBucket}
                        >
                          {isCreatingBucket ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5 mr-2" />} 
                          Init Bucket
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] md:text-xs font-black uppercase text-amber-500">How to Export Cookies</p>
                    <p className="text-[10px] md:text-[11px] text-slate-400 leading-relaxed">
                      1. Install a browser extension like "Get cookies.txt LOCALLY"<br />
                      2. Log into YouTube in your browser<br />
                      3. Export cookies as a text file (engine will auto-rename to cookies.txt)<br />
                      4. Upload the file here for instant system-wide application.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                 <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between min-h-[100px]">
                    <div className="flex items-center gap-2 text-slate-500 mb-4">
                      <History className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Last Update</span>
                    </div>
                    <span className="text-xs font-mono text-indigo-400 font-bold">{lastSync || "NEVER"}</span>
                 </div>
                 <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between min-h-[100px]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Activity className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">API Status</span>
                      </div>
                      <button 
                        onClick={checkHealth} 
                        disabled={isCheckingHealth}
                        className="text-[9px] font-black text-indigo-400 hover:text-white uppercase disabled:opacity-50"
                      >
                        {isCheckingHealth ? "..." : "Check"}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {healthStatus === 'online' ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                      <span className={cn("text-xs font-black uppercase", healthStatus === 'online' ? "text-emerald-500" : "text-red-500")}>
                        {healthStatus === 'online' ? "Live" : healthStatus === 'error' ? "Error" : "Offline"}
                      </span>
                    </div>
                 </div>
                 <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between min-h-[100px]">
                    <div className="flex items-center gap-2 text-slate-500 mb-4">
                      <Cloud className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Storage Type</span>
                    </div>
                    <span className="text-xs font-mono text-indigo-400 font-bold">Supabase Bucket</span>
                 </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="p-6 md:p-8 bg-slate-900 border-t border-white/5 shrink-0 flex gap-4">
          <Button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] h-12 rounded-xl border border-white/10">Close System Core</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
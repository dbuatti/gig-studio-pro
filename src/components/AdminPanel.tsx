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
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Server
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
  const [healthData, setHealthData] = useState<any>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [cookieSize, setCookieSize] = useState<number | null>(null);
  const [bucketExists, setBucketExists] = useState<boolean>(false);

  const API_BASE = "https://yt-audio-api-docker.onrender.com";

  useEffect(() => {
    const saved = localStorage.getItem('gig_admin_last_sync');
    if (saved) setLastSync(saved);
    if (isOpen) {
      checkBucketStatus();
      checkHealth();
    }
  }, [isOpen]);

  const checkBucketStatus = async () => {
    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      
      const foundBucket = data?.find(b => b.name === 'cookies');
      setBucketExists(!!foundBucket);

      if (foundBucket) {
        const { data: files, error: fileError } = await supabase.storage
          .from('cookies')
          .list('', { search: 'cookies.txt' });
        
        if (!fileError && files && files.length > 0) {
          setCookieSize(files[0].metadata?.size || null);
        } else {
          setCookieSize(null);
        }
      } else {
        setCookieSize(null);
      }
    } catch (e) {
      console.error("Error checking bucket status:", e);
      setBucketExists(false);
      setCookieSize(null);
    }
  };

  const createBucket = async () => {
    setIsCreatingBucket(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-storage-bucket', {
        body: {
          bucketName: 'cookies',
          isPublic: false,
          allowedMimeTypes: ['text/plain'],
          fileSizeLimit: 1024 * 1024
        }
      });

      if (error) throw error;
      
      if (data?.success) {
        showSuccess("Bucket 'cookies' verified/created.");
        setBucketExists(true);
        checkBucketStatus();
      }
    } catch (err: any) {
      showError(`Bucket error: ${err.message}`);
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
        setHealthData(data);
        setHealthStatus('online');
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
      showSuccess("Backend successfully pulled fresh cookies from Supabase");
      setLastSync(new Date().toLocaleString());
      localStorage.setItem('gig_admin_last_sync', new Date().toLocaleString());
      checkHealth();
    } catch (err: any) {
      showError(`Backend Sync Failed: ${err.message}`);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!user) {
      showError("Auth required.");
      return;
    }

    setIsUploading(true);
    try {
      if (!bucketExists) await createBucket();

      const { error } = await supabase.storage
        .from('cookies')
        .upload('cookies.txt', file, {
          upsert: true,
          contentType: 'text/plain'
        });

      if (error) throw error;

      await triggerRenderRefresh();
      setCookieSize(file.size);
      showSuccess("New cookies live in production");
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden shadow-2xl flex flex-col">
        <div className="bg-red-600 p-8 flex items-center justify-between shrink-0 relative">
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">System Core Admin</DialogTitle>
              <DialogDescription className="text-red-100 font-medium">Production Extraction Engine & Session Management</DialogDescription>
            </div>
          </div>
          <Lock className="w-10 h-10 opacity-20 hidden md:block" />
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-8 space-y-8">
              {/* Status HUD */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[120px]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Server className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">API Engine</span>
                      </div>
                      <button onClick={checkHealth} className="text-[9px] font-black text-indigo-400 uppercase">Refresh</button>
                    </div>
                    <div className="flex items-center gap-3">
                      {healthStatus === 'online' ? <Wifi className="w-5 h-5 text-emerald-500" /> : <WifiOff className="w-5 h-5 text-red-500" />}
                      <span className={cn("text-lg font-black uppercase", healthStatus === 'online' ? "text-emerald-500" : "text-red-500")}>
                        {healthStatus === 'online' ? "Online" : "Offline"}
                      </span>
                    </div>
                 </div>

                 <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[120px]">
                    <div className="flex items-center gap-2 text-slate-500 mb-4">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Backend Cookie State</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={cn("text-lg font-black uppercase", healthData?.cookies_present ? "text-emerald-500" : "text-red-500")}>
                        {healthData?.cookies_present ? "Loaded" : "Missing"}
                      </span>
                      {healthData?.cookie_age_minutes && (
                        <span className="text-[10px] font-mono text-slate-500">({Math.round(healthData.cookie_age_minutes)}m old)</span>
                      )}
                    </div>
                 </div>

                 <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[120px]">
                    <div className="flex items-center gap-2 text-slate-500 mb-4">
                      <Cloud className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Storage Vault</span>
                    </div>
                    <span className="text-lg font-black uppercase text-indigo-400">
                      {cookieSize ? `${(cookieSize / 1024).toFixed(1)} KB` : "Empty"}
                    </span>
                 </div>
              </div>

              {/* Upload Matrix */}
              <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-[2.5rem] p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-2.5 rounded-xl">
                      <RefreshCw className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black uppercase tracking-tight">Session Overwrite</h4>
                      <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Update cookies.txt to bypass YouTube Bot Detection</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={triggerRenderRefresh} className="bg-white/5 border-white/10 text-white font-black uppercase text-[10px] h-10 px-6 rounded-xl gap-2">
                    <Activity className="w-4 h-4" /> Force Sync Backend
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div 
                    className={cn(
                      "bg-white/5 border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center min-h-[250px] transition-all",
                      isDragOver ? "border-indigo-500 bg-indigo-600/20 scale-[0.98]" : "border-white/10 hover:border-white/20"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleFileDrop}
                  >
                    {isUploading ? (
                      <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                    ) : (
                      <>
                        <FileText className="w-12 h-12 text-indigo-400 mb-6" />
                        <h5 className="text-lg font-black uppercase tracking-tight mb-2">Drop cookies.txt here</h5>
                        <p className="text-xs text-slate-500 font-medium mb-8">The engine will instantly propagate this to the production API.</p>
                        <input type="file" accept=".txt" onChange={handleFileSelect} className="hidden" id="cookie-upload" />
                        <Button onClick={() => document.getElementById('cookie-upload')?.click()} className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 rounded-xl font-black uppercase tracking-widest text-[10px]">Select File</Button>
                      </>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 space-y-4">
                       <div className="flex items-center gap-3">
                         <AlertCircle className="w-5 h-5 text-amber-500" />
                         <span className="text-sm font-black uppercase text-amber-500">Critical Guide: Avoiding "Bot" Errors</span>
                       </div>
                       <ul className="space-y-3 text-[11px] text-slate-400 font-medium leading-relaxed">
                         <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" /> Use the "Get cookies.txt LOCALLY" extension.</li>
                         <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" /> <strong>Crucial:</strong> Log out and log back into YouTube in an <strong>Incognito</strong> window before exporting.</li>
                         <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" /> Do not close the YouTube tab while exporting.</li>
                         <li className="flex gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" /> Export in Netscape format (standard for this extension).</li>
                       </ul>
                    </div>
                    
                    <div className="flex gap-4">
                       <Button variant="ghost" onClick={checkBucketStatus} className="flex-1 h-12 bg-white/5 border border-white/10 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10">
                         Verify Storage
                       </Button>
                       <a href="https://chrome.google.com/webstore/detail/get-cookiestxt-locally/ccmclokmbiocgnoebmjjhkmoonlaoced" target="_blank" className="flex-1">
                         <Button variant="ghost" className="w-full h-12 bg-indigo-600/10 border border-indigo-600/20 rounded-xl font-black uppercase text-[10px] tracking-widest text-indigo-400 hover:bg-indigo-600/20 gap-2">
                           Get Extension <ExternalLink className="w-3.5 h-3.5" />
                         </Button>
                       </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="p-8 border-t border-white/5 bg-slate-900 flex items-center justify-between">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 font-mono">Control Unit v2.5.4 // Production Stack</p>
           <Button onClick={onClose} variant="ghost" className="text-slate-400 hover:text-white font-black uppercase tracking-widest text-[10px]">Close Admin</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
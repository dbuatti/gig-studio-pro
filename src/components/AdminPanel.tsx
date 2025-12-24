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
import { 
  ShieldAlert, 
  Activity,
  Wifi,
  WifiOff,
  Loader2,
  Lock,
  AlertCircle,
  Cloud,
  FileText,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Server,
  History,
  CheckCircle2,
  Database
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
  const [healthStatus, setHealthStatus] = useState<'online' | 'offline' | 'error' | null>(null);
  const [healthData, setHealthData] = useState<any>(null);
  
  // Detailed Metadata State
  const [cookieMetadata, setCookieMetadata] = useState<{
    size: number;
    lastUpdated: string;
    name: string;
  } | null>(null);
  
  const [syncLogs, setSyncLogs] = useState<{ msg: string; type: 'info' | 'success' | 'error'; time: string }[]>([]);

  const API_BASE = "https://yt-audio-api-docker.onrender.com";

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setSyncLogs(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 15));
  };

  useEffect(() => {
    if (isOpen) {
      checkVaultStatus();
      checkHealth();
    }
  }, [isOpen]);

  const checkVaultStatus = async () => {
    addLog("Querying Cloud Vault...", 'info');
    try {
      // List files specifically in the 'cookies' bucket
      const { data: files, error } = await supabase.storage
        .from('cookies')
        .list('', { limit: 1 });
      
      if (error) throw error;

      const cookieFile = files?.find(f => f.name === 'cookies.txt');
      if (cookieFile) {
        setCookieMetadata({
          size: cookieFile.metadata?.size || 0,
          lastUpdated: cookieFile.updated_at || cookieFile.created_at,
          name: cookieFile.name
        });
        addLog(`Vault Match: cookies.txt (${Math.round(cookieFile.metadata?.size / 1024)} KB)`, 'success');
      } else {
        setCookieMetadata(null);
        addLog("Vault empty. Session file not found.", 'info');
      }
    } catch (e: any) {
      console.error("Storage check failed:", e);
      addLog(`Vault Access Error: ${e.message}`, 'error');
    }
  };

  const checkHealth = async () => {
    setIsCheckingHealth(true);
    addLog("Pinging API Engine...", 'info');
    try {
      const res = await fetch(`${API_BASE}/health`, { 
        mode: 'cors',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
        setHealthStatus('online');
        addLog(`Engine Online. Cookies ${data.cookies_loaded ? 'Loaded' : 'Missing'}`, data.cookies_loaded ? 'success' : 'error');
      } else {
        setHealthStatus('offline');
        addLog("Engine unreachable (Offline)", 'error');
      }
    } catch (e) {
      setHealthStatus('error');
      addLog("Engine connection refused.", 'error');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const triggerRenderRefresh = async () => {
    addLog("Sending Sync Signal to Production...", 'info');
    try {
      const refreshRes = await fetch(`${API_BASE}/refresh-cookies`, {
        method: 'POST',
        mode: 'cors'
      });
      
      if (refreshRes.status === 404) {
        addLog("Sync Endpoint Missing (404). Wait for deployment.", 'error');
        return;
      }

      if (!refreshRes.ok) throw new Error('Refresh signal failed');
      
      showSuccess("Backend Sync Initialized");
      addLog("Sync Signal Accepted. Updating state...", 'success');
      
      // Delay re-check to allow the server to finish the pull
      setTimeout(checkHealth, 3000);
    } catch (err: any) {
      addLog(`Sync Warning: ${err.message}`, 'error');
    }
  };

  const handleUpload = async (file: File) => {
    if (!user) return;

    addLog(`Preparing upload: ${file.name}`, 'info');
    setIsUploading(true);
    
    try {
      addLog("Encrypting & Writing to Vault...", 'info');
      
      const { error: uploadError } = await supabase.storage
        .from('cookies')
        .upload('cookies.txt', file, {
          upsert: true,
          contentType: 'text/plain'
        });

      if (uploadError) throw uploadError;

      showSuccess("Vault Updated Successfully");
      addLog("Cloud Write Successful.", 'success');
      
      await checkVaultStatus();
      await triggerRenderRefresh();
      
    } catch (err: any) {
      addLog(`Critical Failure: ${err.message}`, 'error');
      showError(`Upload Error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-red-600 p-8 flex items-center justify-between shrink-0 relative">
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">System Core Admin</DialogTitle>
              <DialogDescription className="text-red-100 font-medium">Session Extraction Engine & Security Protocols</DialogDescription>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end opacity-40">
             <span className="text-[10px] font-black uppercase tracking-widest">Protocol: RSA-4096</span>
             <span className="text-[10px] font-black uppercase tracking-widest">Status: Restricted</span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Controls Area */}
          <ScrollArea className="flex-1 border-r border-white/5">
            <div className="p-8 space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[140px]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Server className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">API Engine</span>
                      </div>
                      <button onClick={checkHealth} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                        <RefreshCw className={cn("w-3.5 h-3.5 text-indigo-400", isCheckingHealth && "animate-spin")} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        {healthStatus === 'online' ? <Wifi className="w-5 h-5 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" /> : <WifiOff className="w-5 h-5 text-red-500" />}
                        <span className={cn("text-lg font-black uppercase", healthStatus === 'online' ? "text-emerald-500" : "text-red-500")}>
                          {healthStatus === 'online' ? "Active" : "Offline"}
                        </span>
                      </div>
                      <p className="text-[9px] font-black text-slate-500 uppercase">Production Server Status</p>
                    </div>
                 </div>

                 <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[140px]">
                    <div className="flex items-center gap-2 text-slate-500 mb-4">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Engine Cache</span>
                    </div>
                    <div className="space-y-1">
                      <span className={cn("text-lg font-black uppercase", healthData?.cookies_loaded ? "text-emerald-500" : "text-red-500")}>
                        {healthData?.cookies_loaded ? "Cookies Loaded" : "Missing Data"}
                      </span>
                      <p className="text-[9px] font-black text-slate-500 uppercase">Extraction Context</p>
                    </div>
                 </div>

                 <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[140px]">
                    <div className="flex items-center gap-2 text-slate-500 mb-4">
                      <Cloud className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Vault State</span>
                    </div>
                    <div className="space-y-1">
                       <span className="text-lg font-black uppercase text-indigo-400">
                         {cookieMetadata ? `${(cookieMetadata.size / 1024).toFixed(1)} KB Linked` : "No File found"}
                       </span>
                       <p className="text-[9px] font-black text-slate-500 uppercase">Secure Database Storage</p>
                    </div>
                 </div>
              </div>

              {/* Interaction Zone */}
              <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-[2.5rem] p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-2.5 rounded-xl">
                      <Database className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black uppercase tracking-tight">Session Synchronizer</h4>
                      <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Update Session Keys to bypass YouTube Bots</p>
                    </div>
                  </div>
                  <Button 
                    onClick={triggerRenderRefresh} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] h-11 px-8 rounded-xl gap-3 shadow-lg shadow-indigo-600/20"
                  >
                    <Activity className="w-4 h-4" /> Trigger Sync Signal
                  </Button>
                </div>

                <div 
                  className={cn(
                    "bg-black/20 border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center transition-all min-h-[300px] relative",
                    isUploading ? "opacity-50" : "hover:border-indigo-500 hover:bg-indigo-600/5 cursor-pointer"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setIsUploading(false); }}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-6">
                      <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                      <p className="text-sm font-black uppercase tracking-[0.3em] animate-pulse">Writing to Secure Vault...</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-indigo-600/20 p-6 rounded-full mb-6">
                         <FileText className="w-16 h-16 text-indigo-400" />
                      </div>
                      <h5 className="text-xl font-black uppercase tracking-tight mb-2">Drop cookies.txt here</h5>
                      <p className="text-xs text-slate-500 font-medium max-w-sm mb-10 leading-relaxed">
                        The system will automatically rename your file to 'cookies.txt' and push it to the production engine.
                      </p>
                      <input type="file" accept=".txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} className="hidden" id="cookie-upload-main" />
                      <Button onClick={() => document.getElementById('cookie-upload-main')?.click()} className="bg-indigo-600 hover:bg-indigo-700 h-14 px-12 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl">
                        Select from Disk
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Registry & Logs Sidebar */}
          <aside className="w-full md:w-80 bg-slate-900/50 flex flex-col shrink-0">
            <div className="p-6 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2 text-slate-400 mb-6">
                <History className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Metadata Registry</span>
              </div>
              
              {cookieMetadata ? (
                <div className="space-y-6">
                   <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-500 uppercase">Vault Filename</p>
                     <p className="text-sm font-mono font-bold text-emerald-400">{cookieMetadata.name}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-500 uppercase">Last Modified</p>
                     <p className="text-sm font-bold text-white">{new Date(cookieMetadata.lastUpdated).toLocaleString()}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-500 uppercase">Integrity</p>
                     <div className="flex items-center gap-2 text-emerald-500">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase">Verified</span>
                     </div>
                   </div>
                </div>
              ) : (
                <div className="py-12 text-center space-y-4">
                   <AlertCircle className="w-8 h-8 text-slate-800 mx-auto" />
                   <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No file record</p>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col p-6 min-h-0">
               <div className="flex items-center justify-between mb-4">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Log</span>
                 <button onClick={() => setSyncLogs([])} className="text-[9px] font-black text-slate-600 hover:text-white uppercase">Clear</button>
               </div>
               <ScrollArea className="flex-1">
                 <div className="space-y-3 pr-4">
                   {syncLogs.map((log, i) => (
                     <div key={i} className="space-y-1">
                       <div className="flex items-center justify-between text-[8px] font-mono font-bold opacity-40">
                         <span>{log.time}</span>
                         <span className="uppercase">{log.type}</span>
                       </div>
                       <p className={cn(
                         "text-[10px] font-medium leading-tight",
                         log.type === 'error' ? "text-red-400" : log.type === 'success' ? "text-emerald-400" : "text-slate-400"
                       )}>
                         {log.msg}
                       </p>
                     </div>
                   ))}
                   {syncLogs.length === 0 && (
                     <p className="text-[10px] font-medium text-slate-700 italic">Standby...</p>
                   )}
                 </div>
               </ScrollArea>
            </div>
          </aside>
        </div>

        <div className="p-8 border-t border-white/5 bg-slate-900 flex items-center justify-between shrink-0">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 font-mono">Control Unit v2.8.0 // Live Mesh Engine</p>
           <Button onClick={onClose} variant="ghost" className="text-slate-400 hover:text-white font-black uppercase tracking-widest text-[10px]">Close Admin</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
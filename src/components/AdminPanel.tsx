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
import { Textarea } from "@/components/ui/textarea";
import { 
  ShieldAlert, 
  Github, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  ExternalLink,
  Clock,
  History,
  Activity,
  Code2,
  Zap,
  Wifi,
  WifiOff,
  Bug,
  Loader2,
  Wrench,
  Filter,
  Trash2,
  FileWarning,
  Upload,
  FileText,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { ScrollArea } from './ui/scroll-area';
import { cn } from "@/lib/utils";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const [cookieText, setCookieText] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'online' | 'offline' | 'error' | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [lastError, setLastError] = useState<any>(null);

  const API_BASE = "https://yt-audio-api-docker.onrender.com";

  useEffect(() => {
    const saved = localStorage.getItem('gig_admin_last_sync');
    if (saved) setLastSync(saved);
  }, [isOpen]);

  const checkHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch(`${API_BASE}/health`, { mode: 'cors' });
      if (res.ok) setHealthStatus('online');
      else setHealthStatus('offline');
    } catch (e) {
      setHealthStatus('error');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleRepairBackend = async () => {
    setIsRepairing(true);
    try {
      const requirements = `flask\nflask-cors\nyt-dlp>=2025.01.15\ngunicorn\n`;
      const { error } = await supabase.functions.invoke('github-file-sync', {
        body: { 
          path: 'requirements.txt',
          content: requirements,
          repo: 'dbuatti/yt-audio-api',
          message: 'System Self-Repair: Critical update to yt-dlp 2025'
        }
      });
      if (error) throw error;
      showSuccess("Repair initiated. Backend is rebuilding.");
    } catch (err: any) {
      showError("Repair failed to reach GitHub.");
    } finally {
      setIsRepairing(false);
    }
  };

  const handleWipeCredentials = async () => {
    if (!confirm("Wipe credentials? The engine will fail until new cookies are synced.")) return;
    
    setIsWiping(true);
    try {
      const { error } = await supabase.functions.invoke('github-file-sync', {
        body: { 
          path: 'cookies.txt',
          content: "# Netscape HTTP Cookie File\n# File Wiped via Admin\n",
          repo: 'dbuatti/yt-audio-api',
          message: 'Security: Wiping engine credentials'
        }
      });
      if (error) throw error;
      showSuccess("Credentials wiped.");
    } catch (err: any) {
      showError("Wipe failed.");
    } finally {
      setIsWiping(false);
    }
  };

  const formatAndFilterCookies = (raw: string) => {
    const lines = raw.split('\n');
    const header = "# Netscape HTTP Cookie File";
    
    const filteredLines = lines.map(line => {
      const l = line.trim();
      if (!l || l.startsWith('#')) return null;
      
      const parts = l.split(/\s+/);
      if (parts.length < 7) return null;

      const domain = parts[0];
      const flag = parts[1];
      const path = parts[2];
      const secure = parts[3];
      const expiration = parts[4];
      const name = parts[5];
      const value = parts.slice(6).join(' ');

      return [domain, flag, path, secure, expiration, name, value].join('\t');
    }).filter(Boolean);

    return `${header}\n# Reconstructed for 2025 Security Bypassing\n\n${filteredLines.join('\n')}\n`;
  };

  const handleRefreshCookies = async (customText?: string) => {
    const textToSync = customText || cookieText;
    if (!textToSync.trim()) {
      showError("No cookie data provided.");
      return;
    }

    setIsRefreshing(true);
    setLastError(null);
    
    const formattedContent = formatAndFilterCookies(textToSync);

    try {
      const { error } = await supabase.functions.invoke('github-file-sync', {
        body: { 
          path: 'cookies.txt',
          content: formattedContent,
          repo: 'dbuatti/yt-audio-api',
          message: 'Fast Sync: Netscape Reconstruction'
        }
      });

      if (error) {
        setLastError(error);
        showError("Sync Blocked: Check GitHub Token permissions.");
        return;
      }
      
      const timestamp = new Date().toLocaleString();
      setLastSync(timestamp);
      localStorage.setItem('gig_admin_last_sync', timestamp);
      showSuccess("Engine re-authorized! Build triggered.");
      setCookieText("");
    } catch (err: any) {
      setLastError(err);
      showError(`Sync Failed: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        handleRefreshCookies(content);
      };
      reader.readAsText(file);
    } else {
      showError("Invalid file. Drop a .txt cookie file.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden shadow-2xl">
        <div className="bg-red-600 p-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">System Core Admin</DialogTitle>
              <DialogDescription className="text-red-100 font-medium">Production Environment Master Controls</DialogDescription>
            </div>
          </div>
          <Lock className="w-8 h-8 opacity-20" />
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-slate-500 mb-4">
                    <History className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Last Sync</span>
                  </div>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{lastSync || "NEVER"}</span>
               </div>
               <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Activity className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Engine Status</span>
                    </div>
                    <button onClick={checkHealth} className="text-[9px] font-black text-indigo-400 hover:text-white uppercase">Refresh</button>
                  </div>
                  <div className="flex items-center gap-2">
                    {healthStatus === 'online' ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                    <span className={cn("text-xs font-black uppercase", healthStatus === 'online' ? "text-emerald-500" : "text-red-500")}>
                      {healthStatus === 'online' ? "Live & Ready" : "System Blocked"}
                    </span>
                  </div>
               </div>
            </div>

            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              className={cn(
                "relative group border-2 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center text-center transition-all duration-500",
                isDragOver ? "bg-indigo-600/20 border-indigo-500 scale-[0.98]" : "bg-white/5 border-white/10 hover:border-white/20"
              )}
            >
              <div className={cn(
                "w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-transform duration-500",
                isDragOver ? "bg-indigo-600 text-white scale-110" : "bg-slate-900 text-slate-500 group-hover:scale-105"
              )}>
                {isRefreshing ? <Loader2 className="w-10 h-10 animate-spin" /> : isDragOver ? <Download className="w-10 h-10" /> : <Upload className="w-10 h-10" />}
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight mb-2">Drop Cookie File</h4>
              <p className="text-slate-500 text-xs font-medium max-w-xs leading-relaxed">
                Export <code className="bg-white/5 px-1.5 py-0.5 rounded text-indigo-400">cookies.txt</code> from YouTube and drop it here to re-authorize the engine instantly.
              </p>
              {isRefreshing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-[2rem] flex flex-col items-center justify-center gap-4 animate-in fade-in">
                  <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                  <p className="text-xs font-black uppercase tracking-widest text-white">Syncing to Cloud Engine...</p>
                </div>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-black uppercase tracking-widest">Manual Buffer Sync</span>
                </div>
              </div>
              <Textarea 
                placeholder="# Netscape HTTP Cookie File..." 
                className="min-h-[150px] font-mono text-[10px] bg-black/40 border-white/5 focus-visible:ring-indigo-500 rounded-xl p-4 shadow-inner resize-none"
                value={cookieText}
                onChange={(e) => setCookieText(e.target.value)}
              />
              <Button 
                onClick={() => handleRefreshCookies()} 
                disabled={isRefreshing || !cookieText.trim()}
                className="w-full bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] h-10 rounded-xl border border-white/10"
              >
                Sync Manual Buffer
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-xl text-white">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight text-white">Repair Engine</p>
                      <p className="text-[9px] text-indigo-300 font-medium uppercase mt-0.5">Force dependencies update</p>
                    </div>
                </div>
                <Button 
                  onClick={handleRepairBackend} 
                  disabled={isRepairing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 h-10 px-6 font-black uppercase tracking-widest text-[9px] rounded-xl"
                >
                  {isRepairing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Run Build Repair"}
                </Button>
              </div>

              <div className="bg-red-600/10 border border-red-600/20 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-600 rounded-xl text-white">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight text-white">Wipe Credentials</p>
                      <p className="text-[9px] text-red-300 font-medium uppercase mt-0.5">Clear local session</p>
                    </div>
                </div>
                <Button 
                  variant="ghost"
                  onClick={handleWipeCredentials} 
                  disabled={isWiping}
                  className="w-full bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white h-10 px-6 font-black uppercase tracking-widest text-[9px] rounded-xl border border-red-600/20"
                >
                  {isWiping ? <Loader2 className="w-4 h-4 animate-spin" /> : "Wipe Configuration"}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-8 bg-slate-900 border-t border-white/5 flex gap-4">
          <Button variant="ghost" onClick={onClose} className="w-full font-black uppercase tracking-widest text-[10px] h-12 rounded-xl">Close System Core</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
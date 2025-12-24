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
  FileWarning
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
      const requirements = `flask\nflask-cors\nyt-dlp>=2024.12.06\ngunicorn\n`;
      const { data, error } = await supabase.functions.invoke('github-file-sync', {
        body: { 
          path: 'requirements.txt',
          content: requirements,
          repo: 'dbuatti/yt-audio-api',
          message: 'System Self-Repair: Updating dependencies'
        }
      });
      if (error) throw error;
      showSuccess("Repair initiated. Build starting...");
    } catch (err: any) {
      showError("Repair failed.");
    } finally {
      setIsRepairing(false);
    }
  };

  const handleWipeCredentials = async () => {
    if (!confirm("Are you sure? This will delete cookies.txt and may trigger bot-detection blocks.")) return;
    
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
      showSuccess("Credentials wiped. Rebuilding clean container...");
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
      if (!l.includes('youtube.com') && !l.includes('google.com')) return null;

      // CRITICAL FIX: yt-dlp 500s if columns are space-separated.
      // Most browsers/textareas convert tabs to spaces. We must restore tabs.
      // A valid Netscape cookie line has 7 columns.
      let processed = l;
      if (!processed.includes('\t')) {
        // Replace sequences of 2 or more spaces with a tab
        processed = processed.replace(/\s{2,}/g, '\t');
      }
      
      return processed;
    }).filter(Boolean);

    return `${header}\n# Optimized & Tab-Restored by Gig Studio Admin\n\n${filteredLines.join('\n')}\n`;
  };

  const handleRefreshCookies = async () => {
    if (!cookieText.trim()) {
      showError("Please paste the cookie buffer.");
      return;
    }

    setIsRefreshing(true);
    setLastError(null);
    
    const formattedContent = formatAndFilterCookies(cookieText);

    try {
      const { data, error } = await supabase.functions.invoke('github-file-sync', {
        body: { 
          path: 'cookies.txt',
          content: formattedContent,
          repo: 'dbuatti/yt-audio-api',
          message: 'Filtered & Tab-Restored Cookie Sync'
        }
      });

      if (error) {
        setLastError(error);
        showError("GitHub Sync Blocked");
        return;
      }
      
      const timestamp = new Date().toLocaleString();
      setLastSync(timestamp);
      localStorage.setItem('gig_admin_last_sync', timestamp);
      showSuccess("Tab-restored cookies synced! Rebuilding...");
      setCookieText("");
    } catch (err: any) {
      setLastError(err);
      showError(`Sync Failed: ${err.message}`);
    } finally {
      setIsRefreshing(false);
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
                    {isCheckingHealth ? <Loader2 className="w-3 h-3 animate-spin text-indigo-500" /> : <button onClick={checkHealth} className="text-[9px] font-black text-indigo-400 hover:text-white uppercase">Refresh</button>}
                  </div>
                  <div className="flex items-center gap-2">
                    {healthStatus === 'online' ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                    <span className={cn("text-xs font-black uppercase", healthStatus === 'online' ? "text-emerald-500" : "text-red-500")}>
                      {healthStatus === 'online' ? "Live & Ready" : healthStatus === 'offline' ? "Engine Error (500)" : healthStatus === 'error' ? "Unreachable" : "Standby"}
                    </span>
                  </div>
               </div>
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
                      <p className="text-[9px] text-red-300 font-medium uppercase mt-0.5">Delete malformed cookies</p>
                    </div>
                </div>
                <Button 
                  variant="ghost"
                  onClick={handleWipeCredentials} 
                  disabled={isWiping}
                  className="w-full bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white h-10 px-6 font-black uppercase tracking-widest text-[9px] rounded-xl border border-red-600/20"
                >
                  {isWiping ? <Loader2 className="w-4 h-4 animate-spin" /> : "Wipe cookies.txt"}
                </Button>
              </div>
            </div>

            {lastError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Critical Trace</span>
                </div>
                <pre className="text-[9px] font-mono bg-black/40 p-4 rounded-xl overflow-x-auto text-red-200/70 border border-red-500/10">
                  {JSON.stringify(lastError, null, 2)}
                </pre>
              </div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Github className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-black uppercase tracking-widest">Cookie Matrix</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => window.open(API_BASE, '_blank')} className="h-8 px-3 text-[9px] font-black uppercase text-indigo-400 hover:bg-white/5">
                   Verify Node <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Netscape Stream (Paste Full Buffer)</label>
                <Textarea 
                  placeholder="# Netscape HTTP Cookie File..." 
                  className="min-h-[200px] font-mono text-[10px] bg-black/40 border-white/5 focus-visible:ring-indigo-500 rounded-xl p-4 shadow-inner resize-none"
                  value={cookieText}
                  onChange={(e) => setCookieText(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
               <FileWarning className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
               <div className="space-y-1">
                 <p className="text-xs font-black uppercase text-indigo-300">Tab-Separation Auto-Enforcement</p>
                 <p className="text-[10px] text-indigo-400/80 leading-relaxed">The engine will automatically restore tab characters stripped by browser copy/paste actions. This prevents the 'js_runtimes' backend crash.</p>
               </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-8 bg-slate-900 border-t border-white/5 flex gap-4">
          <Button variant="ghost" onClick={onClose} className="flex-1 font-black uppercase tracking-widest text-[10px] h-12 rounded-xl">Discard</Button>
          <Button 
            onClick={handleRefreshCookies} 
            disabled={isRefreshing || !cookieText.trim()}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-[10px] h-12 rounded-xl shadow-xl shadow-indigo-600/20 gap-3"
          >
            {isRefreshing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Restore Tabs & Sync
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
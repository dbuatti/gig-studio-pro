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
import { Badge } from "@/components/ui/badge";
import { 
  ShieldAlert, 
  RefreshCw, 
  Activity,
  Code2,
  Zap,
  Wifi,
  WifiOff,
  Loader2,
  Wrench,
  Trash2,
  Upload,
  FileText,
  Download,
  Terminal,
  Copy,
  Check,
  Lock,
  History
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [hasCopiedCommand, setHasCopiedCommand] = useState(false);

  const API_BASE = "https://yt-audio-api-docker.onrender.com";
  const SUPABASE_PROJECT_ID = "rqesjpnhrjdjnrzdhzgw";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZXNqcG5ocmpkam5yemRoemd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMzgwNzgsImV4cCI6MjA3NzYxNDA3OH0.NqFKBFI-l96hWOGNc8QxuQdaGKVmvzw6LDGO_MsIoQc";

  // The automation command
  const automationCommand = `yt-dlp --cookies-from-browser chrome --cookies cookies.txt && curl -X POST https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/github-file-sync -H "Content-Type: application/json" -H "Authorization: Bearer ${ANON_KEY}" -d "{\\"path\\": \\"cookies.txt\\", \\"repo\\": \\"dbuatti/yt-audio-api\\", \\"content\\": \\"$(cat cookies.txt)\\", \\"message\\": \\"CLI Automated Sync\\"}" && rm cookies.txt`;

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

  const copyCommand = () => {
    navigator.clipboard.writeText(automationCommand);
    setHasCopiedCommand(true);
    showSuccess("Automation command copied to clipboard");
    setTimeout(() => setHasCopiedCommand(false), 3000);
  };

  const handleRefreshCookies = async (customText?: string) => {
    const textToSync = customText || cookieText;
    if (!textToSync.trim()) {
      showError("No cookie data provided.");
      return;
    }

    setIsRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('github-file-sync', {
        body: { 
          path: 'cookies.txt',
          content: textToSync,
          repo: 'dbuatti/yt-audio-api',
          message: 'Admin Panel Sync'
        }
      });

      if (error) throw error;
      
      const timestamp = new Date().toLocaleString();
      setLastSync(timestamp);
      localStorage.setItem('gig_admin_last_sync', timestamp);
      showSuccess("Engine re-authorized!");
      setCookieText("");
    } catch (err: any) {
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
      reader.onload = (event) => handleRefreshCookies(event.target?.result as string);
      reader.readAsText(file);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden shadow-2xl">
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

        <ScrollArea className="max-h-[75vh]">
          <div className="p-8 space-y-8">
            {/* CLI Automation Section */}
            <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-3 rounded-2xl text-white">
                    <Terminal className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black uppercase tracking-tight">CLI Automation</h4>
                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-0.5">Automated Browser Bridge</p>
                  </div>
                </div>
                <Badge className="bg-indigo-600 text-white font-mono text-[10px]">v2.1 STABLE</Badge>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-slate-400 leading-relaxed">
                  Run this command in your local terminal to automatically extract cookies from your browser and sync them to the backend engine. 
                  <span className="text-indigo-400 font-bold ml-1">Requires yt-dlp and curl.</span>
                </p>
                
                <div className="relative group">
                  <div className="absolute -inset-1 bg-indigo-500/20 blur opacity-0 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                  <div className="relative bg-black rounded-2xl p-6 font-mono text-xs text-indigo-300 border border-white/5 overflow-x-auto whitespace-pre">
                    {automationCommand}
                  </div>
                  <Button 
                    onClick={copyCommand}
                    className="absolute top-4 right-4 bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 rounded-xl shadow-xl gap-2 font-black uppercase text-[10px] tracking-widest"
                  >
                    {hasCopiedCommand ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {hasCopiedCommand ? "Copied" : "Copy Command"}
                  </Button>
                </div>
              </div>
            </div>

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
              <h4 className="text-xl font-black uppercase tracking-tight mb-2">Manual Cookie Upload</h4>
              <p className="text-slate-500 text-xs font-medium max-w-xs leading-relaxed">
                Export <code className="bg-white/5 px-1.5 py-0.5 rounded text-indigo-400">cookies.txt</code> from YouTube and drop it here to re-authorize the engine manually.
              </p>
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
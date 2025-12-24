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
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const [cookieText, setCookieText] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gig_admin_last_sync');
    if (saved) setLastSync(saved);
  }, [isOpen]);

  const handleRefreshCookies = async () => {
    if (!cookieText.trim()) {
      showError("Please paste the Netscape cookie file content first.");
      return;
    }

    if (!cookieText.includes("youtube.com") && !cookieText.includes("google.com")) {
      showError("Invalid cookie format. Ensure you are exporting ALL cookies from the tool.");
      return;
    }

    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-file-sync', {
        body: { 
          path: 'cookies.txt',
          content: cookieText.trim(),
          repo: 'dbuatti/yt-audio-api',
          message: 'Manual Cookie Refresh via Gig Studio Admin'
        }
      });

      if (error) {
        let displayError = error.message || "System sync failed.";
        
        // Detailed error parsing for Supabase Edge Functions
        if (error.context) {
          try {
            const body = await error.context.json();
            if (body?.error) displayError = body.error;
          } catch (e) {
            // If body isn't JSON, try text
            try {
              const text = await error.context.text();
              if (text) displayError = text;
            } catch (e2) {}
          }
        }
        
        showError(displayError);
        return;
      }
      
      const timestamp = new Date().toLocaleString();
      setLastSync(timestamp);
      localStorage.setItem('gig_admin_last_sync', timestamp);
      
      showSuccess("GitHub Sync Complete! Deploying...");
      setCookieText("");
    } catch (err: any) {
      showError(`Sync Failed: ${err.message || "Network Error"}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden shadow-2xl">
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

        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between px-2">
             <div className="flex items-center gap-2 text-slate-500">
               <History className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-widest">Last Successful Sync:</span>
             </div>
             <span className="text-[10px] font-mono text-indigo-400 font-bold">{lastSync || "NEVER"}</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-black uppercase tracking-widest">Target Repository</span>
              </div>
              <a 
                href="https://yt-audio-api-docker.onrender.com" 
                target="_blank" 
                className="text-[9px] font-black text-indigo-400 uppercase flex items-center gap-1.5 hover:text-indigo-300 bg-white/5 px-2 py-1 rounded"
              >
                <Activity className="w-3 h-3" /> Check Engine Health
              </a>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Full Cookie Buffer (All Domains)</label>
                <div className="flex gap-4">
                  <a 
                    href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/ccmclokmbiocgboebmhlbgikhaeojohf" 
                    target="_blank" 
                    className="text-[9px] font-black text-indigo-400 uppercase flex items-center gap-1 hover:text-indigo-300 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" /> Get Tool
                  </a>
                </div>
              </div>
              <Textarea 
                placeholder="# Netscape HTTP Cookie File... (Copy the ENTIRE file content from the tool)" 
                className="min-h-[200px] font-mono text-[10px] bg-black/40 border-white/5 focus-visible:ring-indigo-500 rounded-xl p-4 shadow-inner resize-none"
                value={cookieText}
                onChange={(e) => setCookieText(e.target.value)}
              />
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-[10px] text-amber-200/90 font-bold uppercase tracking-tight">Crucial Extraction Protocol:</p>
                  <ul className="text-[9px] text-amber-200/70 font-medium list-disc pl-4 space-y-1">
                    <li>Log into YouTube and Google in this browser first.</li>
                    <li>In the export tool, ensure <span className="text-amber-400 font-bold">"Export all cookies"</span> is selected.</li>
                    <li>Paste the <span className="text-amber-400 font-bold">ENTIRE content</span> of the downloaded file.</li>
                    <li>Render takes <span className="text-amber-400 font-black">2-5 minutes</span> to cycle after sync.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
            <Clock className="w-6 h-6 text-indigo-400 shrink-0" />
            <p className="text-[11px] text-indigo-300 font-medium leading-relaxed">
              Syncing triggers an automatic container rebuild on Render. The audio engine will be unavailable during the "Deploying" state shown in the Render console.
            </p>
          </div>
        </div>

        <div className="p-8 bg-slate-900 border-t border-white/5 flex gap-4">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="flex-1 font-black uppercase tracking-widest text-[10px] h-12 rounded-xl"
          >
            Abort
          </Button>
          <Button 
            onClick={handleRefreshCookies} 
            disabled={isRefreshing || !cookieText.trim()}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-[10px] h-12 rounded-xl shadow-xl shadow-indigo-600/20 gap-3"
          >
            {isRefreshing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Sync & Force Redeploy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
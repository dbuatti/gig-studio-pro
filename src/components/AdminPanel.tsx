"use client";

import React, { useState } from 'react';
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
  Code
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

  const handleRefreshCookies = async () => {
    if (!cookieText.trim()) {
      showError("Please paste the Netscape cookie file content first.");
      return;
    }

    setIsRefreshing(true);
    try {
      // We invoke an edge function to keep the GitHub PAT secure on the server side
      const { data, error } = await supabase.functions.invoke('github-file-sync', {
        body: { 
          path: 'cookies.txt',
          content: cookieText,
          repo: 'dbuatti/yt-audio-api',
          message: 'Auto-refresh YouTube cookies via Gig Studio Admin'
        }
      });

      if (error) {
        // Log detailed error to console
        console.error("Invoke Error Details:", error);
        
        // Try to parse the error message if it's from our custom response
        let displayError = "System sync failed.";
        try {
          const body = await error.context?.json();
          if (body?.error) displayError = body.error;
        } catch {
          displayError = error.message || "Connection refused";
        }
        
        showError(displayError);
        return;
      }
      
      showSuccess("GitHub Sync Complete: cookies.txt updated!");
      setCookieText("");
      onClose();
    } catch (err: any) {
      console.error("Catch Sync Error:", err);
      showError(`Sync Failed: ${err.message || "Unknown communication error"}`);
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
              <DialogDescription className="text-red-100 font-medium">Restricted access: Production Environment Controls</DialogDescription>
            </div>
          </div>
          <Lock className="w-8 h-8 opacity-20" />
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-black uppercase tracking-widest">Target: dbuatti/yt-audio-api</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">BRANCH: main</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Netscape Cookie Buffer</label>
                <a 
                  href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/ccmclokmbiocgboebmhlbgikhaeojohf" 
                  target="_blank" 
                  className="text-[9px] font-black text-indigo-400 uppercase flex items-center gap-1 hover:text-indigo-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Get Cookie Tool
                </a>
              </div>
              <Textarea 
                placeholder="# Netscape HTTP Cookie File..." 
                className="min-h-[200px] font-mono text-xs bg-black/40 border-white/5 focus-visible:ring-indigo-500 rounded-xl p-4 shadow-inner resize-none"
                value={cookieText}
                onChange={(e) => setCookieText(e.target.value)}
              />
              <p className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-amber-500" /> 
                Ensure you are logged into YouTube in this browser session before exporting.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
            <Code className="w-6 h-6 text-indigo-400 shrink-0" />
            <p className="text-[11px] text-indigo-300 font-medium leading-relaxed">
              Updating this file will trigger an automatic redeploy of your Render backend service, refreshing the master credentials for YouTube audio extraction.
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
            Refresh YouTube Cookies
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
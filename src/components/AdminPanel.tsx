"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Activity, Wifi, WifiOff, Loader2, Server, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';
import { cn } from "@/lib/utils";

const AdminPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [health, setHealth] = useState<'online' | 'offline' | 'error' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [engineInfo, setEngineInfo] = useState<any>(null);

  const checkHealth = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${window.location.origin}/health`);
      if (res.ok) {
        const data = await res.json();
        setEngineInfo(data);
        setHealth('online');
      } else {
        setHealth('offline');
      }
    } catch (e) {
      setHealth('error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) checkHealth();
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden shadow-2xl">
        <div className="bg-red-600 p-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">System Core Admin</DialogTitle>
              <DialogDescription className="text-red-100 font-medium">Native Node.js Extraction Engine</DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center gap-2 text-slate-500">
                <Server className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Engine Status</span>
              </div>
              <div className="flex items-center gap-3">
                {health === 'online' ? <Wifi className="w-5 h-5 text-emerald-500" /> : <WifiOff className="w-5 h-5 text-red-500" />}
                <span className={cn("text-lg font-black uppercase", health === 'online' ? "text-emerald-500" : "text-red-500")}>
                  {health === 'online' ? "Active" : "Offline"}
                </span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[140px]">
              <div className="flex items-center gap-2 text-slate-500">
                <Activity className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Version</span>
              </div>
              <span className="text-lg font-black uppercase text-indigo-400">{engineInfo?.engine || "v1.0.0"}</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Terminal className="w-5 h-5 text-indigo-400" />
              <span className="text-sm font-black uppercase">Diagnostics</span>
            </div>
            <div className="bg-black/40 rounded-xl p-4 font-mono text-[10px] text-slate-500">
              <p># yt-rip dynamic scraper active</p>
              <p># endpoint: /api/download</p>
              <p># status: {health === 'online' ? "READY" : "WAITING"}</p>
            </div>
          </div>

          <Button onClick={checkHealth} disabled={isLoading} className="w-full bg-indigo-600 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] gap-2">
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} /> Refresh System Health
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
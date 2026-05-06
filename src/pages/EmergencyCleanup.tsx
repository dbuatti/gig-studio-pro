"use client";

import React, { useState } from 'react';
import { supabaseAdmin } from '@/integrations/supabase/admin';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShieldAlert, Loader2, Trash2, CheckCircle2, 
  AlertTriangle, ArrowLeft, HardDrive, RefreshCw 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { cn } from '@/lib/utils';

const BUCKET = 'public_audio';
const DAYS_TO_KEEP = 45;

const EmergencyCleanup = () => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [totalDeleted, setTotalDeleted] = useState(0);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runPurge = async () => {
    if (!confirm(`This will permanently delete all files in '${BUCKET}' older than ${DAYS_TO_KEEP} days. Continue?`)) return;

    setIsProcessing(true);
    setLogs([]);
    setTotalDeleted(0);
    addLog("🚀 Starting recursive administrative purge...");

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DAYS_TO_KEEP);

    try {
      // 1. List top-level folders (User IDs)
      const { data: userFolders, error: userError } = await supabaseAdmin.storage.from(BUCKET).list();
      if (userError) throw userError;

      for (const userFolder of userFolders || []) {
        if (userFolder.id !== null) continue; // Skip files at root

        addLog(`Scanning user directory: ${userFolder.name}...`);
        
        // 2. List song folders
        const { data: songFolders, error: songError } = await supabaseAdmin.storage.from(BUCKET).list(userFolder.name);
        if (songError) continue;

        for (const songFolder of songFolders || []) {
          if (songFolder.id !== null) continue; // Skip files in user root

          const path = `${userFolder.name}/${songFolder.name}`;
          
          // 3. List files in song folder
          const { data: files, error: fileError } = await supabaseAdmin.storage.from(BUCKET).list(path);
          if (fileError) continue;

          const oldFiles = (files || [])
            .filter(f => f.created_at && new Date(f.created_at) < cutoff)
            .map(f => `${path}/${f.name}`);

          if (oldFiles.length > 0) {
            addLog(`Found ${oldFiles.length} old files in ${path}. Deleting...`);
            const { error: delError } = await supabaseAdmin.storage.from(BUCKET).remove(oldFiles);
            
            if (!delError) {
              setTotalDeleted(prev => prev + oldFiles.length);
              addLog(`✅ Successfully purged ${oldFiles.length} files.`);
            } else {
              addLog(`❌ Error deleting files in ${path}: ${delError.message}`);
            }
          }
        }
        // Rate limit buffer
        await new Promise(r => setTimeout(r, 200));
      }

      addLog("🎉 Purge cycle complete.");
      showSuccess(`Emergency cleanup finished. Deleted ${totalDeleted} files.`);
    } catch (err: any) {
      addLog(`FATAL ERROR: ${err.message}`);
      showError(`Purge failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 flex flex-col items-center justify-center">
      <div className="max-w-3xl w-full space-y-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')} className="text-slate-400 hover:text-white gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
          <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <span className="text-xs font-black uppercase tracking-widest text-red-500">Administrative God Mode Active</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl space-y-8">
          <div className="text-center space-y-4">
            <div className="bg-red-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-red-900/20">
              <Trash2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">Emergency Storage Purge</h1>
            <p className="text-slate-400 font-medium max-w-md mx-auto">
              This tool uses the <span className="text-white font-bold">Service Role Key</span> to bypass all restrictions and delete files older than {DAYS_TO_KEEP} days.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-black/20 p-6 rounded-2xl border border-white/5 text-center">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Retention Policy</span>
              <p className="text-2xl font-black text-indigo-400 mt-1">{DAYS_TO_KEEP} Days</p>
            </div>
            <div className="bg-black/20 p-6 rounded-2xl border border-white/5 text-center">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Files Purged</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">{totalDeleted}</p>
            </div>
          </div>

          <Button 
            onClick={runPurge} 
            disabled={isProcessing}
            className="w-full h-20 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-[0.2em] text-sm rounded-2xl shadow-2xl shadow-red-900/40 gap-4 transition-all active:scale-95"
          >
            {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <RefreshCw className="w-6 h-6" />}
            {isProcessing ? "Executing Purge..." : "Execute Recursive Purge"}
          </Button>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Execution Log</span>
              {isProcessing && <span className="text-[9px] font-mono text-indigo-400 animate-pulse">Processing Cloud Infrastructure...</span>}
            </div>
            <div className="bg-black rounded-2xl border border-white/5 p-6 h-64 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-1.5 font-mono text-[11px]">
                  {logs.length === 0 ? (
                    <p className="text-slate-700 italic">Waiting for execution command...</p>
                  ) : (
                    logs.map((log, i) => (
                      <p key={i} className={cn(
                        "leading-relaxed",
                        log.includes('✅') ? "text-emerald-400" : 
                        log.includes('❌') ? "text-red-400" : 
                        log.includes('🚀') ? "text-indigo-400 font-bold" : "text-slate-400"
                      )}>
                        {log}
                      </p>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4 p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-black uppercase text-amber-500">Security Protocol</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              After running this tool and confirming your Supabase project is unlocked, you must rotate your Service Role Secret in the Supabase Dashboard to invalidate the hardcoded key.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyCleanup;
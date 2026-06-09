"use client";

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ShieldAlert, Loader2, Trash2, CheckCircle2, 
  AlertTriangle, ArrowLeft, HardDrive, RefreshCw, Terminal, Database
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
  const [manualPath, setManualPath] = useState("");

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runDatabasePurge = async () => {
    if (!confirm("This will run a direct Database-level purge. This is the most powerful tool and should unlock your project. Continue?")) return;
    
    setIsProcessing(true);
    addLog("🚀 Initiating Database-Level Administrative Purge...");
    
    try {
      const { data, error } = await supabase.rpc('admin_force_purge_storage', {
        target_bucket: BUCKET,
        days_old: DAYS_TO_KEEP
      });

      if (error) throw new Error(error.message || "Unknown error");
      
      addLog(`✅ Result: ${data}`);
      showSuccess("Database purge complete!");
    } catch (err: any) {
      addLog(`❌ DB Purge failed: ${err.message}`);
      showError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualDelete = async () => {
    if (!manualPath.trim()) return;
    setIsProcessing(true);
    addLog(`Attempting manual purge of path: ${manualPath}`);
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([manualPath]);
      if (error) throw new Error(error.message || "Unknown error");
      addLog(`✅ Successfully purged: ${manualPath}`);
      showSuccess("Manual purge successful");
      setManualPath("");
    } catch (err: any) {
      addLog(`❌ Manual purge failed: ${err.message}`);
      showError(err.message);
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
              Project locked? Use the **Database-Level Purge** to bypass API restrictions and clear space.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Button 
              onClick={runDatabasePurge} 
              disabled={isProcessing}
              className="w-full h-20 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-sm rounded-2xl shadow-2xl shadow-indigo-600/40 gap-4 transition-all active:scale-95"
            >
              {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Database className="w-6 h-6" />}
              {isProcessing ? "Executing DB Purge..." : "Execute Database-Level Purge"}
            </Button>
          </div>

          <div className="p-6 bg-black/20 rounded-2xl border border-white/5 space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Manual Path Purge (Standard API)
            </Label>
            <div className="flex gap-3">
              <Input 
                placeholder="user_id/song_id/filename.mp3"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                className="bg-slate-950 border-white/10 h-12 font-mono text-xs"
              />
              <Button 
                onClick={handleManualDelete}
                disabled={isProcessing || !manualPath}
                className="bg-slate-800 hover:bg-slate-700 text-white h-12 px-6 rounded-xl font-black uppercase text-[10px]"
              >
                Purge Path
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Execution Log</span>
              {isProcessing && <span className="text-[9px] font-mono text-indigo-400 animate-pulse">Processing Infrastructure...</span>}
            </div>
            <div className="bg-black rounded-2xl border border-white/5 p-6 h-64 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-1.5 font-mono text-[11px]">
                  {logs.length === 0 ? (
                    <p className="text-slate-700 italic">Waiting for command...</p>
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
              Direct database deletion is permanent. Once records are removed, Supabase will physically delete the files to reclaim your quota. This may take up to 15 minutes to reflect in the dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyCleanup;
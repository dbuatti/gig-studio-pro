"use client";

import React, { useState, useEffect, useTransition, useRef } from 'react'; 
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
  Loader2,
  ShieldCheck,
  History,
  CheckCircle2,
  Database,
  Terminal,
  AlertCircle,
  Upload,
  Zap,
  HardDriveDownload,
  AlertTriangle,
  Play,
  Settings2,
  Wand2,
  Box,
  Link2,
  Undo2,
  Download,
  CloudDownload,
  RefreshCcw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useAuth } from './AuthProvider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cleanYoutubeUrl } from '@/utils/youtubeUtils';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshRepertoire: () => void; 
}

type AdminTab = 'vault' | 'maintenance' | 'automation';

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, onRefreshRepertoire }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('vault');
  const [isPending, startTransition] = useTransition(); 
  
  // Vault State
  const [isUploading, setIsUploading] = useState(false);
  const [cookieMetadata, setCookieMetadata] = useState<{
    size: number;
    lastUpdated: string;
    name: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); 

  // Maintenance / Bulk Extraction State
  const [isQueuingAllExtraction, setIsQueuingAllExtraction] = useState(false); 
  const [isQueuingMissingExtraction, setIsQueuingMissingExtraction] = useState(false); 
  const [isQueuingStuckExtraction, setIsQueuingStuckExtraction] = useState(false); 
  const [maintenanceSongs, setMaintenanceSongs] = useState<any[]>([]);

  // Automation State
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [isPopulatingLinks, setIsPopulatingLinks] = useState(false);
  const [isClearingLinks, setIsClearingLinks] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [syncBatchSize, setSyncBatchSize] = useState(5);

  // GitHub State
  const [githubToken, setGithubToken] = useState("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");
  const [githubRepo, setGithubRepo] = useState("dbuatti/yt-audio-api");
  const [githubFile, setGithubFile] = useState("cookies.txt");
  const [clipboardContent, setClipboardContent] = useState("");
  const [isGithubUploading, setIsGithubUploading] = useState(false);
  
  const [syncLogs, setSyncLogs] = useState<{ msg: string; type: 'info' | 'success' | 'error'; time: string }[]>([]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    console.log(`[AdminPanel] ${msg}`); // Also log to real console
    setSyncLogs(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 20));
  };

  useEffect(() => {
    if (isOpen) {
      checkVaultStatus();
      fetchMaintenanceData();
    }
  }, [isOpen]);

  const fetchMaintenanceData = async () => {
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select('id, title, artist, youtube_url, extraction_status, last_extracted_at, sync_status, metadata_source, preview_url, last_sync_log, audio_url') 
        .eq('user_id', user?.id)
        .order('title', { ascending: true });
      
      if (error) throw error;
      setMaintenanceSongs(data || []);
    } catch (e: any) {
      addLog(`Maintenance Fetch Error: ${e.message}`, 'error');
    }
  };

  const handleGlobalAutoSync = async () => {
    const songsToProcess = maintenanceSongs.filter(s => 
      overwriteExisting || (s.sync_status !== 'COMPLETED' && !s.metadata_source)
    );

    if (songsToProcess.length === 0) {
      showSuccess("All tracks are already optimized.");
      return;
    }

    setIsAutoSyncing(true);
    addLog(`Initiating Global Auto-Sync for ${songsToProcess.length} tracks...`, 'info');

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < songsToProcess.length; i += syncBatchSize) {
      const batch = songsToProcess.slice(i, i + syncBatchSize);
      const batchIds = batch.map(s => s.id);
      
      addLog(`Processing batch ${Math.floor(i/syncBatchSize) + 1}...`, 'info');

      try {
        const { data, error } = await supabase.functions.invoke('global-auto-sync', {
          body: { songIds: batchIds, overwrite: overwriteExisting }
        });

        if (error) throw error;

        startTransition(() => { 
          data.results.forEach((res: any) => {
            if (res.status === 'SUCCESS') {
              successful++;
              addLog(`[✓] Sync Complete: ${res.title}`, 'success');
            } else if (res.status === 'ERROR') {
              failed++;
              addLog(`[!] Sync Failed: ${res.msg}`, 'error');
            }
          });
        });
      } catch (err: any) {
        failed += batch.length; 
        addLog(`Batch Process Error: ${err.message}`, 'error');
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    setIsAutoSyncing(false);
    showSuccess(`Global Auto-Sync Finished: ${successful} successful, ${failed} failed.`);
    fetchMaintenanceData();
    onRefreshRepertoire(); 
  };

  const handlePopulateMissingLinks = async () => {
    const missing = maintenanceSongs.filter(s => !s.youtube_url || s.youtube_url.trim() === '');
    
    if (missing.length === 0) {
      showSuccess("No missing links found.");
      return;
    }

    setIsPopulatingLinks(true);
    addLog(`Smart-Populating ${missing.length} missing links...`, 'info');

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < missing.length; i += syncBatchSize) {
      const batch = missing.slice(i, i + syncBatchSize);
      const batchIds = batch.map(s => s.id);
      
      addLog(`Populating batch ${Math.floor(i/syncBatchSize) + 1}...`, 'info');

      try {
        const { data, error } = await supabase.functions.invoke('bulk-populate-youtube-links', {
          body: { songIds: batchIds }
        });

        if (error) throw error;

        startTransition(() => { 
          data.results.forEach((res: any) => {
            if (res.status === 'SUCCESS') {
              successful++;
              addLog(`[✓] Link Bound: ${res.title}`, 'success');
            } else if (res.status === 'ERROR') {
              failed++;
              addLog(`[!] Link Error: ${res.msg}`, 'error');
            }
          });
        });
      } catch (err: any) {
        failed += batch.length;
        addLog(`Link Batch Error: ${err.message}`, 'error');
      }
    }

    setIsPopulatingLinks(false);
    showSuccess(`Bulk Link Population Complete: ${successful} successful, ${failed} failed.`);
    fetchMaintenanceData();
    onRefreshRepertoire(); 
  };

  const handleClearAutoPopulatedLinks = async () => {
    const autoPopulated = maintenanceSongs.filter(s => s.metadata_source === 'auto_populated');
    
    if (autoPopulated.length === 0) {
      showError("No auto-populated links found to clear.");
      return;
    }

    if (!confirm(`Are you sure you want to clear ${autoPopulated.length} auto-populated links?`)) return;

    setIsClearingLinks(true);
    addLog(`Clearing ${autoPopulated.length} auto-populated links...`, 'info');

    let successful = 0;
    let failed = 0;

    try {
      const { error } = await supabase
        .from('repertoire')
        .update({ 
          youtube_url: null, 
          metadata_source: null,
          sync_status: 'IDLE',
          last_sync_log: 'Cleared auto-populated link'
        })
        .eq('metadata_source', 'auto_populated')
        .eq('user_id', user?.id);

      if (error) {
        failed = autoPopulated.length;
        throw error;
      }
      successful = autoPopulated.length;

      startTransition(() => { 
        addLog(`Cleared ${autoPopulated.length} links successfully.`, 'success');
      });
      showSuccess(`Links cleared: ${successful} successful, ${failed} failed.`);
      fetchMaintenanceData();
      onRefreshRepertoire(); 
    } catch (err: any) {
      addLog(`Clear Error: ${err.message}`, 'error');
    } finally {
      setIsClearingLinks(false);
    }
  };

  const checkVaultStatus = async () => {
    try {
      const { data: files, error } = await supabase.storage
        .from('cookies')
        .list('', { limit: 5 });
      
      if (error) throw error;

      const cookieFile = files?.find(f => f.name === 'cookies.txt');
      if (cookieFile) {
        startTransition(() => { 
          setCookieMetadata({
            size: cookieFile.metadata?.size || 0,
            lastUpdated: cookieFile.updated_at || cookieFile.created_at,
            name: cookieFile.name
          });
        });
      }
    } catch (e: any) {
      addLog(`Vault Access Error: ${e.message}`, 'error');
    }
  };

  const handleSupabaseUpload = async (file: File) => {
    if (!user) {
      showError("User not authenticated.");
      return;
    }
    setIsUploading(true);
    addLog(`Uploading ${file.name} to Supabase Vault...`, 'info');
    try {
      const { error } = await supabase.storage
        .from('cookies')
        .upload(`cookies.txt`, file, {
          upsert: true,
          contentType: 'text/plain',
        });

      if (error) throw error;
      showSuccess("Cookies.txt uploaded to Vault!");
      startTransition(() => { 
        addLog("Cookies.txt uploaded successfully.", 'success');
      });
      checkVaultStatus(); 
      if (fileInputRef.current) { 
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      showError(`Upload failed: ${err.message}`);
      addLog(`Upload failed: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // --- REFINED EXTRACTION HUB LOGIC ---
  const handleQueueBackgroundExtract = async (queueMode: 'all' | 'missing' | 'stuck') => {
    const songsToQueue = maintenanceSongs.filter(s => {
      // Logic for "Re-queue Stuck/Failed"
      if (queueMode === 'stuck') {
        return s.extraction_status === 'queued' || s.extraction_status === 'failed';
      }
      
      // Logic for "Queue Remaining" (Missing Full Audio)
      if (queueMode === 'missing') {
        // Song must have a YouTube URL to be eligible for extraction
        return !!s.youtube_url && (!s.audio_url || s.extraction_status !== 'completed') && s.extraction_status !== 'processing' && s.extraction_status !== 'queued';
      }

      // Logic for "Queue All Refresh"
      if (queueMode === 'all') {
        return !!s.youtube_url && s.extraction_status !== 'processing';
      }

      return false;
    });

    if (songsToQueue.length === 0) {
      showInfo(`Extraction Audit: No tracks match the '${queueMode}' criteria at this time.`);
      addLog(`Extraction check: 0 matching records for mode '${queueMode}'.`, 'info');
      return;
    }

    let message = "";
    if (queueMode === 'missing') message = `Queueing remaining ${songsToQueue.length} tracks for full audio extraction...`;
    else if (queueMode === 'stuck') message = `Re-queueing ${songsToQueue.length} stuck or failed tasks...`;
    else message = `Queueing global background refresh for ${songsToQueue.length} tracks...`;

    if (!confirm(`CONFIRM: ${message}`)) return;

    if (queueMode === 'missing') setIsQueuingMissingExtraction(true);
    else if (queueMode === 'stuck') setIsQueuingStuckExtraction(true);
    else setIsQueuingAllExtraction(true);

    addLog(message, 'info');

    try {
      const songIdsToQueue = songsToQueue.map(s => s.id);
      const { error } = await supabase
        .from('repertoire')
        .update({ 
          extraction_status: 'queued', 
          last_sync_log: `Queued via Extraction Hub (${queueMode}).` 
        })
        .in('id', songIdsToQueue);

      if (error) throw error;

      startTransition(() => { 
        showSuccess(`Queued ${songsToQueue.length} tasks successfully.`);
        addLog(`Successfully queued ${songsToQueue.length} tasks in the background worker.`, 'success');
      });
      fetchMaintenanceData(); 
      onRefreshRepertoire();
    } catch (err: any) {
      addLog(`Batch Queue Error: ${err.message}`, 'error');
      showError("System error during queue operation.");
    } finally {
      setIsQueuingMissingExtraction(false);
      setIsQueuingStuckExtraction(false);
      setIsQueuingAllExtraction(false);
    }
  };

  const handleGithubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleGithubUpload();
  };

  const handleGithubUpload = async () => {
    if (!githubToken || !githubRepo || !githubFile || !clipboardContent) {
      showError("Please fill in all GitHub fields and provide content.");
      return;
    }

    setIsGithubUploading(true);
    addLog(`Initiating GitHub upload to ${githubRepo}...`, 'info');

    try {
      const getRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${githubFile}`, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GigStudio-Admin'
        }
      });

      let sha = null;
      if (getRes.status === 200) {
        const fileData = await getRes.json();
        sha = fileData.sha;
        addLog(`Found existing file. SHA: ${sha.substring(0, 7)}...`, 'info');
      }

      const putRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${githubFile}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'GigStudio-Admin'
        },
        body: JSON.stringify({
          message: `Update ${githubFile} via Gig Studio Admin`,
          content: btoa(unescape(encodeURIComponent(clipboardContent))),
          sha: sha
        })
      });

      if (!putRes.ok) {
        const errorData = await putRes.json().catch(() => ({}));
        throw new Error(errorData.message || `GitHub PUT failed: ${putRes.statusText}`);
      }

      startTransition(() => { 
        addLog(`GitHub Upload Successful!`, 'success');
      });
      showSuccess("Content pushed to GitHub!");
      setClipboardContent(""); 

    } catch (err: any) {
      addLog(`GitHub Error: ${err.message}`, 'error');
      showError(`GitHub Error: ${err.message}`);
    } finally {
      setIsGithubUploading(false);
    }
  };

  // --- REFINED COUNTERS ---
  const activeExtractionQueue = maintenanceSongs.filter(s => 
    s.extraction_status === 'queued' || s.extraction_status === 'processing'
  );

  const stuckOrFailedCount = maintenanceSongs.filter(s => 
    s.extraction_status === 'queued' || s.extraction_status === 'failed'
  ).length;

  const missingRemainingCount = maintenanceSongs.filter(s => 
    !!s.youtube_url && (!s.audio_url || s.extraction_status !== 'completed') && s.extraction_status !== 'processing' && s.extraction_status !== 'queued'
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[95vh] md:h-[92vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden shadow-2xl flex flex-col">
        <div className="bg-red-600 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="bg-white/20 p-2 md:p-3 rounded-2xl backdrop-blur-md">
              <ShieldAlert className="w-6 h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl md:text-2xl font-black uppercase tracking-tight">System Core Admin</DialogTitle>
              <DialogDescription className="text-red-100 font-medium text-xs md:text-sm">Infrastructure Maintenance</DialogDescription>
            </div>
          </div>
          <div className="flex bg-black/20 p-1 rounded-xl overflow-x-auto no-scrollbar self-start md:self-center">
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => setActiveTab('vault')}
               className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-widest h-8 px-4 md:px-6 rounded-lg whitespace-nowrap", activeTab === 'vault' ? "bg-white text-red-600" : "text-white/60")}
             >
               Cloud Vault
             </Button>
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => setActiveTab('automation')}
               className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-widest h-8 px-4 md:px-6 rounded-lg whitespace-nowrap", activeTab === 'automation' ? "bg-white text-red-600" : "text-white/60")}
             >
               Auto-Sync
             </Button>
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => setActiveTab('maintenance')}
               className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-widest h-8 px-4 md:px-6 rounded-lg whitespace-nowrap", activeTab === 'maintenance' ? "bg-white text-red-600" : "text-white/60")}
             >
               Extraction
             </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
          <div className="flex-1 overflow-y-auto border-r border-white/5 bg-slate-900/20 custom-scrollbar">
            {(() => {
              switch (activeTab) {
                case 'automation':
                  return (
                    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
                      <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 space-y-8">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                          <div className="flex items-center gap-4 md:gap-6">
                            <div className="bg-indigo-600 p-3 md:p-4 rounded-2xl md:rounded-3xl shadow-xl shadow-indigo-600/20">
                              <Wand2 className="w-6 h-6 md:w-8 md:h-8 text-white" />
                            </div>
                            <div>
                              <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">Global Auto-Sync Engine</h3>
                              <p className="text-xs md:text-sm text-slate-400 mt-1">Automate metadata and audio discovery.</p>
                            </div>
                          </div>
                          <Button 
                            onClick={handleGlobalAutoSync} 
                            disabled={isAutoSyncing || isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 h-14 md:h-16 px-8 md:px-10 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] md:text-xs shadow-2xl shadow-indigo-600/30 gap-3"
                          >
                            {isAutoSyncing || isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                            Trigger Pipeline
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Smart-Link Discovery</h4>
                            <div className="flex flex-col gap-3">
                              <Button 
                                onClick={handlePopulateMissingLinks}
                                disabled={isPopulatingLinks || isPending}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 md:h-14 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3 shadow-lg"
                              >
                                {isPopulatingLinks || isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                                Populate Missing Links
                              </Button>
                              <Button 
                                variant="ghost"
                                onClick={handleClearAutoPopulatedLinks}
                                disabled={isClearingLinks || isPending}
                                className="w-full text-red-500 hover:bg-red-500/10 h-10 md:h-12 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3"
                              >
                                {isClearingLinks || isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                                Clear Auto-Populated
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Global Configuration</h4>
                            <div className="space-y-3">
                              <div className="p-3 md:p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                                <p className="text-xs font-bold uppercase text-slate-300">Overwrite Verified</p>
                                <Switch checked={overwriteExisting} onCheckedChange={(v) => startTransition(() => setOverwriteExisting(v))} />
                              </div>
                              <div className="p-3 md:p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                                <p className="text-xs font-bold uppercase text-slate-300">Batch Size: {syncBatchSize}</p>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => startTransition(() => setSyncBatchSize(Math.max(1, syncBatchSize - 1)))} className="h-8 w-8 bg-black/40 rounded-lg border border-white/5 hover:bg-black/60 transition-colors">-</button>
                                  <button onClick={() => startTransition(() => setSyncBatchSize(Math.min(10, syncBatchSize + 1)))} className="h-8 w-8 bg-black/40 rounded-lg border border-white/5 hover:bg-black/60 transition-colors">+</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-3xl md:rounded-[2.5rem] overflow-hidden">
                        <div className="p-4 md:p-6 bg-black/20 border-b border-white/5 flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Sync Status Matrix</h4>
                        </div>
                        <div className="divide-y divide-white/5">
                          {maintenanceSongs.map((s) => (
                            <div key={s.id} className="p-4 md:p-5 flex items-center justify-between group hover:bg-white/5 transition-colors">
                              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                <div className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  s.sync_status === 'COMPLETED' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                                  s.sync_status === 'SYNCING' ? "bg-indigo-500 animate-pulse" :
                                  s.sync_status === 'ERROR' ? "bg-red-500" : "bg-slate-700"
                                )} />
                                <div className="min-w-0">
                                  <p className="text-xs md:text-sm font-black uppercase tracking-tight truncate">{s.title}</p>
                                  <p className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{s.metadata_source || "Unsynced"}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={cn(
                                  "text-[9px] md:text-[10px] font-mono font-black uppercase",
                                  s.sync_status === 'COMPLETED' ? "text-emerald-400" : "text-slate-500"
                                )}>{s.sync_status || "IDLE"}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                case 'vault':
                  return (
                    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
                      <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="bg-indigo-600 p-2.5 rounded-xl">
                            <Upload className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h4 className="text-xl font-black uppercase tracking-tight">GitHub Direct Update</h4>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Update Repository Assets</p>
                          </div>
                        </div>
                        <form onSubmit={handleGithubSubmit} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase text-slate-500">Repository</label>
                              <input type="text" value={githubRepo} onChange={(e) => startTransition(() => setGithubRepo(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-indigo-500/50"/>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase text-slate-500">File Path</label>
                              <input type="text" value={githubFile} onChange={(e) => startTransition(() => setGithubFile(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-indigo-500/50"/>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase text-slate-500">Auth Token</label>
                              <input type="password" value={githubToken} onChange={(e) => startTransition(() => setGithubToken(e.target.value))} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-indigo-500/50" autoComplete="current-password"/>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <Textarea value={clipboardContent} onChange={(e) => startTransition(() => setClipboardContent(e.target.value))} placeholder="Paste cookie string or asset content here..." className="min-h-[150px] bg-slate-900 border-white/10 font-mono text-[10px] rounded-2xl text-white resize-none"/>
                            <Button type="submit" disabled={isGithubUploading || !clipboardContent || isPending} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-black uppercase tracking-widest text-xs gap-3">
                              {isGithubUploading || isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} 
                              {isGithubUploading || isPending ? 'PUSHING...' : 'PUSH TO REPOSITORY'}
                            </Button>
                          </div>
                        </form>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-3xl md:rounded-[2.5rem] p-6 md:p-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                          <div className="flex items-center gap-4">
                            <div className="bg-indigo-600 p-2.5 rounded-xl"><Database className="w-6 h-6" /></div>
                            <div>
                              <h4 className="text-xl font-black uppercase tracking-tight">Supabase Vault</h4>
                              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Encrypted Cookie Storage</p>
                            </div>
                          </div>
                          <input type="file" accept=".txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSupabaseUpload(f); }} className="hidden" id="v-upload" ref={fileInputRef} />
                          <Button onClick={() => document.getElementById('v-upload')?.click()} disabled={isPending} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 h-10 px-8 rounded-xl font-black uppercase text-[10px] shadow-lg">Upload Cookies.txt</Button>
                        </div>
                        {isUploading || isPending && (
                          <div className="flex flex-col items-center py-12 gap-4">
                            <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest animate-pulse text-indigo-400">Syncing Vault...</p>
                          </div>
                        )}
                        {cookieMetadata && (
                          <div className="space-y-4 animate-in slide-in-from-top-2">
                            <div className="space-y-1">
                              <p className="text-[9px] font-black text-slate-500 uppercase">Cloud Filename</p>
                              <p className="text-xs md:text-sm font-mono font-bold text-emerald-400 truncate">{cookieMetadata.name}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[9px] font-black text-slate-500 uppercase">Last Sync Event</p>
                              <p className="text-xs md:text-sm font-bold text-white">{new Date(cookieMetadata.lastUpdated).toLocaleString()}</p>
                            </div>
                            <div className="pt-2">
                              <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span className="text-[9px] md:text-[10px] font-black uppercase">Vault Status: Verified</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                case 'maintenance':
                  return (
                    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
                      <div className="bg-red-600/10 border border-red-600/20 rounded-3xl md:rounded-[2.5rem] p-8 md:p-10 space-y-8">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                          <div className="flex items-center gap-6">
                            <div className="bg-red-600 p-3 md:p-4 rounded-2xl md:rounded-3xl shadow-xl shadow-red-600/20">
                              <HardDriveDownload className="w-6 h-6 md:w-8 md:h-8 text-white" />
                            </div>
                            <div>
                              <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">Bulk Extraction Hub</h3>
                              <p className="text-xs md:text-sm text-slate-400 mt-1">Force refresh all master audio assets.</p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <Button 
                              onClick={() => handleQueueBackgroundExtract('stuck')}
                              disabled={isQueuingStuckExtraction || isQueuingMissingExtraction || isQueuingAllExtraction || stuckOrFailedCount === 0 || isPending}
                              className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3 shadow-lg"
                            >
                              {isQueuingStuckExtraction || isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                              Re-queue Stuck/Failed ({stuckOrFailedCount})
                            </Button>
                            <Button 
                              onClick={() => handleQueueBackgroundExtract('missing')}
                              disabled={isQueuingMissingExtraction || isQueuingAllExtraction || isQueuingStuckExtraction || missingRemainingCount === 0 || isPending}
                              className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3 shadow-lg"
                            >
                              {isQueuingMissingExtraction || isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                              Queue Remaining ({missingRemainingCount})
                            </Button>
                            <Button 
                              onClick={() => handleQueueBackgroundExtract('all')}
                              disabled={isQueuingAllExtraction || isQueuingMissingExtraction || isQueuingStuckExtraction || isPending}
                              className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3 shadow-lg"
                            >
                              {isQueuingAllExtraction || isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                              Queue All Refresh
                            </Button>
                          </div>
                        </div>

                        <div className="p-6 bg-red-600/5 border border-red-600/20 rounded-2xl flex items-start gap-4">
                          <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-black uppercase text-red-500">ASYNCHRONOUS PROCESSING ADVISORY</p>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                              Background tasks will process sequentially. Database records will update automatically when each track is finalized.
                            </p>
                          </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-3xl md:rounded-[2.5rem] overflow-hidden mt-8">
                          <div className="p-4 md:p-6 bg-black/20 border-b border-white/5 flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                              <CloudDownload className="w-4 h-4 text-indigo-400" /> Active Extraction Queue ({activeExtractionQueue.length})
                            </h4>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={fetchMaintenanceData}
                              className="h-7 px-3 text-[9px] font-black uppercase hover:bg-white/10 text-slate-400 gap-1.5"
                            >
                              <RefreshCcw className="w-3 3" /> Refresh
                            </Button>
                          </div>
                          <div className="divide-y divide-white/5">
                            {activeExtractionQueue.length === 0 ? (
                              <div className="py-12 text-center opacity-30">
                                <Loader2 className="w-8 h-8 mx-auto mb-4 text-slate-700" />
                                <p className="text-[10px] font-mono font-bold uppercase italic">No active extraction tasks.</p>
                              </div>
                            ) : (
                              activeExtractionQueue.map((s) => (
                                <div key={s.id} className="p-4 md:p-5 flex items-center justify-between group hover:bg-white/5 transition-colors">
                                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                    <div className={cn(
                                      "w-2 h-2 rounded-full shrink-0",
                                      s.extraction_status === 'processing' ? "bg-indigo-500 animate-pulse" : "bg-amber-500"
                                    )} />
                                    <div className="min-w-0">
                                      <p className="text-xs md:text-sm font-black uppercase tracking-tight truncate">{s.title}</p>
                                      <p className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{s.artist || "Unknown"}</p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className={cn(
                                      "text-[9px] md:text-[10px] font-mono font-black uppercase",
                                      s.extraction_status === 'processing' ? "text-indigo-400" : "text-amber-400"
                                    )}>{s.extraction_status || "IDLE"}</p>
                                    {s.last_sync_log && (
                                      <p className="text-[8px] font-mono text-slate-600 truncate max-w-[100px]">{s.last_sync_log}</p>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                default:
                  return null;
              }
            })()}
          </div>

          <aside className="w-full md:w-80 lg:w-96 bg-slate-950/50 flex flex-col shrink-0 min-h-0 border-t md:border-t-0 md:border-l border-white/5">
            <div className="p-5 md:p-6 border-b border-white/5 bg-black/20 shrink-0">
              <div className="flex items-center gap-2 text-slate-400 mb-4 md:mb-6">
                <History className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Automation Logs</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col p-5 md:p-6 min-h-0">
               <div className="flex items-center justify-between mb-4 shrink-0">
                 <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Console Stream</span>
                 </div>
                 <button onClick={() => startTransition(() => setSyncLogs([]))} className="text-[9px] font-black text-slate-600 hover:text-white uppercase transition-colors">Clear</button>
               </div>
               
               <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                 <div className="space-y-3">
                   {syncLogs.length === 0 ? (
                     <div className="py-12 text-center opacity-20">
                        <p className="text-[9px] font-mono font-bold uppercase italic">Listening for system events...</p>
                     </div>
                   ) : (
                     syncLogs.map((log, i) => (
                       <div key={i} className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
                         <div className="flex items-center justify-between text-[8px] font-mono font-bold opacity-40">
                           <span>{log.time}</span>
                           <span className="uppercase">{log.type}</span>
                         </div>
                         <p className={cn(
                           "text-[10px] font-medium leading-tight font-mono",
                           log.type === 'error' ? "text-red-400" : log.type === 'success' ? "text-emerald-400" : "text-slate-400"
                         )}>
                           {log.msg}
                         </p>
                       </div>
                     ))
                   )}
                 </div>
               </div>
            </div>
          </aside>
        </div>

        <div className="p-6 md:p-8 border-t border-white/5 bg-slate-900 flex flex-col md:flex-row items-center justify-between shrink-0 gap-4">
           <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] text-slate-600 font-mono text-center md:text-left">
              Control Unit v4.0 // Smart-Link Logic Engine Online // ID: {user?.id?.substring(0,8)}
           </p>
           <Button onClick={onClose} variant="ghost" className="w-full md:w-auto text-slate-400 hover:text-white font-black uppercase tracking-widest text-[10px] h-10 px-8 bg-white/5 md:bg-transparent rounded-xl">Close System Admin</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
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
  Loader2,
  Cloud,
  FileText,
  RefreshCw,
  ShieldCheck,
  Server,
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
  Monitor,
  Link2,
  Undo2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from "@/lib/utils";
import { useAuth } from './AuthProvider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  
  // Vault State
  const [isUploading, setIsUploading] = useState(false);
  const [cookieMetadata, setCookieMetadata] = useState<{
    size: number;
    lastUpdated: string;
    name: string;
  } | null>(null);

  // Maintenance / Bulk Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
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
        .select('id, title, artist, youtube_url, extraction_status, last_extracted_at, sync_status, metadata_source')
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

    for (let i = 0; i < songsToProcess.length; i += syncBatchSize) {
      const batch = songsToProcess.slice(i, i + syncBatchSize);
      const batchIds = batch.map(s => s.id);
      
      addLog(`Processing batch ${Math.floor(i/syncBatchSize) + 1}...`, 'info');

      try {
        const { data, error } = await supabase.functions.invoke('global-auto-sync', {
          body: { songIds: batchIds, overwrite: overwriteExisting }
        });

        if (error) throw error;

        data.results.forEach((res: any) => {
          if (res.status === 'SUCCESS') {
            addLog(`[✓] Sync Complete: ${res.title}`, 'success');
          } else if (res.status === 'ERROR') {
            addLog(`[!] Sync Failed: ${res.msg}`, 'error');
          }
        });
      } catch (err: any) {
        addLog(`Batch Process Error: ${err.message}`, 'error');
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    setIsAutoSyncing(false);
    showSuccess("Global Auto-Sync Operation Finished");
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

    for (let i = 0; i < missing.length; i += syncBatchSize) {
      const batch = missing.slice(i, i + syncBatchSize);
      const batchIds = batch.map(s => s.id);
      
      addLog(`Populating batch ${Math.floor(i/syncBatchSize) + 1}...`, 'info');

      try {
        const { data, error } = await supabase.functions.invoke('bulk-populate-youtube-links', {
          body: { songIds: batchIds }
        });

        if (error) throw error;

        data.results.forEach((res: any) => {
          if (res.status === 'SUCCESS') {
            addLog(`[✓] Link Bound: ${res.title}`, 'success');
          } else if (res.status === 'ERROR') {
            addLog(`[!] Link Error: ${res.msg}`, 'error');
          }
        });
      } catch (err: any) {
        addLog(`Link Batch Error: ${err.message}`, 'error');
      }
    }

    setIsPopulatingLinks(false);
    showSuccess("Bulk Link Population Complete");
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

      if (error) throw error;

      addLog(`Cleared ${autoPopulated.length} links successfully.`, 'success');
      showSuccess("Links cleared");
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
        setCookieMetadata({
          size: cookieFile.metadata?.size || 0,
          lastUpdated: cookieFile.updated_at || cookieFile.created_at,
          name: cookieFile.name
        });
      }
    } catch (e: any) {
      addLog(`Vault Access Error: ${e.message}`, 'error');
    }
  };

  const handleBulkBackgroundExtract = async () => {
    const songsToProcess = maintenanceSongs.filter(s => s.youtube_url);
    if (songsToProcess.length === 0) {
      showError("No songs with YouTube links found.");
      return;
    }

    if (!confirm(`WARNING: This will initiate background extraction for ${songsToProcess.length} songs. Continue?`)) {
      return;
    }

    setIsExtracting(true);
    addLog(`Initiating background bulk override for ${songsToProcess.length} tracks...`, 'info');
    showInfo("Task Queued: Extraction occurring in background.");

    for (let i = 0; i < songsToProcess.length; i++) {
      const song = songsToProcess[i];
      try {
        const targetVideoUrl = cleanYoutubeUrl(song.youtube_url);
        
        await supabase.functions.invoke('download-audio', {
          body: { 
            videoUrl: targetVideoUrl,
            songId: song.id,
            userId: user?.id
          }
        });

        addLog(`Queued: ${song.title}`, 'success');
      } catch (err: any) {
        addLog(`Failed to Queue: ${song.title} - ${err.message}`, 'error');
      }
      // Small delay between trigger calls
      await new Promise(r => setTimeout(r, 500));
    }

    setIsExtracting(false);
    showSuccess("All background tasks initialized.");
    fetchMaintenanceData();
  };

  const handleSupabaseUpload = async (file: File) => {
    if (!user) return;
    setIsUploading(true);
    addLog(`Uploading session data to Supabase vault...`, 'info');
    
    try {
      const { error: uploadError } = await supabase.storage
        .from('cookies')
        .upload('cookies.txt', file, {
          upsert: true,
          contentType: 'text/plain'
        });

      if (uploadError) throw uploadError;

      showSuccess("Supabase Vault Updated");
      addLog("Supabase Upload Successful.", 'success');
      
      await checkVaultStatus();
    } catch (err: any) {
      addLog(`Supabase Upload Failure: ${err.message}`, 'error');
      showError(`Upload Error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
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

      addLog(`GitHub Upload Successful!`, 'success');
      showSuccess("Content pushed to GitHub!");
      setClipboardContent("");

    } catch (err: any) {
      addLog(`GitHub Error: ${err.message}`, 'error');
      showError(`GitHub Error: ${err.message}`);
    } finally {
      setIsGithubUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden shadow-2xl flex flex-col">
        <div className="bg-red-600 p-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">System Core Admin</DialogTitle>
              <DialogDescription className="text-red-100 font-medium">Core Infrastructure & Maintenance</DialogDescription>
            </div>
          </div>
          <div className="flex bg-black/20 p-1 rounded-xl overflow-x-auto no-scrollbar">
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => setActiveTab('vault')}
               className={cn("text-[10px] font-black uppercase tracking-widest h-8 px-6 rounded-lg whitespace-nowrap", activeTab === 'vault' ? "bg-white text-red-600" : "text-white/60")}
             >
               Cloud Vault
             </Button>
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => setActiveTab('automation')}
               className={cn("text-[10px] font-black uppercase tracking-widest h-8 px-6 rounded-lg whitespace-nowrap", activeTab === 'automation' ? "bg-white text-red-600" : "text-white/60")}
             >
               Auto-Sync
             </Button>
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => setActiveTab('maintenance')}
               className={cn("text-[10px] font-black uppercase tracking-widest h-8 px-6 rounded-lg whitespace-nowrap", activeTab === 'maintenance' ? "bg-white text-red-600" : "text-white/60")}
             >
               Extraction
             </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          <ScrollArea className="flex-1 h-full border-r border-white/5">
            {activeTab === 'automation' ? (
              <div className="p-8 space-y-8 animate-in fade-in duration-500">
                <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-[2.5rem] p-10 space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                      <div className="bg-indigo-600 p-4 rounded-3xl shadow-xl shadow-indigo-600/20">
                        <Wand2 className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight text-white">Global Auto-Sync Engine</h3>
                        <p className="text-sm text-slate-400 mt-1">Automate metadata enrichment and audio discovery.</p>
                      </div>
                    </div>
                    <Button 
                      onClick={handleGlobalAutoSync} 
                      disabled={isAutoSyncing}
                      className="bg-indigo-600 hover:bg-indigo-700 h-16 px-10 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-indigo-600/30 gap-4"
                    >
                      {isAutoSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                      Trigger Pipeline
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Smart-Link Discovery</h4>
                      <div className="flex flex-col gap-3">
                        <Button 
                          onClick={handlePopulateMissingLinks}
                          disabled={isPopulatingLinks}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 h-14 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3 shadow-lg"
                        >
                          {isPopulatingLinks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                          Populate Missing Links
                        </Button>
                        <Button 
                          variant="ghost"
                          onClick={handleClearAutoPopulatedLinks}
                          disabled={isClearingLinks}
                          className="w-full text-red-500 hover:bg-red-500/10 h-12 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3"
                        >
                          {isClearingLinks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                          Clear Auto-Populated
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Global Configuration</h4>
                      <div className="space-y-4">
                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Settings2 className="w-4 h-4 text-indigo-400" />
                            <p className="text-xs font-bold uppercase">Overwrite Verified</p>
                          </div>
                          <Switch checked={overwriteExisting} onCheckedChange={setOverwriteExisting} />
                        </div>
                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Box className="w-4 h-4 text-indigo-400" />
                            <p className="text-xs font-bold uppercase">Batch Size: {syncBatchSize}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setSyncBatchSize(Math.max(1, syncBatchSize - 1))} className="h-7 w-7 bg-black/20 rounded-lg">-</button>
                            <button onClick={() => setSyncBatchSize(Math.min(10, syncBatchSize + 1))} className="h-7 w-7 bg-black/20 rounded-lg">+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-indigo-600/5 border border-indigo-600/20 rounded-2xl flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-black uppercase text-indigo-400">Smart-Link Automation Policy</p>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Population logic uses [Artist] + [Title] + 'official audio' and strictly assigns the top video hit.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
                   <div className="p-6 bg-black/20 border-b border-white/5 flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Repertoire Library Sync Status</h4>
                   </div>
                   <div className="divide-y divide-white/5">
                      {maintenanceSongs.map((s) => (
                        <div key={s.id} className="p-5 flex items-center justify-between group hover:bg-white/5 transition-colors">
                           <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                s.sync_status === 'COMPLETED' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                                s.sync_status === 'SYNCING' ? "bg-indigo-500 animate-pulse" :
                                s.sync_status === 'ERROR' ? "bg-red-500" : "bg-slate-700"
                              )} />
                              <div>
                                 <p className="text-sm font-black uppercase tracking-tight">{s.title}</p>
                                 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{s.metadata_source || "Unsynced"}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-8">
                              <div className="text-right">
                                 <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">State</p>
                                 <p className={cn(
                                   "text-[10px] font-mono font-black uppercase",
                                   s.sync_status === 'COMPLETED' ? "text-emerald-400" : "text-slate-500"
                                 )}>{s.sync_status || "IDLE"}</p>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            ) : activeTab === 'vault' ? (
              <div className="p-8 space-y-8">
                <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-[2.5rem] p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-2.5 rounded-xl">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black uppercase tracking-tight">GitHub Clipboard Push</h4>
                      <p className="text-[10px] font-black uppercase tracking-widest">Update Repository Assets</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-500">Repository</label>
                      <input type="text" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white"/>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-500">File Path</label>
                      <input type="text" value={githubFile} onChange={(e) => setGithubFile(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white"/>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-500">Token</label>
                      <input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white"/>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Textarea value={clipboardContent} onChange={(e) => setClipboardContent(e.target.value)} placeholder="Paste cookies or data..." className="min-h-[120px] bg-slate-900 border-white/10 font-mono text-xs rounded-xl text-white"/>
                    <Button onClick={handleGithubUpload} disabled={isGithubUploading || !clipboardContent} className="w-full bg-indigo-600 h-12 rounded-xl font-black uppercase">
                      {isGithubUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />} Push Update
                    </Button>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
                   <div className="flex justify-between items-center mb-8">
                     <div className="flex items-center gap-4">
                       <div className="bg-indigo-600 p-2.5 rounded-xl"><Database className="w-6 h-6" /></div>
                       <h4 className="text-xl font-black uppercase tracking-tight">Supabase Vault</h4>
                     </div>
                     <input type="file" accept=".txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSupabaseUpload(f); }} className="hidden" id="v-upload" />
                     <Button onClick={() => document.getElementById('v-upload')?.click()} className="bg-indigo-600 h-10 px-6 rounded-xl font-black uppercase text-[10px]">Select Cookies.txt</Button>
                   </div>
                   {isUploading && (
                     <div className="flex flex-col items-center py-10 gap-4">
                        <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Syncing Vault...</p>
                     </div>
                   )}
                </div>
              </div>
            ) : (
              <div className="p-8 space-y-8 animate-in fade-in duration-500">
                <div className="bg-red-600/10 border border-red-600/20 rounded-[2.5rem] p-10 space-y-8">
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-6">
                         <div className="bg-red-600 p-4 rounded-3xl shadow-xl shadow-red-600/20">
                            <HardDriveDownload className="w-8 h-8 text-white" />
                         </div>
                         <div>
                            <h3 className="text-2xl font-black uppercase tracking-tight text-white">Asynchronous Bulk Extraction</h3>
                            <p className="text-sm text-slate-400 mt-1">Initialize master audio extraction in the background.</p>
                         </div>
                      </div>
                      <Button 
                        onClick={handleBulkBackgroundExtract} 
                        disabled={isExtracting}
                        className="bg-red-600 hover:bg-red-700 h-16 px-10 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-red-600/30 gap-4"
                      >
                        {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                        Run Background Batch
                      </Button>
                   </div>

                   <div className="p-6 bg-red-600/5 border border-red-600/20 rounded-2xl flex items-start gap-4">
                      <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-black uppercase text-red-500">ASYNCHRONOUS EXTRACTION POLICY</p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Background tasks will process sequentially and update the database when finished. You do not need to keep the app open.
                        </p>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </ScrollArea>

          <aside className="w-full md:w-80 bg-slate-900/50 flex flex-col shrink-0">
            <div className="p-6 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2 text-slate-400 mb-6">
                <History className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Automation Logs</span>
              </div>
              
              {cookieMetadata && activeTab === 'vault' && (
                <div className="space-y-6">
                   <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-500 uppercase">Cloud Filename</p>
                     <p className="text-sm font-mono font-bold text-emerald-400">{cookieMetadata.name}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-500 uppercase">Last Sync Event</p>
                     <p className="text-sm font-bold text-white">{new Date(cookieMetadata.lastUpdated).toLocaleString()}</p>
                   </div>
                   <div className="pt-4 flex items-center gap-2 text-emerald-500 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="text-[10px] font-black uppercase">Vault Verified</span>
                   </div>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col p-6 min-h-0">
               <div className="flex items-center justify-between mb-4">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Console Feed</span>
                 <button onClick={() => setSyncLogs([])} className="text-[9px] font-black text-slate-600 hover:text-white uppercase">Clear</button>
               </div>
               <ScrollArea className="flex-1 h-full">
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
                 </div>
               </ScrollArea>
            </div>
          </aside>
        </div>

        <div className="p-8 border-t border-white/5 bg-slate-900 flex items-center justify-between shrink-0">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 font-mono">Control Unit v4.0 // Smart-Link Logic Engine Online</p>
           <Button onClick={onClose} variant="ghost" className="text-slate-400 hover:text-white font-black uppercase tracking-widest text-[10px]">Close Admin</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
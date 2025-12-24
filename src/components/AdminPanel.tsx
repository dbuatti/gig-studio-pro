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
  Copy,
  Upload,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from "@/lib/utils";
import { useAuth } from './AuthProvider';
import { Textarea } from '@/components/ui/textarea';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'online' | 'offline' | 'error' | null>(null);
  const [healthData, setHealthData] = useState<any>(null);
  
  const [cookieMetadata, setCookieMetadata] = useState<{
    size: number;
    lastUpdated: string;
    name: string;
  } | null>(null);
  
  const [syncLogs, setSyncLogs] = useState<{ msg: string; type: 'info' | 'success' | 'error'; time: string }[]>([]);

  // GitHub State
  const [githubToken, setGithubToken] = useState("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");
  const [githubRepo, setGithubRepo] = useState("dbuatti/yt-audio-api");
  const [githubFile, setGithubFile] = useState("cookies.txt");
  const [clipboardContent, setClipboardContent] = useState("");
  const [isGithubUploading, setIsGithubUploading] = useState(false);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setSyncLogs(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 15));
  };

  useEffect(() => {
    if (isOpen) {
      checkVaultStatus();
    }
  }, [isOpen]);

  const checkVaultStatus = async () => {
    addLog("Querying Cloud Vault...", 'info');
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
        addLog(`Vault Match Found: cookies.txt (${Math.round(cookieFile.metadata?.size / 1024)} KB)`, 'success');
      } else {
        setCookieMetadata(null);
        addLog("Vault check complete: No cookies.txt file detected.", 'info');
      }
    } catch (e: any) {
      addLog(`Vault Access Error: ${e.message}`, 'error');
    }
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
      // 1. Get current file SHA if it exists
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
      } else if (getRes.status === 404) {
        addLog("File does not exist, will be created.", 'info');
      } else {
        throw new Error(`GitHub GET failed: ${getRes.statusText}`);
      }

      // 2. Upload/Update the file
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
          content: btoa(unescape(encodeURIComponent(clipboardContent))), // Base64 encode
          sha: sha // Required for updates
        })
      });

      if (!putRes.ok) {
        const errorData = await putRes.json().catch(() => ({}));
        throw new Error(errorData.message || `GitHub PUT failed: ${putRes.statusText}`);
      }

      const result = await putRes.json();
      addLog(`GitHub Upload Successful! Commit: ${result.commit.sha.substring(0, 7)}...`, 'success');
      showSuccess("Content pushed to GitHub successfully!");
      setClipboardContent(""); // Clear on success

    } catch (err: any) {
      addLog(`GitHub Upload Error: ${err.message}`, 'error');
      showError(`GitHub Error: ${err.message}`);
    } finally {
      setIsGithubUploading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setClipboardContent(text);
      addLog("Pasted content from clipboard.", 'info');
    } catch (err) {
      showError("Failed to read clipboard. Please paste manually.");
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
              <DialogDescription className="text-red-100 font-medium">GitHub & Cloud Vault Management</DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          <ScrollArea className="flex-1 border-r border-white/5">
            <div className="p-8 space-y-8">
              {/* GitHub Upload Section */}
              <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-[2.5rem] p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-2.5 rounded-xl">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black uppercase tracking-tight">GitHub Clipboard Push</h4>
                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Send clipboard content to repo</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-500">Repository</label>
                    <input 
                      type="text" 
                      value={githubRepo} 
                      onChange={(e) => setGithubRepo(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
                      placeholder="owner/repo"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-500">File Path</label>
                    <input 
                      type="text" 
                      value={githubFile} 
                      onChange={(e) => setGithubFile(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
                      placeholder="cookies.txt"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-500">GitHub PAT</label>
                    <input 
                      type="password" 
                      value={githubToken} 
                      onChange={(e) => setGithubToken(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
                      placeholder="ghp_..."
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-black uppercase text-slate-500">Content to Push</label>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handlePaste}
                        className="h-7 px-3 bg-white/5 text-[9px] font-bold uppercase rounded-lg hover:bg-white/10"
                      >
                        Paste Clipboard
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleGithubUpload}
                        disabled={isGithubUploading || !clipboardContent}
                        className="h-7 px-4 bg-indigo-600 hover:bg-indigo-700 text-[9px] font-bold uppercase rounded-lg shadow-lg"
                      >
                        {isGithubUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                        Push to GitHub
                      </Button>
                    </div>
                  </div>
                  <Textarea 
                    value={clipboardContent}
                    onChange={(e) => setClipboardContent(e.target.value)}
                    placeholder="Paste your cookies or data here..."
                    className="min-h-[120px] bg-slate-900 border-white/10 font-mono text-xs p-4 rounded-xl"
                  />
                </div>
              </div>

              {/* Supabase Vault Section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                 <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-h-[140px] flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-500 mb-4">
                      <Server className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">API Engine</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black uppercase text-slate-500">N/A</span>
                    </div>
                 </div>

                 <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-h-[140px] flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-500 mb-4">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Engine Cache</span>
                    </div>
                    <span className="text-lg font-black uppercase text-red-500">
                      N/A
                    </span>
                 </div>

                 <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-h-[140px] flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-500 mb-4">
                      <Cloud className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Vault State</span>
                    </div>
                    <span className="text-lg font-black uppercase text-indigo-400">
                      {cookieMetadata ? `${(cookieMetadata.size / 1024).toFixed(1)} KB` : "Empty"}
                    </span>
                 </div>
              </div>

              <div className="bg-indigo-600/10 border border-indigo-600/20 rounded-[2.5rem] p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-2.5 rounded-xl">
                      <Database className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black uppercase tracking-tight">Supabase Synchronizer</h4>
                      <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Manually trigger the engine to fetch from Supabase</p>
                    </div>
                  </div>
                  <Button onClick={() => checkVaultStatus()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] h-11 px-8 rounded-xl gap-3 shadow-lg shadow-indigo-600/20">
                    <RefreshCw className="w-4 h-4" /> Force Sync
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div 
                    className={cn(
                      "bg-black/20 border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center transition-all min-h-[300px] relative cursor-pointer",
                      isUploading ? "opacity-50" : "hover:border-indigo-500 hover:bg-indigo-600/5"
                    )}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleSupabaseUpload(f); }}
                    onClick={() => document.getElementById('cookie-upload-main')?.click()}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-6">
                        <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                        <p className="text-sm font-black uppercase tracking-[0.3em] animate-pulse">Pushing to Vault...</p>
                      </div>
                    ) : (
                      <>
                        <FileText className="w-16 h-16 text-indigo-400 mb-6" />
                        <h5 className="text-xl font-black uppercase tracking-tight mb-2">Drop cookies.txt here</h5>
                        <p className="text-xs text-slate-500 font-medium max-w-sm mb-10 leading-relaxed">
                          Upload to Supabase Storage. The engine will automatically attempt a sync.
                        </p>
                        <input type="file" accept=".txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSupabaseUpload(f); }} className="hidden" id="cookie-upload-main" />
                        <Button className="bg-indigo-600 hover:bg-indigo-700 h-14 px-12 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl">
                          Select File
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="bg-slate-900/50 rounded-3xl border border-white/5 p-8 flex flex-col justify-between">
                     <div className="space-y-6">
                        <div className="flex items-center gap-3">
                           <Terminal className="w-5 h-5 text-indigo-400" />
                           <span className="text-sm font-black uppercase text-white">Engine Diagnostics</span>
                        </div>
                        <div className="bg-black/40 rounded-xl p-4 font-mono text-[10px] text-slate-500 leading-relaxed border border-white/5">
                           <p className="text-emerald-400"># Last Engine Message:</p>
                           <p className="text-indigo-300 mt-1 whitespace-pre-wrap">{healthData?.last_error || "No errors reported. System stable."}</p>
                           <p className="mt-4 text-slate-500">Supabase Connection: {healthData?.supabase_initialized ? "ONLINE" : "OFFLINE"}</p>
                        </div>
                     </div>
                     <Button 
                       variant="ghost" 
                       onClick={() => { /* Removed checkHealth */ }}
                       className="w-full mt-6 h-12 bg-white/5 border border-white/10 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 gap-2"
                     >
                       Refresh Health Status <Activity className="w-3.5 h-3.5" />
                     </Button>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <aside className="w-full md:w-80 bg-slate-900/50 flex flex-col shrink-0">
            <div className="p-6 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2 text-slate-400 mb-6">
                <History className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Metadata Registry</span>
              </div>
              
              {cookieMetadata ? (
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
              ) : (
                <div className="py-12 text-center space-y-4">
                   <AlertCircle className="w-8 h-8 text-slate-800 mx-auto" />
                   <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No file record</p>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col p-6 min-h-0">
               <div className="flex items-center justify-between mb-4">
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Log</span>
                 <button onClick={() => setSyncLogs([])} className="text-[9px] font-black text-slate-600 hover:text-white uppercase">Clear</button>
               </div>
               <ScrollArea className="flex-1">
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
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 font-mono">Control Unit v2.9.1 // Enhanced Error Resilience</p>
           <Button onClick={onClose} variant="ghost" className="text-slate-400 hover:text-white font-black uppercase tracking-widest text-[10px]">Close Admin</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
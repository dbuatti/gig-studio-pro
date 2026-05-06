"use client";

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, Database, RefreshCw, Trash2, Loader2, 
  Zap, ShieldAlert, Cloud, Type, HardDrive, Music, 
  Apple, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { cleanAllSetlists } from '@/utils/setlistCleanup';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { SetlistSong } from './SetlistManager';
import { Progress } from './ui/progress';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshRepertoire: () => Promise<void>;
  repertoire: SetlistSong[];
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, onRefreshRepertoire, repertoire }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCleaning, setIsCleaning] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  // Calculate Storage Distribution
  const stats = useMemo(() => {
    const total = repertoire.length;
    if (total === 0) return null;

    const r2 = repertoire.filter(s => s.audio_url?.includes('r2.dev') || s.audio_url?.includes('pub-')).length;
    const supabaseLegacy = repertoire.filter(s => s.audio_url?.includes('supabase.co') || s.previewUrl?.includes('supabase.co')).length;
    const itunes = repertoire.filter(s => !s.audio_url && s.previewUrl?.includes('apple.com')).length;
    const none = repertoire.filter(s => !s.audio_url && !s.previewUrl).length;

    return {
      total,
      r2,
      supabaseLegacy,
      itunes,
      none,
      r2Percent: (r2 / total) * 100,
      supabasePercent: (supabaseLegacy / total) * 100,
      itunesPercent: (itunes / total) * 100,
    };
  }, [repertoire]);

  const handleGlobalCleanup = async () => {
    if (!user?.id) return;
    setIsCleaning(true);
    await cleanAllSetlists(user.id);
    await onRefreshRepertoire();
    setIsCleaning(false);
  };

  const handleR2Migration = async () => {
    if (!confirm("This will move all your Supabase files to Cloudflare R2. Continue?")) return;
    setIsMigrating(true);
    showInfo("Starting asset migration to R2...");
    try {
      const { data, error } = await supabase.functions.invoke('migrate-to-r2');
      if (error) throw error;
      showSuccess(data.message || "Migration complete!");
      await onRefreshRepertoire();
    } catch (err: any) {
      showError(`Migration failed: ${err.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleR2Rename = async () => {
    if (!confirm("This will rename all existing R2 files to use descriptive names. Continue?")) return;
    setIsRenaming(true);
    showInfo("Renaming R2 assets...");
    try {
      const { data, error } = await supabase.functions.invoke('rename-r2-assets');
      if (error) throw error;
      showSuccess(data.message || "Renaming complete!");
      await onRefreshRepertoire();
    } catch (err: any) {
      showError(`Renaming failed: ${err.message}`);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-slate-950 border-white/10 text-white rounded-[2.5rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-indigo-600 shrink-0">
          <div className="flex items-center gap-4 mb-2">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">System Administration</DialogTitle>
              <DialogDescription className="text-indigo-100 font-bold uppercase tracking-widest text-[10px] mt-1">
                Advanced database maintenance & storage distribution
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Storage Distribution Report */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5" /> Storage Distribution Report
              </h3>
              <span className="text-[10px] font-mono text-slate-500 uppercase">{repertoire.length} Total Records</span>
            </div>

            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <span className="text-xl font-black font-mono text-emerald-400">{stats.r2}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Cloudflare R2</p>
                    <Progress value={stats.r2Percent} className="h-1 mt-2 bg-emerald-900" />
                  </div>
                </div>

                <div className="p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                      <Database className="w-4 h-4" />
                    </div>
                    <span className="text-xl font-black font-mono text-amber-400">{stats.supabaseLegacy}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Legacy Supabase</p>
                    <Progress value={stats.supabasePercent} className="h-1 mt-2 bg-amber-900" />
                  </div>
                </div>

                <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                      <Apple className="w-4 h-4" />
                    </div>
                    <span className="text-xl font-black font-mono text-indigo-400">{stats.itunes}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">iTunes Previews</p>
                    <Progress value={stats.itunesPercent} className="h-1 mt-2 bg-indigo-900" />
                  </div>
                </div>
              </div>
            )}

            {stats?.supabaseLegacy === 0 && (
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <p className="text-xs font-bold text-emerald-400 uppercase">All legacy files have been successfully migrated to R2.</p>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black uppercase tracking-tight">Automation & Migration</h3>
              </div>
              
              <Button
                variant="outline"
                onClick={handleR2Migration}
                disabled={isMigrating || stats?.supabaseLegacy === 0}
                className="w-full justify-start gap-3 h-14 rounded-2xl border-white/10 bg-transparent hover:bg-indigo-600/10 hover:text-indigo-400 transition-all"
              >
                {isMigrating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-tight">Run R2 Migration</p>
                  <p className="text-[9px] font-medium opacity-60">Move {stats?.supabaseLegacy} legacy files to R2</p>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={handleR2Rename}
                disabled={isRenaming}
                className="w-full justify-start gap-3 h-14 rounded-2xl border-white/10 bg-transparent hover:bg-amber-600/10 hover:text-amber-400 transition-all"
              >
                {isRenaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Type className="w-5 h-5" />}
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-tight">Rename R2 Assets</p>
                  <p className="text-[9px] font-medium opacity-60">Apply descriptive names to R2 files</p>
                </div>
              </Button>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-black uppercase tracking-tight">Maintenance</h3>
              </div>
              
              <Button
                variant="outline"
                onClick={handleGlobalCleanup}
                disabled={isCleaning}
                className="w-full justify-start gap-3 h-14 rounded-2xl border-white/10 bg-transparent hover:bg-indigo-600/10 hover:text-indigo-400 transition-all"
              >
                {isCleaning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-tight">Clean All Setlists</p>
                  <p className="text-[9px] font-medium opacity-60">Removes duplicates from every gig</p>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={onRefreshRepertoire}
                className="w-full justify-start gap-3 h-14 rounded-2xl border-white/10 bg-transparent hover:bg-white/10 transition-all"
              >
                <RefreshCw className="w-5 h-5" />
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-tight">Force Refresh</p>
                  <p className="text-[9px] font-medium opacity-60">Reload all repertoire data</p>
                </div>
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-900 border-t border-white/5 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/emergency-cleanup')}
            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 font-black uppercase text-[10px] tracking-widest h-10 px-4 rounded-xl"
          >
            <ShieldAlert className="w-4 h-4 mr-2" /> Nuclear Cleanup
          </Button>
          <Button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest text-[11px] h-12 px-8 rounded-xl transition-all"
          >
            Close Admin
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
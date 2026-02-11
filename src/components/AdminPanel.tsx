"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Database, RefreshCw, Trash2, Loader2, Zap } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { cleanAllSetlists } from '@/utils/setlistCleanup';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshRepertoire: () => Promise<void>;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, onRefreshRepertoire }) => {
  const { user } = useAuth();
  const [isCleaning, setIsCleaning] = useState(false);

  const handleGlobalCleanup = async () => {
    if (!user?.id) return;
    setIsCleaning(true);
    await cleanAllSetlists(user.id);
    await onRefreshRepertoire();
    setIsCleaning(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-950 border-white/10 text-white rounded-[2.5rem] p-10 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-2">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter">System Administration</DialogTitle>
              <DialogDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                Advanced database maintenance & tools
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Database className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-black uppercase tracking-tight">Data Integrity</h3>
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

          <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              <h3 className="text-sm font-black uppercase tracking-tight">Danger Zone</h3>
            </div>
            
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
              These actions are permanent and cannot be undone. Use with extreme caution.
            </p>
            
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14 rounded-2xl border-red-500/20 bg-transparent hover:bg-red-600/10 hover:text-red-400 transition-all opacity-50 cursor-not-allowed"
            >
              <Trash2 className="w-5 h-5" />
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-tight">Wipe Repertoire</p>
                <p className="text-[9px] font-medium opacity-60">Delete all songs (Disabled)</p>
              </div>
            </Button>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 flex justify-end">
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
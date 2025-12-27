"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Zap, Loader2, Copy, Check, Trash2, 
  ExternalLink, QrCode, Calendar, ShieldCheck 
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface GigSessionManagerProps {
  setlistId: string;
}

const GigSessionManager: React.FC<GigSessionManagerProps> = ({ setlistId }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [setlistId]);

  const fetchSessions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gig_sessions')
        .select('*')
        .eq('setlist_id', setlistId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    if (!user || !newCode.trim()) return;
    setIsCreating(true);
    const code = newCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    
    try {
      const { error } = await supabase
        .from('gig_sessions')
        .insert([{
          user_id: user.id,
          setlist_id: setlistId,
          access_code: code,
          is_active: true
        }]);

      if (error) {
        if (error.code === '23505') throw new Error("Code already exists globally");
        throw error;
      }

      showSuccess(`Gig Code "${code}" Created!`);
      setNewCode("");
      fetchSessions();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleSession = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from('gig_sessions')
        .update({ is_active: !current })
        .eq('id', id);
      
      if (error) throw error;
      fetchSessions();
    } catch (err) {}
  };

  const deleteSession = async (id: string) => {
    if (!confirm("Remove this gig code?")) return;
    try {
      const { error } = await supabase.from('gig_sessions').delete().eq('id', id);
      if (error) throw error;
      fetchSessions();
    } catch (err) {}
  };

  const copyLink = (code: string, id: string) => {
    const url = `${window.location.origin}/gig/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showSuccess("Gig Link Copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-200 dark:border-white/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-tight">Gig Access Codes</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Public Setlist Portals</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Input 
          placeholder="E.G. WEDDING25" 
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          className="h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-xs font-black uppercase tracking-widest rounded-xl"
        />
        <Button 
          onClick={createSession} 
          disabled={isCreating || !newCode.trim()}
          className="h-11 bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] rounded-xl px-6"
        >
          {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />} Create
        </Button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="py-4 text-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" /></div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-2xl">
            <Calendar className="w-8 h-8 text-slate-200 dark:text-slate-800 mx-auto mb-2" />
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No active sessions</p>
          </div>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-white/5 rounded-2xl flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => toggleSession(session.id, session.is_active)}
                  className={cn(
                    "w-3 h-3 rounded-full transition-all",
                    session.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300 dark:bg-slate-800"
                  )}
                />
                <div>
                  <p className="text-sm font-black uppercase tracking-widest">{session.access_code}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">{session.is_active ? 'Active' : 'Offline'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="ghost" size="icon" className="h-8 w-8 rounded-lg"
                  onClick={() => copyLink(session.access_code, session.id)}
                >
                  {copiedId === session.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Button 
                  variant="ghost" size="icon" className="h-8 w-8 rounded-lg"
                  onClick={() => window.open(`/gig/${session.access_code}`, '_blank')}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
                <Button 
                  variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50"
                  onClick={() => deleteSession(session.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GigSessionManager;
"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from '@/hooks/use-settings';
import { Settings2, Hash, Music2, Moon, Sun, LogOut, ShieldCheck, Zap, Coffee, Heart } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { cn } from "@/lib/utils";

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const { keyPreference, setKeyPreference } = useSettings();
  const { user, signOut } = useAuth();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-slate-950 text-white border-white/10 rounded-[2rem]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">App Preferences</DialogTitle>
          </div>
          <DialogDescription className="text-slate-500">
            Configure your global performance settings and account options.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Display Engine</h4>
            
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/10 rounded-lg">
                  {keyPreference === 'sharps' ? <Hash className="w-4 h-4 text-indigo-400" /> : <Music2 className="w-4 h-4 text-indigo-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold">Key Notation</p>
                  <p className="text-[10px] text-slate-500 uppercase font-black">Current: {keyPreference}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-black uppercase", keyPreference === 'flats' ? "text-indigo-400" : "text-slate-600")}>Flats</span>
                <Switch 
                  checked={keyPreference === 'sharps'} 
                  onCheckedChange={(checked) => setKeyPreference(checked ? 'sharps' : 'flats')}
                />
                <span className={cn("text-[10px] font-black uppercase", keyPreference === 'sharps' ? "text-indigo-400" : "text-slate-600")}>Sharps</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/10 rounded-lg">
                  <Zap className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold">Performance Sync</p>
                  <p className="text-[10px] text-slate-500 uppercase font-black">Ultra-Low Latency</p>
                </div>
              </div>
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Community & Support</h4>
            <a 
              href="https://buymeacoffee.com/danielebuatti" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 hover:bg-amber-500/20 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg group-hover:scale-110 transition-transform">
                  <Coffee className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-100">Support the Developer</p>
                  <p className="text-[9px] text-amber-500/80 uppercase font-black">Keeping the Studio free for all</p>
                </div>
              </div>
              <Heart className="w-4 h-4 text-amber-500 fill-amber-500/20" />
            </a>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Account</h4>
            <div className="p-4 bg-slate-900 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active User</p>
              <p className="text-sm font-bold mt-1">{user?.email}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => signOut()}
                className="mt-4 w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 h-10 px-0"
              >
                <LogOut className="w-4 h-4" /> Sign Out of Studio
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-12 rounded-2xl">
            Apply Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreferencesModal;
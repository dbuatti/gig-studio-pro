"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from '@/hooks/use-settings';
import { Settings2, Hash, Music2, LogOut, ShieldCheck, Zap, Coffee, Heart, Globe, User } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const { keyPreference, setKeyPreference } = useSettings();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Public Presence</h4>
            <Button 
              variant="outline" 
              className="w-full justify-between h-14 bg-white/5 border-white/10 rounded-2xl group hover:bg-white/10 transition-all"
              onClick={() => {
                navigate('/profile');
                onClose();
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/10 rounded-lg group-hover:bg-indigo-600/20">
                  <Globe className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold">Repertoire Link</p>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Configure your public page</p>
                </div>
              </div>
              <User className="w-4 h-4 text-slate-600" />
            </Button>
          </div>

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
"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useSettings } from '@/hooks/use-settings';
import { Settings2, Hash, Music2, LogOut, ShieldCheck, Zap, Coffee, Heart, Globe, User, Youtube, Key, ShieldAlert, Bug, FileText, Monitor } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PURE_NOTES_SHARP, PURE_NOTES_FLAT } from '@/utils/keyUtils';
import { useReaderSettings, ReaderResourceForce } from '@/hooks/use-reader-settings'; // NEW: Import useReaderSettings

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const { keyPreference, setKeyPreference } = useSettings();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [ytKey, setYtKey] = useState("");
  const [safePitchMaxNote, setSafePitchMaxNote] = useState("G3");
  const [isSaving, setIsSaving] = useState(false);

  // NEW: Use reader settings hook
  const {
    forceReaderResource,
    alwaysShowAllToasts,
    ignoreConfirmedGate,
    forceDesktopView,
    updateSetting,
  } = useReaderSettings();

  useEffect(() => {
    if (isOpen && user) {
      fetchProfile();
    }
  }, [isOpen, user]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('youtube_api_key, safe_pitch_max_note').eq('id', user?.id).single();
    if (data?.youtube_api_key) setYtKey(data.youtube_api_key);
    if (data?.safe_pitch_max_note) setSafePitchMaxNote(data.safe_pitch_max_note);
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ 
        youtube_api_key: ytKey,
        safe_pitch_max_note: safePitchMaxNote
      }).eq('id', user.id);
      if (error) throw error;
      showSuccess("Preferences Updated");
    } catch (err) {
      showError("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const pureNotes = keyPreference === 'sharps' ? PURE_NOTES_SHARP : PURE_NOTES_FLAT;

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

        <div className="py-6 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar px-1">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Integrations</h4>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-600/10 rounded-lg">
                  <Youtube className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-bold">YouTube Data API</p>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Enable Master Record Discovery</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <Input 
                    type="password"
                    placeholder="AIza..."
                    value={ytKey}
                    onChange={(e) => setYtKey(e.target.value)}
                    className="h-10 pl-9 bg-black/20 border-white/5 text-xs font-mono"
                  />
                </div>
                <Button 
                  size="sm" 
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 h-10 px-4 font-black uppercase text-[9px] rounded-xl"
                >
                  {isSaving ? "..." : "Save"}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Stage Safety</h4>
            <div className="p-4 bg-indigo-600/5 rounded-2xl border border-indigo-600/20 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/10 rounded-lg">
                  <ShieldAlert className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold">Safe Pitch Mode Target</p>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Max Allowable Ceiling Note</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Select 
                  value={safePitchMaxNote.slice(0, -1)} 
                  onValueChange={(note) => setSafePitchMaxNote(`${note}${safePitchMaxNote.slice(-1) || '3'}`)}
                >
                  <SelectTrigger className="bg-black/20 border-white/5 text-xs font-mono font-bold h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                    {pureNotes.map(n => <SelectItem key={n} value={n} className="font-mono">{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select 
                  value={safePitchMaxNote.slice(-1)} 
                  onValueChange={(oct) => setSafePitchMaxNote(`${safePitchMaxNote.slice(0, -1) || 'G'}${oct}`)}
                >
                  <SelectTrigger className="w-24 bg-black/20 border-white/5 text-xs font-mono font-bold h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                    {[...Array(9)].map((_, i) => <SelectItem key={i} value={`${i}`}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed font-medium uppercase tracking-tight">
                This target will be used to calculate temporary transpositions when Safe Pitch Mode is activated on the stage.
              </p>
            </div>
          </div>

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

          {/* NEW: DEBUG & OVERRIDE Section */}
          <div className="space-y-4 border-t border-white/10 pt-6">
            <div className="flex items-center gap-3">
              <Bug className="w-5 h-5 text-red-400" />
              <h4 className="text-xl font-black uppercase tracking-tight text-red-400">DEBUG & OVERRIDE</h4>
            </div>
            <p className="text-xs text-slate-500">Advanced settings for debugging and testing reader behavior.</p>

            {/* Reader Resource Force */}
            <div className="p-4 bg-red-950/10 rounded-2xl border border-red-900/50 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-600/10 rounded-lg">
                  <FileText className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-bold">Reader Resource Force</p>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Override default chart logic</p>
                </div>
              </div>
              <Select 
                value={forceReaderResource} 
                onValueChange={(value: ReaderResourceForce) => updateSetting('forceReaderResource', value)}
              >
                <SelectTrigger className="bg-black/20 border-white/5 text-xs font-mono font-bold h-10">
                  <SelectValue placeholder="Default (Auto)" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white z-[300]">
                  <SelectItem value="default" className="font-mono">Default (Auto)</SelectItem>
                  <SelectItem value="force-pdf" className="font-mono">Force PDF Only</SelectItem>
                  <SelectItem value="force-ug" className="font-mono">Force UG Only</SelectItem>
                  <SelectItem value="force-chords" className="font-mono">Force Chords</SelectItem>
                  <SelectItem value="simulation" className="font-mono">Simulation Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Always Show All Toasts */}
            <div className="p-4 bg-red-950/10 rounded-2xl border border-red-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-600/10 rounded-lg">
                  <Zap className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-bold">Always Show All Toasts</p>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Disable toast suppression</p>
                </div>
              </div>
              <Switch 
                checked={alwaysShowAllToasts} 
                onCheckedChange={(checked) => updateSetting('alwaysShowAllToasts', checked)}
                className="data-[state=checked]:bg-red-600"
              />
            </div>

            {/* Ignore Confirmed Gate */}
            <div className="p-4 bg-red-950/10 rounded-2xl border border-red-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-600/10 rounded-lg">
                  <ShieldCheck className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-bold">Ignore Confirmed Gate</p>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Cycle through all songs in Reader</p>
                </div>
              </div>
              <Switch 
                checked={ignoreConfirmedGate} 
                onCheckedChange={(checked) => updateSetting('ignoreConfirmedGate', checked)}
                className="data-[state=checked]:bg-red-600"
              />
            </div>

            {/* Force Desktop View */}
            <div className="p-4 bg-red-950/10 rounded-2xl border border-red-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-600/10 rounded-lg">
                  <Monitor className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-bold">Force Desktop View</p>
                  <p className="text-[9px] text-slate-500 uppercase font-black">Disable mobile optimizations</p>
                </div>
              </div>
              <Switch 
                checked={forceDesktopView} 
                onCheckedChange={(checked) => updateSetting('forceDesktopView', checked)}
                className="data-[state=checked]:bg-red-600"
              />
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
          <Button onClick={() => { handleSaveSettings(); onClose(); }} className="w-full bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-12 rounded-2xl">
            Apply Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreferencesModal;
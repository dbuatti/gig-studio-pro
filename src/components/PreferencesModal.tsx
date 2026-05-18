"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { 
  Settings2, Hash, LogOut, ShieldCheck, Youtube, Key, Target, 
  Type, ListMusic, Library, LayoutDashboard, ArrowRight, Palette, 
  AlignLeft, AlignCenter, AlignRight, Moon, Sun, Loader2, Globe, MonitorX,
  X, Zap, User
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from '@/hooks/use-theme';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const { 
    keyPreference, setKeyPreference, 
    setIsSafePitchEnabled,
    isGoalTrackerEnabled, setIsGoalTrackerEnabled,
    goalLyricsCount, setGoalLyricsCount,
    goalUgChordsCount, setGoalUgChordsCount,
    goalUgLinksCount, setGoalUgLinksCount,
    goalHighestNoteCount, setGoalHighestNoteCount,
    goalOriginalKeyCount, setGoalOriginalKeyCount,
    goalTargetKeyCount, setGoalTargetKeyCount,
    goalPdfsCount, setGoalPdfsCount,
    defaultDashboardView, setDefaultDashboardView,
    ugChordsFontFamily, setUgChordsFontFamily,
    ugChordsFontSize, setUgChordsFontSize,
    ugChordsChordBold, setUgChordsChordBold,
    ugChordsChordColor, setUgChordsChordColor,
    ugChordsLineSpacing, setUgChordsLineSpacing,
    ugChordsTextAlign, setUgChordsTextAlign,
    preventStageKeyOverwrite, setPreventStageKeyOverwrite,
    disablePortraitPdfScroll, setDisablePortraitPdfScroll,
    isFetchingSettings 
  } = useSettings();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [ytApiKey, setYtApiKey] = useState("");
  const [isSavingYtKey, setIsSavingYtKey] = useState(false);

  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (isOpen && user) {
      fetchYtKey();
    }
  }, [isOpen, user]);

  const fetchYtKey = async () => {
    const { data } = await supabase.from('profiles').select('youtube_api_key').eq('id', user?.id).single();
    if (data?.youtube_api_key) setYtApiKey(data.youtube_api_key);
  };

  const handleSaveYtKey = async () => {
    if (!user) return;
    setIsSavingYtKey(true);
    try {
      const { error } = await supabase.from('profiles').update({ 
        youtube_api_key: ytApiKey,
      }).eq('id', user.id);
      if (error) throw error;
      showSuccess("YouTube API Key Updated");
    } catch (err) {
      showError("Failed to save YouTube API key");
    } finally {
      setIsSavingYtKey(false);
    }
  };

  if (isFetchingSettings) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md bg-slate-950 text-white border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center h-64">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-4">Syncing Preferences...</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-slate-950 text-white border-white/10 rounded-[2.5rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-indigo-600 shrink-0 relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Settings2 className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">App Preferences</DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 font-medium">
              Configure your global performance settings and account options.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar bg-slate-950">
          {/* Achievement Engine */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
              <Target className="w-3.5 h-3.5" /> Achievement Engine
            </h4>
            <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-black uppercase text-white">Goal Tracker</p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold">Monitor repertoire progress</p>
                </div>
                <Switch 
                  checked={isGoalTrackerEnabled} 
                  onCheckedChange={setIsGoalTrackerEnabled}
                  className="data-[state=checked]:bg-indigo-600"
                />
              </div>

              {isGoalTrackerEnabled && (
                <div className="space-y-6 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Lyrics', val: goalLyricsCount, set: setGoalLyricsCount },
                      { label: 'Chords', val: goalUgChordsCount, set: setGoalUgChordsCount },
                      { label: 'Links', val: goalUgLinksCount, set: setGoalUgLinksCount },
                      { label: 'Range', val: goalHighestNoteCount, set: setGoalHighestNoteCount },
                      { label: 'Orig Key', val: goalOriginalKeyCount, set: setGoalOriginalKeyCount },
                      { label: 'Stage Key', val: goalTargetKeyCount, set: setGoalTargetKeyCount },
                      { label: 'PDFs', val: goalPdfsCount, set: setGoalPdfsCount },
                    ].map((goal) => (
                      <div key={goal.label} className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase text-slate-500 ml-1">{goal.label} Goal</Label>
                        <Input 
                          type="number" 
                          value={goal.val} 
                          onChange={(e) => goal.set(parseInt(e.target.value) || 0)} 
                          className="h-10 bg-black/40 border-white/10 text-xs font-bold rounded-xl" 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Integrations */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" /> Integrations
            </h4>
            <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-600/20 rounded-xl">
                  <Youtube className="w-5 h-5 text-red-500" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-black uppercase text-white">YouTube Data API</p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold">Enable Master Record Discovery</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <Input 
                    type="password" 
                    placeholder="AIza..." 
                    value={ytApiKey} 
                    onChange={(e) => setYtApiKey(e.target.value)} 
                    className="h-12 pl-10 bg-black/40 border-white/10 text-xs font-mono text-white rounded-xl" 
                  />
                </div>
                <Button 
                  size="sm" 
                  onClick={handleSaveYtKey} 
                  disabled={isSavingYtKey} 
                  className="bg-indigo-600 hover:bg-indigo-700 h-12 px-6 font-black uppercase text-[10px] rounded-xl shadow-lg shadow-indigo-600/20"
                >
                  {isSavingYtKey ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          </section>

          {/* Display Engine */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
              <LayoutDashboard className="w-3.5 h-3.5" /> Display Engine
            </h4>
            
            <div className="space-y-3">
              <div className="p-5 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-black uppercase text-white">Default View</p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold">Dashboard landing page</p>
                </div>
                <ToggleGroup 
                  type="single" 
                  value={defaultDashboardView} 
                  onValueChange={(value) => value && setDefaultDashboardView(value as 'gigs' | 'repertoire')} 
                  className="bg-black/40 p-1 rounded-xl gap-1"
                >
                  <ToggleGroupItem value="gigs" className="text-[9px] font-black uppercase h-8 px-4 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white">Gigs</ToggleGroupItem>
                  <ToggleGroupItem value="repertoire" className="text-[9px] font-black uppercase h-8 px-4 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white">Library</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="p-5 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-black uppercase text-white">Key Notation</p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold">Global harmonic display</p>
                </div>
                <ToggleGroup 
                  type="single" 
                  value={keyPreference} 
                  onValueChange={(value) => value && setKeyPreference(value as KeyPreference)} 
                  className="bg-black/40 p-1 rounded-xl gap-1"
                >
                  <ToggleGroupItem value="flats" className="text-[9px] font-black uppercase h-8 px-3 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white">b</ToggleGroupItem>
                  <ToggleGroupItem value="neutral" className="text-[9px] font-black uppercase h-8 px-3 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white">N</ToggleGroupItem>
                  <ToggleGroupItem value="sharps" className="text-[9px] font-black uppercase h-8 px-3 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white">#</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="p-5 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-black uppercase text-white">Lock Stage Key</p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold">Prevent accidental changes</p>
                </div>
                <Switch 
                  checked={preventStageKeyOverwrite} 
                  onCheckedChange={setPreventStageKeyOverwrite}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>

              <div className="p-5 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-black uppercase text-white">App Theme</p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold">Current: {theme.toUpperCase()}</p>
                </div>
                <button 
                  onClick={toggleTheme}
                  className="h-10 w-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all"
                >
                  {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </section>

          {/* Account */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Account
            </h4>
            <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 space-y-6">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Session</p>
                <p className="text-sm font-bold text-white truncate">{user?.email}</p>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/profile')} 
                  className="w-full justify-start gap-3 h-12 rounded-xl bg-white/5 hover:bg-indigo-600/10 text-indigo-400 font-black uppercase text-[10px] tracking-widest"
                >
                  <Globe className="w-4 h-4" /> Public Profile Dashboard
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => signOut()} 
                  className="w-full justify-start gap-3 h-12 rounded-xl bg-red-500/5 hover:bg-red-500/10 text-red-400 font-black uppercase text-[10px] tracking-widest"
                >
                  <LogOut className="w-4 h-4" /> Sign Out of Studio
                </Button>
              </div>
            </div>
          </section>
        </div>

        <div className="p-8 bg-slate-900 border-t border-white/5 shrink-0">
          <Button 
            onClick={onClose} 
            className="w-full bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest text-[11px] h-14 rounded-2xl shadow-2xl transition-all active:scale-95"
          >
            Apply Preferences
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PreferencesModal;
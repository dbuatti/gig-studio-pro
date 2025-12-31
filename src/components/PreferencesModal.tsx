"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useSettings } from '@/hooks/use-settings';
import { Settings2, Hash, Music2, LogOut, ShieldCheck, Zap, Coffee, Heart, Globe, User, Youtube, Key, ShieldAlert, Bug, FileText, Monitor, Sun, Moon } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PURE_NOTES_SHARP, PURE_NOTES_FLAT } from '@/utils/keyUtils';
import { useReaderSettings, ReaderResourceForce } from '@/hooks/use-reader-settings';
import { useTheme } from '@/hooks/use-theme';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const { keyPreference, setKeyPreference, safePitchMaxNote: globalSafePitchMaxNote, setSafePitchMaxNote: setGlobalSafePitchMaxNote, isSafePitchEnabled: globalIsSafePitchEnabled, setIsSafePitchEnabled: setGlobalIsSafePitchEnabled } = useSettings();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [ytKey, setYtKey] = useState("");
  const [safePitchMaxNote, setSafePitchMaxNote] = useState(globalSafePitchMaxNote);
  const [isSafePitchEnabled, setIsSafePitchEnabled] = useState(globalIsSafePitchEnabled);
  const [isSaving, setIsSaving] = useState(false);

  const {
    forceReaderResource,
    alwaysShowAllToasts,
    ignoreConfirmedGate,
    forceDesktopView,
    updateSetting,
  } = useReaderSettings();

  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (isOpen && user) {
      fetchProfile();
    }
  }, [isOpen, user]);

  // Sync local state with global state when modal opens or global state changes
  useEffect(() => {
    setSafePitchMaxNote(globalSafePitchMaxNote);
    setIsSafePitchEnabled(globalIsSafePitchEnabled);
  }, [globalSafePitchMaxNote, globalIsSafePitchEnabled]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('youtube_api_key, safe_pitch_max_note, is_safe_pitch_enabled').eq('id', user?.id).single();
    if (data?.youtube_api_key) setYtKey(data.youtube_api_key);
    if (data?.safe_pitch_max_note) setSafePitchMaxNote(data.safe_pitch_max_note);
    if (data?.is_safe_pitch_enabled !== undefined) setIsSafePitchEnabled(data.is_safe_pitch_enabled);
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ 
        youtube_api_key: ytKey,
        safe_pitch_max_note: safePitchMaxNote,
        is_safe_pitch_enabled: isSafePitchEnabled, // NEW: Save isSafePitchEnabled
      }).eq('id', user.id);
      if (error) throw error;
      
      // Update global state after successful save
      setGlobalSafePitchMaxNote(safePitchMaxNote);
      setGlobalIsSafePitchEnabled(isSafePitchEnabled);

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
      <DialogContent className="max-w-md bg-popover text-foreground border-border rounded-[2rem]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">App Preferences</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            Configure your global performance settings and account options.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar px-1">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Integrations</h4>
            <div className="p-4 bg-card rounded-2xl border border-border space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-600/10 rounded-lg">
                  <Youtube className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">YouTube Data API</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-black">Enable Master Record Discovery</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input 
                    type="password"
                    placeholder="AIza..."
                    value={ytKey}
                    onChange={(e) => setYtKey(e.target.value)}
                    className="h-10 pl-9 bg-secondary border-border text-xs font-mono text-foreground"
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
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Stage Safety</h4>
            <div className="p-4 bg-indigo-50 dark:bg-indigo-600/5 rounded-2xl border border-indigo-100 dark:border-indigo-600/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-lg">
                    <ShieldAlert className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Safe Pitch Mode</p>
                    <p className="text-[9px] text-muted-foreground uppercase font-black">Enable pitch limit enforcement</p>
                  </div>
                </div>
                <Switch 
                  checked={isSafePitchEnabled} 
                  onCheckedChange={setIsSafePitchEnabled}
                  className="data-[state=checked]:bg-indigo-600"
                />
              </div>

              <div className="space-y-4" >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-lg">
                    <ShieldAlert className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Safe Pitch Mode Target</p>
                    <p className="text-[9px] text-muted-foreground uppercase font-black">Max Allowable Ceiling Note</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select 
                    value={safePitchMaxNote.slice(0, -1)} 
                    onValueChange={(note) => setSafePitchMaxNote(`${note}${safePitchMaxNote.slice(-1) || '3'}`)}
                    disabled={!isSafePitchEnabled} // Disable if mode is off
                  >
                    <SelectTrigger className="bg-secondary border-border text-xs font-mono font-bold h-10 text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-foreground z-[300]">
                      {pureNotes.map(n => <SelectItem key={n} value={n} className="font-mono">{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select 
                    value={safePitchMaxNote.slice(-1)} 
                    onValueChange={(oct) => setSafePitchMaxNote(`${safePitchMaxNote.slice(0, -1) || 'G'}${oct}`)}
                    disabled={!isSafePitchEnabled} // Disable if mode is off
                  >
                    <SelectTrigger className="w-24 bg-secondary border-border text-xs font-mono font-bold h-10 text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-foreground z-[300]">
                      {[...Array(9)].map((_, i) => <SelectItem key={i} value={`${i}`}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[9px] text-muted-foreground leading-relaxed font-medium uppercase tracking-tight">
                  This target will be used to calculate temporary transpositions when Safe Pitch Mode is activated on the stage.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Public Presence</h4>
            <Button 
              variant="outline" 
              className="w-full justify-between h-14 bg-card border-border rounded-2xl group hover:bg-accent transition-all text-foreground"
              onClick={() => {
                navigate('/profile');
                onClose();
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-600/20">
                  <Globe className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold">Repertoire Link</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-black">Configure your public page</p>
                </div>
              </div>
              <User className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Display Engine</h4>
            
            <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-lg">
                  {keyPreference === 'sharps' ? <Hash className="w-4 h-4 text-indigo-400" /> : <Music2 className="w-4 h-4 text-indigo-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Key Notation</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">Current: {keyPreference}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-black uppercase", keyPreference === 'flats' ? "text-indigo-400" : "text-muted-foreground")}>Flats</span>
                <Switch 
                  checked={keyPreference === 'sharps'} 
                  onCheckedChange={(checked) => setKeyPreference(checked ? 'sharps' : 'flats')}
                />
                <span className={cn("text-[10px] font-black uppercase", keyPreference === 'sharps' ? "text-indigo-400" : "text-muted-foreground")}>Sharps</span>
              </div>
            </div>

            {/* NEW: Dark Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-lg">
                  {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-indigo-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">App Theme</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">Current: {theme}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-black uppercase", theme === 'light' ? "text-indigo-400" : "text-muted-foreground")}>Light</span>
                <Switch 
                  checked={theme === 'dark'} 
                  onCheckedChange={toggleTheme}
                />
                <span className={cn("text-[10px] font-black uppercase", theme === 'dark' ? "text-indigo-400" : "text-muted-foreground")}>Dark</span>
              </div>
            </div>
          </div>

          {/* NEW: DEBUG & OVERRIDE Section */}
          <div className="space-y-4 border-t border-border pt-6">
            <div className="flex items-center gap-3">
              <Bug className="w-5 h-5 text-destructive" />
              <h4 className="text-xl font-black uppercase tracking-tight text-destructive">DEBUG & OVERRIDE</h4>
            </div>
            <p className="text-xs text-muted-foreground">Advanced settings for debugging and testing reader behavior.</p>

            {/* Reader Resource Force */}
            <div className="p-4 bg-destructive/5 rounded-2xl border border-destructive/10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <FileText className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Reader Resource Force</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-black">Override default chart logic</p>
                </div>
              </div>
              <Select 
                value={forceReaderResource} 
                onValueChange={(value: ReaderResourceForce) => updateSetting('forceReaderResource', value)}
              >
                <SelectTrigger className="bg-secondary border-border text-xs font-mono font-bold h-10 text-foreground">
                  <SelectValue placeholder="Default (Auto)" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground z-[300]">
                  <SelectItem value="default" className="font-mono">Default (Auto)</SelectItem>
                  <SelectItem value="force-pdf" className="font-mono">Force PDF Only</SelectItem>
                  <SelectItem value="force-ug" className="font-mono">Force UG Only</SelectItem>
                  <SelectItem value="force-chords" className="font-mono">Force Chords</SelectItem>
                  <SelectItem value="simulation" className="font-mono">Simulation Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Always Show All Toasts */}
            <div className="p-4 bg-destructive/5 rounded-2xl border border-destructive/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <Zap className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Always Show All Toasts</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-black">Disable toast suppression</p>
                </div>
              </div>
              <Switch 
                checked={alwaysShowAllToasts} 
                onCheckedChange={(checked) => updateSetting('alwaysShowAllToasts', checked)}
                className="data-[state=checked]:bg-destructive"
              />
            </div>

            {/* Ignore Confirmed Gate */}
            <div className="p-4 bg-destructive/5 rounded-2xl border border-destructive/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <ShieldCheck className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Ignore Confirmed Gate</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-black">Cycle through all songs in Reader</p>
                </div>
              </div>
              <Switch 
                checked={ignoreConfirmedGate} 
                onCheckedChange={(checked) => updateSetting('ignoreConfirmedGate', checked)}
                className="data-[state=checked]:bg-destructive"
              />
            </div>

            {/* Force Desktop View */}
            <div className="p-4 bg-destructive/5 rounded-2xl border border-destructive/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <Monitor className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Force Desktop View</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-black">Disable mobile optimizations</p>
                </div>
              </div>
              <Switch 
                checked={forceDesktopView} 
                onCheckedChange={(checked) => updateSetting('forceDesktopView', checked)}
                className="data-[state=checked]:bg-destructive"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Account</h4>
            <div className="p-4 bg-card rounded-2xl border border-border">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active User</p>
              <p className="text-sm font-bold mt-1 text-foreground">{user?.email}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => signOut()}
                className="mt-4 w-full justify-start gap-2 text-destructive hover:text-destructive-foreground hover:bg-destructive/10 h-10 px-0"
              >
                <LogOut className="w-4 h-4" /> Sign Out of Studio
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-secondary">
          <Button onClick={() => { handleSaveSettings(); onClose(); }} className="w-full bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-12 rounded-2xl">
            Apply Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreferencesModal;
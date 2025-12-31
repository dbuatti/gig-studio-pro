"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useSettings, KeyPreference } from '@/hooks/use-settings';
import { Settings2, Hash, Music2, LogOut, ShieldCheck, Zap, Globe, User, Youtube, Key, ShieldAlert, Bug, FileText, Monitor, Sun, Moon, Loader2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { cn } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PURE_NOTES_SHARP, PURE_NOTES_FLAT } from '@/utils/keyUtils';
import { useReaderSettings, ReaderResourceForce } from '@/hooks/use-reader-settings';
import { useTheme } from '@/hooks/use-theme';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const { 
    keyPreference, setKeyPreference, 
    safePitchMaxNote, setSafePitchMaxNote, 
    isSafePitchEnabled, setIsSafePitchEnabled,
    isFetchingSettings 
  } = useSettings();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [ytApiKey, setYtApiKey] = useState("");
  const [isSavingYtKey, setIsSavingYtKey] = useState(false);

  const {
    forceReaderResource,
    alwaysShowAllToasts,
    ignoreConfirmedGate,
    forceDesktopView,
    updateSetting: updateReaderSetting,
  } = useReaderSettings();

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

  const pureNotes = keyPreference === 'sharps' ? PURE_NOTES_SHARP : PURE_NOTES_FLAT;

  if (isFetchingSettings) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md bg-popover text-foreground border-border rounded-[2rem] flex items-center justify-center h-60">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </DialogContent>
      </Dialog>
    );
  }

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
                    value={ytApiKey}
                    onChange={(e) => setYtApiKey(e.target.value)}
                    className="h-10 pl-9 bg-secondary border-border text-xs font-mono text-foreground"
                  />
                </div>
                <Button 
                  size="sm" 
                  onClick={handleSaveYtKey}
                  disabled={isSavingYtKey}
                  className="bg-indigo-600 hover:bg-indigo-700 h-10 px-4 font-black uppercase text-[9px] rounded-xl"
                >
                  {isSavingYtKey ? "..." : "Save"}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Display Engine</h4>
            
            <div className="p-4 bg-card rounded-2xl border border-border space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-lg">
                  <Hash className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Key Notation</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">Current: {keyPreference}</p>
                </div>
              </div>
              
              <ToggleGroup 
                type="single" 
                value={keyPreference} 
                onValueChange={(value) => value && setKeyPreference(value as KeyPreference)}
                className="grid grid-cols-3 bg-secondary p-1 rounded-xl gap-1"
              >
                <ToggleGroupItem value="flats" className="text-[9px] font-black uppercase h-9 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white">
                  Flats (b)
                </ToggleGroupItem>
                <ToggleGroupItem value="neutral" className="text-[9px] font-black uppercase h-9 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white">
                  Neutral
                </ToggleGroupItem>
                <ToggleGroupItem value="sharps" className="text-[9px] font-black uppercase h-9 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white">
                  Sharps (#)
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase">
                * Neutral mode defers to individual song settings in the chord editor.
              </p>
            </div>

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
          <Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-12 rounded-2xl">
            Apply Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreferencesModal;
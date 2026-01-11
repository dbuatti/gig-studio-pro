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
  AlignLeft, AlignCenter, AlignRight, Moon, Sun, Loader2, Globe 
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
        <DialogContent className="max-w-md bg-popover text-foreground border-border rounded-[2rem] flex flex-col items-center justify-center h-60">
          <DialogHeader className="sr-only">
            <DialogTitle>Loading Settings</DialogTitle>
          </DialogHeader>
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-popover text-foreground border-border rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tight">
            <div className="bg-indigo-600 p-2 rounded-xl shrink-0">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            App Preferences
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure your global performance settings and account options.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar px-1">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Achievement Engine</h4>
            <div className="p-4 bg-card rounded-2xl border border-border space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-lg">
                    <Target className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Goal Tracker</p>
                    <p className="text-[9px] text-muted-foreground uppercase font-black">Monitor repertoire progress</p>
                  </div>
                </div>
                <Switch 
                  checked={isGoalTrackerEnabled} 
                  onCheckedChange={setIsGoalTrackerEnabled}
                  className="data-[state=checked]:bg-indigo-600"
                />
              </div>

              {isGoalTrackerEnabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground">Lyrics Goal</Label>
                      <Input type="number" value={goalLyricsCount} onChange={(e) => setGoalLyricsCount(parseInt(e.target.value) || 0)} className="h-9 text-xs bg-secondary border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground">Chords Goal</Label>
                      <Input type="number" value={goalUgChordsCount} onChange={(e) => setGoalUgChordsCount(parseInt(e.target.value) || 0)} className="h-9 text-xs bg-secondary border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground">UG Links Goal</Label>
                      <Input type="number" value={goalUgLinksCount} onChange={(e) => setGoalUgLinksCount(parseInt(e.target.value) || 0)} className="h-9 text-xs bg-secondary border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground">Range Goal</Label>
                      <Input type="number" value={goalHighestNoteCount} onChange={(e) => setGoalHighestNoteCount(parseInt(e.target.value) || 0)} className="h-9 text-xs bg-secondary border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground">Orig Key Goal</Label>
                      <Input type="number" value={goalOriginalKeyCount} onChange={(e) => setGoalOriginalKeyCount(parseInt(e.target.value) || 0)} className="h-9 text-xs bg-secondary border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground">Stage Key Goal</Label>
                      <Input type="number" value={goalTargetKeyCount} onChange={(e) => setGoalTargetKeyCount(parseInt(e.target.value) || 0)} className="h-9 text-xs bg-secondary border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground">PDF Goal</Label>
                      <Input type="number" value={goalPdfsCount} onChange={(e) => setGoalPdfsCount(parseInt(e.target.value) || 0)} className="h-9 text-xs bg-secondary border-border" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

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
                  <Input type="password" placeholder="AIza..." value={ytApiKey} onChange={(e) => setYtApiKey(e.target.value)} className="h-10 pl-9 bg-secondary border-border text-xs font-mono text-foreground" />
                </div>
                <Button size="sm" onClick={handleSaveYtKey} disabled={isSavingYtKey} className="bg-indigo-600 hover:bg-indigo-700 h-10 px-4 font-black uppercase text-[9px] rounded-xl">
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
                  <LayoutDashboard className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Default Dashboard View</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black">Current: {defaultDashboardView}</p>
                </div>
              </div>
              <ToggleGroup 
                type="single" 
                value={defaultDashboardView} 
                onValueChange={(value) => value && setDefaultDashboardView(value as 'gigs' | 'repertoire')} 
                className="grid grid-cols-2 bg-secondary p-1 rounded-xl gap-1"
              >
                <ToggleGroupItem value="gigs" className="text-[9px] font-black uppercase h-9 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white gap-2">
                  <ListMusic className="w-3 h-3" /> Gigs
                </ToggleGroupItem>
                <ToggleGroupItem value="repertoire" className="text-[9px] font-black uppercase h-9 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white gap-2">
                  <Library className="w-3 h-3" /> Repertoire
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="p-4 bg-card rounded-2xl border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-lg">
                    <Hash className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Key Notation</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Current: {keyPreference}</p>
                  </div>
                </div>
                <ToggleGroup type="single" value={keyPreference} onValueChange={(value) => value && setKeyPreference(value as KeyPreference)} className="grid grid-cols-3 bg-secondary p-1 rounded-xl gap-1">
                  <ToggleGroupItem value="flats" className="text-[9px] font-black uppercase h-9 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white">Flats (b)</ToggleGroupItem>
                  <ToggleGroupItem value="neutral" className="text-[9px] font-black uppercase h-9 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white">Neutral</ToggleGroupItem>
                  <ToggleGroupItem value="sharps" className="text-[9px] font-black uppercase h-9 rounded-lg data-[state=on]:bg-indigo-600 data-[state=on]:text-white">Sharps (#)</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-600/10 rounded-lg">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Lock Stage Key</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Prevent changes after confirmation</p>
                  </div>
                </div>
                <Switch 
                  checked={preventStageKeyOverwrite} 
                  onCheckedChange={setPreventStageKeyOverwrite}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-lg">
                    {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">App Theme</p>
                  </div>
                </div>
                <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
              </div>

              <div className="p-4 bg-card rounded-2xl border border-border space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-lg">
                    <Palette className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Global Chord Display</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Default styling for UG Chords</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Font Family</Label>
                    <Select 
                      value={ugChordsFontFamily} 
                      onValueChange={setUgChordsFontFamily}
                    >
                      <SelectTrigger className="h-9 text-xs bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-foreground">
                        <SelectItem value="monospace" className="text-xs">Monospace</SelectItem>
                        <SelectItem value="sans-serif" className="text-xs">Sans Serif</SelectItem>
                        <SelectItem value="serif" className="text-xs">Serif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Font Size</Label>
                    <div className="flex items-center gap-2">
                      <Slider 
                        value={[ugChordsFontSize]} 
                        min={12} 
                        max={24} 
                        step={1} 
                        onValueChange={([value]) => setUgChordsFontSize(value)}
                        className="flex-1"
                      />
                      <span className="text-xs font-mono font-bold w-8 text-center text-foreground">{ugChordsFontSize}px</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Line Spacing</Label>
                    <div className="flex items-center gap-2">
                      <Slider 
                        value={[ugChordsLineSpacing]} 
                        min={1} 
                        max={2.5} 
                        step={0.1} 
                        onValueChange={([value]) => setUgChordsLineSpacing(value)}
                        className="flex-1"
                      />
                      <span className="text-xs font-mono font-bold w-8 text-center text-foreground">{ugChordsLineSpacing}x</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Chord Bold</Label>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={ugChordsChordBold} 
                        onCheckedChange={setUgChordsChordBold}
                        className="data-[state=checked]:bg-indigo-600"
                      />
                      <span className="text-xs font-bold text-foreground">{ugChordsChordBold ? 'ON' : 'OFF'}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Chord Color</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="color" 
                        value={ugChordsChordColor} 
                        onChange={(e) => setUgChordsChordColor(e.target.value)}
                        className="h-8 w-12 p-1 rounded border border-border bg-background"
                      />
                      <span className="text-xs font-mono text-foreground">{ugChordsChordColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Alignment</Label>
                    <div className="flex gap-1">
                      <Button 
                        variant={ugChordsTextAlign === "left" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setUgChordsTextAlign("left")}
                        className={cn(
                          "h-8 w-8 p-0",
                          ugChordsTextAlign === "left" 
                            ? "bg-indigo-600 hover:bg-indigo-500 text-white" 
                            : "border border-border bg-secondary text-muted-foreground hover:bg-accent"
                        )}
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant={ugChordsTextAlign === "center" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setUgChordsTextAlign("center")}
                        className={cn(
                          "h-8 w-8 p-0",
                          ugChordsTextAlign === "center" 
                            ? "bg-indigo-600 hover:bg-indigo-500 text-white" 
                            : "border border-border bg-secondary text-muted-foreground hover:bg-accent"
                        )}
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant={ugChordsTextAlign === "right" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setUgChordsTextAlign("right")}
                        className={cn(
                          "h-8 w-8 p-0",
                          ugChordsTextAlign === "right" 
                            ? "bg-indigo-600 hover:bg-indigo-500 text-white" 
                            : "border border-border bg-secondary text-muted-foreground hover:bg-accent"
                        )}
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
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
                onClick={() => navigate('/profile')} 
                className="mt-4 w-full justify-start gap-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/10 h-10 px-0"
              >
                <Globe className="w-4 h-4" /> Public Repertoire Dashboard <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => signOut()} className="mt-4 w-full justify-start gap-2 text-destructive hover:text-destructive-foreground hover:bg-destructive/10 h-10 px-0">
                <LogOut className="w-4 h-4" /> Sign Out
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-secondary">
          <Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-12 rounded-2xl">Apply Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreferencesModal;
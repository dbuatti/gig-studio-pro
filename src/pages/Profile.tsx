"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { Globe, User, Loader2, ArrowLeft, RotateCcw, Sparkles, ExternalLink, Link as LinkIcon, Check, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PublicRepertoireView from '@/components/PublicRepertoireView';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/hooks/use-settings'; // Import useSettings

const THEMES = [
  { name: 'Vibrant Light', primary: '#9333ea', background: '#ffffff', text: '#1e1b4b', border: '#9333ea' },
  { name: 'Dark Pro', primary: '#4f46e5', background: '#020617', text: '#ffffff', border: '#4f46e5' },
  { name: 'Classic Black', primary: '#000000', background: '#000000', text: '#ffffff', border: '#ffffff' },
  { name: 'Purple Energy', primary: '#c084fc', background: '#2e1065', text: '#f5f3ff', border: '#c084fc' },
];

// Use CSS variables for dynamic defaults
const DEFAULT_COLORS_LIGHT = { primary: 'hsl(var(--primary))', background: 'hsl(var(--background))', text: 'hsl(var(--foreground))', border: 'hsl(var(--primary))' };
const DEFAULT_COLORS_DARK = { primary: 'hsl(var(--primary))', background: 'hsl(var(--background))', text: 'hsl(var(--foreground))', border: 'hsl(var(--primary))' };

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const { theme } = useTheme();
  const { isFetchingSettings } = useSettings(); // Use loading state from useSettings

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      let { data: profileData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileData && !pError) {
        const initialThemeName = theme === 'dark' ? 'Dark Pro' : 'Vibrant Light';
        const initialThemePreset = THEMES.find(t => t.name === initialThemeName) || THEMES[0]; // Fallback to first theme
        const { data: newData, error: iError } = await supabase
          .from('profiles')
          .insert([{ 
            id: user.id, 
            first_name: user.email?.split('@')[0], 
            repertoire_threshold: 0, 
            custom_colors: initialThemePreset, // Store the preset colors
            custom_theme: initialThemeName // Store the theme name
          }])
          .select()
          .single();
        
        if (iError) throw iError;
        profileData = newData;
      } else if (pError) {
        throw pError;
      }

      setProfile(profileData);

      const { data: songData, error: sError } = await supabase
        .from('repertoire')
        .select('*, extraction_status, last_sync_log')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (sError) throw sError;
      setSongs(songData || []);
    } catch (err) {
      showError("Connection lost. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [user, theme]);

  useEffect(() => {
    // Only fetch profile data if useSettings is not already fetching global settings
    if (!isFetchingSettings) {
      fetchData();
    }
  }, [fetchData, isFetchingSettings]);

  const handleUpdateLocal = (updates: any) => {
    setProfile((prev: any) => ({ ...prev, ...updates }));
  };

  const saveToDatabase = async (updates: any) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      showSuccess("Settings Saved");
    } catch (err: any) {
      showError("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = `${window.location.origin}/repertoire/${profile?.repertoire_slug || 'your-link'}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    showSuccess("Share Link Copied!");
  };

  if (loading || isFetchingSettings) return ( // Show loading if useSettings is still fetching
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  const thresholdFilteredSongs = songs.filter(s => (s.readiness_score || 0) >= (profile?.repertoire_threshold || 0));

  const currentDefaultColors = theme === 'dark' ? DEFAULT_COLORS_DARK : DEFAULT_COLORS_LIGHT;
  // This will now be the actual colors from the selected preset, or the dynamic CSS variables
  const profileColors = profile?.custom_colors || currentDefaultColors; 


  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden">
      <div className="w-full lg:w-[450px] flex flex-col border-r border-border shrink-0 bg-card">
        <div className="p-6 border-b border-border bg-secondary flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full hover:bg-accent">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">Public Presence</h1>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Global Profile Engine</p>
            </div>
          </div>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Identity</h4>
              <span className="text-[10px] font-black text-indigo-500 uppercase">{songs.length} Tracks Live</span>
            </div>
            
            <div className="flex flex-col items-center gap-6 p-6 bg-secondary rounded-[2rem] border border-border">
              <div className="w-28 h-28 rounded-full border-4 flex items-center justify-center overflow-hidden bg-muted shadow-2xl" style={{ borderColor: profileColors.primary }}>
                <User className="w-12 h-12 text-muted-foreground" />
              </div>

              <div className="w-full space-y-4">
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase">First Name</Label>
                    <Input 
                      defaultValue={profile?.first_name}
                      onBlur={(e) => saveToDatabase({ first_name: e.target.value })}
                      onChange={(e) => handleUpdateLocal({ first_name: e.target.value })}
                      className="h-9 text-xs bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase">Last Name</Label>
                    <Input 
                      defaultValue={profile?.last_name}
                      onBlur={(e) => saveToDatabase({ last_name: e.target.value })}
                      onChange={(e) => handleUpdateLocal({ last_name: e.target.value })}
                      className="h-9 text-xs bg-background border-border text-foreground"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between p-5 bg-card rounded-[2rem] border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-600/10 rounded-xl">
                  <Globe className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Public Status</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-black">Clients can view list</p>
                </div>
              </div>
              <Switch 
                checked={profile?.is_repertoire_public} 
                className="data-[state=checked]:bg-indigo-600 border border-border"
                onCheckedChange={(checked) => {
                  if (checked && songs.length === 0) {
                    showError("Add songs to library first");
                    return;
                  }
                  handleUpdateLocal({ is_repertoire_public: checked });
                  saveToDatabase({ is_repertoire_public: checked });
                  if (checked) showSuccess("Repertoire is now Live!");
                }}
              />
            </div>

            <div className="space-y-4">
              <div className="p-6 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-[2rem] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-tight text-foreground">Sync Engine Online</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5">Automated Background Updates Active</p>
                  </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="space-y-2 px-1">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Visibility Threshold</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 50, 75, 100].map((val) => (
                    <Button
                      key={val}
                      variant="ghost"
                      onClick={() => {
                        handleUpdateLocal({ repertoire_threshold: val });
                        saveToDatabase({ repertoire_threshold: val });
                      }}
                      className={cn(
                        "h-10 text-[10px] font-black border uppercase rounded-xl transition-all",
                        profile?.repertoire_threshold === val 
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg" 
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {val === 0 ? 'ALL' : `>${val}%`}
                    </Button>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground font-bold uppercase mt-2 px-1">
                  Only showing {thresholdFilteredSongs.length} of {songs.length} songs based on readiness.
                </p>
              </div>

              <div className="space-y-2 px-1 pt-4">
                <Label className="text-[9px] font-bold text-muted-foreground uppercase">Unique Repertoire Slug</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">/repertoire/</span>
                    <Input 
                      placeholder="heroes-duo" 
                      defaultValue={profile?.repertoire_slug}
                      onBlur={(e) => {
                        const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                        saveToDatabase({ repertoire_slug: slug });
                      }}
                      onChange={(e) => handleUpdateLocal({ repertoire_slug: e.target.value })}
                      className="h-10 pl-24 text-xs bg-card border-border font-bold text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 px-1">
                <Label className="text-[9px] font-bold text-muted-foreground uppercase">Repertoire Bio / Mission</Label>
                <Textarea 
                  defaultValue={profile?.repertoire_bio}
                  onBlur={(e) => saveToDatabase({ repertoire_bio: e.target.value })}
                  onChange={(e) => handleUpdateLocal({ repertoire_bio: e.target.value })}
                  className="bg-card border-border min-h-[100px] text-xs resize-none rounded-xl text-foreground"
                  placeholder="Tell clients about your vibe..."
                />
              </div>
            </div>
          </section>

          <section className="space-y-6 pt-4 border-t border-border">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Branding & Style</h4>
            
            <div className="grid grid-cols-2 gap-3">
              {THEMES.map(themeOption => (
                <Button 
                  key={themeOption.name}
                  variant="ghost" 
                  onClick={() => {
                    // When a preset is clicked, update both custom_colors (hex values) and custom_theme (name)
                    handleUpdateLocal({ custom_colors: themeOption, custom_theme: themeOption.name });
                    saveToDatabase({ custom_colors: themeOption, custom_theme: themeOption.name });
                  }}
                  className="h-14 bg-card border border-border hover:border-indigo-500/50 justify-start px-4 rounded-xl gap-3 group transition-all text-foreground"
                >
                  <div className="w-4 h-4 rounded-full border border-border" style={{ background: themeOption.primary }} />
                  <span className="text-[10px] font-bold uppercase tracking-tight">{themeOption.name}</span>
                </Button>
              ))}
            </div>

            <div className="space-y-4 bg-card p-6 rounded-[2rem] border border-border">
              {[
                { label: 'Primary Accent', key: 'primary' },
                { label: 'Background', key: 'background' },
                { label: 'Text Color', key: 'text' },
              ].map(color => (
                <div key={color.key} className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">{color.label}</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg border-2 border-border shadow-inner overflow-hidden relative">
                      <Input 
                        type="color" 
                        value={profileColors[color.key]} // Use profileColors directly
                        onChange={(e) => {
                          const newColors = { ...profile.custom_colors, [color.key]: e.target.value };
                          handleUpdateLocal({ custom_colors: newColors, custom_theme: null }); // Clear custom_theme if manually adjusting colors
                        }}
                        onBlur={() => saveToDatabase({ custom_colors: profile.custom_colors, custom_theme: null })} // Clear custom_theme on blur
                        className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{profileColors[color.key]}</span>
                  </div>
                </div>
              ))}
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  const resetColors = theme === 'dark' ? DEFAULT_COLORS_DARK : DEFAULT_COLORS_LIGHT;
                  handleUpdateLocal({ custom_colors: resetColors, custom_theme: null }); // Reset to dynamic defaults
                  saveToDatabase({ custom_colors: resetColors, custom_theme: null });
                }}
                className="w-full mt-2 text-[9px] font-black uppercase text-muted-foreground hover:text-foreground gap-2"
              >
                <RotateCcw className="w-3 h-3" /> Reset to Defaults
              </Button>
            </div>
          </section>
        </div>
      </div>

      <div className="flex-1 bg-background flex flex-col p-10 relative overflow-hidden">
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] blur-[150px] opacity-20 pointer-events-none rounded-full"
          style={{ background: profileColors.primary }} // Use profileColors directly
        />

        <div className="relative z-10 h-full flex flex-col gap-6">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Live Studio Preview</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Real-time Rendering Engine Active</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-card border border-border rounded-xl px-4 py-2 flex items-center gap-4 shadow-xl">
                 <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">{publicUrl}</span>
                 <Button onClick={copyLink} size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 px-4 text-[10px] font-black uppercase rounded-lg">
                   <Copy className="w-3.5 h-3.5 mr-2" /> Copy Link
                 </Button>
              </div>
              <a 
                href={publicUrl} 
                target="_child" 
                className="h-10 w-10 bg-card border border-border flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="flex-1 bg-card rounded-[2.5rem] border-4 border-border shadow-2xl overflow-hidden relative">
            {profile?.is_repertoire_public ? (
              <PublicRepertoireView profile={profile} songs={thresholdFilteredSongs} isPreview themes={THEMES} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md text-center p-12">
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
                  <Globe className="w-10 h-1- text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-foreground mb-3">Preview Offline</h2>
                <p className="text-muted-foreground max-w-sm font-medium">Your repertoire is currently private. Toggle the Public Status switch to enable the live link and see the preview.</p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    handleUpdateLocal({ is_repertoire_public: true });
                    saveToDatabase({ is_repertoire_public: true });
                  }}
                  className="mt-8 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-2xl"
                >
                  Go Live Now
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
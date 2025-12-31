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

const THEMES = [
  { name: 'Vibrant Light', primary: '#9333ea', background: '#ffffff', text: '#1e1b4b', border: '#9333ea' },
  { name: 'Dark Pro', primary: '#4f46e5', background: '#020617', text: '#ffffff', border: '#4f46e5' },
  { name: 'Classic Black', primary: '#ffffff', background: '#000000', text: '#ffffff', border: '#ffffff' },
  { name: 'Purple Energy', primary: '#c084fc', background: '#2e1065', text: '#f5f3ff', border: '#c084fc' },
];

const DEFAULT_COLORS = { primary: '#9333ea', background: '#ffffff', text: '#1e1b4b', border: '#9333ea' };

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      let { data: profileData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileData && !pError) {
        const { data: newData, error: iError } = await supabase
          .from('profiles')
          .insert([{ id: user.id, first_name: user.email?.split('@')[0], repertoire_threshold: 0, custom_colors: DEFAULT_COLORS }])
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
        .select('*, extraction_status, last_sync_log') // NEW: Select extraction_status and last_sync_log
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (sError) throw sError;
      setSongs(songData || []);
    } catch (err) {
      // console.error("Profile Fetch Error:", err);
      showError("Connection lost. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  const thresholdFilteredSongs = songs.filter(s => (s.readiness_score || 0) >= (profile?.repertoire_threshold || 0));

  return (
    <div className="h-screen bg-slate-950 text-white flex overflow-hidden">
      <div className="w-full lg:w-[450px] flex flex-col border-r border-white/10 shrink-0 bg-slate-900/50">
        <div className="p-6 border-b border-white/10 bg-black/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">Public Presence</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Global Profile Engine</p>
            </div>
          </div>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Identity</h4>
              <span className="text-[10px] font-black text-indigo-500 uppercase">{songs.length} Tracks Live</span>
            </div>
            
            <div className="flex flex-col items-center gap-6 p-6 bg-white/5 rounded-[2rem] border border-white/5">
              <div className="w-28 h-28 rounded-full border-4 flex items-center justify-center overflow-hidden bg-slate-800 shadow-2xl" style={{ borderColor: profile?.custom_colors?.primary || DEFAULT_COLORS.primary }}>
                <User className="w-12 h-12 text-slate-700" />
              </div>

              <div className="w-full space-y-4">
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-slate-500 uppercase">First Name</Label>
                    <Input 
                      defaultValue={profile?.first_name}
                      onBlur={(e) => saveToDatabase({ first_name: e.target.value })}
                      onChange={(e) => handleUpdateLocal({ first_name: e.target.value })}
                      className="h-9 text-xs bg-black/20 border-white/10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold text-slate-500 uppercase">Last Name</Label>
                    <Input 
                      defaultValue={profile?.last_name}
                      onBlur={(e) => saveToDatabase({ last_name: e.target.value })}
                      onChange={(e) => handleUpdateLocal({ last_name: e.target.value })}
                      className="h-9 text-xs bg-black/20 border-white/10"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between p-5 bg-white/5 rounded-[2rem] border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/10 rounded-xl">
                  <Globe className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold">Public Status</p>
                  <p className="text-[9px] text-slate-500 font-black uppercase">Clients can view list</p>
                </div>
              </div>
              <Switch 
                checked={profile?.is_repertoire_public} 
                className="data-[state=checked]:bg-indigo-600 border border-white/10"
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
              <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <Check className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-tight">Sync Engine Online</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Automated Background Updates Active</p>
                  </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="space-y-2 px-1">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Visibility Threshold</Label>
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
                          : "bg-white/5 border-white/5 text-slate-500 hover:text-white"
                      )}
                    >
                      {val === 0 ? 'ALL' : `>${val}%`}
                    </Button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-500 font-bold uppercase mt-2 px-1">
                  Only showing {thresholdFilteredSongs.length} of {songs.length} songs based on readiness.
                </p>
              </div>

              <div className="space-y-2 px-1 pt-4">
                <Label className="text-[9px] font-bold text-slate-500 uppercase">Unique Repertoire Slug</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">/repertoire/</span>
                    <Input 
                      placeholder="heroes-duo" 
                      defaultValue={profile?.repertoire_slug}
                      onBlur={(e) => {
                        const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                        saveToDatabase({ repertoire_slug: slug });
                      }}
                      onChange={(e) => handleUpdateLocal({ repertoire_slug: e.target.value })}
                      className="h-10 pl-24 text-xs bg-white/5 border-white/10 font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 px-1">
                <Label className="text-[9px] font-bold text-slate-500 uppercase">Repertoire Bio / Mission</Label>
                <Textarea 
                  defaultValue={profile?.repertoire_bio}
                  onBlur={(e) => saveToDatabase({ repertoire_bio: e.target.value })}
                  onChange={(e) => handleUpdateLocal({ repertoire_bio: e.target.value })}
                  className="bg-white/5 border-white/10 min-h-[100px] text-xs resize-none rounded-xl"
                  placeholder="Tell clients about your vibe..."
                />
              </div>
            </div>
          </section>

          <section className="space-y-6 pt-4 border-t border-white/10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Branding & Style</h4>
            
            <div className="grid grid-cols-2 gap-3">
              {THEMES.map(theme => (
                <Button 
                  key={theme.name}
                  variant="ghost" 
                  onClick={() => {
                    const colors = { primary: theme.primary, background: theme.background, text: theme.text, border: theme.border };
                    handleUpdateLocal({ custom_colors: colors });
                    saveToDatabase({ custom_colors: colors });
                  }}
                  className="h-14 bg-white/5 border border-white/5 hover:border-indigo-500/50 justify-start px-4 rounded-xl gap-3 group transition-all"
                >
                  <div className="w-4 h-4 rounded-full border border-white/10" style={{ background: theme.primary }} />
                  <span className="text-[10px] font-bold uppercase tracking-tight">{theme.name}</span>
                </Button>
              ))}
            </div>

            <div className="space-y-4 bg-white/5 p-6 rounded-[2rem] border border-white/5">
              {[
                { label: 'Primary Accent', key: 'primary' },
                { label: 'Background', key: 'background' },
                { label: 'Text Color', key: 'text' },
              ].map(color => (
                <div key={color.key} className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-slate-400">{color.label}</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg border-2 border-white/10 shadow-inner overflow-hidden relative">
                      <Input 
                        type="color" 
                        value={profile?.custom_colors?.[color.key] || DEFAULT_COLORS[color.key]} 
                        onChange={(e) => {
                          const newColors = { ...profile.custom_colors, [color.key]: e.target.value };
                          handleUpdateLocal({ custom_colors: newColors });
                        }}
                        onBlur={() => saveToDatabase({ custom_colors: profile.custom_colors })}
                        className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{profile?.custom_colors?.[color.key]}</span>
                  </div>
                </div>
              ))}
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  handleUpdateLocal({ custom_colors: DEFAULT_COLORS });
                  saveToDatabase({ custom_colors: DEFAULT_COLORS });
                }}
                className="w-full mt-2 text-[9px] font-black uppercase text-slate-500 hover:text-white gap-2"
              >
                <RotateCcw className="w-3 h-3" /> Reset to Defaults
              </Button>
            </div>
          </section>
        </div>
      </div>

      <div className="flex-1 bg-slate-950 flex flex-col p-10 relative overflow-hidden">
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] blur-[150px] opacity-20 pointer-events-none rounded-full"
          style={{ background: profile?.custom_colors?.primary || DEFAULT_COLORS.primary }}
        />

        <div className="relative z-10 h-full flex flex-col gap-6">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Live Studio Preview</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Real-time Rendering Engine Active</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-4 shadow-xl">
                 <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">{publicUrl}</span>
                 <Button onClick={copyLink} size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 px-4 text-[10px] font-black uppercase rounded-lg">
                   <Copy className="w-3.5 h-3.5 mr-2" /> Copy Link
                 </Button>
              </div>
              <a 
                href={publicUrl} 
                target="_child" 
                className="h-10 w-10 bg-white/5 border border-white/10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="flex-1 bg-slate-900 rounded-[2.5rem] border-4 border-white/10 shadow-2xl overflow-hidden relative">
            {profile?.is_repertoire_public ? (
              <PublicRepertoireView profile={profile} songs={thresholdFilteredSongs} isPreview />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md text-center p-12">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <Globe className="w-10 h-10 text-slate-700" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-3">Preview Offline</h2>
                <p className="text-slate-500 max-w-sm font-medium">Your repertoire is currently private. Toggle the Public Status switch to enable the live link and see the preview.</p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    handleUpdateLocal({ is_repertoire_public: true });
                    saveToDatabase({ is_repertoire_public: true });
                  }}
                  className="mt-8 border-indigo-500/50 text-indigo-400 font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-2xl"
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
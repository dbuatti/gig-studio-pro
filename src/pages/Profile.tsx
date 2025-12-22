"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { Camera, Copy, ExternalLink, Globe, Palette, User, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [songCount, setSongCount] = useState(0);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data: profileData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (pError) throw pError;
      setProfile(profileData);

      const { count, error: cError } = await supabase
        .from('repertoire')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      if (cError) throw cError;
      setSongCount(count || 0);
    } catch (err) {
      showError("Failed to load profile settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updates: any) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user?.id);

      if (error) throw error;
      setProfile({ ...profile, ...updates });
      showSuccess("Settings updated");
    } catch (err: any) {
      showError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      showError("Photo must be less than 5MB");
      return;
    }

    setSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('audio_tracks') // Using existing bucket for simplicity, usually separate
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('audio_tracks')
        .getPublicUrl(filePath);

      await handleSave({ avatar_url: publicUrl });
    } catch (err) {
      showError("Photo upload failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  const publicUrl = `${window.location.origin}/repertoire/${profile?.repertoire_slug || 'your-link'}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Public Presence</h1>
            <p className="text-slate-500 font-medium">Configure how clients see your repertoire.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="md:col-span-1 bg-slate-900 border-white/5 text-white overflow-hidden rounded-[2rem]">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-indigo-400">Identity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              <div className="relative group">
                <div 
                  className="w-40 h-40 rounded-full border-4 border-indigo-600 bg-slate-800 flex items-center justify-center overflow-hidden"
                  style={{ borderColor: profile?.custom_colors?.primary || '#4f46e5' }}
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-16 h-16 text-slate-700" />
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                  <Camera className="w-8 h-8 text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                </label>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold">{profile?.first_name} {profile?.last_name}</h3>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mt-1">{songCount} Songs in Library</p>
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-8">
            <Card className="bg-slate-900 border-white/5 text-white rounded-[2rem]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                      <Globe className="w-5 h-5 text-indigo-400" /> Public Repertoire
                    </CardTitle>
                    <CardDescription className="text-slate-500">Make your set list shareable with a unique link.</CardDescription>
                  </div>
                  <Switch 
                    checked={profile?.is_repertoire_public} 
                    onCheckedChange={(checked) => {
                      if (checked && songCount < 1) {
                        showError("Add some songs to your repertoire before making it public.");
                        return;
                      }
                      handleSave({ is_repertoire_public: checked });
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Unique URL Slug</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g. heroes-duo" 
                      defaultValue={profile?.repertoire_slug}
                      onBlur={(e) => handleSave({ repertoire_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                      className="bg-white/5 border-white/10 font-bold"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(publicUrl);
                        showSuccess("Link copied!");
                      }}
                      className="border-white/10"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  {profile?.is_repertoire_public && (
                    <a href={`/repertoire/${profile.repertoire_slug}`} target="_blank" className="text-[10px] text-indigo-400 font-bold flex items-center gap-1 hover:underline">
                      View Live Page <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Page Bio / Subtitle</Label>
                  <Textarea 
                    defaultValue={profile?.repertoire_bio}
                    onBlur={(e) => handleSave({ repertoire_bio: e.target.value })}
                    className="bg-white/5 border-white/10 min-h-[100px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-white/5 text-white rounded-[2rem]">
              <CardHeader>
                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Palette className="w-5 h-5 text-indigo-400" /> Branding & Style
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Primary Color</Label>
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-lg border border-white/10 shrink-0" style={{ backgroundColor: profile?.custom_colors?.primary }} />
                      <Input 
                        type="color" 
                        value={profile?.custom_colors?.primary} 
                        onChange={(e) => setProfile({...profile, custom_colors: {...profile.custom_colors, primary: e.target.value}})}
                        onBlur={() => handleSave({ custom_colors: profile.custom_colors })}
                        className="h-10 bg-transparent border-none p-0 w-full"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Background Color</Label>
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-lg border border-white/10 shrink-0" style={{ backgroundColor: profile?.custom_colors?.background }} />
                      <Input 
                        type="color" 
                        value={profile?.custom_colors?.background} 
                        onChange={(e) => setProfile({...profile, custom_colors: {...profile.custom_colors, background: e.target.value}})}
                        onBlur={() => handleSave({ custom_colors: profile.custom_colors })}
                        className="h-10 bg-transparent border-none p-0 w-full"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
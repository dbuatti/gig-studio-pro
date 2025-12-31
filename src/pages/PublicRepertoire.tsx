"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, UserCircle2 } from 'lucide-react';
import PublicRepertoireView from '@/components/PublicRepertoireView';
import { useTheme } from '@/hooks/use-theme';

const PublicRepertoire = () => {
  const { slug } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  const fetchPublicData = useCallback(async () => {
    try {
      const { data: profileData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('repertoire_slug', slug)
        .eq('is_repertoire_public', true)
        .single();

      if (pError) throw pError;
      setProfile(profileData);

      const threshold = profileData.repertoire_threshold || 0;

      const { data: songData, error: sError } = await supabase
        .from('repertoire')
        .select('*, extraction_status, last_sync_log')
        .eq('user_id', profileData.id)
        .eq('is_active', true)
        .gte('readiness_score', threshold);

      if (sError) throw sError;
      setSongs(songData || []);
    } catch (err) {
      // console.error("Public Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) {
      fetchPublicData();

      const profileChannel = supabase
        .channel('public_profile_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `repertoire_slug=eq.${slug}` },
          () => fetchPublicData()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'repertoire' },
          () => fetchPublicData()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(profileChannel);
      };
    }
  }, [slug, fetchPublicData]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-8 text-center">
      <div className="bg-card p-12 rounded-[3rem] border border-border space-y-6">
        <UserCircle2 className="w-24 h-24 text-muted-foreground mx-auto" />
        <h1 className="text-4xl font-black uppercase tracking-tight">Studio Link Offline</h1>
        <p className="text-muted-foreground font-medium">This repertoire is currently private or does not exist.</p>
        <Button onClick={() => window.location.href = '/'} className="bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-widest px-8">Return to Gig Studio</Button>
      </div>
    </div>
  );

  return <PublicRepertoireView profile={profile} songs={songs} />;
};

export default PublicRepertoire;
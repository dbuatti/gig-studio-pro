"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, UserCircle2 } from 'lucide-react';
import PublicRepertoireView from '@/components/PublicRepertoireView';

const PublicRepertoire = () => {
  const { slug } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) fetchPublicData();
  }, [slug]);

  const fetchPublicData = async () => {
    try {
      const { data: profileData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('repertoire_slug', slug)
        .eq('is_repertoire_public', true)
        .single();

      if (pError) throw pError;
      setProfile(profileData);

      const { data: songData, error: sError } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', profileData.id)
        .eq('is_active', true);

      if (sError) throw sError;
      setSongs(songData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-8 text-center">
      <div className="bg-slate-900 p-12 rounded-[3rem] border border-white/5 space-y-6">
        <UserCircle2 className="w-24 h-24 text-slate-700 mx-auto" />
        <h1 className="text-4xl font-black uppercase tracking-tight">Studio Link Expired</h1>
        <p className="text-slate-500 max-w-sm">This repertoire is currently private or does not exist.</p>
        <Button onClick={() => window.location.href = '/'} className="bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-widest px-8">Return to Gig Studio</Button>
      </div>
    </div>
  );

  return <PublicRepertoireView profile={profile} songs={songs} />;
};

export default PublicRepertoire;
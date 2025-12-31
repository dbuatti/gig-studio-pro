"use client";

import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo import
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Music2, MapPin, Calendar, ArrowLeft, User, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetlistSong } from '@/components/SetlistManager';
import { cn } from '@/lib/utils';
import { MadeWithDyad } from '@/components/made-with-dyad';

// NEW: Define THEMES here or import from a shared constants file
const THEMES = [
  { name: 'Vibrant Light', primary: '#9333ea', background: '#ffffff', text: '#1e1b4b', border: '#9333ea' },
  { name: 'Dark Pro', primary: '#4f46e5', background: '#020617', text: '#ffffff', border: '#4f46e5' },
  { name: 'Classic Black', primary: '#000000', background: '#000000', text: '#ffffff', border: '#ffffff' },
  { name: 'Purple Energy', primary: '#c084fc', background: '#2e1065', text: '#f5f3ff', border: '#c084fc' },
];

const PublicGigView = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gigSession, setGigSession] = useState<any>(null);
  const [setlist, setSetlist] = useState<any>(null);
  const [performer, setPerformer] = useState<any>(null);

  useEffect(() => {
    const fetchGigData = async () => {
      if (!code) return;
      try {
        // 1. Fetch Gig Session
        const { data: sessionData, error: sessionError } = await supabase
          .from('gig_sessions')
          .select('*')
          .eq('access_code', code.toUpperCase())
          .eq('is_active', true)
          .single();

        if (sessionError || !sessionData) throw new Error("Invalid Code");
        setGigSession(sessionData);

        // 2. Fetch Setlist and Profile (Policies allow this read via the session)
        const { data: setlistData, error: setlistError } = await supabase
          .from('setlists')
          .select('*')
          .eq('id', sessionData.setlist_id)
          .single();

        if (setlistError) throw setlistError;
        setSetlist(setlistData);

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionData.user_id)
          .single();
        
        setPerformer(profileData);

      } catch (err) {
        // console.error("Gig Fetch Error:", err); // Removed console.error
      } finally {
        setLoading(false);
      }
    };

    fetchGigData();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!gigSession || !setlist) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-card p-12 rounded-[3rem] border border-border space-y-6 max-w-md">
          <div className="bg-destructive/10 w-16 h-16 rounded-2xl flex items-center justify-center text-destructive mx-auto">
            <Calendar className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Code Expired</h1>
          <p className="text-muted-foreground font-medium">This gig code is no longer active or was entered incorrectly.</p>
          <Button onClick={() => navigate('/gig')} className="w-full bg-indigo-600 h-14 rounded-2xl font-black uppercase tracking-widest">Try Another Code</Button>
        </div>
      </div>
    );
  }

  const songs = (setlist.songs as SetlistSong[]) || [];
  
  // NEW: Derive colors based on custom_theme or fallback to dynamic CSS variables
  const colors = useMemo(() => {
    if (performer?.custom_theme) {
      const preset = THEMES.find(t => t.name === performer.custom_theme);
      if (preset) return preset;
    }
    // Fallback to dynamic CSS variables if no custom theme or preset found
    return {
      primary: 'hsl(var(--primary))',
      background: 'hsl(var(--background))',
      text: 'hsl(var(--foreground))',
      border: 'hsl(var(--border))',
    };
  }, [performer?.custom_theme]);

  return (
    <div 
      className="min-h-screen font-sans selection:bg-indigo-500/30 flex flex-col"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      <header className="px-6 py-12 md:py-20 text-center relative overflow-hidden border-b border-border">
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] blur-[120px] opacity-20 pointer-events-none rounded-full"
          style={{ background: colors.primary }}
        />
        
        <div className="max-w-4xl mx-auto relative z-10 space-y-8">
          <div className="flex flex-col items-center gap-6">
            <div 
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 flex items-center justify-center overflow-hidden bg-secondary shadow-2xl"
              style={{ borderColor: colors.border }}
            >
              {performer?.avatar_url ? (
                <img src={performer.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">
                {performer?.first_name} {performer?.last_name || 'Live'}
              </h1>
              <div className="flex items-center justify-center gap-3">
                <span 
                  className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-border"
                  style={{ backgroundColor: `${colors.primary}20`, color: colors.primary }}
                >
                  Code: {code}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-card/20 backdrop-blur-md rounded-[2.5rem] p-6 md:p-8 border border-border inline-flex flex-col items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">{setlist.name}</h2>
            <p className="text-sm font-medium opacity-60">Tonight's Official Set Selection</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 md:py-16">
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Running Order</h3>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{songs.length} Tracks</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {songs.map((song, idx) => (
              <div 
                key={song.id}
                className="group relative p-6 rounded-[1.5rem] bg-card/5 border border-border hover:bg-card/10 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-5 min-w-0">
                  <span className="text-lg font-mono font-black opacity-20 w-8">
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-lg font-black uppercase tracking-tight truncate leading-tight group-hover:translate-x-1 transition-transform">
                      {song.name}
                    </h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">
                      {song.artist || "Standard"}
                    </p>
                  </div>
                </div>
                
                {song.genre && (
                  <span 
                    className="hidden sm:inline-block text-[8px] font-black uppercase px-2 py-1 rounded-md border border-border"
                    style={{ color: colors.primary, borderColor: `${colors.primary}20` }}
                  >
                    {song.genre}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-12 border-t border-border mt-auto">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-2">
            <Waves className="w-5 h-5" style={{ color: colors.primary }} />
            <span className="font-black uppercase tracking-tighter">Gig Studio Pro</span>
          </div>
          <MadeWithDyad />
        </div>
      </footer>
    </div>
  );
};

export default PublicGigView;
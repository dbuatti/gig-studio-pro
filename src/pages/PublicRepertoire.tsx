"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, Loader2, Music, ListMusic, UserCircle2, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const PublicRepertoire = () => {
  const { slug } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<'artist' | 'alphabetical'>('artist');

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

  const filteredSongs = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return songs.filter(s => 
      s.title.toLowerCase().includes(q) || 
      s.artist.toLowerCase().includes(q)
    );
  }, [songs, searchTerm]);

  const groupedSongs = useMemo(() => {
    if (sortMode === 'alphabetical') {
      return [...filteredSongs].sort((a, b) => {
        const titleA = a.title.replace(/^(the |a |an )/i, '');
        const titleB = b.title.replace(/^(the |a |an )/i, '');
        return titleA.localeCompare(titleB);
      });
    }

    const groups: Record<string, any[]> = {};
    filteredSongs.forEach(s => {
      const artist = s.artist || 'Unknown Artist';
      if (!groups[artist]) groups[artist] = [];
      groups[artist].push(s);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([artist, artistSongs]) => ({
        artist,
        songs: artistSongs.sort((a, b) => a.title.localeCompare(b.title))
      }));
  }, [filteredSongs, sortMode]);

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

  const colors = profile.custom_colors || { primary: '#4f46e5', background: '#020617', text: '#ffffff', border: '#4f46e5' };

  return (
    <div className="min-h-screen font-sans selection:bg-indigo-500/30" style={{ backgroundColor: colors.background, color: colors.text }}>
      <header className="py-20 px-4 text-center border-b border-white/5 bg-gradient-to-b from-black/20 to-transparent">
        <div className="max-w-4xl mx-auto space-y-8">
          <div 
            className="w-32 h-32 md:w-40 md:h-40 rounded-full mx-auto border-4 bg-slate-800 flex items-center justify-center overflow-hidden shadow-2xl"
            style={{ borderColor: colors.border }}
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.first_name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-16 h-16 text-slate-700" />
            )}
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter" style={{ color: colors.text }}>
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-xl md:text-2xl font-medium opacity-60 tracking-tight max-w-2xl mx-auto">
              {profile.repertoire_bio}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-12 px-6 pb-32">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            <Input 
              placeholder="Search Repertoire..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border-white/10 h-12 pl-12 rounded-2xl focus-visible:ring-indigo-500 text-base"
              style={{ color: colors.text }}
            />
          </div>
          
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 w-full md:w-auto">
            <Button 
              variant="ghost" 
              onClick={() => setSortMode('artist')}
              className={cn(
                "flex-1 md:flex-none h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 transition-all",
                sortMode === 'artist' ? "bg-white/10 shadow-lg" : "opacity-40"
              )}
              style={{ color: sortMode === 'artist' ? colors.primary : colors.text }}
            >
              <User className="w-3.5 h-3.5" /> By Artist
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setSortMode('alphabetical')}
              className={cn(
                "flex-1 md:flex-none h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 transition-all",
                sortMode === 'alphabetical' ? "bg-white/10 shadow-lg" : "opacity-40"
              )}
              style={{ color: sortMode === 'alphabetical' ? colors.primary : colors.text }}
            >
              <ArrowUpDown className="w-3.5 h-3.5" /> A-Z Songs
            </Button>
          </div>
        </div>

        <div className="space-y-12">
          {sortMode === 'artist' ? (
            (groupedSongs as any[]).map((group) => (
              <section key={group.artist} className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 border-b border-white/5 pb-2" style={{ color: colors.primary }}>
                  {group.artist}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                  {group.songs.map((song: any) => (
                    <div key={song.id} className="flex items-center justify-between py-1 group">
                      <span className="text-lg font-bold tracking-tight group-hover:translate-x-1 transition-transform">{song.title}</span>
                      {song.genre && <span className="text-[10px] font-black uppercase opacity-20">{song.genre}</span>}
                    </div>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              {(groupedSongs as any[]).map((song) => (
                <div key={song.id} className="flex items-center justify-between py-2 border-b border-white/5 group">
                  <div className="flex flex-col">
                    <span className="text-lg font-bold tracking-tight">{song.title}</span>
                    <span className="text-xs font-black uppercase opacity-40 tracking-widest">{song.artist}</span>
                  </div>
                  {song.genre && <span className="text-[10px] font-black uppercase opacity-20">{song.genre}</span>}
                </div>
              ))}
            </div>
          )}

          {filteredSongs.length === 0 && (
            <div className="text-center py-20 opacity-30">
              <Music className="w-16 h-16 mx-auto mb-4" />
              <p className="text-sm font-black uppercase tracking-widest">No matching tracks found</p>
            </div>
          )}
        </div>
      </main>

      <footer className="py-12 border-t border-white/5 text-center opacity-40">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] font-black uppercase tracking-widest">Powered by GigStudio Pro</p>
          <div className="flex items-center gap-4 text-xs font-medium">
             <a href="/" className="hover:text-indigo-400">Launch Your Studio</a>
             <div className="w-1 h-1 bg-slate-700 rounded-full" />
             <a href="https://dyad.sh" target="_blank" className="hover:text-indigo-400">Built with Dyad</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicRepertoire;
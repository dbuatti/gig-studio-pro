"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Activity, Check, Sparkles, 
  Loader2, ShieldCheck, Maximize2, 
  ChevronLeft, ChevronRight, AlertCircle 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { SetlistSong } from '@/components/SetlistManager';
import { syncToMasterRepertoire, calculateReadiness } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { showSuccess, showError } from '@/utils/toast';
import StudioTabContent from '@/components/StudioTabContent';
import SongConfigTab from '@/components/SongConfigTab';
import ProSyncSearch from '@/components/ProSyncSearch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useKeyboardNavigation } from '@/hooks/use-keyboard-navigation';

type StudioTab = 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library';

interface SongStudioViewProps {
  gigId: string | 'library';
  songId: string;
  onClose: () => void;
  isModal?: boolean;
  onExpand?: () => void;
  visibleSongs?: SetlistSong[];
  onSelectSong?: (id: string) => void;
}

const SongStudioView: React.FC<SongStudioViewProps> = ({ 
  gigId, songId, onClose, isModal, onExpand, visibleSongs = [], onSelectSong 
}) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const audio = useToneAudio();
  const [song, setSong] = useState<SetlistSong | null>(null);
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<StudioTab>('audio');
  const [loading, setLoading] = useState(true);
  const [isProSyncSearchOpen, setIsProSyncSearchOpen] = useState(false);
  const [isProSyncing, setIsProSyncing] = useState(false);
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const fetchData = async () => {
    if (!user || !songId) return;
    setLoading(true);
    try {
      let targetSong: SetlistSong | undefined;
      
      if (gigId === 'library') {
        const { data } = await supabase.from('repertoire').select('*').eq('id', songId).single();
        if (data) targetSong = {
          id: data.id, name: data.title, artist: data.artist, previewUrl: data.preview_url,
          youtubeUrl: data.youtube_url, originalKey: data.original_key, targetKey: data.target_key,
          pitch: data.pitch, bpm: data.bpm, lyrics: data.lyrics, notes: data.notes, 
          is_pitch_linked: data.is_pitch_linked, isApproved: data.is_approved
        } as SetlistSong;
      } else {
        const { data } = await supabase.from('setlists').select('songs').eq('id', gigId).single();
        targetSong = (data?.songs as SetlistSong[])?.find(s => s.id === songId);
      }

      if (!targetSong) throw new Error("Song not found");

      setSong(targetSong);
      setFormData({ ...targetSong, is_pitch_linked: targetSong.is_pitch_linked ?? true });
      if (targetSong.previewUrl) await audio.loadFromUrl(targetSong.previewUrl, targetSong.pitch || 0);
    } catch (err) {
      showError("Studio failed to initialize.");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); return () => audio.stopPlayback(); }, [songId, gigId]);

  const handleAutoSave = useCallback(async (updates: Partial<SetlistSong>) => {
    if (!song) return;
    setFormData(prev => {
      const next = { ...prev, ...updates };
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const updatedSong = { ...song, ...next };
          if (user) await syncToMasterRepertoire(user.id, [updatedSong]);
          if (gigId !== 'library') {
            const { data } = await supabase.from('setlists').select('songs').eq('id', gigId).single();
            const songs = (data?.songs as SetlistSong[]) || [];
            await supabase.from('setlists').update({ songs: songs.map(s => s.id === song.id ? updatedSong : s) }).eq('id', gigId);
          }
        } catch (err) {}
      }, 1000);
      return next;
    });
  }, [song, gigId, user]);

  useKeyboardNavigation({
    onNext: () => visibleSongs.length > 1 && onSelectSong?.(visibleSongs[(visibleSongs.findIndex(s => s.id === songId) + 1) % visibleSongs.length].id),
    onPrev: () => visibleSongs.length > 1 && onSelectSong?.(visibleSongs[(visibleSongs.findIndex(s => s.id === songId) - 1 + visibleSongs.length) % visibleSongs.length].id),
    onClose, onPlayPause: audio.togglePlayback, disabled: loading || isProSyncSearchOpen
  });

  if (loading) return <div className="h-full flex flex-col items-center justify-center bg-slate-950"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;

  const readiness = calculateReadiness(formData);

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden relative">
      <header className="h-20 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-white/10 p-0"><ArrowLeft className="w-5 h-5 text-slate-400" /></Button>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">{gigId === 'library' ? 'MASTER LIBRARY' : 'ACTIVE GIG'}</p>
            <h2 className="text-xl font-black uppercase text-white truncate max-w-[250px]">{formData.name}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
            <ShieldCheck className={cn("w-3.5 h-3.5", readiness === 100 ? "text-emerald-500" : "text-indigo-400")} />
            <span className="text-[10px] font-black font-mono text-white">{readiness}% READY</span>
          </div>
          <Button onClick={() => setIsProSyncSearchOpen(true)} className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black uppercase text-[9px] tracking-widest gap-2 px-4 shadow-lg">
            <Sparkles className="w-3.5 h-3.5" /> PRO SYNC
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!isMobile && !isModal && (
          <aside className="w-96 bg-slate-900/50 border-r border-white/5 overflow-y-auto custom-scrollbar">
            <SongConfigTab song={song} formData={formData} handleAutoSave={handleAutoSave} onUpdateKey={(id, k) => handleAutoSave({ targetKey: k })} setPitch={audio.setPitch} setTempo={audio.setTempo} setVolume={audio.setVolume} setFineTune={audio.setFineTune} currentBuffer={audio.currentBuffer} isPlaying={audio.isPlaying} progress={audio.progress} duration={audio.duration} togglePlayback={audio.togglePlayback} stopPlayback={audio.stopPlayback} isMobile={false} />
          </aside>
        )}

        <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          <nav className="h-16 bg-black/20 border-b border-white/5 flex items-center px-6 overflow-x-auto no-scrollbar shrink-0">
            <div className="flex gap-8">
              {['audio', 'details', 'charts', 'lyrics', 'visual', 'library'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab as any)} className={cn("text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-4 h-16 flex items-center", activeTab === tab ? "text-indigo-400 border-indigo-50" : "text-slate-500 border-transparent hover:text-white")}>
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
          </nav>

          <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar">
            <StudioTabContent activeTab={activeTab} song={song} formData={formData} handleAutoSave={handleAutoSave} onUpdateKey={(id, k) => handleAutoSave({ targetKey: k })} audioEngine={audio} isMobile={isMobile} onLoadAudioFromUrl={audio.loadFromUrl} setPreviewPdfUrl={() => {}} isFramable={() => true} activeChartType={activeChartType} setActiveChartType={setActiveChartType} handleUgPrint={() => {}} handleDownloadAll={async () => {}} onSwitchTab={setActiveTab} />
          </div>
        </div>
      </div>

      <ProSyncSearch isOpen={isProSyncSearchOpen} onClose={() => setIsProSyncSearchOpen(false)} onSelect={(d) => handleAutoSave({ name: d.trackName, artist: d.artistName, isMetadataConfirmed: true })} initialQuery={`${formData.artist} ${formData.name}`} />
    </div>
  );
};

export default SongStudioView;
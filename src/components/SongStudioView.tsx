"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Activity, Check, Sparkles, 
  Loader2, ShieldCheck, Maximize2, 
  ChevronLeft, ChevronRight, AlertCircle, 
  ShieldAlert,
  ClipboardCheck,
  CheckCircle2,
  Music
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');
  const [isVerifying, setIsVerifying] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const fetchData = async () => {
    if (!user || !songId) return;
    setLoading(true);
    try {
      let targetSong: SetlistSong | undefined;
      
      if (gigId === 'library') {
        const { data } = await supabase.from('repertoire').select('*').eq('id', songId).single();
        if (data) targetSong = {
          id: data.id, master_id: data.id, name: data.title, artist: data.artist, previewUrl: data.preview_url,
          youtubeUrl: data.youtube_url, originalKey: data.original_key, targetKey: data.target_key,
          pitch: data.pitch, bpm: data.bpm, lyrics: data.lyrics, notes: data.notes, 
          is_pitch_linked: data.is_pitch_linked, isApproved: data.is_approved,
          isMetadataConfirmed: data.is_metadata_confirmed, ug_chords_text: data.ug_chords_text,
          ug_chords_config: data.ug_chords_config, user_tags: data.user_tags, resources: data.resources,
          pdf_url: data.pdf_url, leadsheet_url: data.leadsheet_url, apple_music_url: data.apple_music_url,
          duration_seconds: data.duration_seconds, genre: data.genre
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

  const handleVerifyMetadata = async () => {
    if (!formData.name || !formData.artist) {
      showError("Please enter song title and artist first.");
      return;
    }

    setIsVerifying(true);
    try {
      const query = encodeURIComponent(`${formData.artist} ${formData.name}`);
      const response = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const track = data.results[0];
        
        // Extract duration in seconds
        const durationSeconds = track.trackTimeMillis ? Math.floor(track.trackTimeMillis / 1000) : 0;
        
        // Prepare updates
        const updates: Partial<SetlistSong> = {
          name: track.trackName,
          artist: track.artistName,
          genre: track.primaryGenreName,
          appleMusicUrl: track.trackViewUrl,
          duration_seconds: durationSeconds,
          isMetadataConfirmed: true
        };

        // Calculate BPM from duration if available
        if (durationSeconds > 0) {
          // Simple heuristic: assume 4/4 time signature and count beats
          // This is a rough estimate based on common song structures
          const estimatedBPM = Math.round((durationSeconds / 60) * 2); // Rough estimate
          if (!formData.bpm) {
            updates.bpm = estimatedBPM.toString();
          }
        }

        // Apply updates
        handleAutoSave(updates);
        showSuccess(`Imported metadata: ${track.trackName} - ${track.artistName}`);
      } else {
        showError("No iTunes match found. Try manual search.");
        window.open(`https://music.apple.com/us/search?term=${query}`, '_blank');
      }
    } catch (err) {
      showError("Failed to fetch iTunes data. Opening manual search.");
      window.open(`https://music.apple.com/us/search?term=${encodeURIComponent(`${formData.artist} ${formData.name}`)}`, '_blank');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmForSetlist = (checked: boolean) => {
    handleAutoSave({ isApproved: checked });
    showSuccess(checked ? "Confirmed for Active Gig" : "Removed from Confirmed Status");
  };

  useKeyboardNavigation({
    onNext: () => visibleSongs.length > 1 && onSelectSong?.(visibleSongs[(visibleSongs.findIndex(s => s.id === songId) + 1) % visibleSongs.length].id),
    onPrev: () => visibleSongs.length > 1 && onSelectSong?.(visibleSongs[(visibleSongs.findIndex(s => s.id === songId) - 1 + visibleSongs.length) % visibleSongs.length].id),
    onClose, 
    onPlayPause: audio.togglePlayback, 
    onFullscreen: onExpand,
    disabled: loading || isProSyncSearchOpen
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

        <div className="flex items-center gap-6">
          {/* Readiness HUD */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-black/40 rounded-2xl border border-white/10">
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Readiness Level</span>
              <span className={cn("text-xs font-mono font-black", readiness === 100 ? "text-emerald-400" : "text-indigo-400")}>{readiness}%</span>
            </div>
            <div className="w-12">
               <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                 <div className={cn("h-full transition-all duration-1000", readiness === 100 ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${readiness}%` }} />
               </div>
            </div>
          </div>

          <div className="h-8 w-px bg-white/5 hidden md:block" />

          <div className="flex items-center gap-4">
            {/* Step 1: Metadata Verification */}
            <Button 
              onClick={handleVerifyMetadata}
              disabled={isVerifying}
              className={cn(
                "h-11 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 px-6 transition-all shadow-lg",
                formData.isMetadataConfirmed 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20" 
                  : "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10"
              )}
            >
              {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
              {isVerifying ? "VERIFYING..." : "VERIFY METADATA"}
            </Button>

            {/* Step 2: Setlist Confirmation Toggle */}
            <div className="flex items-center gap-3 bg-white/5 px-4 h-11 rounded-xl border border-white/10">
              <div className="flex flex-col items-end">
                <Label htmlFor="setlist-confirm" className="text-[8px] font-black text-slate-500 uppercase tracking-widest cursor-pointer">Confirm for Setlist</Label>
                {formData.isApproved && <span className="text-[7px] font-black text-emerald-500 uppercase">Gig Ready</span>}
              </div>
              <Switch 
                id="setlist-confirm"
                checked={formData.isApproved || false}
                onCheckedChange={handleConfirmForSetlist}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>
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

      <ProSyncSearch isOpen={isProSyncSearchOpen} onClose={() => setIsProSyncSearchOpen(false)} onSelect={(d) => handleAutoSave({ name: d.trackName, artist: d.artistName })} initialQuery={`${formData.artist} ${formData.name}`} />
    </div>
  );
};

export default SongStudioView;
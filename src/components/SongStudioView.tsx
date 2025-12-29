"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Activity, Check, Sparkles, Loader2, ShieldCheck, Maximize2, ChevronLeft, ChevronRight, AlertCircle, ShieldAlert, ClipboardCheck, CheckCircle2, Music } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { SetlistSong } from '@/components/SetlistManager';
import { syncToMasterRepertoire, calculateReadiness } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import StudioTabContent from '@/components/StudioTabContent';
import ProSyncSearch from '@/components/ProSyncSearch';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useKeyboardNavigation } from '@/hooks/use-keyboard-navigation';
import SetlistMultiSelector from './SetlistMultiSelector';
import { useSettings } from '@/hooks/use-settings';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { extractKeyFromChords } from '@/utils/chordUtils';

type StudioTab = 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library';

interface SongStudioViewProps {
  gigId: string | 'library';
  songId: string;
  onClose: () => void;
  isModal?: boolean;
  onExpand?: () => void;
  visibleSongs?: SetlistSong[];
  onSelectSong?: (id: string) => void;
  allSetlists?: { id: string; name: string; songs: SetlistSong[] }[];
  masterRepertoire?: SetlistSong[];
  onUpdateSetlistSongs?: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
}

const SongStudioView: React.FC<SongStudioViewProps> = ({
  gigId,
  songId,
  onClose,
  isModal,
  onExpand,
  visibleSongs = [],
  onSelectSong,
  allSetlists = [],
  masterRepertoire = [],
  onUpdateSetlistSongs
}) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const audio = useToneAudio();
  
  const [song, setSong] = useState<SetlistSong | null>(null);
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<StudioTab>('audio');
  const [loading, setLoading] = useState(true);
  const [isProSyncSearchOpen, setIsProSyncSearchOpen] = useState(false);
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const performSave = async (currentUpdates: Partial<SetlistSong>) => {
    if (!song || !user) return;

    try {
      // Merge current state with the newest updates
      const updatedFullSong = { ...song, ...formData, ...currentUpdates };
      
      // 1. Sync to Master Repertoire
      const syncedSongs = await syncToMasterRepertoire(user.id, [updatedFullSong]);
      const syncedSong = syncedSongs[0];

      // CRITICAL: Update local state with the synced song (contains valid master_id)
      // This prevents subsequent saves from being treated as new records.
      setSong(syncedSong);
      setFormData(prev => ({ ...prev, ...currentUpdates, master_id: syncedSong.master_id }));
      
      // 2. Sync to Setlist (Gig) if applicable
      if (gigId !== 'library') {
        const { data: setlistData, error: fetchErr } = await supabase
          .from('setlists')
          .select('songs')
          .eq('id', gigId)
          .single();
        
        if (fetchErr) throw fetchErr;

        const setlistSongs = (setlistData?.songs as SetlistSong[]) || [];
        // Map back to the setlist array using local IDs
        const updatedList = setlistSongs.map(s => s.id === song.id ? syncedSong : s);
        
        await supabase
          .from('setlists')
          .update({ songs: updatedList })
          .eq('id', gigId);
      }

    } catch (err: any) {
      console.error("[SongStudioView] Auto-save engine failure:", err.message);
      showError("Sync failed: " + err.message);
    }
  };

  const handleAutoSave = useCallback((updates: Partial<SetlistSong>) => {
    // 1. Update UI state immediately for responsiveness
    setFormData(prev => ({ ...prev, ...updates }));

    // 2. Debounce the actual database push
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
      performSave(updates);
    }, 1000);
  }, [song, user, gigId, formData]);

  const {
    pitch,
    setPitch,
    targetKey,
    setTargetKey,
    isPitchLinked,
    setIsPitchLinked,
  } = useHarmonicSync({
    formData,
    handleAutoSave,
    globalKeyPreference
  });

  const fetchData = async () => {
    if (!user || !songId) return;
    
    setLoading(true);
    try {
      let targetSong: SetlistSong | undefined;
      
      if (gigId === 'library') {
        const { data, error } = await supabase.from('repertoire').select('*').eq('id', songId).single();
        if (error) throw error;
        
        if (data) {
          targetSong = {
            id: data.id,
            master_id: data.id,
            name: data.title,
            artist: data.artist,
            previewUrl: data.preview_url,
            youtubeUrl: data.youtube_url,
            originalKey: data.original_key,
            targetKey: data.target_key,
            pitch: data.pitch ?? 0,
            bpm: data.bpm,
            lyrics: data.lyrics,
            notes: data.notes,
            is_pitch_linked: data.is_pitch_linked ?? true,
            isApproved: data.is_approved,
            isMetadataConfirmed: data.is_metadata_confirmed,
            ug_chords_text: data.ug_chords_text,
            ug_chords_config: data.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
            user_tags: data.user_tags || [],
            resources: data.resources || [],
            pdfUrl: data.pdf_url,
            leadsheetUrl: data.leadsheet_url,
            apple_music_url: data.apple_music_url,
            duration_seconds: data.duration_seconds,
            genre: data.genre,
            is_ug_chords_present: data.is_ug_chords_present,
            is_ug_link_verified: data.is_ug_link_verified,
            sheet_music_url: data.sheet_music_url,
            is_sheet_verified: data.is_sheet_verified,
            ugUrl: data.ug_url,
            highest_note_original: data.highest_note_original,
          } as SetlistSong;
        }
      } else {
        const { data, error } = await supabase.from('setlists').select('songs').eq('id', gigId).single();
        if (error) throw error;
        targetSong = (data?.songs as SetlistSong[])?.find(s => s.id === songId);
      }
      
      if (!targetSong) throw new Error("Song not found.");
      
      setSong(targetSong);
      setFormData(targetSong);
      
      if (targetSong.previewUrl) {
        await audio.loadFromUrl(targetSong.previewUrl, targetSong.pitch ?? 0, true);
      } else {
        audio.stopPlayback();
      }
      
    } catch (err: any) {
      showError("Studio Error: " + err.message);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      audio.stopPlayback();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [songId, gigId]);

  const handleVerifyMetadata = async () => {
    if (!formData.name || !formData.artist) return showError("Title and Artist required.");
    setIsVerifying(true);
    try {
      const q = encodeURIComponent(`${formData.artist} ${formData.name}`);
      const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=1`);
      const data = await res.json();
      if (data.results?.[0]) {
        const t = data.results[0];
        handleAutoSave({
          name: t.trackName,
          artist: t.artistName,
          genre: t.primaryGenreName,
          appleMusicUrl: t.trackViewUrl,
          duration_seconds: Math.floor(t.trackTimeMillis / 1000),
          isMetadataConfirmed: true
        });
        showSuccess("Metadata verified.");
      } else showError("No match found.");
    } catch (err) { showError("Verification failed."); } finally { setIsVerifying(false); }
  };

  const handlePullKey = async () => {
    if (!formData.ug_chords_text) return showError("No chords available.");
    const key = extractKeyFromChords(formData.ug_chords_text);
    if (key) {
      handleAutoSave({ originalKey: key, targetKey: key, pitch: 0, isKeyConfirmed: true });
      showSuccess(`Key extracted: ${key}`);
    } else showError("Extraction failed.");
  };

  useKeyboardNavigation({
    onNext: () => visibleSongs.length > 1 && onSelectSong?.(visibleSongs[(visibleSongs.findIndex(s => s.id === songId) + 1) % visibleSongs.length].id),
    onPrev: () => visibleSongs.length > 1 && onSelectSong?.(visibleSongs[(visibleSongs.findIndex(s => s.id === songId) - 1 + visibleSongs.length) % visibleSongs.length].id),
    onClose,
    onPlayPause: audio.togglePlayback,
    disabled: loading || isProSyncSearchOpen
  });

  if (loading) return <div className="h-full flex flex-col items-center justify-center bg-slate-950"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden relative">
      <header className="h-20 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onClose} className="h-12 w-12 rounded-2xl bg-white/5"><ArrowLeft className="w-5 h-5 text-slate-400" /></Button>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{gigId === 'library' ? 'MASTER' : 'GIG'}</p>
            <h2 className="text-xl font-black uppercase text-white truncate max-w-[250px]">{formData.name}</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button onClick={handleVerifyMetadata} disabled={isVerifying || formData.isMetadataConfirmed} className={cn("h-11 px-6 rounded-xl font-black text-[9px] uppercase tracking-widest gap-2", formData.isMetadataConfirmed ? "bg-emerald-600" : "bg-white/5")}>
            {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} VERIFY METADATA
          </Button>
          <Button onClick={handlePullKey} disabled={!formData.ug_chords_text} className="h-11 px-6 bg-purple-600 rounded-xl font-black text-[9px] uppercase tracking-widest gap-2"><Sparkles className="w-4 h-4" /> PULL KEY</Button>
          
          {gigId === 'library' ? (
            <SetlistMultiSelector songMasterId={songId} allSetlists={allSetlists} songToAssign={song!} onUpdateSetlistSongs={onUpdateSetlistSongs!} />
          ) : (
            <div className="flex items-center gap-3 bg-white/5 px-4 h-11 rounded-xl border border-white/10">
              <Label className="text-[8px] font-black text-slate-500 uppercase">Confirm for Gig</Label>
              <Switch checked={formData.isApproved || false} onCheckedChange={(v) => handleAutoSave({ isApproved: v })} className="data-[state=checked]:bg-emerald-500" />
            </div>
          )}
        </div>
      </header>
      
      {(!formData.originalKey || formData.originalKey === 'TBC') && (
        <div className="bg-red-950/30 border-b border-red-900/50 p-3 flex items-center justify-center gap-3 shrink-0">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-xs font-bold uppercase text-red-400">CRITICAL: Original Key is missing. Transposition is relative to 'C'.</p>
        </div>
      )}
      
      <nav className="h-16 bg-black/20 border-b border-white/5 flex items-center px-6 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex gap-8">
          {['config', 'audio', 'details', 'charts', 'lyrics', 'visual', 'library'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={cn("text-[10px] font-black uppercase tracking-widest h-16 flex items-center border-b-4", activeTab === tab ? "text-indigo-400 border-indigo-50" : "text-slate-500 border-transparent")}>
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>
      
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <StudioTabContent
          activeTab={activeTab}
          song={song}
          formData={formData}
          handleAutoSave={handleAutoSave}
          onUpdateKey={setTargetKey}
          audioEngine={audio}
          isMobile={isMobile}
          onLoadAudioFromUrl={audio.loadFromUrl}
          setPreviewPdfUrl={() => {}}
          isFramable={() => true}
          activeChartType={activeChartType}
          setActiveChartType={setActiveChartType}
          handleUgPrint={() => {}}
          handleDownloadAll={async () => {}}
          onSwitchTab={setActiveTab}
          pitch={pitch}
          setPitch={(p) => { setPitch(p); audio.setPitch(p); }}
          targetKey={targetKey}
          setTargetKey={setTargetKey}
          isPitchLinked={isPitchLinked}
          setIsPitchLinked={(l) => { setIsPitchLinked(l); if (!l) audio.setPitch(0); }}
          setTempo={audio.setTempo}
          setVolume={audio.setVolume}
          setFineTune={audio.setFineTune}
          currentBuffer={audio.currentBuffer}
          isPlaying={audio.isPlaying}
          progress={audio.progress}
          duration={audio.duration}
          togglePlayback={audio.togglePlayback}
          stopPlayback={audio.stopPlayback}
          chordAutoScrollEnabled={chordAutoScrollEnabled}
          chordScrollSpeed={chordScrollSpeed}
        />
      </div>
    </div>
  );
};

export default SongStudioView;
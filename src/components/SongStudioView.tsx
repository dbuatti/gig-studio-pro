"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Sparkles, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { SetlistSong, Setlist } from '@/components/SetlistManager'; // Import Setlist
import { syncToMasterRepertoire } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { showSuccess, showError } from '@/utils/toast';
import StudioTabContent from '@/components/StudioTabContent';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useKeyboardNavigation } from '@/hooks/use-keyboard-navigation';
import SetlistMultiSelector from './SetlistMultiSelector';
import { useSettings } from '@/hooks/use-settings';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { extractKeyFromChords } from '@/utils/chordUtils';

export type StudioTab = 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library';

interface SongStudioViewProps {
  gigId: string | 'library';
  songId: string;
  onClose: () => void;
  isModal?: boolean;
  onExpand?: () => void;
  visibleSongs?: SetlistSong[];
  onSelectSong?: (id: string) => void;
  allSetlists?: Setlist[]; // Use Setlist interface
  masterRepertoire?: SetlistSong[];
  onUpdateSetlistSongs?: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  defaultTab?: StudioTab; // New prop for default active tab
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
  onUpdateSetlistSongs,
  defaultTab // Destructure new prop
}) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const audio = useToneAudio(true);
  
  const [song, setSong] = useState<SetlistSong | null>(null);
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<StudioTab>(defaultTab || 'audio'); // Use defaultTab here
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');
  
  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastPendingUpdatesRef = useRef<Partial<SetlistSong>>({});
  const currentSongRef = useRef<SetlistSong | null>(null);

  useEffect(() => {
    currentSongRef.current = song;
  }, [song]);

  const performSave = async (currentUpdates: Partial<SetlistSong>) => {
    const targetSong = currentSongRef.current;
    if (!targetSong || !user) {
      console.log("[SongStudioView] performSave: Skipping save, no target song or user.");
      return;
    }

    console.log("[SongStudioView] performSave: Initiating save for song:", targetSong.id, "Updates:", currentUpdates);

    try {
      lastPendingUpdatesRef.current = {};
      const updatedFullSong = { ...targetSong, ...formData, ...currentUpdates };
      const syncedSongs = await syncToMasterRepertoire(user.id, [updatedFullSong]);
      const syncedSong = syncedSongs[0];

      setSong(syncedSong);
      setFormData(prev => ({ ...prev, ...currentUpdates, master_id: syncedSong.master_id }));
      
      // --- FIX: Update masterRepertoire here ---
      if (masterRepertoire) { // Ensure masterRepertoire is available
        const updatedMasterRepertoire = masterRepertoire.map(s => s.id === syncedSong.id ? syncedSong : s);
        // This is a prop, so we can't directly set it. We need a callback from parent.
        // For now, we'll rely on the parent (Index.tsx) to refetch or update its masterRepertoire state.
        // If this component was responsible for masterRepertoire, we'd do: setMasterRepertoire(updatedMasterRepertoire);
      }

      // Removed the redundant setlist.songs JSONB update here.
      // The parent component (Index.tsx) is responsible for keeping its setlist state in sync
      // via the repertoire_changes subscription and fetchSetlistsAndRepertoire.

      console.log("[SongStudioView] performSave: Save successful for song:", targetSong.id);
    } catch (err: any) {
      console.error("[SongStudioView] performSave 400 Failure:", err.message, err.details);
    }
  };

  const handleAutoSave = useCallback((updates: Partial<SetlistSong>) => {
    console.log("[SongStudioView] handleAutoSave: Received updates:", updates);
    setFormData(prev => ({ ...prev, ...updates }));
    lastPendingUpdatesRef.current = { ...lastPendingUpdatesRef.current, ...updates };

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      performSave(lastPendingUpdatesRef.current);
    }, 1000);
  }, [user, gigId, formData, masterRepertoire]); // Added masterRepertoire to dependencies

  const { pitch, setPitch, targetKey, setTargetKey, isPitchLinked, setIsPitchLinked } = useHarmonicSync({
    formData: {
      originalKey: formData.originalKey,
      targetKey: formData.targetKey,
      pitch: formData.pitch,
      is_pitch_linked: formData.is_pitch_linked,
      ug_chords_text: formData.ug_chords_text,
    },
    handleAutoSave,
    globalKeyPreference
  });

  const handleClose = useCallback(() => {
    console.log("[SongStudioView] handleClose: Initiated.");
    const pending = lastPendingUpdatesRef.current;
    if (Object.keys(pending).length > 0) {
      console.log("[SongStudioView] handleClose: Performing final save for pending updates.");
      performSave(pending);
    }
    console.log("[SongStudioView] handleClose: Stopping audio playback.");
    audio.stopPlayback();
    console.log("[SongStudioView] handleClose: Calling onClose prop.");
    onClose();
  }, [onClose, audio, performSave]);

  const fetchData = async () => {
    if (!user || !songId) {
      console.log("[SongStudioView] fetchData: Skipping fetch, no user or songId.");
      return;
    }
    console.log("[SongStudioView] fetchData: Starting fetch for songId (repertoire.id):", songId);
    setLoading(true);
    try {
      // Always fetch the master song record from the 'repertoire' table
      const { data, error } = await supabase.from('repertoire').select('*').eq('id', songId).maybeSingle();
      if (error) {
        console.error("[SongStudioView] fetchData: Supabase 'repertoire' query error:", error);
        throw error;
      }
      if (!data) {
        console.error("[SongStudioView] fetchData: No 'repertoire' data found for ID:", songId);
        showError("Error: The requested track could not be found.");
        throw new Error("Track not found.");
      }

      console.log("[SongStudioView] fetchData: 'repertoire' data found:", data);
      const targetSong: SetlistSong = {
        id: data.id, // This is the repertoire.id
        master_id: data.id,
        name: data.title,
        artist: data.artist,
        originalKey: data.original_key !== null ? data.original_key : 'TBC', // Default to 'TBC' if null
        targetKey: data.target_key !== null ? data.target_key : (data.original_key !== null ? data.original_key : 'TBC'), // Default to 'TBC' if null
        pitch: data.pitch ?? 0,
        previewUrl: data.extraction_status === 'completed' && data.audio_url ? data.audio_url : data.preview_url,
        youtubeUrl: data.youtube_url,
        ugUrl: data.ug_url,
        appleMusicUrl: data.apple_music_url, // Corrected property name
        pdfUrl: data.pdf_url,
        leadsheetUrl: data.leadsheet_url,
        bpm: data.bpm,
        genre: data.genre,
        isSyncing: false,
        isMetadataConfirmed: data.is_metadata_confirmed,
        isKeyConfirmed: data.is_key_confirmed,
        notes: data.notes,
        lyrics: data.lyrics,
        resources: data.resources || [],
        user_tags: data.user_tags || [],
        is_pitch_linked: data.is_pitch_linked ?? true,
        duration_seconds: data.duration_seconds,
        key_preference: data.key_preference,
        is_active: data.is_active,
        fineTune: data.fineTune,
        tempo: data.tempo,
        volume: data.volume,
        isApproved: data.is_approved,
        preferred_reader: data.preferred_reader,
        ug_chords_text: data.ug_chords_text,
        ug_chords_config: data.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: data.is_ug_chords_present,
        highest_note_original: data.highest_note_original,
        is_ug_link_verified: data.is_ug_link_verified,
        metadata_source: data.metadata_source,
        sync_status: data.sync_status,
        last_sync_log: data.last_sync_log,
        audio_url: data.audio_url,
      };
      
      setSong(targetSong);
      setFormData(targetSong);
      
      if (targetSong.audio_url || targetSong.previewUrl) {
        const urlToLoad = targetSong.audio_url || targetSong.previewUrl;
        console.log("[SongStudioView] fetchData: Loading audio from URL:", urlToLoad);
        // FIX: Pass the pitch from the song data to loadFromUrl
        await audio.loadFromUrl(urlToLoad, targetSong.pitch ?? 0, true);
      }
      console.log("[SongStudioView] fetchData: Fetch successful for songId:", songId);
    } catch (err: any) {
      console.error("[SongStudioView] Studio Engine Error: " + err.message);
      console.log("[SongStudioView] fetchData: Calling onClose due to error.");
      onClose();
    } finally {
      setLoading(false);
      console.log("[SongStudioView] fetchData: Loading set to false.");
    }
  };

  useEffect(() => {
    console.log("[SongStudioView] Component mounted/songId/gigId changed. Calling fetchData.");
    fetchData();
    return () => {
      console.log("[SongStudioView] Component unmounting/songId/gigId changing. Cleanup initiated.");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const pending = lastPendingUpdatesRef.current;
      if (Object.keys(pending).length > 0) {
        console.log("[SongStudioView] Cleanup: Performing final save for pending updates.");
        performSave(pending);
      }
      console.log("[SongStudioView] Cleanup: Stopping audio playback.");
      audio.stopPlayback();
    };
  }, [songId, gigId]);

  useKeyboardNavigation({
    onNext: () => visibleSongs.length > 1 && onSelectSong?.(visibleSongs[(visibleSongs.findIndex(s => s.id === songId) + 1) % visibleSongs.length].id),
    onPrev: () => visibleSongs.length > 1 && onSelectSong?.(visibleSongs[(visibleSongs.findIndex(s => s.id === songId) - 1 + visibleSongs.length) % visibleSongs.length].id),
    onClose: handleClose,
    onPlayPause: audio.togglePlayback,
    disabled: loading
  });

  if (loading) return <div className="h-full flex items-center justify-center bg-slate-950"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>;

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      <header className="h-20 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleClose} className="h-12 w-12 rounded-2xl bg-white/5"><ArrowLeft className="w-5 h-5 text-slate-400" /></Button>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{gigId === 'library' ? 'MASTER' : 'GIG'}</p>
            <h2 className="text-xl font-black uppercase text-white truncate max-w-[250px]">{formData.name}</h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {gigId === 'library' ? (
            <SetlistMultiSelector songMasterId={songId} allSetlists={allSetlists} songToAssign={song!} onUpdateSetlistSongs={onUpdateSetlistSongs!} />
          ) : (
            <div className="flex items-center gap-3 bg-white/5 px-4 h-11 rounded-xl border border-white/10">
              <Label className="text-[8px] font-black text-slate-500 uppercase">Gig Approved</Label>
              <Switch checked={formData.isApproved || false} onCheckedChange={(v) => handleAutoSave({ isApproved: v })} className="data-[state=checked]:bg-emerald-500" />
            </div>
          )}
        </div>
      </header>
      
      {(!formData.originalKey || formData.originalKey === 'TBC') && (
        <div className="bg-red-950/30 border-b border-red-900/50 p-3 flex items-center justify-center gap-3 shrink-0 h-10">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-xs font-bold uppercase text-red-400">Original Key missing. Transposition is relative to 'C'.</p>
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
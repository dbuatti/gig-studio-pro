"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Sparkles, Loader2, AlertCircle, ShieldAlert, Globe, X } from 'lucide-react'; 
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useSettings } from '@/hooks/use-settings';
import { SetlistSong, Setlist } from '@/components/SetlistManager';
import { syncToMasterRepertoire } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { showError, showSuccess } from '@/utils/toast';
import StudioTabContent from '@/components/StudioTabContent';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useKeyboardNavigation } from '@/hooks/use-keyboard-navigation';
import SetlistMultiSelector from './SetlistMultiSelector';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { extractKeyFromChords } from '@/utils/chordUtils';
import ProSyncSearch from './ProSyncSearch'; 
import { formatKey } from '@/utils/keyUtils';
import SongStudioConsolidatedHeader from '@/components/SongStudioConsolidatedHeader'; // Import the new consolidated header

export type StudioTab = 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library';

interface SongStudioViewProps {
  gigId: string | 'library';
  songId: string | null;
  onClose: () => void;
  isModal?: boolean;
  onExpand?: () => void;
  visibleSongs?: SetlistSong[];
  onSelectSong?: (id: string) => void;
  allSetlists?: Setlist[];
  masterRepertoire?: SetlistSong[]; // Corrected type
  onUpdateSetlistSongs?: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  defaultTab?: StudioTab;
  handleAutoSave?: (updates: Partial<SetlistSong>) => void;
  preventStageKeyOverwrite?: boolean; // NEW: Add this prop
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
  defaultTab,
  handleAutoSave: externalAutoSave,
  preventStageKeyOverwrite, // NEW: Destructure the prop
}) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings(); // Removed preventStageKeyOverwrite from here
  const audio = useToneAudio();
  
  const [song, setSong] = useState<SetlistSong | null>(null);
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<StudioTab>(defaultTab || 'config'); // Set default to 'config'
  const [loading, setLoading] = useState(true);
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');
  const [isProSyncOpen, setIsProSyncOpen] = useState(false); 
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastPendingUpdatesRef = useRef<Partial<SetlistSong>>({});
  const currentSongRef = useRef<SetlistSong | null>(null);

  useEffect(() => {
    currentSongRef.current = song;
  }, [song]);

  const performSave = async (currentUpdates: Partial<SetlistSong>) => {
    const targetSong = currentSongRef.current;
    if (!targetSong || !user) return;

    try {
      lastPendingUpdatesRef.current = {};
      // Pass only the delta plus identifying fields for upsert consistency
      const identifyingUpdates = {
        ...currentUpdates,
        name: currentUpdates.name || targetSong.name,
        artist: currentUpdates.artist || targetSong.artist
      };
      
      const syncedSongs = await syncToMasterRepertoire(user.id, [identifyingUpdates]);
      const syncedSong = syncedSongs[0];

      setSong(syncedSong);
      setFormData(prev => ({ ...prev, ...currentUpdates, master_id: syncedSong.master_id }));
    } catch (err: any) {
      // Failure handled silently or via toast
    }
  };

  const handleAutoSave = useCallback((updates: Partial<SetlistSong>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    lastPendingUpdatesRef.current = { ...lastPendingUpdatesRef.current, ...updates };

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      performSave(lastPendingUpdatesRef.current);
    }, 1000);
  }, [user, gigId, formData]);

  const activeAutoSave = externalAutoSave || handleAutoSave;

  const handleClose = useCallback(() => {
    const pending = lastPendingUpdatesRef.current;
    if (Object.keys(pending).length > 0) {
      performSave(pending);
    }
    audio.stopPlayback();
    onClose();
  }, [onClose, audio, performSave]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    if (gigId === 'library' && !songId) {
      setSong(null);
      setFormData({});
      setLoading(false);
      audio.stopPlayback();
      return;
    }

    if (!songId) {
      showError("Error: No song ID provided.");
      onClose();
      return;
    }

    try {
      const { data, error } = await supabase.from('repertoire').select('*').eq('id', songId).maybeSingle();
      if (error) throw error;
      if (!data) {
        showError("Error: The requested track could not be found.");
        throw new Error("Track not found.");
      }

      const targetSong: SetlistSong = {
        id: data.id, 
        master_id: data.id,
        name: data.title,
        artist: data.artist,
        originalKey: data.original_key !== null ? data.original_key : 'TBC', 
        targetKey: data.target_key !== null ? data.target_key : (data.original_key !== null ? data.original_key : 'TBC'), 
        pitch: data.pitch ?? 0,
        previewUrl: data.extraction_status === 'completed' && data.audio_url ? data.audio_url : data.preview_url,
        youtubeUrl: data.youtube_url,
        ugUrl: data.ug_url,
        appleMusicUrl: data.apple_music_url, 
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
        lyrics_updated_at: data.lyrics_updated_at,
        chords_updated_at: data.chords_updated_at,
        ug_link_updated_at: data.ug_link_updated_at,
        highest_note_updated_at: data.highest_note_updated_at,
      };
      
      setSong(targetSong);
      setFormData(targetSong);
      
      if (targetSong.audio_url || targetSong.previewUrl) {
        const urlToLoad = targetSong.audio_url || targetSong.previewUrl;
        await audio.loadFromUrl(urlToLoad, targetSong.pitch ?? 0, true);
      }
    } catch (err: any) {
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const pending = lastPendingUpdatesRef.current;
      if (Object.keys(pending).length > 0) {
        performSave(pending);
      }
      audio.stopPlayback();
    };
  }, [songId, gigId]);

  const {
    pitch,
    setPitch,
    targetKey,
    setTargetKey,
    isPitchLinked,
    setIsPitchLinked,
  } = useHarmonicSync({
    formData: formData,
    handleAutoSave: activeAutoSave,
    globalKeyPreference: globalKeyPreference,
    preventStageKeyOverwrite: preventStageKeyOverwrite, // NEW: Pass the prop
  });

  useEffect(() => {
    audio.setPitch(pitch);
  }, [pitch, audio]);

  const handleProSyncSelect = async (itunesSong: any) => {
    const updates: Partial<SetlistSong> = {
      name: itunesSong.trackName,
      artist: itunesSong.artistName,
      genre: itunesSong.primaryGenreName,
      appleMusicUrl: itunesSong.trackViewUrl,
      previewUrl: itunesSong.previewUrl,
      duration_seconds: Math.floor(itunesSong.trackTimeMillis / 1000),
      isMetadataConfirmed: true,
      metadata_source: 'itunes_sync'
    };

    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: [`${itunesSong.trackName} by ${itunesSong.artistName}`] }
      });
      
      if (!error && data) {
        const result = Array.isArray(data) ? data[0] : data;
        if (result?.originalKey) {
          updates.originalKey = formatKey(result.originalKey, globalKeyPreference === 'neutral' ? 'sharps' : globalKeyPreference);
          updates.isKeyConfirmed = true;
          updates.bpm = result.bpm?.toString() || updates.bpm;
        }
      }
    } catch (e) {}

    activeAutoSave(updates);
    setIsProSyncOpen(false);
    showSuccess("Pro Metadata Synced");
  };

  const handleDownloadAll = async () => {
    showError("Download All functionality is not yet implemented.");
  };

  const handleUgPrint = () => {
    if (formData.ugUrl) {
      window.open(formData.ugUrl, '_blank');
    } else {
      showError("No Ultimate Guitar link available.");
    }
  };

  const isFramable = (url: string | null | undefined) => {
    if (!url) return true;
    const blockedSites = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blockedSites.some(site => url.includes(site));
  };

  if (loading) return <div className="h-full flex items-center justify-center bg-slate-950"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>;

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      <header className="shrink-0 z-50">
        <SongStudioConsolidatedHeader
          formData={formData}
          isPlaying={audio.isPlaying}
          isLoadingAudio={audio.isLoadingAudio}
          onTogglePlayback={audio.togglePlayback}
          pitch={pitch}
          targetKey={targetKey}
          globalKeyPreference={globalKeyPreference}
          onClose={handleClose}
          onOpenProSync={() => setIsProSyncOpen(true)}
          gigId={gigId}
          allSetlists={allSetlists}
          onUpdateSetlistSongs={onUpdateSetlistSongs!}
          onAutoSave={activeAutoSave}
        />
      </header>
      
      <ProSyncSearch 
        isOpen={isProSyncOpen} 
        onClose={() => setIsProSyncOpen(false)} 
        onSelect={handleProSyncSelect}
        initialQuery={`${formData.artist} ${formData.name}`}
      />

      {(!formData.originalKey || formData.originalKey === 'TBC') && (
        <div className="bg-red-950/30 border-b border-red-900/50 p-3 flex items-center justify-center gap-3 shrink-0 h-10">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <p className="text-xs font-bold uppercase text-red-400">Original Key missing. Transposition is relative to 'C'.</p>
        </div>
      )}
      
      <nav className="h-16 bg-black/20 border-b border-white/5 flex items-center px-6 overflow-x-auto no-scrollbar shrink-0">
        <div className="grid grid-cols-7 w-full">
          {['config', 'audio', 'details', 'charts', 'lyrics', 'visual', 'library'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={cn("text-[10px] font-black uppercase tracking-widest h-16 flex items-center justify-center border-b-4 transition-colors", activeTab === tab ? "text-indigo-400 border-indigo-50" : "text-slate-500 border-transparent hover:text-white")}>
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
          handleAutoSave={activeAutoSave}
          onUpdateKey={setTargetKey}
          audioEngine={audio}
          isMobile={isMobile}
          onLoadAudioFromUrl={audio.loadFromUrl}
          setPreviewPdfUrl={() => {}}
          isFramable={isFramable}
          activeChartType={activeChartType}
          setActiveChartType={setActiveChartType}
          handleUgPrint={handleUgPrint}
          handleDownloadAll={handleDownloadAll}
          onSwitchTab={setActiveTab}
          pitch={pitch}
          setPitch={setPitch}
          targetKey={targetKey}
          setTargetKey={setTargetKey}
          isPitchLinked={isPitchLinked}
          setIsPitchLinked={setIsPitchLinked}
          setTempo={audio.setTempo}
          setVolume={audio.setVolume}
          setFineTune={audio.setFineTune}
          currentBuffer={audio.currentBuffer}
          isPlaying={audio.isPlaying}
          progress={audio.progress}
          duration={audio.duration}
          togglePlayback={audio.togglePlayback}
          stopPlayback={audio.stopPlayback}
        />
      </div>
    </div>
  );
};

export default SongStudioView;
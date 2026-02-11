"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Sparkles, Loader2, AlertCircle, ShieldAlert, Globe, X } from 'lucide-react'; 
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToneAudio, AudioEngineControls } from '@/hooks/use-tone-audio';
import { useSettings } from '@/hooks/use-settings';
import { SetlistSong, Setlist, EnergyZone } from '@/components/SetlistManager';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
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
import SongStudioConsolidatedHeader from '@/components/SongStudioConsolidatedHeader';
import { autoVibeCheck } from '@/utils/vibeUtils';

export type StudioTab = 'config' | 'audio' | 'details' | 'charts' | 'lyrics' | 'visual' | 'library';

interface SongStudioViewProps {
  gigId: string | 'library';
  songId: string | null;
  onClose: () => void;
  isModal?: boolean;
  onExpand?: () => void;
  visibleSongs?: SetlistSong[];
  onSelectSong?: (id: string) => void;
  allSetlists?: Setlist[];
  masterRepertoire?: SetlistSong[];
  onUpdateSetlistSongs?: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  defaultTab?: StudioTab;
  handleAutoSave?: (updates: Partial<SetlistSong>) => void;
  preventStageKeyOverwrite?: boolean;
  audioEngine?: AudioEngineControls;
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
  preventStageKeyOverwrite,
  audioEngine: externalAudioEngine,
}) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  
  const internalAudio = useToneAudio();
  const audio = externalAudioEngine || internalAudio;
  
  const [song, setSong] = useState<SetlistSong | null>(null);
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<StudioTab>(defaultTab || 'config');
  const [loading, setLoading] = useState(true);
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');
  const [isProSyncOpen, setIsProSyncOpen] = useState(false); 
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastPendingUpdatesRef = useRef<Partial<SetlistSong>>({});
  const currentSongRef = useRef<SetlistSong | null>(null);

  const TABS: StudioTab[] = ['config', 'audio', 'details', 'charts', 'lyrics', 'visual', 'library'];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && !isNaN(Number(e.key))) {
        const index = Number(e.key) - 1;
        if (index >= 0 && index < TABS.length) {
          e.preventDefault();
          setActiveTab(TABS[index]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    currentSongRef.current = song;
  }, [song]);

  const performSave = async (currentUpdates: Partial<SetlistSong>) => {
    const targetSong = currentSongRef.current;
    if (!targetSong || !user) return;

    try {
      lastPendingUpdatesRef.current = {};
      const identifyingUpdates = {
        ...currentUpdates,
        name: currentUpdates.name || targetSong.name,
        artist: currentUpdates.artist || targetSong.artist
      };
      
      const syncedSongs = await syncToMasterRepertoire(user.id, [identifyingUpdates]);
      const syncedSong = syncedSongs[0];

      setSong(syncedSong);
      setFormData(prev => ({ ...prev, ...currentUpdates, master_id: syncedSong.master_id }));
    } catch (err: any) {}
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
      if (!data) throw new Error("Track not found.");

      const targetSong: SetlistSong = {
        id: data.id, 
        master_id: data.id,
        name: data.title,
        artist: data.artist,
        originalKey: data.original_key || 'TBC', 
        targetKey: data.target_key || data.original_key || 'TBC', 
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
        is_ready_to_sing: data.is_ready_to_sing,
        preferred_reader: data.preferred_reader,
        ug_chords_text: data.ug_chords_text,
        ug_chords_config: data.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: data.is_ug_chords_present,
        highest_note_original: data.highest_note_original,
        audio_url: data.audio_url,
        extraction_status: data.extraction_status,
        energy_level: data.energy_level as EnergyZone,
        comfort_level: data.comfort_level ?? 0,
      };
      
      setSong(targetSong);
      setFormData(targetSong);
      
      const isAudioContext = activeTab === 'audio' || activeTab === 'config';
      const audioUrl = targetSong.audio_url || targetSong.previewUrl;
      const isDifferentUrl = audioUrl && audioUrl !== audio.currentUrl;

      if (isAudioContext && isDifferentUrl) {
        await audio.loadFromUrl(audioUrl, targetSong.pitch ?? 0, true);
      }
    } catch (err: any) {
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [songId, gigId]);

  useEffect(() => {
    if (loading || !song) return;
    const isAudioContext = activeTab === 'audio' || activeTab === 'config';
    const audioUrl = song.audio_url || song.previewUrl;
    const isDifferentUrl = audioUrl && audioUrl !== audio.currentUrl;

    if (isAudioContext && isDifferentUrl) {
      audio.loadFromUrl(audioUrl, song.pitch ?? 0, true);
    }
  }, [activeTab, loading]);

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
    preventStageKeyOverwrite: preventStageKeyOverwrite,
  });

  useEffect(() => {
    const audioUrl = song?.audio_url || song?.previewUrl;
    if (audioUrl === audio.currentUrl) {
      audio.setPitch(pitch);
    }
  }, [pitch, audio, song]);

  const handleProSyncSelect = async (itunesSong: any) => {
    if (!user) return;

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

    // Save the metadata first
    await activeAutoSave(updates);
    
    // Trigger automatic vibe check
    autoVibeCheck(user.id, { ...formData, ...updates, master_id: song?.master_id || song?.id });
    
    setIsProSyncOpen(false);
    showSuccess("Pro Metadata & Vibe Synced");
  };

  const isFramable = useCallback((url: string | null | undefined) => {
    if (!url) return true;
    const blockedSites = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blockedSites.some(site => url.includes(site));
  }, []);

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
          onUpdateSetlistSongs={onUpdateSetlistSongs}
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
          {TABS.map((tab, i) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab as any)} 
              className={cn(
                "text-[10px] font-black uppercase tracking-widest h-16 flex flex-col items-center justify-center border-b-4 transition-colors", 
                activeTab === tab ? "text-indigo-400 border-indigo-50" : "text-slate-500 border-transparent hover:text-white"
              )}
            >
              <span>{tab.toUpperCase()}</span>
              <span className="text-[8px] opacity-40 mt-0.5">⌘{i + 1}</span>
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
          handleUgPrint={() => {}}
          handleDownloadAll={async () => {}}
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
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Sparkles, Loader2, AlertCircle, ShieldAlert, Globe } from 'lucide-react'; 
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
  masterRepertoire?: SetlistSong[];
  onUpdateSetlistSongs?: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
  defaultTab?: StudioTab;
  handleAutoSave?: (updates: Partial<SetlistSong>) => void;
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
}) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const audio = useToneAudio();
  
  const [song, setSong] = useState<SetlistSong | null>(null);
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<StudioTab>(defaultTab || 'audio');
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
      const updatedFullSong = { ...targetSong, ...formData, ...currentUpdates };
      const syncedSongs = await syncToMasterRepertoire(user.id, [updatedFullSong]);
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

  if (loading) return <div className="h-full flex items-center justify-center bg-slate-950"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>;

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      <header className="h-20 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleClose} className="h-12 w-12 rounded-2xl bg-white/5"><ArrowLeft className="w-5 h-5 text-slate-400" /></Button>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{gigId === 'library' ? 'MASTER' : 'GIG'}</p>
            <h2 className="text-xl font-black uppercase text-white truncate max-w-[250px]">
              {songId ? formData.name : "Library Search"} 
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {songId && (
            <Button 
              variant="outline" 
              onClick={() => setIsProSyncOpen(true)}
              className="h-11 px-4 rounded-xl border-indigo-500/20 bg-indigo-600/10 text-indigo-400 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg hover:bg-indigo-600 hover:text-white transition-all"
            >
              <Globe className="w-4 h-4" /> Pro Sync
            </Button>
          )}

          {gigId === 'library' && song ? (
            <SetlistMultiSelector songMasterId={songId || ''} allSetlists={allSetlists} songToAssign={song} onUpdateSetlistSongs={onUpdateSetlistSongs!} />
          ) : (
            <div className="flex items-center gap-3 bg-white/5 px-4 h-11 rounded-xl border border-white/10">
              <Label className="text-[8px] font-black text-slate-500 uppercase">Gig Approved</Label>
              <Switch checked={formData.isApproved || false} onCheckedChange={(v) => activeAutoSave({ isApproved: v })} className="data-[state=checked]:bg-emerald-500" />
            </div>
          )}
        </div>
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
          handleAutoSave={activeAutoSave}
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
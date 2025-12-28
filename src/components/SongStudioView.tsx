"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';
import { SetlistSong } from './SetlistManager';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useIsMobile } from '@/hooks/use-mobile';
import { useHarmonicSync } from '@/hooks/use-harmonic-sync';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, X, Maximize2, Minimize2, Settings2, Volume2, FileText, Guitar, AlignLeft, Youtube, Library, ArrowLeft, Check, Link as LinkIcon, AlertCircle, RotateCcw } from 'lucide-react';
import StudioTabContent from './StudioTabContent';
import SongStudioModal from './SongStudioModal';
import SetlistMultiSelector from './SetlistMultiSelector';
import ProSyncSearch from './ProSyncSearch';
import { sanitizeUGUrl } from '@/utils/ugUtils';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';

const StudioTabConfig = {
  config: { label: 'Config', icon: 'Settings2' },
  audio: { label: 'Audio', icon: 'Volume2' },
  details: { label: 'Details', icon: 'FileText' },
  charts: { label: 'Charts', icon: 'Guitar' },
  lyrics: { label: 'Lyrics', icon: 'AlignLeft' },
  visual: { label: 'Visual', icon: 'Youtube' },
  library: { label: 'Library', icon: 'Library' },
};

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { keyPreference: globalPreference } = useSettings();

  const [song, setSong] = useState<SetlistSong | null>(null);
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library'>('config');
  const [activeChartType, setActiveChartType] = useState<'pdf' | 'leadsheet' | 'web' | 'ug'>('pdf');
  const [isProSyncOpen, setIsProSyncOpen] = useState(false);
  const [proSyncQuery, setProSyncQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // NEW: State for PDF scroll speed (default 1.0)
  const [pdfScrollSpeed, setPdfScrollSpeed] = useState(1.0);
  
  // NEW: State for Chord scroll settings
  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0);

  const audio = useToneAudio();

  const handleAutoSave = useCallback((updates: Partial<SetlistSong>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setIsSaving(true);
  }, []);

  const harmonicSync = useHarmonicSync({
    formData,
    handleAutoSave,
    globalKeyPreference,
  });

  const { pitch, setPitch, targetKey, setTargetKey, isPitchLinked, setIsPitchLinked } = harmonicSync;

  const fetchData = useCallback(async () => {
    if (!user || !songId) return;

    let currentSong: SetlistSong | null = null;

    if (gigId === 'library') {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('id', songId)
        .single();

      if (error) {
        showError("Failed to load master track.");
        return;
      }

      currentSong = {
        id: data.id,
        master_id: data.id,
        name: data.title,
        artist: data.artist,
        previewUrl: data.preview_url,
        youtubeUrl: data.youtube_url,
        ugUrl: data.ug_url,
        appleMusicUrl: data.apple_music_url,
        pdfUrl: data.pdf_url,
        leadsheetUrl: data.leadsheet_url,
        originalKey: data.original_key,
        targetKey: data.target_key,
        pitch: data.pitch ?? 0,
        bpm: data.bpm,
        genre: data.genre,
        isMetadataConfirmed: data.is_metadata_confirmed,
        isKeyConfirmed: data.is_key_confirmed,
        notes: data.notes,
        lyrics: data.lyrics,
        resources: data.resources || [],
        user_tags: data.user_tags || [],
        is_pitch_linked: data.is_pitch_linked ?? true,
        duration_seconds: data.duration_seconds,
        key_preference: data.key_preference,
        isApproved: data.is_approved,
        preferred_reader: data.preferred_reader,
        ug_chords_text: data.ug_chords_text,
        ug_chords_config: data.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: data.is_ug_chords_present,
        highest_note_original: data.highest_note_original,
        sheet_music_url: data.sheet_music_url,
        is_sheet_verified: data.is_sheet_verified,
        metadata_source: data.metadata_source,
        sync_status: data.sync_status,
        last_sync_log: data.last_sync_log,
        auto_synced: data.auto_synced,
      } as SetlistSong;
    } else {
      // Logic for fetching from a specific gig setlist (not implemented here, assuming library mode for studio)
      showError("Studio only supports editing master repertoire tracks.");
      return;
    }

    if (currentSong) {
      setSong(currentSong);
      setFormData(currentSong);
      audio.setPitch(currentSong.pitch ?? 0);
      audio.setTempo(currentSong.tempo ?? 1);
      audio.setVolume(currentSong.volume ?? -6);
      audio.setFineTune(currentSong.fineTune ?? 0);
      if (currentSong.previewUrl) {
        audio.loadFromUrl(currentSong.previewUrl, currentSong.pitch ?? 0);
      }
    }
  }, [user, songId, gigId, audio]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-save logic
  useEffect(() => {
    if (!isSaving) return;

    const timer = setTimeout(async () => {
      if (!user || !song) return;

      try {
        const updatedSong = { ...song, ...formData };
        const [syncedSong] = await syncToMasterRepertoire(user.id, updatedSong);
        
        // Update local state with the newly synced data (especially master_id if new)
        setSong(syncedSong);
        setFormData(syncedSong);
        
        // Update the pitch/key state in the harmonic sync hook if it changed during sync
        setTargetKey(syncedSong.targetKey || syncedSong.originalKey || 'C');
        setPitch(syncedSong.pitch ?? 0);

        showSuccess("Studio changes saved.");
      } catch (err) {
        showError("Failed to save changes to master repertoire.");
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isSaving, formData, song, user, setTargetKey, setPitch]);

  const handleProSyncSelect = (result: any) => {
    const updates: Partial<SetlistSong> = {
      name: result.trackName,
      artist: result.artistName,
      genre: result.primaryGenreName,
      appleMusicUrl: result.trackViewUrl,
      duration_seconds: Math.floor(result.trackTimeMillis / 1000),
      isMetadataConfirmed: true,
      metadata_source: 'itunes_manual',
    };
    handleAutoSave(updates);
    setIsProSyncOpen(false);
  };

  const handleUgPrint = () => {
    const ugUrl = formData.ugUrl;
    if (!ugUrl) {
      showError("No UG link available.");
      return;
    }
    const printUrl = ugUrl.includes('?') ? ugUrl.replace('?', '/print?') : `${ugUrl}/print`;
    window.open(printUrl, '_blank');
  };

  const handleDownloadAll = async () => {
    showError("Bulk download not yet implemented.");
  };

  if (!song) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
      </div>
    );
  }

  const isOriginalKeyMissing = !song.originalKey || song.originalKey === 'TBC';

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Header */}
      <div className="h-20 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-xl hover:bg-white/10">
            <X className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
              <Settings2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-white">{song.name}</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{song.artist}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setProSyncQuery(`${song.artist} ${song.name}`);
              setIsProSyncOpen(true);
            }}
            className="h-10 px-4 rounded-xl border-indigo-500/50 text-indigo-400 font-black uppercase text-[10px] tracking-widest gap-2"
          >
            <LinkIcon className="w-3.5 h-3.5" /> Pro Sync
          </Button>
          
          {song.master_id && (
            <SetlistMultiSelector 
              songMasterId={song.master_id}
              allSetlists={allSetlists}
              songToAssign={song}
              onUpdateSetlistSongs={onUpdateSetlistSongs!}
            />
          )}

          {isModal && onExpand && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onExpand}
              className="h-10 w-10 rounded-xl hover:bg-white/10"
            >
              <Maximize2 className="w-5 h-5" />
            </Button>
          )}
          {isSaving && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
        </div>
      </div>

      {/* Warning Banner */}
      {isOriginalKeyMissing && (
        <div className="bg-red-950/30 border-b border-red-900/50 p-2 flex items-center justify-center gap-2 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">
            CRITICAL: Original Key is missing. Transposition is currently relative to 'C'.
          </p>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full shrink-0">
            <TabsList className="grid w-full grid-cols-7 h-14 bg-slate-900/50 border-b border-white/10 p-0 rounded-none">
              {Object.entries(StudioTabConfig).map(([key, { label, icon: IconName }]) => {
                const Icon = (require('lucide-react') as any)[IconName];
                return (
                  <TabsTrigger 
                    key={key} 
                    value={key} 
                    className={cn(
                      "text-[10px] uppercase font-black tracking-widest h-full rounded-none border-b-2 transition-all",
                      activeTab === key ? "border-indigo-500 text-indigo-400 bg-black/20" : "border-transparent text-slate-500 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon className="w-4 h-4 mr-2" /> {label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
          
          <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar">
            <StudioTabContent
              activeTab={activeTab}
              song={song}
              formData={formData}
              handleAutoSave={handleAutoSave}
              onUpdateKey={setTargetKey}
              audioEngine={audio}
              isMobile={isMobile}
              onLoadAudioFromUrl={audio.loadFromUrl}
              setPreviewPdfUrl={setPdfPreviewUrl}
              isFramable={(url) => !['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'].some(site => url?.includes(site))}
              activeChartType={activeChartType}
              setActiveChartType={setActiveChartType}
              handleUgPrint={handleUgPrint}
              handleDownloadAll={handleDownloadAll}
              onSwitchTab={setActiveTab}
              pitch={pitch}
              setPitch={(p) => { setPitch(p); audio.setPitch(p); }}
              targetKey={targetKey}
              setTargetKey={setTargetKey}
              isPitchLinked={isPitchLinked}
              setIsPitchLinked={(linked) => { 
                setIsPitchLinked(linked); 
                if (!linked) audio.setPitch(0); 
              }}
              setTempo={audio.setTempo}
              setVolume={audio.setVolume}
              setFineTune={audio.setFineTune}
              currentBuffer={audio.currentBuffer}
              isPlaying={audio.isPlaying}
              progress={audio.progress}
              duration={audio.duration}
              togglePlayback={audio.togglePlayback}
              stopPlayback={audio.stopPlayback}
              // NEW: Pass PDF scroll props
              pdfScrollSpeed={pdfScrollSpeed}
              setPdfScrollSpeed={setPdfScrollSpeed}
              // NEW: Pass Chord scroll props
              chordAutoScrollEnabled={chordAutoScrollEnabled}
              setChordAutoScrollEnabled={setChordAutoScrollEnabled}
              chordScrollSpeed={chordScrollSpeed}
              setChordScrollSpeed={setChordScrollSpeed}
            />
          </div>
        </div>
      </div>
      
      {/* Modals */}
      <ProSyncSearch 
        isOpen={isProSyncOpen}
        onClose={() => setIsProSyncOpen(false)}
        onSelect={handleProSyncSelect}
        initialQuery={proSyncQuery}
      />

      {pdfPreviewUrl && (
        <SongStudioModal
          isOpen={!!pdfPreviewUrl}
          onClose={() => setPdfPreviewUrl(null)}
          gigId="library"
          songId={song.id}
        >
          <div className="h-full w-full bg-white">
            <iframe src={pdfPreviewUrl} className="w-full h-full" title="PDF Preview" />
          </div>
        </SongStudioModal>
      )}
    </div>
  );
};

export default SongStudioView;
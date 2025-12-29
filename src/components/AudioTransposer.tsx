"use client";

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as Tone from 'tone';
import { Button } from "@/components/ui/button";
import { Waves, Subtitles, PlusCircle, ListPlus } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import AudioVisualizer from './AudioVisualizer';
import { cn } from "@/lib/utils";
import { SetlistSong } from './SetlistManager';
import { transposeKey } from '@/utils/keyUtils';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useIsMobile } from '@/hooks/use-mobile';

// New modular components
import AudioPlaybackControls from './AudioPlaybackControls';
import AudioHarmonicControls from './AudioHarmonicControls';
import ManualLinkEditor from './ManualLinkEditor';
import SongSearchTabs from './SongSearchTabs';

export interface AudioTransposerRef {
  loadFromUrl: (url: string, name: string, artist: string, youtubeUrl?: string, originalKey?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string) => Promise<void>;
  setPitch: (pitch: number) => void;
  getPitch: () => number;
  triggerSearch: (query: string) => void;
  togglePlayback: () => Promise<void>;
  stopPlayback: () => void;
  resetEngine: () => void;
  getProgress: () => { progress: number; duration: number };
  getAnalyzer: () => Tone.Analyser | null;
  getIsPlaying: () => boolean;
}

interface AudioTransposerProps {
  onAddToSetlist?: (previewUrl: string, name: string, artist: string, youtubeUrl?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string, pitch?: number) => void;
  onAddExistingSong?: (song: SetlistSong) => void;
  onUpdateSongKey?: (songId: string, newTargetKey: string) => void;
  onSongEnded?: () => void;
  onPlaybackChange?: (isPlaying: boolean) => void;
  repertoire?: SetlistSong[];
  currentSong?: SetlistSong | null;
  onOpenAdmin?: () => void;
  currentList?: { id: string; name: string; songs: SetlistSong[] };
}

const AudioTransposer = forwardRef<AudioTransposerRef, AudioTransposerProps>(({ 
  onAddToSetlist, 
  onAddExistingSong, 
  onUpdateSongKey,
  onSongEnded, 
  onPlaybackChange,
  repertoire = [],
  currentSong,
  onOpenAdmin,
  currentList
}, ref) => {
  const isMobile = useIsMobile();
  const audio = useToneAudio();
  
  const [file, setFile] = useState<{ id?: string; name: string; artist?: string; url?: string; originalKey?: string; ugUrl?: string; youtubeUrl?: string; appleMusicUrl?: string; genre?: string } | null>(null);
  const [activeTab, setActiveTab] = useState("search");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeYoutubeUrl, setActiveYoutubeUrl] = useState<string | undefined>();
  const [activeUgUrl, setActiveUgUrl] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");

  const { 
    isPlaying, progress, duration, pitch, tempo, volume, fineTune, analyzer,
    setPitch, setTempo, setVolume, setFineTune, setProgress,
    loadFromUrl: hookLoadFromUrl, togglePlayback: hookTogglePlayback, stopPlayback: hookStopPlayback, resetEngine,
    isLoadingAudio
  } = audio;

  useEffect(() => {
    if (onPlaybackChange) onPlaybackChange(isPlaying);
  }, [isPlaying, onPlaybackChange]);

  useEffect(() => {
    if (duration > 0 && progress >= 100) {
      if (onSongEnded) onSongEnded();
    }
  }, [progress, duration, onSongEnded]);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const loadFromUrl = async (targetUrl: string, name: string, artist: string, youtubeUrl?: string, originalKey?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string) => {
    resetEngine();
    const initialPitch = currentSong?.pitch || 0;
    await hookLoadFromUrl(targetUrl, initialPitch);
    
    setFile({ id: currentSong?.id, name, artist, url: targetUrl, originalKey, ugUrl, youtubeUrl, appleMusicUrl, genre });
    
    setActiveYoutubeUrl(youtubeUrl);
    setActiveUgUrl(ugUrl);
    if (youtubeUrl) {
      setActiveVideoId(getYoutubeId(youtubeUrl));
    } else {
      setActiveVideoId(null);
    }
  };

  const togglePlayback = async () => {
    await hookTogglePlayback();
  };

  const stopPlayback = () => {
    hookStopPlayback();
  };

  const handleUgPrint = () => {
    const ugUrl = activeUgUrl || currentSong?.ugUrl;
    if (!ugUrl) {
      showError("No tab linked.");
      return;
    }
    const printUrl = ugUrl.includes('?') ? ugUrl.replace('?', '/print?') : `${ugUrl}/print`;
    window.open(printUrl, '_blank');
  };

  const handleAddToGig = () => {
    if (!file) return;
    onAddToSetlist?.(
      file.url || '', 
      file.name, 
      file.artist || "Unknown", 
      activeYoutubeUrl || file.youtubeUrl, 
      activeUgUrl || file.ugUrl, 
      file.appleMusicUrl, 
      file.genre, 
      pitch
    );
    setFile(null); // Clear after add
  };

  const handleSelectSuggestion = (query: string) => {
    setSearchQuery(query);
    setActiveTab("search");
  };

  const handleImportGlobal = (songData: Partial<SetlistSong>) => {
    if (onAddExistingSong) {
      const { id, master_id, ...dataToClone } = songData;
      const newSong = {
        ...dataToClone,
        id: Math.random().toString(36).substr(2, 9),
        isPlayed: false
      } as SetlistSong;
      onAddExistingSong(newSong);
    }
  };

  useImperativeHandle(ref, () => ({
    loadFromUrl: async (targetUrl, name, artist, youtubeUrl, originalKey, ugUrl, appleMusicUrl, genre) => {
      await loadFromUrl(targetUrl, name, artist, youtubeUrl, originalKey, ugUrl, appleMusicUrl, genre);
    },
    setPitch: (newPitch: number) => setPitch(newPitch),
    getPitch: () => pitch,
    triggerSearch: (query: string) => {
      setSearchQuery(query);
      setActiveTab("search");
    },
    togglePlayback,
    stopPlayback,
    resetEngine,
    getProgress: () => ({ progress, duration }),
    getAnalyzer: () => analyzer,
    getIsPlaying: () => isPlaying
  }));

  return (
    <div className="flex flex-col h-full relative">
      <div className="bg-indigo-600 px-6 py-2.5 flex items-center justify-between text-white shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <Subtitles className="w-3.5 h-3.5 animate-pulse" />
          <span className="font-black text-[10px] tracking-widest uppercase">Performance Engine Ready</span>
        </div>
      </div>
      
      <div className={cn("p-6 space-y-6 pb-24 md:pb-6")}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
              <Waves className="w-5 h-5 text-indigo-600" />
              Song Studio
            </h2>
          </div>
          {file && !isMobile && onAddToSetlist && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleAddToGig}
              className="h-8 border-green-200 text-green-600 hover:bg-green-50 font-bold text-[10px] uppercase gap-2"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Save to Gig
            </Button>
          )}
        </div>

        <SongSearchTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onSelectSong={(url, name, artist, yt) => { loadFromUrl(url, name, artist, yt); }}
          onAddToSetlist={(url, name, artist, yt, ug, apple, gen) => 
            onAddToSetlist?.(url, name, artist, yt, ug, apple, gen, 0)
          }
          onAddExistingSong={handleImportGlobal}
          externalQuery={searchQuery}
          repertoire={repertoire}
          currentList={currentList}
        />

        {file && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 border-t pt-6">
            <div className="flex flex-col items-center gap-5">
              {activeVideoId && (
                <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 bg-black">
                  <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${activeVideoId}`} frameBorder="0" allowFullScreen />
                </div>
              )}
              
              <div className="w-full">
                <AudioVisualizer analyzer={analyzer} isActive={isPlaying} />
              </div>
              
              <AudioPlaybackControls
                isPlaying={isPlaying}
                progress={progress}
                duration={duration}
                onTogglePlayback={togglePlayback}
                onStopPlayback={stopPlayback}
                onSetProgress={setProgress}
                isLoadingAudio={isLoadingAudio}
                songName={file.name}
              />
            </div>

            <ManualLinkEditor
              activeYoutubeUrl={activeYoutubeUrl}
              setActiveYoutubeUrl={(url) => {
                setActiveYoutubeUrl(url);
                setActiveVideoId(getYoutubeId(url));
              }}
              activeUgUrl={activeUgUrl}
              setActiveUgUrl={setActiveUgUrl}
              songName={file.name}
              artistName={file.artist || "Unknown Artist"}
              handleUgPrint={handleUgPrint}
            />

            <AudioHarmonicControls
              pitch={pitch}
              setPitch={setPitch}
              tempo={tempo}
              setTempo={setTempo}
              volume={volume}
              setVolume={setVolume}
              fineTune={fineTune}
              setFineTune={setFineTune}
              originalKey={file.originalKey || currentSong?.originalKey}
              currentSongId={file.id || currentSong?.id}
              onUpdateSongKey={onUpdateSongKey}
            />
          </div>
        )}
      </div>

      {isMobile && file && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-white/10 z-[60] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-500">
           <Button 
            onClick={handleAddToGig} 
            className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-2xl gap-3 shadow-2xl shadow-indigo-600/30"
           >
             <ListPlus className="w-6 h-6" />
             {currentList ? `ADD TO ${currentList.name.toUpperCase()}` : 'ADD TO CURRENT GIG'}
           </Button>
           {currentList && (
             <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-center mt-2">
               Targeting: {currentList.name} ({currentList.songs.length} tracks)
             </p>
           )}
        </div>
      )}
    </div>
  );
});

export default AudioTransposer;
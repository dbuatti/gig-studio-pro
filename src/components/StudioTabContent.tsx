"use client";
import React from 'react';
import { SetlistSong } from './SetlistManager';
import { AudioEngineControls } from '@/hooks/use-tone-audio';
import SongDetailsTab from './SongDetailsTab';
import SongChartsTab from './SongChartsTab';
import LyricsEngine from './LyricsEngine';
import LibraryEngine from './LibraryEngine';
import SongConfigTab from './SongConfigTab';
import SongAudioPlaybackTab from './SongAudioPlaybackTab';
import YoutubeMediaManager from './YoutubeMediaManager';
import { transposeKey } from '@/utils/keyUtils';
import { cn } from '@/lib/utils';
import { Youtube } from 'lucide-react';

interface StudioTabContentProps {
  activeTab: 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library';
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onUpdateKey: (newTargetKey: string) => void;
  audioEngine: AudioEngineControls;
  isMobile: boolean;
  onLoadAudioFromUrl: (url: string, initialPitch: number) => Promise<void>;
  setPreviewPdfUrl: (url: string | null) => void;
  isFramable: (url: string | null) => boolean;
  activeChartType: 'pdf' | 'leadsheet' | 'web' | 'ug';
  setActiveChartType: (type: 'pdf' | 'leadsheet' | 'web' | 'ug') => void;
  handleUgPrint: () => void;
  handleDownloadAll: () => Promise<void>;
  onSwitchTab: (tab: 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library') => void;
  pitch: number;
  setPitch: (pitch: number) => void;
  targetKey: string;
  setTargetKey: (targetKey: string) => void;
  isPitchLinked: boolean;
  setIsPitchLinked: (linked: boolean) => void;
  setTempo: (tempo: number) => void;
  setVolume: (volume: number) => void;
  setFineTune: (fineTune: number) => void;
  currentBuffer: AudioBuffer | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  togglePlayback: () => void;
  stopPlayback: () => void;
  onRefreshSong?: () => Promise<void>;
}

const StudioTabContent: React.FC<StudioTabContentProps> = ({
  activeTab,
  song,
  formData,
  handleAutoSave,
  onUpdateKey,
  audioEngine,
  isMobile,
  onLoadAudioFromUrl,
  setPreviewPdfUrl,
  isFramable,
  activeChartType,
  setActiveChartType,
  handleUgPrint,
  handleDownloadAll,
  onSwitchTab,
  pitch,
  setPitch,
  targetKey,
  setTargetKey,
  isPitchLinked,
  setIsPitchLinked,
  setTempo,
  setVolume,
  setFineTune,
  currentBuffer,
  isPlaying,
  progress,
  duration,
  togglePlayback,
  stopPlayback,
  onRefreshSong,
}) => {
  switch (activeTab) {
    case 'config':
      return (
        <div id="studio-panel-config">
          <SongConfigTab 
            song={song}
            formData={formData}
            handleAutoSave={handleAutoSave}
            pitch={pitch}
            setPitch={setPitch}
            targetKey={targetKey}
            setTargetKey={setTargetKey}
            isPitchLinked={isPitchLinked}
            setIsPitchLinked={setIsPitchLinked}
            setTempo={setTempo}
            setVolume={setVolume}
            setFineTune={setFineTune}
            currentBuffer={currentBuffer}
            isPlaying={isPlaying}
            progress={progress}
            duration={duration}
            setProgress={audioEngine.setProgress}
            togglePlayback={togglePlayback}
            stopPlayback={stopPlayback}
            isMobile={isMobile}
            onSwitchTab={onSwitchTab}
          />
        </div>
      );
    case 'audio':
      return (
        <div id="studio-panel-audio">
          <SongAudioPlaybackTab 
            song={song}
            formData={formData}
            audioEngine={audioEngine}
            isMobile={isMobile}
            onLoadAudioFromUrl={onLoadAudioFromUrl}
            onSave={handleAutoSave}
            onUpdateKey={setTargetKey}
            transposeKey={transposeKey}
            pitch={pitch}
            setPitch={setPitch}
            targetKey={targetKey}
            setTargetKey={setTargetKey}
            isPitchLinked={isPitchLinked}
            setIsPitchLinked={setIsPitchLinked}
          />
        </div>
      );
    case 'details':
      return (
        <div id="studio-panel-details">
          <SongDetailsTab 
            formData={formData} 
            handleAutoSave={handleAutoSave} 
            isMobile={isMobile} 
          />
        </div>
      );
    case 'charts':
      return (
        <div id="studio-panel-charts" className="h-full flex flex-col">
          <SongChartsTab 
            formData={formData}
            handleAutoSave={handleAutoSave}
            isMobile={isMobile}
            setPreviewPdfUrl={setPreviewPdfUrl}
            isFramable={isFramable}
            activeChartType={activeChartType}
            setActiveChartType={setActiveChartType}
            handleUgPrint={handleUgPrint}
            pitch={pitch}
            setPitch={setPitch}
            targetKey={targetKey}
            setTargetKey={setTargetKey}
            isPitchLinked={isPitchLinked}
            setIsPitchLinked={setIsPitchLinked}
          />
        </div>
      );
    case 'lyrics':
      return (
        <div id="studio-panel-lyrics" className="h-full flex flex-col">
          <LyricsEngine 
            lyrics={formData.lyrics || ""} 
            onUpdate={(newLyrics) => handleAutoSave({ lyrics: newLyrics })} 
            artist={formData.artist} 
            title={formData.name} 
            isMobile={isMobile} 
          />
        </div>
      );
    case 'visual':
      return (
        <div id="studio-panel-visual" className="space-y-10 animate-in fade-in duration-200 h-full flex flex-col">
          <YoutubeMediaManager 
            song={song}
            formData={formData}
            handleAutoSave={handleAutoSave}
            onOpenAdmin={() => {}}
            onLoadAudioFromUrl={audioEngine.loadFromUrl}
            onSwitchTab={onSwitchTab}
            onRefreshSong={onRefreshSong}
          />
          <div className={cn("flex-1 bg-slate-900 rounded-[2.5rem] border-4 border-white/5 shadow-2xl overflow-hidden relative min-h-[300px]", !formData.youtubeUrl && "flex flex-col items-center justify-center")}>
            {formData.youtubeUrl ? 
              <iframe 
                width="100%" 
                height="100%" 
                src={`https://www.youtube.com/embed/${formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] || ''}?autoplay=0&modestbranding=1&rel=0`} 
                title="Reference" 
                frameBorder="0" 
                allowFullScreen 
                className="w-full h-full"
              /> : 
              <div className="flex flex-col items-center gap-4">
                <Youtube className="w-20 h-20 text-slate-700" />
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">No Video Linked</p>
                <p className="text-[10px] text-slate-700 max-w-xs text-center leading-relaxed">
                  Paste a YouTube URL above to watch the reference video alongside your rehearsal.
                </p>
              </div>
            }
          </div>
        </div>
      );
    case 'library':
      return (
        <div id="studio-panel-library">
          <LibraryEngine 
          formData={formData} 
          handleDownloadAll={handleDownloadAll} 
          isMobile={isMobile}
          setPreviewPdfUrl={setPreviewPdfUrl}
          handleUgPrint={handleUgPrint}
        />
        </div>
      );
    default:
      return null;
  }
};

export default StudioTabContent;
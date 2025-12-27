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
import { KeyPreference } from '@/hooks/use-settings'; // Import KeyPreference

interface StudioTabContentProps {
  activeTab: 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library';
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onUpdateKey: (newTargetKey: string) => void; // Changed to accept only newTargetKey
  audioEngine: AudioEngineControls;
  isMobile: boolean;
  onLoadAudioFromUrl: (url: string, initialPitch: number) => Promise<void>;
  onOpenAdmin?: () => void;
  setPreviewPdfUrl: (url: string | null) => void;
  isFramable: (url: string | null) => boolean;
  activeChartType: 'pdf' | 'leadsheet' | 'web' | 'ug';
  setActiveChartType: (type: 'pdf' | 'leadsheet' | 'web' | 'ug') => void;
  handleUgPrint: () => void;
  handleDownloadAll: () => Promise<void>;
  onSwitchTab: (tab: 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library') => void;
  // Props for SongConfigTab (now from useHarmonicSync)
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
  // NEW: Chord auto-scroll props
  chordAutoScrollEnabled: boolean;
  chordScrollSpeed: number;
}

const StudioTabContent: React.FC<StudioTabContentProps> = ({
  activeTab,
  song,
  formData,
  handleAutoSave,
  onUpdateKey, // This is now setTargetKey from useHarmonicSync
  audioEngine,
  isMobile,
  onLoadAudioFromUrl,
  onOpenAdmin,
  setPreviewPdfUrl,
  isFramable,
  activeChartType,
  setActiveChartType,
  handleUgPrint,
  handleDownloadAll,
  onSwitchTab,
  // Destructure SongConfigTab props (now from useHarmonicSync)
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
  // NEW: Chord auto-scroll props
  chordAutoScrollEnabled,
  chordScrollSpeed,
}) => {
  switch (activeTab) {
    case 'config':
      return (
        <SongConfigTab 
          song={song}
          formData={formData}
          handleAutoSave={handleAutoSave}
          // Pass harmonic sync props directly
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
          togglePlayback={togglePlayback}
          stopPlayback={stopPlayback}
          isMobile={isMobile}
        />
      );
    case 'audio':
      return (
        <SongAudioPlaybackTab 
          song={song}
          formData={formData}
          audioEngine={audioEngine}
          isMobile={isMobile}
          onLoadAudioFromUrl={onLoadAudioFromUrl}
          onSave={handleAutoSave} // Pass handleAutoSave directly
          onUpdateKey={setTargetKey} // Use setTargetKey from useHarmonicSync
          transposeKey={transposeKey}
          // Pass harmonic sync props
          pitch={pitch}
          setPitch={setPitch}
          targetKey={targetKey}
          setTargetKey={setTargetKey}
          isPitchLinked={isPitchLinked}
          setIsPitchLinked={setIsPitchLinked}
        />
      );
    case 'details':
      return (
        <SongDetailsTab 
          formData={formData} 
          handleAutoSave={handleAutoSave} // Pass handleAutoSave directly
          isMobile={isMobile} 
        />
      );
    case 'charts':
      return (
        <SongChartsTab 
          formData={formData}
          handleAutoSave={handleAutoSave}
          isMobile={isMobile}
          setPreviewPdfUrl={setPreviewPdfUrl}
          isFramable={isFramable}
          activeChartType={activeChartType}
          setActiveChartType={setActiveChartType}
          handleUgPrint={handleUgPrint}
          // NEW: Pass auto-scroll props
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          chordAutoScrollEnabled={chordAutoScrollEnabled}
          chordScrollSpeed={chordScrollSpeed}
          // Pass harmonic sync props to UGChordsEditor via SongChartsTab
          pitch={pitch}
          setPitch={setPitch}
          targetKey={targetKey}
          setTargetKey={setTargetKey}
          isPitchLinked={isPitchLinked}
          setIsPitchLinked={setIsPitchLinked}
        />
      );
    case 'lyrics':
      return (
        <LyricsEngine 
          lyrics={formData.lyrics || ""} 
          onUpdate={(newLyrics) => handleAutoSave({ lyrics: newLyrics })} 
          artist={formData.artist} 
          title={formData.name} 
          isMobile={isMobile} 
        />
      );
    case 'visual':
      return (
        <div className="space-y-10 animate-in fade-in duration-500 h-full flex flex-col">
          <YoutubeMediaManager 
            song={song}
            formData={formData}
            handleAutoSave={handleAutoSave}
            onOpenAdmin={onOpenAdmin}
            onLoadAudioFromUrl={audioEngine.loadFromUrl}
            onSwitchTab={onSwitchTab}
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
              <Youtube className="w-32 h-32 text-slate-800" />
            }
          </div>
        </div>
      );
    case 'library':
      return (
        <LibraryEngine 
          formData={formData} 
          handleDownloadAll={handleDownloadAll} 
          isMobile={isMobile}
          setPreviewPdfUrl={setPreviewPdfUrl}
          handleUgPrint={handleUgPrint}
        />
      );
    default:
      return null;
  }
};

export default StudioTabContent;
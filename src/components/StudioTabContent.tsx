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
import { cn } from '@/lib/utils'; // Import cn utility
import { Youtube } from 'lucide-react'; // Import Youtube icon

interface StudioTabContentProps {
  activeTab: 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library';
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
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
  onOpenAdmin,
  setPreviewPdfUrl,
  isFramable,
  activeChartType,
  setActiveChartType,
  handleUgPrint,
  handleDownloadAll,
}) => {
  switch (activeTab) {
    case 'config':
      return (
        <SongConfigTab
          song={song}
          formData={formData}
          handleAutoSave={handleAutoSave}
          onUpdateKey={onUpdateKey}
          setPitch={audioEngine.setPitch}
          setTempo={audioEngine.setTempo}
          setVolume={audioEngine.setVolume}
          setFineTune={audioEngine.setFineTune}
          currentBuffer={audioEngine.currentBuffer}
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
          onSave={handleAutoSave} // Now correctly matches the updated prop type in SongAudioPlaybackTab
          onUpdateKey={onUpdateKey}
          transposeKey={transposeKey}
        />
      );
    case 'details':
      return (
        <SongDetailsTab formData={formData} handleAutoSave={handleAutoSave} isMobile={isMobile} />
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
            onLoadAudioFromUrl={audioEngine.loadFromUrl} // Changed prop name and passed audioEngine.loadFromUrl
          />
          <div className={cn("flex-1 bg-slate-900 rounded-[2.5rem] border-4 border-white/5 shadow-2xl overflow-hidden relative min-h-[300px]", !formData.youtubeUrl && "flex flex-col items-center justify-center")}>
            {formData.youtubeUrl ? <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] || ''}?autoplay=0&mute=1&modestbranding=1&rel=0`} title="Reference" frameBorder="0" allowFullScreen className="w-full h-full" /> : <Youtube className="w-32 h-32 text-slate-800" />}
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
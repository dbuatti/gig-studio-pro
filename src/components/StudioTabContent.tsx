"use client";
import React from 'react';
import { SetlistSong } from './SetlistManager';
import SongDetailsTab from './SongDetailsTab';
import SongChartsTab from './SongChartsTab';
import LyricsEngine from './LyricsEngine';
import LibraryEngine from './LibraryEngine';
import SongConfigTab from './SongConfigTab';
import SongAudioPlaybackTab from './SongAudioPlaybackTab';
import AudioVisualizer from './AudioVisualizer';
import { useToneAudio } from '@/hooks/use-tone-audio';

interface StudioTabContentProps {
  activeTab: string;
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  audioEngine: ReturnType<typeof useToneAudio>;
  isMobile: boolean;
  onLoadAudioFromUrl: (url: string, pitch: number) => Promise<void>;
  onOpenAdmin?: () => void;
  setPreviewPdfUrl: (url: string | null) => void;
  isFramable: (url: string | null) => boolean;
  activeChartType: 'pdf' | 'leadsheet' | 'web' | 'ug';
  setActiveChartType: (type: 'pdf' | 'leadsheet' | 'web' | 'ug') => void;
  handleUgPrint: () => void;
  handleDownloadAll: () => Promise<void>;
  onSwitchTab: (tab: 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library') => void; // Corrected type
  isChartsReaderExpanded: boolean;
  onToggleChartsReaderExpanded: (expanded: boolean) => void;
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
  onSwitchTab,
  isChartsReaderExpanded,
  onToggleChartsReaderExpanded
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
    case 'details':
      return (
        <SongDetailsTab
          formData={formData}
          handleAutoSave={handleAutoSave}
          isMobile={isMobile}
          onOpenAdmin={onOpenAdmin}
        />
      );
    case 'audio':
      return (
        <SongAudioPlaybackTab
          song={song}
          formData={formData}
          handleAutoSave={handleAutoSave}
          audioEngine={audioEngine}
          isMobile={isMobile}
          onLoadAudioFromUrl={onLoadAudioFromUrl}
        />
      );
    case 'visual':
      return (
        <AudioVisualizer
          analyzer={audioEngine.analyzer}
          isPlaying={audioEngine.isPlaying}
          isMobile={isMobile}
        />
      );
    case 'lyrics':
      return (
        <LyricsEngine
          formData={formData}
          handleAutoSave={handleAutoSave}
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
          isChartsReaderExpanded={isChartsReaderExpanded}
          onToggleChartsReaderExpanded={onToggleChartsReaderExpanded}
        />
      );
    case 'library':
      return (
        <LibraryEngine
          formData={formData}
          handleAutoSave={handleAutoSave}
          isMobile={isMobile}
          handleDownloadAll={handleDownloadAll}
          onSwitchTab={onSwitchTab}
        />
      );
    default:
      return <div className="text-white">Select a tab</div>;
  }
};

export default StudioTabContent;
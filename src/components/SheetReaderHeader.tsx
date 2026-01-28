"use client";

import React from 'react';
import { SetlistSong, ChartType } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Search, Settings, Fullscreen, FullscreenExit, Volume2, VolumeX, Link, Edit3, Ruler, Plus, Minus, Layout, BookOpen, Guitar, FileText, ScrollText, Sheet, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KeyPreference } from '@/hooks/use-settings';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type SheetReaderHeaderProps = {
  currentSong: SetlistSong;
  onClose: () => void;
  onOpenRepertoireSearch: () => void;
  onOpenCurrentSongStudio: () => void;
  isLoading: boolean;
  keyPreference: KeyPreference;
  onUpdateKey: (newKey: string) => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  setIsOverlayOpen: (isOpen: boolean) => void;
  pitch: number;
  setPitch: (pitch: number) => void;
  readerKeyPreference: 'sharps' | 'flats';
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  effectiveTargetKey: string;
  isAudioPlayerVisible: boolean;
  onToggleAudioPlayer: () => void;
  onAddLink: () => void;
  onToggleLinkEditMode: () => void;
  onOpenLinkSizeModal: () => void;
  isEditingLinksMode: boolean;
  selectedChartType: ChartType;
  setSelectedChartType: (type: ChartType) => void;
  pdfCurrentPage: number;
  pdfNumPages: number | null;
  onPrevPdfPage: () => void;
  onNextPdfPage: () => void;
  onZoomInPdf: () => void;
  onZoomOutPdf: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
};

const SheetReaderHeader: React.FC<SheetReaderHeaderProps> = ({
  currentSong,
  onClose,
  onOpenRepertoireSearch,
  onOpenCurrentSongStudio,
  isLoading,
  keyPreference,
  onUpdateKey,
  isFullScreen,
  onToggleFullScreen,
  setIsOverlayOpen,
  pitch,
  setPitch,
  readerKeyPreference,
  isSidebarOpen,
  onToggleSidebar,
  effectiveTargetKey,
  isAudioPlayerVisible,
  onToggleAudioPlayer,
  onAddLink,
  onToggleLinkEditMode,
  onOpenLinkSizeModal,
  isEditingLinksMode,
  selectedChartType,
  setSelectedChartType,
  pdfCurrentPage,
  pdfNumPages,
  onPrevPdfPage,
  onNextPdfPage,
  onZoomInPdf,
  onZoomOutPdf,
  canZoomIn,
  canZoomOut,
}) => {
  const getChartTypeIcon = (type: ChartType) => {
    switch (type) {
      case 'pdf': return <FileText className="w-4 h-4" />;
      case 'leadsheet': return <Sheet className="w-4 h-4" />;
      case 'chords': return <Guitar className="w-4 h-4" />;
      default: return <Layout className="w-4 h-4" />;
    }
  };

  const hasPdf = !!(currentSong?.pdfUrl || currentSong?.sheet_music_url);
  const hasLeadsheet = !!currentSong?.leadsheetUrl;
  const hasChords = !!currentSong?.ug_chords_text;

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-[72px] px-4 bg-slate-900 border-b border-slate-800 transition-all duration-300",
      isFullScreen && "h-16 px-2"
    )}>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="text-slate-400 hover:bg-slate-800 hover:text-white">
                <Layout className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-700 text-white border-slate-600">
              Toggle Sidebar
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-700 text-white border-slate-600">
              Exit Reader
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onOpenRepertoireSearch} className="text-slate-400 hover:bg-slate-800 hover:text-white">
                <Search className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-700 text-white border-slate-600">
              Search Repertoire
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onOpenCurrentSongStudio} className="text-slate-400 hover:bg-slate-800 hover:text-white">
                <Edit3 className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-700 text-white border-slate-600">
              Open Song Studio
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2">
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        ) : currentSong ? (
          <>
            <h2 className="text-lg font-bold text-white truncate max-w-full">{currentSong.name}</h2>
            <p className="text-sm text-slate-400 truncate max-w-full">{currentSong.artist}</p>
            <div className="flex items-center gap-2 mt-1">
              {isEditingLinksMode && (
                <Badge variant="secondary" className="bg-indigo-600 text-white">
                  <Ruler className="w-3 h-3 mr-1" /> Editing Links
                </Badge>
              )}
              {currentSong.originalKey && (
                <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                  Original: {currentSong.originalKey}
                </Badge>
              )}
              {effectiveTargetKey && effectiveTargetKey !== currentSong.originalKey && (
                <Badge variant="secondary" className="bg-indigo-700 text-white">
                  Stage: {effectiveTargetKey}
                </Badge>
              )}
            </div>
          </>
        ) : (
          <p className="text-slate-400">No song selected</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Chart Type Selector */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroup
                type="single"
                value={selectedChartType}
                onValueChange={(value: ChartType) => value && setSelectedChartType(value)}
                className="bg-slate-800 rounded-md p-1"
              >
                {hasPdf && (
                  <ToggleGroupItem value="pdf" aria-label="PDF/Sheet Music" className="data-[state=on]:bg-indigo-600 data-[state=on]:text-white text-slate-400 hover:bg-slate-700">
                    <FileText className="w-4 h-4" />
                  </ToggleGroupItem>
                )}
                {hasLeadsheet && (
                  <ToggleGroupItem value="leadsheet" aria-label="Leadsheet" className="data-[state=on]:bg-indigo-600 data-[state=on]:text-white text-slate-400 hover:bg-slate-700">
                    <Sheet className="w-4 h-4" />
                  </ToggleGroupItem>
                )}
                {hasChords && (
                  <ToggleGroupItem value="chords" aria-label="UG Chords" className="data-[state=on]:bg-indigo-600 data-[state=on]:text-white text-slate-400 hover:bg-slate-700">
                    <Guitar className="w-4 h-4" />
                  </ToggleGroupItem>
                )}
              </ToggleGroup>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-700 text-white border-slate-600">
              Select Chart Type
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* PDF Navigation & Zoom Controls */}
        {(selectedChartType === 'pdf' || selectedChartType === 'leadsheet') && pdfNumPages && pdfNumPages > 1 && (
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onPrevPdfPage} disabled={pdfCurrentPage <= 1} className="text-slate-400 hover:bg-slate-800 hover:text-white">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-700 text-white border-slate-600">
                  Previous Page
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-sm text-slate-300 whitespace-nowrap">{pdfCurrentPage} / {pdfNumPages}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onNextPdfPage} disabled={pdfCurrentPage >= (pdfNumPages || 1)} className="text-slate-400 hover:bg-slate-800 hover:text-white">
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-700 text-white border-slate-600">
                  Next Page
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {(selectedChartType === 'pdf' || selectedChartType === 'leadsheet') && (
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onZoomOutPdf} disabled={!canZoomOut} className="text-slate-400 hover:bg-slate-800 hover:text-white">
                    <Minus className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-700 text-white border-slate-600">
                  Zoom Out
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onZoomInPdf} disabled={!canZoomIn} className="text-slate-400 hover:bg-slate-800 hover:text-white">
                    <Plus className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-700 text-white border-slate-600">
                  Zoom In
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Audio Player Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggleAudioPlayer} className="text-slate-400 hover:bg-slate-800 hover:text-white">
                {isAudioPlayerVisible ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-700 text-white border-slate-600">
              {isAudioPlayerVisible ? 'Hide Audio Player' : 'Show Audio Player'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Fullscreen Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onToggleFullScreen} className="text-slate-400 hover:bg-slate-800 hover:text-white">
                {isFullScreen ? <FullscreenExit className="w-5 h-5" /> : <Fullscreen className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-700 text-white border-slate-600">
              {isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
};

export default SheetReaderHeader;
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Play, Pause, SkipForward, SkipBack, X, Music, 
  Waves, Activity, ArrowRight, Shuffle,
  Settings2, Gauge, FileText, Save, Youtube,
  Monitor, AlignLeft, RotateCcw, ShieldCheck, ExternalLink,
  Clock, Timer, ChevronRight, Zap, Minus, Plus, Edit, Check, Keyboard, CloudDownload, AlertTriangle, Loader2
} from 'lucide-react';
import { SetlistSong } from './SetlistManagementModal';
import AudioVisualizer from './AudioVisualizer';
import Metronome from './Metronome';
import ShortcutLegend from './ShortcutLegend';
import { ALL_KEYS_SHARP, ALL_KEYS_FLAT, formatKey, calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { useSettings } from '@/hooks/use-settings';
import { AudioEngineControls } from '@/hooks/use-tone-audio';

interface PerformanceOverlayProps {
  songs: SetlistSong[];
  currentIndex: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onTogglePlayback: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShuffle: () => void;
  onClose: () => void;
  onUpdateSong: (songId: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (songId: string, newKey: string) => void;
  analyzer: AudioEngineControls['analyzer'];
  gigId: string;
  onOpenStudio: (songId: string | null) => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  onToggleHeatmap: () => void;
  showHeatmap: boolean;
  onToggleAudioPlayer: () => void;
  isAudioPlayerVisible: boolean;
  onToggleFullScreen: () => void;
  isFullScreen: boolean;
  onOpenLinkSizeModal: () => void;
  onToggleLinkEditMode: () => void;
  isEditingLinksMode: boolean;
  onAddLink: () => void;
  onOpenRepertoireSearch: () => void;
  onToggleReader: () => void;
  isReaderMode: boolean;
  activeSongId: string | null;
}

const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  songs,
  currentIndex,
  isPlaying,
  progress,
  duration,
  onTogglePlayback,
  onNext,
  onPrevious,
  onShuffle,
  onClose,
  onUpdateSong,
  onUpdateKey,
  analyzer,
  gigId,
  onOpenStudio,
  onOpenSettings,
  onOpenGuide,
  onToggleHeatmap,
  showHeatmap,
  onToggleAudioPlayer,
  isAudioPlayerVisible,
  onToggleFullScreen,
  isFullScreen,
  onOpenLinkSizeModal,
  onToggleLinkEditMode,
  isEditingLinksMode,
  onAddLink,
  onOpenRepertoireSearch,
  onToggleReader,
  isReaderMode,
  activeSongId,
}) => {
  const [isMetronomeOpen, setIsMetronomeOpen] = useState(false);
  const [isShortcutLegendOpen, setIsShortcutLegendOpen] = useState(false);
  const [volume, setVolume] = useState(-12); // dB
  const [tempoMultiplier, setTempoMultiplier] = useState(1.0);
  const [currentKey, setCurrentKey] = useState(songs[currentIndex]?.targetKey || songs[currentIndex]?.originalKey || 'C');
  const [isKeyDropdownOpen, setIsKeyDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isLinkSizeModalOpen, setIsLinkSizeModalOpen] = useState(false);

  const { keyPreference: globalPreference } = useSettings();
  const currentSong = songs[currentIndex];
  const navigate = useNavigate();

  const keysToUse = globalPreference === 'flats' ? ALL_KEYS_FLAT : ALL_KEYS_SHARP;

  const handleKeyChange = useCallback((newKey: string) => {
    setCurrentKey(newKey);
    if (currentSong) {
      onUpdateKey(currentSong.id, newKey);
    }
  }, [currentSong, onUpdateKey]);

  const handlePitchChange = useCallback((newPitch: number) => {
    if (currentSong) {
      const originalKey = currentSong.originalKey || 'C';
      const newTargetKey = transposeKey(originalKey, newPitch, globalPreference);
      onUpdateSong(currentSong.id, { pitch: newPitch, targetKey: newTargetKey });
      setCurrentKey(newTargetKey);
    }
  }, [currentSong, onUpdateSong, globalPreference]);

  const handleTempoChange = useCallback((newTempo: number) => {
    setTempoMultiplier(newTempo);
    // Tempo adjustment is usually handled by the audio engine directly, but we can expose it here if needed.
    // For now, we just track the multiplier.
  }, []);

  const handleTogglePlayed = useCallback(() => {
    if (currentSong) {
      onUpdateSong(currentSong.id, { isPlayed: !currentSong.isPlayed });
    }
  }, [currentSong, onUpdateSong]);

  const handleOpenStudio = () => {
    onClose();
    navigate(`/gig/${gigId}/song/${currentSong?.id}`);
  };

  const handleOpenLinkSizeModal = () => {
    onClose();
    setIsLinkSizeModalOpen(true);
  };

  const handleOpenLinkEditor = () => {
    onClose();
    onAddLink();
  };

  const handleToggleLinkEditMode = () => {
    onToggleLinkEditMode();
    onClose();
  };

  const handleToggleHeatmap = () => {
    onToggleHeatmap();
    onClose();
  };

  const handleToggleReader = () => {
    onToggleReader();
    onClose();
  };

  const handleExit = () => {
    onClose();
    if (isFullScreen) {
      document.exitFullscreen();
    }
  };

  const currentSongIndex = songs.findIndex(s => s.id === activeSongId);
  const currentSongData = songs[currentSongIndex];

  const displayKey = currentSongData ? formatKey(currentSongData.targetKey || currentSongData.originalKey, globalPreference === 'neutral' ? (currentSongData.key_preference as any) || 'sharps' : globalPreference as any) : 'C';
  const pitchOffset = currentSongData ? calculateSemitones(currentSongData.originalKey || 'C', currentSongData.targetKey || currentSongData.originalKey || 'C') : 0;

  const isChartAvailable = !!currentSongData?.pdfUrl || !!currentSongData?.leadsheetUrl || !!currentSongData?.ug_chords_text || !!currentSongData?.sheet_music_url;

  return (
    <div className="fixed inset-0 z-40 bg-black/90 backdrop-blur-lg animate-in fade-in duration-300 flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleExit} className="rounded-full hover:bg-white/10 text-white/70 hover:text-white">
            <X className="w-6 h-6" />
          </Button>
          <div className="flex flex-col text-left">
            <p className="text-xs font-medium text-slate-300 uppercase tracking-widest">Now Playing</p>
            <h1 className="text-xl font-black uppercase tracking-tight truncate max-w-xs">{currentSongData?.name || 'Loading...'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleToggleFullScreen} className="rounded-full hover:bg-white/10 text-slate-400">
            {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleToggleReader} className={cn("rounded-full hover:bg-white/10", isReaderMode ? "bg-indigo-600 text-white" : "text-slate-400")}>
            <FileText className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Song Info & Controls */}
        <div className="w-1/3 p-8 border-r border-white/10 flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-tight text-indigo-400 flex items-center gap-2"><Music className="w-5 h-5" /> Track Details</h2>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-slate-400 uppercase">Artist</p>
                <p className="text-sm font-bold text-white truncate">{currentSongData?.artist || 'N/A'}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-slate-400 uppercase">BPM</p>
                <p className="text-sm font-mono font-bold text-white">{currentSongData?.bpm || 'N/A'}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-slate-400 uppercase">Original Key</p>
                <p className="text-sm font-mono font-bold text-white">{currentSongData?.originalKey || 'TBC'}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-indigo-400 uppercase">Stage Key</p>
                <p className="text-sm font-mono font-bold text-indigo-300">{displayKey}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-black uppercase tracking-tight text-indigo-400 flex items-center gap-2"><Gauge className="w-5 h-5" /> Performance Tuning</h2>
            
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Minus className="w-3 h-3" /> Pitch Shift ({pitchOffset} ST)</Label>
                  <span className="text-sm font-mono font-bold text-white">{pitchOffset > 0 ? `+${pitchOffset}` : pitchOffset}</span>
                </div>
                <Slider 
                  value={[pitchOffset]} 
                  min={-12} 
                  max={12} 
                  step={1} 
                  onValueChange={(v) => handlePitchChange(v[0])}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Tempo Multiplier</Label>
                  <span className="text-sm font-mono font-bold text-white">{(tempoMultiplier * 100).toFixed(0)}%</span>
                </div>
                <Slider 
                  value={[tempoMultiplier]} 
                  min={0.5} 
                  max={1.5} 
                  step={0.01} 
                  onValueChange={(v) => handleTempoChange(v[0])}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/10">
            <h2 className="text-lg font-black uppercase tracking-tight text-indigo-400 flex items-center gap-2"><Settings2 className="w-5 h-5" /> Tools</h2>
            <Button variant="ghost" onClick={handleOpenStudio} disabled={!currentSong} className="w-full justify-start h-12 bg-white/5 hover:bg-white/10 rounded-xl text-white font-bold uppercase tracking-widest gap-3">
              <Edit className="w-4 h-4" /> Edit Song Details
            </Button>
            <Button variant="ghost" onClick={handleToggleHeatmap} disabled={!currentSong} className={cn("w-full justify-start h-12 rounded-xl font-bold uppercase tracking-widest gap-3", showHeatmap ? "bg-amber-600/20 text-amber-400 hover:bg-amber-600/30" : "bg-white/5 hover:bg-white/10 text-slate-300")}>
              <Sparkles className="w-4 h-4" /> Heatmap Overlay {showHeatmap ? 'ON' : 'OFF'}
            </Button>
            <Button variant="ghost" onClick={() => setIsMetronomeOpen(true)} disabled={!currentSong} className="w-full justify-start h-12 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 font-bold uppercase tracking-widest gap-3">
              <Zap className="w-4 h-4" /> Metronome
            </Button>
            <Button variant="ghost" onClick={handleOpenLinkSizeModal} className="w-full justify-start h-12 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 font-bold uppercase tracking-widest gap-3">
              <Ruler className="w-4 h-4" /> Link Size Settings
            </Button>
            <Button variant="ghost" onClick={handleToggleLinkEditMode} disabled={!currentSong || !currentSong.pdfUrl && !currentSong.sheet_music_url} className={cn("w-full justify-start h-12 rounded-xl font-bold uppercase tracking-widest gap-3", isEditingLinksMode ? "bg-red-600/20 text-red-400 hover:bg-red-600/30" : "bg-white/5 hover:bg-white/10 text-slate-300")}>
              <LinkIcon className="w-4 h-4" /> Link Editor {isEditingLinksMode ? 'ACTIVE' : 'OFF'}
            </Button>
          </div>
        </div>

        {/* Right Column: Chart/Lyrics */}
        <div className="w-2/3 p-8 flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black uppercase tracking-tight text-white">Chart View</h3>
              <Badge variant="outline" className="bg-indigo-600/20 border-indigo-500/50 text-indigo-300 font-bold uppercase text-xs">{currentSongData?.preferred_reader || 'Auto'}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleTogglePlayed} className="h-9 w-9 rounded-lg text-slate-400 hover:bg-white/10">
                {currentSongData?.isPlayed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <CircleDashed className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsKeyDropdownOpen(true)} className="h-9 w-9 rounded-lg text-slate-400 hover:bg-white/10">
                <Hash className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenRepertoireSearch()} className="h-9 w-9 rounded-lg text-slate-400 hover:bg-white/10">
                <Search className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onToggleAudioPlayer} className={cn("h-9 w-9 rounded-lg", isAudioPlayerVisible ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-white/10")}>
                <Headphones className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden rounded-2xl border-2 border-white/10 shadow-inner bg-black/50">
            {currentSongData ? (
              <>
                <div className="absolute top-4 left-4 z-20 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { onOpenStudio(); }} className="h-8 px-3 text-[9px] font-black uppercase bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-lg">
                    <Edit3 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { onOpenSettings(); }} className="h-8 px-3 text-[9px] font-black uppercase bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-lg">
                    <Settings2 className="w-3 h-3 mr-1" /> Song Settings
                  </Button>
                </div>
                
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleToggleReader} className={cn("h-8 px-3 text-[9px] font-black uppercase bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-lg", isReaderMode && "bg-emerald-600 hover:bg-emerald-700")}>
                    <FileText className="w-3 h-3 mr-1" /> Reader Mode
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleToggleHeatmap} className={cn("h-8 px-3 text-[9px] font-black uppercase bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-lg", showHeatmap && "bg-amber-600 hover:bg-amber-700")}>
                    <Sparkles className="w-3 h-3 mr-1" /> Heatmap
                  </Button>
                </div>

                <div className="absolute bottom-4 left-4 z-20 flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleToggleLinkEditMode} className={cn("h-8 px-3 text-[9px] font-black uppercase bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-lg", isEditingLinksMode && "bg-red-600 hover:bg-red-700")}>
                    <LinkIcon className="w-3 h-3 mr-1" /> Links {isEditingLinksMode ? 'EDIT' : 'OFF'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenLinkSizeModal} className="h-8 px-3 text-[9px] font-black uppercase bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-lg">
                    <Ruler className="w-3 h-3 mr-1" /> Link Size
                  </Button>
                </div>

                <div className="absolute bottom-4 right-4 z-20 flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleToggleAudioPlayer} className={cn("h-8 px-3 text-[9px] font-black uppercase bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-lg", isAudioPlayerVisible && "bg-indigo-600 hover:bg-indigo-700")}>
                    <Headphones className="w-3 h-3 mr-1" /> Audio Player
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenRepertoireSearch} className="h-8 px-3 text-[9px] font-black uppercase bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-lg">
                    <Search className="w-3 h-3 mr-1" /> Search
                  </Button>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  {currentSongData?.is_ready_to_sing !== false ? (
                    <div className="text-center p-4 bg-emerald-600/20 border-2 border-emerald-500 rounded-full shadow-xl shadow-emerald-500/30 animate-pulse-once">
                      <CheckCircle className="w-12 h-12 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-red-600/20 border-2 border-red-500 rounded-full shadow-xl shadow-red-500/30 animate-pulse-once">
                      <AlertCircle className="w-12 h-12 text-red-400" />
                    </div>
                  )}
                </div>

                {/* Chart Content */}
                <div className="w-full h-full flex items-center justify-center">
                  {currentSongData?.pdfUrl || currentSongData?.sheet_music_url ? (
                    <div className="w-full h-full overflow-auto">
                      <div className="flex justify-center items-start">
                        <div className="relative" style={{ width: '800px' }}>
                          <div className="flex justify-center gap-4 p-4 bg-black/50 sticky top-0 z-10 border-b border-white/10">
                            <Button variant="outline" size="icon" onClick={() => setIsKeyDropdownOpen(true)} className="bg-white/5 border-white/10 text-indigo-400 hover:bg-white/10 h-10 w-10 rounded-lg">
                              <Hash className="w-4 h-4" />
                            </Button>
                            <DropdownMenu open={isKeyDropdownOpen} onOpenChange={setIsKeyDropdownOpen}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="bg-indigo-600/20 border-indigo-500/50 text-indigo-300 font-mono font-bold h-10 px-4 rounded-xl shadow-lg">
                                  {displayKey} <ChevronDown className="w-4 h-4 ml-2" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="bg-slate-900 border-white/10 text-white z-[300] max-h-60 overflow-y-auto custom-scrollbar p-2">
                                <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">
                                  Stage Key
                                </DropdownMenuLabel>
                                {keysToUse.map((k) => (
                                  <DropdownMenuItem
                                    key={k}
                                    onSelect={() => handleKeyChange(k)}
                                    className={cn(
                                      "font-mono font-bold cursor-pointer",
                                      k === displayKey && "bg-indigo-600 text-white hover:bg-indigo-700"
                                    )}
                                  >
                                    {k}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator className="bg-white/5" />
                                <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-3 py-2">
                                  Pitch Offset
                                </DropdownMenuLabel>
                                <div className="p-2">
                                  <Slider 
                                    value={[pitchOffset]} 
                                    min={-12} 
                                    max={12} 
                                    step={1} 
                                    onValueChange={(v) => handlePitchChange(v[0])}
                                    className="w-full"
                                  />
                                  <div className="flex justify-between text-[10px] font-mono font-bold text-slate-500 mt-1">
                                    <span>{pitchOffset > 0 ? `+${pitchOffset}` : pitchOffset} ST</span>
                                    <Button variant="ghost" size="sm" onClick={() => handleKeyChange(currentSongData.originalKey || 'C')} className="text-xs text-indigo-400 hover:bg-white/10">Reset Pitch</Button>
                                  </div>
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="outline" size="sm" onClick={handleTogglePlayed} className={cn("h-9 px-3 text-[9px] font-black uppercase gap-1.5", currentSongData.isPlayed ? "bg-emerald-600/20 text-emerald-400" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10")}>
                              <CheckCircle className="w-3 h-3" /> {currentSongData.isPlayed ? 'Played' : 'Unplayed'}
                            </Button>
                          </div>
                          <div className="flex gap-2 mt-2">
                            {currentSongData.pdfUrl && (
                              <Button variant="outline" size="sm" onClick={() => window.open(currentSongData.pdfUrl!, '_blank')} className="h-8 px-3 text-[9px] font-black uppercase bg-blue-600/20 border-blue-500/50 text-blue-400 hover:bg-blue-600/30 rounded-lg gap-1.5">
                                <FileText className="w-3 h-3" /> PDF
                              </Button>
                            )}
                            {currentSongData.leadsheetUrl && (
                              <Button variant="outline" size="sm" onClick={() => window.open(currentSongData.leadsheetUrl!, '_blank')} className="h-8 px-3 text-[9px] font-black uppercase bg-purple-600/20 border-purple-500/50 text-purple-400 hover:bg-purple-600/30 rounded-lg gap-1.5">
                                <FileText className="w-3 h-3" /> Lead Sheet
                              </Button>
                            )}
                            {currentSongData.youtubeUrl && (
                              <Button variant="outline" size="sm" onClick={() => window.open(currentSongData.youtubeUrl!, '_blank')} className="h-8 px-3 text-[9px] font-black uppercase bg-red-600/20 border-red-500/50 text-red-400 hover:bg-red-600/30 rounded-lg gap-1.5">
                                <Youtube className="w-3 h-3" /> Video
                              </Button>
                            )}
                            {currentSongData.ugUrl && (
                              <Button variant="outline" size="sm" onClick={() => window.open(currentSongData.ugUrl!, '_blank')} className="h-8 px-3 text-[9px] font-black uppercase bg-green-600/20 border-green-500/50 text-green-400 hover:bg-green-600/30 rounded-lg gap-1.5">
                                <Guitar className="w-3 h-3" /> UG Tab
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm italic gap-4">
                      <Music className="w-12 h-12 opacity-20" />
                      <p>No song selected in the current list.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Player & Metronome */}
      <div className="shrink-0">
        {isAudioPlayerVisible && currentSongData && (
          <SheetReaderAudioPlayer
            currentSong={currentSongData}
            isPlaying={isPlaying}
            progress={progress}
            duration={duration}
            onTogglePlayback={onTogglePlayback}
            onNext={onNext}
            onPrevious={onPrevious}
            onSeek={audioEngine.setProgress}
            volume={volume}
            setVolume={setVolume}
            pitch={pitchOffset}
            setPitch={() => {}} // Not controlled here
            isLoadingAudio={isLoadingAudio}
            readerKeyPreference={readerKeyPreference}
            effectiveTargetKey={displayKey}
            isPlayerVisible={isAudioPlayerVisible}
          />
        )}
        {isMetronomeOpen && currentSongData && (
          <Metronome initialBpm={parseInt(currentSongData.bpm || '120')} />
        )}
      </div>

      <ShortcutLegend isOpen={isShortcutLegendOpen} onClose={() => setIsShortcutLegendOpen(false)} />
      <LinkSizeModal isOpen={isLinkSizeModalOpen} onClose={() => setIsLinkSizeModalOpen(false)} onLinkSizeUpdated={() => {}} />
    </div>
  );
};

export default PerformanceOverlay;
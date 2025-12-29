"use client";

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import * as Tone from 'tone';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Play, Pause, RotateCcw, Volume2, Waves, Settings2, Link as LinkIcon, Globe, Search, Youtube, PlusCircle, Library, Sparkles, Check, FileText, Subtitles, ChevronUp, ChevronDown, Printer, ListPlus } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import AudioVisualizer from './AudioVisualizer';
import SongSearch from './SongSearch';
import MyLibrary from './MyLibrary';
import GlobalLibrary from './GlobalLibrary';
import SongSuggestions from './SongSuggestions';
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SetlistSong } from './SetlistManager';
import { transposeKey } from '@/utils/keyUtils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useIsMobile } from '@/hooks/use-mobile';

export interface AudioTransposerRef {
  loadFromUrl: (url: string, name: string, artist: string, youtubeUrl?: string, originalKey?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string) => Promise<void>;
  setPitch: (pitch: number) => void;
  getPitch: () => number;
  triggerSearch: (query: string) => void;
  togglePlayback: () => Promise<void>;
  stopPlayback: () => void;
  resetEngine: () => void; // Added resetEngine to the interface
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
    loadFromUrl: hookLoadFromUrl, togglePlayback: hookTogglePlayback, stopPlayback: hookStopPlayback, resetEngine
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

  const suggestedKey = useMemo(() => {
    const activeKey = file?.originalKey || currentSong?.originalKey;
    if (!activeKey || activeKey === "TBC") return null;
    return transposeKey(activeKey, pitch);
  }, [file?.originalKey, currentSong?.originalKey, pitch]);

  const handleApplyKey = () => {
    if (currentSong && suggestedKey && onUpdateSongKey) {
      onUpdateSongKey(currentSong.id, suggestedKey);
      showSuccess(`Applied ${suggestedKey}`);
    }
  };

  const handleOctaveShift = (direction: 'up' | 'down') => {
    const shift = direction === 'up' ? 12 : -12;
    const newPitch = pitch + shift;
    if (newPitch > 24 || newPitch < -24) {
      showError("Range limit reached.");
      return;
    }
    setPitch(newPitch);
    if (currentSong && onUpdateSongKey) {
      const activeKey = file?.originalKey || currentSong?.originalKey;
      if (activeKey && activeKey !== "TBC") {
        const newTarget = transposeKey(activeKey, newPitch);
        onUpdateSongKey(currentSong.id, newTarget);
      }
    }
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
    resetEngine, // Exposed resetEngine
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9 bg-slate-100 dark:bg-slate-800 p-1 mb-6">
            <TabsTrigger value="search" className="text-[10px] uppercase font-bold gap-1.5"><Search className="w-3 h-3" /> iTunes</TabsTrigger>
            <TabsTrigger value="community" className="text-[10px] uppercase font-bold gap-1.5"><Globe className="w-3 h-3" /> Community</TabsTrigger>
            <TabsTrigger value="suggestions" className="text-[10px] uppercase font-bold gap-1.5"><Sparkles className="w-3 h-3" /> Discover</TabsTrigger>
            <TabsTrigger value="repertoire" className="text-[10px] uppercase font-bold gap-1.5"><Library className="w-3 h-3" /> Library</TabsTrigger>
          </TabsList>
          
          <TabsContent value="search" className="mt-0 space-y-4">
            <SongSearch 
              onSelectSong={(url, name, artist, yt) => { loadFromUrl(url, name, artist, yt); }} 
              onAddToSetlist={(url, name, artist, yt, ug, apple, gen) => 
                onAddToSetlist?.(url, name, artist, yt, ug, apple, gen, 0)
              }
              externalQuery={searchQuery}
            />
          </TabsContent>

          <TabsContent value="community" className="mt-0 space-y-4">
            <GlobalLibrary onImport={handleImportGlobal} />
          </TabsContent>

          <TabsContent value="suggestions" className="mt-0 space-y-4">
            <SongSuggestions repertoire={repertoire} onSelectSuggestion={handleSelectSuggestion} />
          </TabsContent>

          <TabsContent value="repertoire" className="mt-0 space-y-4">
            <MyLibrary 
              repertoire={repertoire} 
              onAddSong={(song) => onAddExistingSong?.(song)}
            />
          </TabsContent>
        </Tabs>

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
              
              <div className="flex items-center justify-center gap-6">
                <Button variant="outline" size="icon" onClick={stopPlayback} className="rounded-full h-10 w-10">
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button size="lg" onClick={togglePlayback} className="w-16 h-16 rounded-full shadow-xl bg-indigo-600 hover:bg-indigo-700">
                  {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-0.5" />}
                </Button>
                <div className="w-10" />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between text-[9px] font-mono text-indigo-600 font-black uppercase tracking-tighter">
                <span>{new Date((progress/100 * duration) * 1000).toISOString().substr(14, 5)}</span>
                <span className="opacity-60 truncate max-w-[180px]">{file.name}</span>
                <span>{new Date(duration * 1000).toISOString().substr(14, 5)}</span>
              </div>
              <Slider value={[progress]} max={100} step={0.1} onValueChange={([v]) => setProgress(v)} />
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b pb-2 mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <LinkIcon className="w-3.5 h-3.5 text-indigo-500" /> Manual Metadata Links
                </span>
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[9px] font-bold text-slate-500 uppercase flex items-center justify-between">
                    <span>YouTube Full Version</span>
                    <button 
                      onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(file.artist + ' ' + file.name + ' full audio')}`, '_blank')}
                      className="text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <Youtube className="w-3 h-3" /> Find
                    </button>
                  </Label>
                  <Input 
                    placeholder="Paste YouTube Link..." 
                    className="h-8 text-[10px] bg-white border-slate-100" 
                    value={activeYoutubeUrl || ""} 
                    onChange={(e) => {
                      setActiveYoutubeUrl(e.target.value);
                      setActiveVideoId(getYoutubeId(e.target.value));
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[9px] font-bold text-slate-500 uppercase flex items-center justify-between">
                    <span>Ultimate Guitar Tab</span>
                    <div className="flex gap-2">
                       <button onClick={handleUgPrint} className="text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                         <Printer className="w-3 h-3" /> Print
                       </button>
                       <button 
                        onClick={() => window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(file.artist + ' ' + file.name + ' chords')}`, '_blank')}
                        className="text-orange-500 hover:text-orange-600 flex items-center gap-1"
                       >
                        <FileText className="w-3 h-3" /> Search
                       </button>
                    </div>
                  </Label>
                  <Input 
                    placeholder="Paste UG Tab Link..." 
                    className="h-8 text-[10px] bg-white border-slate-100" 
                    value={activeUgUrl || ""} 
                    onChange={(e) => setActiveUgUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Settings2 className="w-3 h-3 text-indigo-500" /> Key Transposer
                  </Label>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {pitch > 0 ? `+${pitch}` : pitch} ST
                    </span>
                    <div className="flex bg-slate-200/50 dark:bg-slate-800/50 rounded-lg border p-0.5 shadow-inner">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleOctaveShift('down')} className="h-7 px-2 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-black uppercase text-slate-500 hover:text-indigo-600 transition-colors border-r">- oct</button>
                          </TooltipTrigger>
                          <TooltipContent className="text-[9px] font-black uppercase">-12 ST</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleOctaveShift('up')} className="h-7 px-2 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-black uppercase text-slate-500 hover:text-indigo-600 transition-colors">+ oct</button>
                          </TooltipTrigger>
                          <TooltipContent className="text-[9px] font-black uppercase">+12 ST</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <Slider value={[pitch]} min={-24} max={24} step={1} onValueChange={([v]) => setPitch(v)} />
                  </div>
                  {suggestedKey && (
                    <Button onClick={handleApplyKey} size="sm" className="bg-indigo-50 text-indigo-600 h-9 px-3 text-[10px] uppercase font-black gap-1">
                      <Sparkles className="w-3 h-3" /> Apply {suggestedKey}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tempo</Label>
                    <span className="text-xs font-mono font-bold text-indigo-600">{tempo.toFixed(2)}x</span>
                  </div>
                  <Slider value={[tempo]} min={0.5} max={1.5} step={0.01} onValueChange={([v]) => setTempo(v)} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Volume2 className="w-3 h-3 text-indigo-500" /> Gain</Label>
                    <span className="text-[10px] font-mono font-bold text-slate-600">{Math.round((volume + 60) * 1.66)}%</span>
                  </div>
                  <Slider value={[volume]} min={-60} max={0} step={1} onValueChange={([v]) => setVolume(v)} />
                </div>
              </div>
            </div>
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
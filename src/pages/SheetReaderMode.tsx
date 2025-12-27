"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  FileText, ArrowLeft, ChevronLeft, ChevronRight, Play, Pause, Shuffle, Timer, Filter, Music, Check, X, Loader2, Guitar, AlignLeft, ExternalLink, ShieldCheck, ListMusic, SortAsc, SortDesc, Search, Volume2, RotateCcw, Plus, Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import UGChordsReader from '@/components/UGChordsReader';
import { formatKey, calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showSuccess, showError } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useToneAudio } from '@/hooks/use-tone-audio'; // Import useToneAudio

interface FilterState {
  hasAudio: boolean;
  isApproved: boolean;
  hasCharts: boolean;
  hasUgChords: boolean;
}

type SortOption = 'alphabetical' | 'readiness_asc' | 'readiness_desc';

// Removed onUpdateSong prop from interface
interface SheetReaderModeProps {
  // onUpdateSong: (songId: string, updates: Partial<SetlistSong>) => void; 
}

const SheetReaderMode: React.FC<SheetReaderModeProps> = ({ }) => { // Removed onUpdateSong from props
  const navigate = useNavigate();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<SetlistSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    hasAudio: false,
    isApproved: false,
    hasCharts: false,
    hasUgChords: false,
  });
  const [sortOption, setSortOption] = useState<SortOption>('alphabetical');
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(false);
  const [autoAdvanceInterval, setAutoAdvanceInterval] = useState(30); // seconds
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const audioEngine = useToneAudio(); // Initialize audio engine
  const { isPlaying, progress, duration, analyzer, loadFromUrl, togglePlayback, stopPlayback, setPitch: setAudioPitch, setVolume, setProgress: setAudioProgress, resetEngine } = audioEngine;

  const currentSong = filteredSongs[currentIndex];
  const currentSongKeyPreference = currentSong?.key_preference || globalKeyPreference;

  // Local state for transposition in reader mode
  const [localPitch, setLocalPitch] = useState(0);

  const isFramable = useCallback((url: string | null | undefined) => {
    if (!url) return true;
    const blockedSites = ['ultimate-guitar.com', 'musicnotes.com', 'sheetmusicplus.com'];
    return !blockedSites.some(site => url.includes(site));
  }, []);

  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const mappedSongs: SetlistSong[] = (data || []).map(d => ({
        id: d.id,
        master_id: d.id,
        name: d.title,
        artist: d.artist,
        bpm: d.bpm,
        lyrics: d.lyrics,
        originalKey: d.original_key,
        targetKey: d.target_key,
        pitch: d.pitch,
        ugUrl: d.ug_url,
        pdfUrl: d.pdf_url,
        leadsheetUrl: d.leadsheet_url,
        previewUrl: d.preview_url,
        youtubeUrl: d.youtube_url,
        appleMusicUrl: d.apple_music_url,
        isMetadataConfirmed: d.is_metadata_confirmed,
        isKeyConfirmed: d.is_key_confirmed,
        duration_seconds: d.duration_seconds,
        notes: d.notes,
        user_tags: d.user_tags || [],
        resources: d.resources || [],
        isApproved: d.is_approved,
        preferred_reader: d.preferred_reader,
        ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        is_ug_chords_present: d.is_ug_chords_present
      }));
      setAllSongs(mappedSongs);
    } catch (err) {
      console.error("Failed to fetch repertoire:", err);
      showError("Failed to load your repertoire.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  useEffect(() => {
    let result = [...allSongs];

    // Apply search term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.artist?.toLowerCase().includes(q)
      );
    }

    // Apply filters
    if (filters.hasAudio) {
      result = result.filter(s => !!s.previewUrl && !(s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets')));
    }
    if (filters.isApproved) {
      result = result.filter(s => s.isApproved);
    }
    if (filters.hasCharts) {
      result = result.filter(s => s.pdfUrl || s.leadsheetUrl || s.ugUrl || s.ug_chords_text);
    }
    if (filters.hasUgChords) {
      result = result.filter(s => s.is_ug_chords_present);
    }

    // Apply sorting
    if (sortOption === 'alphabetical') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortOption === 'readiness_asc') {
      result.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    } else if (sortOption === 'readiness_desc') {
      result.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    }

    setFilteredSongs(result);
    setCurrentIndex(0); // Reset to first song on filter/sort change
  }, [allSongs, searchTerm, filters, sortOption]);

  // Effect to load audio and set pitch when currentSong changes
  useEffect(() => {
    if (currentSong?.previewUrl) {
      loadFromUrl(currentSong.previewUrl, currentSong.pitch || 0);
      setLocalPitch(currentSong.pitch || 0); // Initialize local pitch from song
    } else {
      resetEngine();
      setLocalPitch(0);
    }
  }, [currentSong, loadFromUrl, resetEngine]);

  // Effect to update song pitch in DB when localPitch changes
  useEffect(() => {
    const updateSongInDb = async () => {
      if (currentSong && user && localPitch !== currentSong.pitch) {
        const newTargetKey = transposeKey(currentSong.originalKey || "C", localPitch);
        try {
          await supabase
            .from('repertoire')
            .update({ pitch: localPitch, target_key: newTargetKey })
            .eq('id', currentSong.id)
            .eq('user_id', user.id);
          
          // Optimistically update local state
          setAllSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, pitch: localPitch, targetKey: newTargetKey } : s));
          // showSuccess("Song pitch updated."); // Optional: show a toast
        } catch (error) {
          console.error("Failed to update song pitch in DB:", error);
          showError("Failed to save pitch changes.");
        }
      }
    };
    updateSongInDb();
  }, [localPitch, currentSong, user]);

  const handleNext = useCallback(() => {
    if (filteredSongs.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % filteredSongs.length);
    stopPlayback(); // Stop audio on song change
  }, [filteredSongs, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (filteredSongs.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + filteredSongs.length) % filteredSongs.length);
    stopPlayback(); // Stop audio on song change
  }, [filteredSongs, stopPlayback]);

  const handleToggleAutoAdvance = useCallback(() => {
    setAutoAdvanceEnabled(prev => !prev);
  }, []);

  useEffect(() => {
    if (autoAdvanceTimerRef.current) {
      clearInterval(autoAdvanceTimerRef.current);
    }
    if (autoAdvanceEnabled && filteredSongs.length > 0) {
      autoAdvanceTimerRef.current = setInterval(handleNext, autoAdvanceInterval * 1000);
    }
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearInterval(autoAdvanceTimerRef.current);
      }
    };
  }, [autoAdvanceEnabled, autoAdvanceInterval, filteredSongs.length, handleNext]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.key === 'Escape') {
        navigate('/');
      }
      if (e.key === 'ArrowLeft') {
        handlePrev();
      }
      if (e.key === 'ArrowRight') {
        handleNext();
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback(); // Toggle audio playback
      }
      if (e.key === 'p' || e.key === 'P') { // Transpose up
        e.preventDefault();
        setLocalPitch(prev => Math.min(prev + 1, 24));
      }
      if (e.key === 'o' || e.key === 'O') { // Transpose down
        e.preventDefault();
        setLocalPitch(prev => Math.max(prev - 1, -24));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, handlePrev, handleNext, togglePlayback]);

  const renderChart = useMemo(() => {
    if (!currentSong) return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-8">
        <Music className="w-16 h-16 mb-4" />
        <p className="text-lg font-black uppercase tracking-tight">No Song Selected</p>
        <p className="text-sm mt-2">Select a song from the list or add new tracks to your repertoire.</p>
      </div>
    );

    const preferredReader = currentSong.preferred_reader;
    const ugChordsConfig = currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG;

    let chartContent = null;
    let chartType = "None";
    let chartUrl = null;

    // Prioritize preferred reader
    if (preferredReader === 'ug' && currentSong.ug_chords_text) {
      chartContent = (
        <UGChordsReader
          chordsText={currentSong.ug_chords_text}
          config={ugChordsConfig}
          isMobile={false}
          originalKey={currentSong.originalKey}
          targetKey={transposeKey(currentSong.originalKey || "C", localPitch)} // Use localPitch for transposition
        />
      );
      chartType = "UG Chords";
    } else if (preferredReader === 'ls' && currentSong.leadsheetUrl) {
      chartUrl = currentSong.leadsheetUrl;
      chartType = "Lead Sheet";
    } else if (preferredReader === 'fn' && currentSong.pdfUrl) {
      chartUrl = currentSong.pdfUrl;
      chartType = "Full Notation";
    } else {
      // Fallback to any available chart if preferred is not set or not available
      if (currentSong.ug_chords_text) {
        chartContent = (
          <UGChordsReader
            chordsText={currentSong.ug_chords_text}
            config={ugChordsConfig}
            isMobile={false}
            originalKey={currentSong.originalKey}
            targetKey={transposeKey(currentSong.originalKey || "C", localPitch)} // Use localPitch for transposition
          />
        );
        chartType = "UG Chords (Fallback)";
      } else if (currentSong.leadsheetUrl) {
        chartUrl = currentSong.leadsheetUrl;
        chartType = "Lead Sheet (Fallback)";
      } else if (currentSong.pdfUrl) {
        chartUrl = currentSong.pdfUrl;
        chartType = "Full Notation (Fallback)";
      } else {
        chartContent = (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-8">
            <FileText className="w-16 h-16 mb-4" />
            <p className="text-lg font-black uppercase tracking-tight">No Chart Linked</p>
            <p className="text-sm mt-2">Add a PDF, Lead Sheet, or Ultimate Guitar tab in Song Studio.</p>
          </div>
        );
        chartType = "None";
      }
    }

    if (chartUrl) {
      if (isFramable(chartUrl)) {
        chartContent = <iframe src={`${chartUrl}#toolbar=0&navpanes=0&view=FitH`} className="w-full h-full" title={chartType} />;
      } else {
        chartContent = (
          <div className="h-full flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
            <ShieldCheck className="w-12 h-12 text-indigo-400 mb-6" />
            <h4 className="text-3xl font-black uppercase tracking-tight mb-4 text-white">Asset Protected</h4>
            <p className="text-slate-500 max-w-xl mb-8 text-lg font-medium leading-relaxed">
              External security prevents in-app display. Use the button below to launch in a secure dedicated performance window.
            </p>
            <Button onClick={() => window.open(chartUrl, '_blank')} className="bg-indigo-600 hover:bg-indigo-700 h-16 px-10 font-black uppercase tracking-[0.2em] text-sm rounded-2xl shadow-2xl shadow-indigo-600/30 gap-4">
              <ExternalLink className="w-6 h-6" /> Launch Chart Window
            </Button>
          </div>
        );
      }
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-8 py-4 bg-slate-900/50 border-b border-white/5 shrink-0">
          <h3 className="text-xl font-black uppercase tracking-tight text-white truncate max-w-[70%]">{currentSong.name}</h3>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{chartType}</span>
            <span className="text-sm font-mono font-bold text-indigo-400">{formatKey(transposeKey(currentSong.originalKey || currentSong.targetKey || "C", localPitch), currentSongKeyPreference)}</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-white rounded-b-[3rem] md:rounded-b-[4rem] shadow-2xl relative">
          {chartContent}
        </div>
      </div>
    );
  }, [currentSong, filteredSongs, isFramable, currentSongKeyPreference, localPitch, loadFromUrl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col md:flex-row overflow-hidden">
      {/* Left Sidebar: Song List & Filters */}
      <div className="w-full md:w-96 bg-slate-900/50 border-r border-white/10 flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10 bg-black/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">Sheet Reader</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Rehearsal Mode</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Search songs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-9 text-xs bg-white/5 border-white/10 rounded-xl focus-visible:ring-indigo-500"
            />
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Filters</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setFilters(prev => ({ ...prev, hasAudio: !prev.hasAudio }))}
                className={cn("h-9 text-[10px] font-black uppercase tracking-widest rounded-xl gap-2", filters.hasAudio ? "bg-indigo-600 text-white" : "bg-white/5 border-white/10 text-slate-400")}
              >
                <Music className="w-3.5 h-3.5" /> Master Audio
              </Button>
              <Button
                variant="outline"
                onClick={() => setFilters(prev => ({ ...prev, isApproved: !prev.isApproved }))}
                className={cn("h-9 text-[10px] font-black uppercase tracking-widest rounded-xl gap-2", filters.isApproved ? "bg-emerald-600 text-white" : "bg-white/5 border-white/10 text-slate-400")}
              >
                <Check className="w-3.5 h-3.5" /> Approved
              </Button>
              <Button
                variant="outline"
                onClick={() => setFilters(prev => ({ ...prev, hasCharts: !prev.hasCharts }))}
                className={cn("h-9 text-[10px] font-black uppercase tracking-widest rounded-xl gap-2", filters.hasCharts ? "bg-purple-600 text-white" : "bg-white/5 border-white/10 text-slate-400")}
              >
                <FileText className="w-3.5 h-3.5" /> Has Charts
              </Button>
              <Button
                variant="outline"
                onClick={() => setFilters(prev => ({ ...prev, hasUgChords: !prev.hasUgChords }))}
                className={cn("h-9 text-[10px] font-black uppercase tracking-widest rounded-xl gap-2", filters.hasUgChords ? "bg-orange-600 text-white" : "bg-white/5 border-white/10 text-slate-400")}
              >
                <Guitar className="w-3.5 h-3.5" /> UG Chords
              </Button>
            </div>
          </div>

          {/* Sort Options */}
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Sort By</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => setSortOption('alphabetical')}
                className={cn("h-9 text-[10px] font-black uppercase tracking-widest rounded-xl gap-2", sortOption === 'alphabetical' ? "bg-indigo-600 text-white" : "bg-white/5 border-white/10 text-slate-400")}
              >
                <AlignLeft className="w-3.5 h-3.5" /> A-Z
              </Button>
              <Button
                variant="outline"
                onClick={() => setSortOption('readiness_desc')}
                className={cn("h-9 text-[10px] font-black uppercase tracking-widest rounded-xl gap-2", sortOption === 'readiness_desc' ? "bg-indigo-600 text-white" : "bg-white/5 border-white/10 text-slate-400")}
              >
                <SortAsc className="w-3.5 h-3.5" /> Ready
              </Button>
              <Button
                variant="outline"
                onClick={() => setSortOption('readiness_asc')}
                className={cn("h-9 text-[10px] font-black uppercase tracking-widest rounded-xl gap-2", sortOption === 'readiness_asc' ? "bg-indigo-600 text-white" : "bg-white/5 border-white/10 text-slate-400")}
              >
                <SortDesc className="w-3.5 h-3.5" /> Work
              </Button>
            </div>
          </div>

          {/* Song List */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Songs ({filteredSongs.length})</Label>
            {filteredSongs.length === 0 ? (
              <div className="py-10 text-center opacity-30">
                <ListMusic className="w-10 h-10 mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">No Matches</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredSongs.map((song, idx) => (
                  <button
                    key={song.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl transition-colors",
                      idx === currentIndex ? "bg-indigo-600/20 text-indigo-400" : "hover:bg-white/5 text-slate-300"
                    )}
                  >
                    <p className="text-sm font-bold truncate">{song.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{song.artist || "Unknown Artist"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Chart Preview & Controls */}
      <div className="flex-1 flex flex-col bg-slate-950 rounded-t-[3rem] md:rounded-t-[4rem] overflow-hidden">
        {renderChart}

        {/* Bottom Controls */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border-t border-white/10 px-6 md:px-12 py-4 md:py-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 md:gap-8">
            <Button variant="ghost" size="icon" onClick={handlePrev} className="h-12 w-12 md:h-16 md:w-16 rounded-full hover:bg-white/5 text-slate-400">
              <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
            </Button>
            <Button
              onClick={togglePlayback}
              className={cn(
                "h-16 w-16 md:h-20 md:w-20 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95",
                isPlaying ? "bg-red-600 hover:bg-red-700 shadow-red-600/30" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30"
              )}
            >
              {isPlaying ? <Pause className="w-8 h-8 md:w-10 md:h-10 text-white" /> : <Play className="w-8 h-8 md:w-10 md:h-10 ml-1 text-white" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNext} className="h-12 w-12 md:h-16 md:w-16 rounded-full hover:bg-white/5 text-slate-400">
              <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
            </Button>
          </div>

          {/* Audio Progress Bar */}
          <div className="flex-1 mx-4 md:mx-8 space-y-2 max-w-md">
            <Slider
              value={[duration > 0 ? (progress / 100) * duration : 0]}
              max={duration}
              step={1}
              onValueChange={([v]) => setAudioProgress((v / duration) * 100)}
              className="w-full"
              disabled={!currentSong?.previewUrl}
            />
            <div className="flex justify-between text-[10px] font-mono font-black text-slate-500 uppercase">
              <span>{formatTime((progress / 100) * duration)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Transpose Controls */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocalPitch(prev => Math.max(prev - 1, -24))}
              className="h-10 w-10 bg-white/5 rounded-xl text-slate-400 hover:text-white" 
              disabled={!currentSong}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-xl font-black font-mono text-indigo-400">
              {localPitch > 0 ? '+' : ''}{localPitch} ST
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocalPitch(prev => Math.min(prev + 1, 24))}
              className="h-10 w-10 bg-white/5 rounded-xl text-slate-400 hover:text-white" 
              disabled={!currentSong}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="ghost" onClick={() => navigate('/')} className="text-slate-400 hover:text-white font-black uppercase tracking-widest text-[10px] md:text-xs">
            Close Reader
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SheetReaderMode;
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong } from '@/components/SetlistManager';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Music, Loader2, AlertCircle, ChevronLeft, ChevronRight, X, Settings, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showSuccess, showError } from '@/utils/toast';
import UGChordsReader from '@/components/UGChordsReader';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { transposeKey, calculateSemitones } from '@/utils/keyUtils';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import PreferencesModal from '@/components/PreferencesModal';
import SongStudioModal from '@/components/SongStudioModal';

const SheetReaderMode: React.FC = () => {
  const navigate = useNavigate();
  const { songId: routeSongId } = useParams<{ songId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { keyPreference: globalKeyPreference } = useSettings();
  const { forceReaderResource, ignoreConfirmedGate } = useReaderSettings();

  // State
  const [allSongs, setAllSongs] = useState<SetlistSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);

  // Audio
  const audioEngine = useToneAudio(true);
  const {
    isPlaying,
    progress,
    duration,
    loadFromUrl,
    togglePlayback,
    stopPlayback,
    setPitch: setAudioPitch,
    setProgress: setAudioProgress,
    volume,
    setVolume,
  } = audioEngine;

  const [localPitch, setLocalPitch] = useState(0);

  // === Data Fetching ===
  const fetchSongs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('repertoire')
        .select('*')
        .eq('user_id', user.id)
        .order('title');

      if (error) throw error;

      const mappedSongs: SetlistSong[] = (data || []).map((d) => ({
        id: d.id,
        master_id: d.id,
        name: d.title,
        artist: d.artist,
        originalKey: d.original_key,
        targetKey: d.target_key,
        pitch: d.pitch,
        previewUrl: d.preview_url,
        ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG,
        isApproved: d.is_approved,
        pdfUrl: d.pdf_url,
        leadsheetUrl: d.leadsheet_url,
        ugUrl: d.ug_url,
        bpm: d.bpm,
        is_ug_chords_present: d.is_ug_chords_present,
        is_sheet_verified: d.is_sheet_verified,
        is_ug_link_verified: d.is_ug_link_verified,
      }));

      setAllSongs(mappedSongs);

      // Determine initial index
      let initialIndex = 0;
      const targetId = routeSongId || searchParams.get('id');
      
      if (targetId) {
        const idx = mappedSongs.findIndex((s) => s.id === targetId);
        if (idx !== -1) initialIndex = idx;
      }
      
      setCurrentIndex(initialIndex);

    } catch (err) {
      showError('Failed to load repertoire');
    } finally {
      setLoading(false);
    }
  }, [user, routeSongId, searchParams]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // === Song Selection ===
  const currentSong = allSongs[currentIndex];

  // Load audio when song changes
  useEffect(() => {
    if (currentSong?.previewUrl) {
      loadFromUrl(currentSong.previewUrl, currentSong.pitch || 0);
      setLocalPitch(currentSong.pitch || 0);
    } else {
      stopPlayback();
      setLocalPitch(0);
    }
  }, [currentSong, loadFromUrl, stopPlayback]);

  // Update URL when song changes
  useEffect(() => {
    if (currentSong) {
      setSearchParams({ id: currentSong.id }, { replace: true });
    }
  }, [currentSong, setSearchParams]);

  // === Navigation ===
  const handleNext = useCallback(() => {
    if (allSongs.length === 0) return;
    const nextIndex = (currentIndex + 1) % allSongs.length;
    setCurrentIndex(nextIndex);
    stopPlayback();
  }, [currentIndex, allSongs.length, stopPlayback]);

  const handlePrev = useCallback(() => {
    if (allSongs.length === 0) return;
    const prevIndex = (currentIndex - 1 + allSongs.length) % allSongs.length;
    setCurrentIndex(prevIndex);
    stopPlayback();
  }, [currentIndex, allSongs.length, stopPlayback]);

  // === Key Update ===
  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;
    const newPitch = calculateSemitones(currentSong.originalKey || 'C', newTargetKey);
    setLocalPitch(newPitch);
    setAudioPitch(newPitch);

    try {
      const { error } = await supabase
        .from('repertoire')
        .update({ target_key: newTargetKey, pitch: newPitch })
        .eq('id', currentSong.id);
      if (error) throw error;

      setAllSongs((prev) =>
        prev.map((s) =>
          s.id === currentSong.id ? { ...s, targetKey: newTargetKey, pitch: newPitch } : s
        )
      );
      showSuccess(`Stage Key set to ${newTargetKey}`);
    } catch {
      showError('Failed to update key');
    }
  }, [currentSong, user, setAudioPitch]);

  // === Chart Content ===
  const chartContent = useMemo(() => {
    if (!currentSong) {
      return (
        <div className="h-full flex items-center justify-center text-slate-500">
          <Loader2 className="w-16 h-16 animate-spin" />
          <span className="text-2xl ml-6">Loading song...</span>
        </div>
      );
    }

    const readiness = calculateReadiness(currentSong);
    if (readiness < 40 && forceReaderResource !== 'simulation' && !ignoreConfirmedGate) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <AlertCircle className="w-24 h-24 text-red-500 mb-8" />
          <h2 className="text-4xl font-black uppercase text-white mb-4">Missing Resources</h2>
          <p className="text-xl text-slate-400 mb-8">Audit this track to link charts or audio.</p>
          <Button onClick={() => navigate('/')} className="text-lg px-10 py-6 bg-indigo-600 rounded-2xl">
            Go to Dashboard
          </Button>
        </div>
      );
    }

    // Force chords
    if (forceReaderResource === 'force-chords' && currentSong.ug_chords_text) {
      return (
        <UGChordsReader
          key={currentSong.id}
          chordsText={currentSong.ug_chords_text}
          config={currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
          isMobile={false}
          originalKey={currentSong.originalKey}
          targetKey={transposeKey(currentSong.originalKey || 'C', localPitch)}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          chordAutoScrollEnabled={true}
          chordScrollSpeed={1.0}
        />
      );
    }

    // Chords fallback
    if (
      currentSong.ug_chords_text &&
      !currentSong.pdfUrl &&
      !currentSong.leadsheetUrl &&
      !currentSong.ugUrl
    ) {
      return (
        <UGChordsReader
          key={currentSong.id}
          chordsText={currentSong.ug_chords_text}
          config={currentSong.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG}
          isMobile={false}
          originalKey={currentSong.originalKey}
          targetKey={transposeKey(currentSong.originalKey || 'C', localPitch)}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
          chordAutoScrollEnabled={true}
          chordScrollSpeed={1.0}
        />
      );
    }

    const chartUrl = currentSong.pdfUrl || currentSong.leadsheetUrl || currentSong.ugUrl;
    if (!chartUrl) return null;

    // Google Viewer - Primary method for PDFs
    const googleViewer = `https://docs.google.com/viewer?url=${encodeURIComponent(chartUrl)}&embedded=true`;

    return (
      <div className="w-full h-full relative bg-black">
        <iframe
          key={`${currentSong.id}-google`}
          src={googleViewer}
          className="absolute inset-0 w-full h-full"
          title="Chart - Google Viewer"
          style={{ border: 'none' }}
          allowFullScreen
        />
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <a
            href={chartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-indigo-600 hover:bg-indigo-700 px-8 py-4 rounded-2xl text-lg font-bold shadow-2xl"
          >
            Open Chart Externally →
          </a>
        </div>
      </div>
    );
  }, [currentSong, forceReaderResource, ignoreConfirmedGate, localPitch, isPlaying, progress, duration, navigate]);

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-white">
      {/* Left Sidebar */}
      <aside className="w-80 bg-slate-900 border-r border-white/10 flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Reader</h1>
            <p className="text-indigo-400 text-sm font-bold mt-1">{allSongs.length} Songs</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {allSongs.map((song, index) => (
              <button
                key={song.id}
                onClick={() => {
                  setCurrentIndex(index);
                  stopPlayback();
                }}
                className={cn(
                  'w-full text-left p-4 rounded-xl transition-all border',
                  index === currentIndex
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg'
                    : 'bg-slate-800 text-slate-300 border-transparent hover:bg-slate-700'
                )}
              >
                <div className="font-bold text-lg truncate">{song.name}</div>
                {song.artist && <div className="text-sm opacity-75 mt-1 truncate">{song.artist}</div>}
                <div className="text-xs opacity-50 mt-2 flex items-center gap-2">
                  <span>{(index + 1).toString().padStart(2, '0')}</span>
                  {song.pdfUrl && <span className="bg-white/10 px-1.5 rounded">PDF</span>}
                  {song.ug_chords_text && <span className="bg-white/10 px-1.5 rounded">CH</span>}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/10">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2 text-slate-400 hover:text-white hover:bg-white/10"
            onClick={() => setIsPreferencesOpen(true)}
          >
            <Settings className="w-4 h-4" /> Reader Settings
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 bg-slate-900 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePrev} className="rounded-lg hover:bg-white/10">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-[300px]">
              <button 
                onClick={() => setIsStudioModalOpen(true)}
                className="text-xl font-bold truncate hover:text-indigo-400 transition-colors text-left"
              >
                {currentSong?.name || "No Song Selected"}
              </button>
              <p className="text-sm text-slate-400 truncate">{currentSong?.artist || ""}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleNext} className="rounded-lg hover:bg-white/10">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Controls */}
            {currentSong?.previewUrl && (
              <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={togglePlayback}
                  className="h-8 w-8 rounded hover:bg-white/10"
                >
                  {isPlaying ? <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> : <div className="w-2 h-2 bg-white rounded-full" />}
                </Button>
                <span className="text-xs font-mono text-slate-400">
                  {Math.floor((progress / 100) * duration)}s
                </span>
              </div>
            )}

            {/* Key Display */}
            {currentSong && (
              <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg">
                <span className="text-xs font-bold text-slate-400">KEY</span>
                <span className="text-sm font-mono font-bold text-indigo-400">
                  {transposeKey(currentSong.originalKey || 'C', localPitch)}
                </span>
              </div>
            )}

            {/* Immersive Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsImmersive(!isImmersive)}
              className="rounded-lg hover:bg-white/10"
            >
              {isImmersive ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Chart Viewer */}
        <div className={cn("flex-1 bg-black overflow-hidden relative", isImmersive && "mt-0")}>
          {chartContent}
        </div>

        {/* Footer Controls */}
        {!isImmersive && currentSong && (
          <div className="h-16 bg-slate-900 border-t border-white/10 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-500 uppercase">Pitch Shift</span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  const newPitch = localPitch - 1;
                  setLocalPitch(newPitch);
                  setAudioPitch(newPitch);
                }}
                className="h-8 w-8 rounded hover:bg-white/10"
              >
                -
              </Button>
              <span className="text-sm font-mono font-bold w-8 text-center">{localPitch > 0 ? '+' : ''}{localPitch}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  const newPitch = localPitch + 1;
                  setLocalPitch(newPitch);
                  setAudioPitch(newPitch);
                }}
                className="h-8 w-8 rounded hover:bg-white/10"
              >
                +
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-500 uppercase">Volume</span>
              <input 
                type="range" 
                min={-60} 
                max={0} 
                value={volume} 
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-32 accent-indigo-500"
              />
            </div>
          </div>
        )}
      </main>

      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      
      {/* Song Studio Modal */}
      {currentSong && (
        <SongStudioModal
          isOpen={isStudioModalOpen}
          onClose={() => setIsStudioModalOpen(false)}
          gigId="library"
          songId={currentSong.id}
        />
      )}
    </div>
  );
};

export default SheetReaderMode;
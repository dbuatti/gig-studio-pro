"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  FileText, ArrowLeft, ChevronLeft, ChevronRight, Play, Pause, Shuffle, Timer, Filter, Music, Check, X, Loader2, Guitar, AlignLeft, ExternalLink, ShieldCheck, ListMusic, SortAsc, SortDesc, Search, Volume2, RotateCcw, Plus, Minus, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import UGChordsReader from '@/components/UGChordsReader';
import { formatKey, calculateSemitones, transposeKey } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';
import { calculateReadiness } from '@/utils/repertoireSync';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';
import { useToneAudio } from '@/hooks/use-tone-audio';
import SheetReaderHeader from '@/components/SheetReaderHeader';
import SheetReaderFooter from '@/components/SheetReaderFooter';
import RepertoirePicker from '@/components/RepertoirePicker';
import ResourceAuditModal from '@/components/ResourceAuditModal';
import { AnimatePresence, motion } from 'framer-motion'; // Import motion and AnimatePresence
import FloatingCommandDock from '@/components/FloatingCommandDock'; // Import FloatingCommandDock

interface FilterState {
  hasAudio: boolean;
  isApproved: boolean;
  hasCharts: boolean;
  hasUgChords: boolean;
}

type SortOption = 'alphabetical' | 'readiness_asc' | 'readiness_desc';

interface SheetReaderModeProps {
  // No props needed here, as it will get initialSongId from URL params
}

const SheetReaderMode: React.FC<SheetReaderModeProps> = () => {
  const navigate = useNavigate();
  const { songId: initialSongId } = useParams<{ songId?: string }>(); // Get songId from URL params
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

  // NEW: Chord auto-scroll states
  const [chordAutoScrollEnabled, setChordAutoScrollEnabled] = useState(true);
  const [chordScrollSpeed, setChordScrollSpeed] = useState(1.0); // Multiplier for scroll speed

  const audioEngine = useToneAudio();
  const { isPlaying, progress, duration, analyzer, loadFromUrl, togglePlayback, stopPlayback, setPitch: setAudioPitch, setVolume, setProgress: setAudioProgress, resetEngine } = audioEngine;

  const currentSong = filteredSongs[currentIndex];
  const currentSongKeyPreference = currentSong?.key_preference || globalKeyPreference;

  const [localPitch, setLocalPitch] = useState(0);
  const [isUiVisible, setIsUiVisible] = useState(true); // State for UI visibility
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false); // State for RepertoirePicker
  const [isResourceAuditOpen, setIsResourceAuditOpen] = useState(false); // State for ResourceAuditModal

  const mainContentRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0); // NEW: Track Y for swipe direction
  const tapCountRef = useRef<number>(0); // NEW: For double tap detection
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null); // NEW: For tap timeout
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null); // NEW: For long press detection

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
        .eq('user_id', user.id)
        .eq('is_approved', true); // Filter for approved songs only

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
        is_ug_chords_present: d.is_ug_chords_present,
        highest_note_original: d.highest_note_original,
        is_sheet_verified: d.is_sheet_verified,
        sheet_music_url: d.sheet_music_url,
      }));
      setAllSongs(mappedSongs);

      // Set initial song if provided in URL
      if (initialSongId) {
        const initialIdx = mappedSongs.findIndex(s => s.id === initialSongId);
        if (initialIdx !== -1) {
          setCurrentIndex(initialIdx);
        }
      }

    } catch (err) {
      console.error("Failed to fetch repertoire:", err);
      showError("Failed to load your repertoire.");
    } finally {
      setLoading(false);
    }
  }, [user, initialSongId]);

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

  // NEW: Gesture Handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY; // Record Y position
    tapCountRef.current++;

    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    longPressTimeoutRef.current = setTimeout(() => {
      // This is a long press, prevent tap/swipe
      tapCountRef.current = 0; // Reset tap count
      setIsRepertoirePickerOpen(true); // Long press opens song selector
      longPressTimeoutRef.current = null;
    }, 500); // Adjust long press delay
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    // Prevent tap detection if there's significant movement
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = Math.abs(touchStartX.current - currentX);
    const deltaY = Math.abs(touchStartY.current - currentY);

    if (deltaX > 10 || deltaY > 10) { // Threshold for movement
      tapCountRef.current = 0; // Cancel tap if moved
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (tapCountRef.current === 1) {
      // Single tap logic
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = setTimeout(() => {
        setIsUiVisible(prev => !prev); // Toggle UI visibility
        tapCountRef.current = 0;
        tapTimeoutRef.current = null;
      }, 250); // Single tap detection window
    } else if (tapCountRef.current === 2) {
      // Double tap logic
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      togglePlayback(); // Two-finger tap toggles playback
      tapCountRef.current = 0;
      tapTimeoutRef.current = null;
    }

    // Swipe detection (only if not a tap)
    if (tapCountRef.current === 0) { // Only process swipe if no tap was registered
      const endX = e.changedTouches[0].clientX;
      const diffX = touchStartX.current - endX;
      const swipeThreshold = 50; // Pixels for a valid swipe

      if (Math.abs(diffX) > swipeThreshold) {
        if (diffX > 0) { // Swipe left
          handleNext();
        } else { // Swipe right
          handlePrev();
        }
      }
    }
  }, [handleNext, handlePrev, togglePlayback]);

  const handleUpdateKey = useCallback(async (newTargetKey: string) => {
    if (!currentSong || !user) return;

    const newPitch = calculateSemitones(currentSong.originalKey || "C", newTargetKey);
    setLocalPitch(newPitch); // Update local pitch immediately
    setAudioPitch(newPitch); // Update audio engine pitch

    try {
      await supabase
        .from('repertoire')
        .update({ target_key: newTargetKey, pitch: newPitch })
        .eq('id', currentSong.id)
        .eq('user_id', user.id);
      
      // Optimistically update local state
      setAllSongs(prev => prev.map(s => s.id === currentSong.id ? { ...s, targetKey: newTargetKey, pitch: newPitch } : s));
      showSuccess(`Stage Key set to ${newTargetKey}`);
    } catch (error) {
      console.error("Failed to update song key in DB:", error);
      showError("Failed to save key changes.");
    }
  }, [currentSong, user, setAudioPitch]);

  const renderChart = useMemo(() => {
    if (!currentSong) return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-8">
        <Music className="w-16 h-16 mb-4" />
        <p className="text-lg font-black uppercase tracking-tight">No Song Selected</p>
        <p className="text-sm mt-2">Select a song from the list or add new tracks to your repertoire.</p>
      </div>
    );

    const readiness = calculateReadiness(currentSong);
    const hasChartLink = currentSong.pdfUrl || currentSong.leadsheetUrl || currentSong.ugUrl || currentSong.ug_chords_text;

    if (readiness < 40 || !hasChartLink) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-950 text-white p-8 text-center">
          <div className="bg-red-500/10 w-20 h-20 rounded-[2rem] flex items-center justify-center text-red-500 mx-auto mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight mb-4">Missing Resources</h1>
          <p className="text-slate-500 max-w-md font-medium">
            This song has a readiness score of {readiness}% or is missing a linked chart.
            Please audit its resources to ensure it's ready for performance.
          </p>
          <Button 
            onClick={() => setIsResourceAuditOpen(true)} 
            className="mt-8 bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest px-8 h-14 rounded-2xl shadow-lg shadow-indigo-600/30"
          >
            <ShieldCheck className="w-5 h-5 mr-3" /> Open Resource Audit
          </Button>
        </div>
      );
    }

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
          // NEW: Pass auto-scroll props
          autoScrollEnabled={chordAutoScrollEnabled}
          scrollSpeed={chordScrollSpeed}
          isPlaying={isPlaying}
          progress={progress}
          duration={duration}
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
            // NEW: Pass auto-scroll props
            autoScrollEnabled={chordAutoScrollEnabled}
            scrollSpeed={chordScrollSpeed}
            isPlaying={isPlaying}
            progress={progress}
            duration={duration}
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
        <div className="flex-1 overflow-hidden bg-black rounded-b-[3rem] md:rounded-b-[4rem] shadow-2xl relative"> {/* Set background to black */}
          {chartContent}
        </div>
      </div>
    );
  }, [currentSong, filteredSongs, isFramable, currentSongKeyPreference, localPitch, handleUpdateKey, chordAutoScrollEnabled, chordScrollSpeed, isPlaying, progress, duration]);

  const handleSelectSongFromPicker = useCallback((song: SetlistSong) => {
    const newIndex = allSongs.findIndex(s => s.id === song.id);
    if (newIndex !== -1) {
      setCurrentIndex(newIndex);
      setIsRepertoirePickerOpen(false);
    }
  }, [allSongs]);

  const handleUpdateSongInRepertoire = useCallback(async (songId: string, updates: Partial<SetlistSong>) => {
    if (!user) return;
    const target = allSongs.find(s => s.id === songId);
    if (target) {
      await supabase.from('repertoire').update(updates).eq('id', songId).eq('user_id', user.id); // Corrected user_id filter
      setAllSongs(prev => prev.map(s => s.id === songId ? { ...s, ...updates } : s));
      showSuccess("Song updated in repertoire.");
    }
  }, [allSongs, user]);

  return (
    <div
      className={cn(
        "h-screen w-screen bg-slate-950 text-white flex flex-col overflow-hidden relative", // Full viewport width/height
        isPlaying ? "absolute inset-0" : "" // Apply inset-0 when in immersive mode
      )}
      ref={mainContentRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Floating Header */}
      <AnimatePresence>
        {isUiVisible && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SheetReaderHeader
              currentSong={currentSong}
              onClose={() => navigate('/')}
              onSearchClick={() => setIsRepertoirePickerOpen(true)} // Search button opens RepertoirePicker
              onPrevSong={handlePrev}
              onNextSong={handleNext}
              currentSongIndex={currentIndex}
              totalSongs={filteredSongs.length}
              isLoading={loading}
              keyPreference={globalKeyPreference}
              onUpdateKey={handleUpdateKey} // Pass the new handler
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chart Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderChart}
      </div>

      {/* Floating Footer */}
      <AnimatePresence>
        {isUiVisible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SheetReaderFooter
              currentSong={currentSong}
              isPlaying={isPlaying}
              progress={progress}
              duration={duration}
              onTogglePlayback={togglePlayback}
              onStopPlayback={stopPlayback}
              onSetProgress={setAudioProgress}
              localPitch={localPitch}
              setLocalPitch={setLocalPitch}
              volume={audioEngine.volume}
              setVolume={audioEngine.setVolume}
              keyPreference={globalKeyPreference}
              // NEW: Pass chord auto-scroll props
              chordAutoScrollEnabled={chordAutoScrollEnabled}
              setChordAutoScrollEnabled={setChordAutoScrollEnabled}
              chordScrollSpeed={chordScrollSpeed}
              setChordScrollSpeed={setChordScrollSpeed}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* NEW: Ghost Transport Button (FloatingCommandDock) */}
      <FloatingCommandDock
        onOpenSearch={() => {}} // Not used in reader mode
        onOpenPractice={() => {}} // Not used in reader mode
        onOpenReader={() => {}} // Not used in reader mode
        onOpenAdmin={() => {}} // Not used in reader mode
        onOpenPreferences={() => {}} // Not used in reader mode
        onToggleHeatmap={() => {}} // Not used in reader mode
        onOpenUserGuide={() => {}} // Not used in reader mode
        showHeatmap={false} // Always false in reader mode
        viewMode="repertoire" // Irrelevant in reader mode
        hasPlayableSong={!!currentSong?.previewUrl}
        hasReadableChart={true} // Always true in reader mode
        isPlaying={isPlaying}
        onTogglePlayback={togglePlayback}
        isReaderMode={true} // Indicate that we are in reader mode
      />

      {/* Modals */}
      <RepertoirePicker 
        isOpen={isRepertoirePickerOpen} 
        onClose={() => setIsRepertoirePickerOpen(false)} 
        repertoire={allSongs} 
        currentSetlistSongs={[]} // Not in a setlist context here
        onAdd={handleSelectSongFromPicker} // Use onAdd to select a song
      />
      <ResourceAuditModal 
        isOpen={isResourceAuditOpen} 
        onClose={() => setIsResourceAuditOpen(false)} 
        songs={allSongs} 
        onVerify={handleUpdateSongInRepertoire} 
      />
    </div>
  );
};

export default SheetReaderMode;
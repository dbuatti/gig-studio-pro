import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Tone from 'tone';
import { showSuccess, showError } from '@/utils/toast';

export interface AudioEngineControls {
  isPlaying: boolean;
  progress: number;
  duration: number;
  pitch: number;
  tempo: number;
  volume: number;
  fineTune: number;
  analyzer: Tone.Analyser | null;
  currentBuffer: AudioBuffer | null;
  currentUrl: string;
  isLoadingAudio: boolean;
  
  setPitch: (p: number) => void;
  setTempo: (t: number) => void;
  setVolume: (v: number) => void;
  setFineTune: (f: number) => void;
  setProgress: (p: number) => void;
  // NEW: Compressor controls
  setCompressorThreshold: (t: number) => void;
  setCompressorRatio: (r: number) => void;
  
  loadAudioBuffer: (buffer: AudioBuffer, initialPitch?: number) => void;
  loadFromUrl: (url: string, initialPitch?: number, force?: boolean) => Promise<void>;
  togglePlayback: () => Promise<void>;
  stopPlayback: () => void;
  resetEngine: () => void;
}

export function useToneAudio(suppressToasts: boolean = false): AudioEngineControls {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pitch, setPitchState] = useState(0);
  const [fineTune, setFineTuneState] = useState(0);
  const [tempo, setTempoState] = useState(1);
  const [volume, setVolumeState] = useState(-6); // Initial default volume
  const [currentUrl, setCurrentUrlState] = useState<string>("");
  const [isLoadingAudio, setIsLoadingAudioState] = useState(false);
  // NEW: Compressor state
  const [compressorThreshold, setCompressorThresholdState] = useState(-24);
  const [compressorRatio, setCompressorRatioState] = useState(4);

  // Refs for internal state tracking to stabilize callbacks
  const currentUrlRef = useRef<string>("");
  const isLoadingAudioRef = useRef<boolean>(false);
  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const analyzerRef = useRef<Tone.Analyser | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);
  const requestRef = useRef<number>();
  // NEW: Compressor ref
  const compressorRef = useRef<Tone.Compressor | null>(null);
  
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);

  const initEngine = useCallback(async () => {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    if (!analyzerRef.current) {
      analyzerRef.current = new Tone.Analyser("fft", 256);
    }
    // NEW: Initialize compressor
    if (!compressorRef.current) {
      compressorRef.current = new Tone.Compressor({
        threshold: compressorThreshold,
        ratio: compressorRatio,
        attack: 0.003,
        release: 0.25
      }).toDestination();
    }
    return true;
  }, [compressorThreshold, compressorRatio]);

  const resetEngine = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current.dispose();
      playerRef.current = null;
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    playbackOffsetRef.current = 0;
    currentBufferRef.current = null;
    currentUrlRef.current = "";
    setCurrentUrlState("");
    isLoadingAudioRef.current = false;
    setIsLoadingAudioState(false);
  }, []);

  useEffect(() => {
    return () => {
      resetEngine();
      analyzerRef.current?.dispose();
      compressorRef.current?.dispose(); // NEW: Dispose compressor
    };
  }, [resetEngine]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume.value = volume;
    }
  }, [volume]);

  // NEW: Update compressor settings when state changes
  useEffect(() => {
    if (compressorRef.current) {
      compressorRef.current.threshold.value = compressorThreshold;
      compressorRef.current.ratio.value = compressorRatio;
    }
  }, [compressorThreshold, compressorRatio]);

  const loadAudioBuffer = useCallback((audioBuffer: AudioBuffer, initialPitch: number = 0) => {
    
    // Reset player but keep loading status for a moment
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current.dispose();
      playerRef.current = null;
    }
    
    currentBufferRef.current = audioBuffer;
    // NEW: Connect player to compressor, then compressor to analyzer, then analyzer to destination
    playerRef.current = new Tone.GrainPlayer(audioBuffer).connect(compressorRef.current!).connect(analyzerRef.current!);
    
    // Ensure analyzer is connected to destination if compressor is not used, or if analyzer is the final node
    // In this setup, compressor is the final node before destination, and analyzer is connected before it.
    // So, player -> compressor -> analyzer -> destination is incorrect.
    // It should be player -> analyzer -> compressor -> destination OR player -> compressor -> analyzer (for visualization) and compressor -> destination.
    // Let's go with: player -> analyzer (for visualization) AND player -> compressor -> destination.
    // This means the analyzer will see the *uncompressed* signal, which is often desired for visualization.
    playerRef.current.disconnect(); // Disconnect from previous connections
    playerRef.current.connect(analyzerRef.current!); // Connect to analyzer for visualization
    playerRef.current.connect(compressorRef.current!); // Connect to compressor for output

    playerRef.current.grainSize = 0.18;
    playerRef.current.overlap = 0.1;
    
    setDuration(audioBuffer.duration);
    setPitchState(initialPitch);
    setTempoState(1);
    setFineTuneState(0);
    
    playerRef.current.detune = (initialPitch * 100);
    playerRef.current.playbackRate = 1;
    playerRef.current.volume.value = volume; // Use the current volume state
    
    isLoadingAudioRef.current = false;
    setIsLoadingAudioState(false);
    
    if (!suppressToasts) {
      showSuccess("Audio Loaded");
    }
  }, [volume, suppressToasts]);

  const loadFromUrl = useCallback(async (url: string, initialPitch: number = 0, force: boolean = false) => {
    if (!url) {
      return;
    }

    // Use refs to bail early if already loading or same URL is loaded
    if (!force && (isLoadingAudioRef.current || (url === currentUrlRef.current && currentBufferRef.current))) {
      // If we bail, ensure pitch is still applied in case it changed since load
      if (playerRef.current) {
        playerRef.current.detune = (initialPitch * 100) + fineTune;
        setPitchState(initialPitch);
      }
      return;
    }

    currentUrlRef.current = url;
    setCurrentUrlState(url);
    isLoadingAudioRef.current = true;
    setIsLoadingAudioState(true);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[AudioEngine] Fetch failed with status: ${response.status} ${response.statusText}. URL: ${url}`);
        throw new Error(`Fetch error: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      loadAudioBuffer(audioBuffer, initialPitch);
    } catch (err) {
      console.error("[AudioEngine] Fatal error during loadFromUrl:", err);
      showError("Audio load failed.");
      currentUrlRef.current = "";
      setCurrentUrlState("");
      isLoadingAudioRef.current = false;
      setIsLoadingAudioState(false);
    } 
  }, [loadAudioBuffer, fineTune, pitch]);

  const togglePlayback = useCallback(async () => {
    await initEngine();

    if (!playerRef.current) {
      if (currentUrlRef.current && !isLoadingAudioRef.current) {
        // Attempt to load audio if URL is set but player isn't ready
        await loadFromUrl(currentUrlRef.current, pitch, true);
      }
    }

    if (!playerRef.current) {
      showError("No audio loaded to play.");
      console.error("[AudioEngine] Playback failed: No audio buffer available.");
      return;
    }

    if (isPlaying) {
      playerRef.current.stop();
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      playbackOffsetRef.current += elapsed;
      setIsPlaying(false);
    } else {
      const startTime = (progress / 100) * duration;
      playbackOffsetRef.current = startTime;
      playbackStartTimeRef.current = Tone.now();
      playerRef.current.start(0, startTime);
      setIsPlaying(true);
    }
  }, [isPlaying, progress, duration, tempo, initEngine, loadFromUrl, pitch]);

  const stopPlayback = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.stop();
      setIsPlaying(false);
      setProgress(0);
      playbackOffsetRef.current = 0;
    }
  }, []);

  const animateProgress = useCallback(() => {
    if (isPlaying && playerRef.current && duration > 0) {
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      const currentSeconds = playbackOffsetRef.current + elapsed;
      const newProgress = (currentSeconds / duration) * 100;
      
      if (currentSeconds >= duration) {
        stopPlayback();
        return;
      }
      
      setProgress(newProgress);
      requestRef.current = requestAnimationFrame(animateProgress);
    }
  }, [isPlaying, duration, tempo, stopPlayback]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animateProgress);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, animateProgress]);

  const setPitch = useCallback((p: number) => {
    setPitchState(p);
    if (playerRef.current) {
      playerRef.current.detune = (p * 100) + fineTune;
    }
  }, [fineTune]);

  const setTempo = useCallback((t: number) => {
    setTempoState(t);
    if (playerRef.current) {
      playerRef.current.playbackRate = t;
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (playerRef.current) {
      playerRef.current.volume.value = v;
    }
  }, []);

  const setFineTune = useCallback((f: number) => {
    setFineTuneState(f);
    if (playerRef.current) {
      playerRef.current.detune = (pitch * 100) + f;
    }
  }, [pitch]);

  const setProgressHandler = useCallback((p: number) => {
    setProgress(p);
    if (playerRef.current && duration > 0) {
      const offset = (p / 100) * duration;
      playbackOffsetRef.current = offset;
      if (isPlaying) {
        playerRef.current.stop();
        playbackStartTimeRef.current = Tone.now();
        playerRef.current.start(0, offset);
      } else {
      }
    }
  }, [duration, isPlaying]);

  // NEW: Setters for compressor
  const setCompressorThreshold = useCallback((t: number) => {
    setCompressorThresholdState(t);
  }, []);

  const setCompressorRatio = useCallback((r: number) => {
    setCompressorRatioState(r);
  }, []);

  return {
    isPlaying,
    progress,
    duration,
    pitch,
    tempo,
    volume,
    fineTune,
    analyzer: analyzerRef.current,
    currentBuffer: currentBufferRef.current,
    currentUrl,
    isLoadingAudio,
    setPitch,
    setTempo,
    setVolume,
    setFineTune,
    setProgress: setProgressHandler,
    setCompressorThreshold, // NEW
    setCompressorRatio,     // NEW
    loadAudioBuffer,
    loadFromUrl,
    togglePlayback,
    stopPlayback,
    resetEngine,
  };
}
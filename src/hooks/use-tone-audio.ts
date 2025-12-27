import { useState, useEffect, useRef, useCallback } from 'react';
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
  currentUrl: string; // Added this line
  
  setPitch: (p: number) => void;
  setTempo: (t: number) => void;
  setVolume: (v: number) => void;
  setFineTune: (f: number) => void;
  setProgress: (p: number) => void;
  
  loadAudioBuffer: (buffer: AudioBuffer, initialPitch?: number) => void;
  loadFromUrl: (url: string, initialPitch?: number) => Promise<void>;
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
  const [volume, setVolumeState] = useState(-6);
  const [currentUrl, setCurrentUrl] = useState<string>(""); // State for current URL

  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const analyzerRef = useRef<Tone.Analyser | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);
  const requestRef = useRef<number>();
  
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);
  // currentUrlRef is no longer needed as currentUrl is now state

  const initEngine = useCallback(async () => {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    if (!analyzerRef.current) {
      analyzerRef.current = new Tone.Analyser("fft", 256);
    }
    return true;
  }, []);

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
    setCurrentUrl(""); // Reset currentUrl state
  }, []);

  useEffect(() => {
    return () => {
      resetEngine();
      analyzerRef.current?.dispose();
    };
  }, [resetEngine]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume.value = volume;
    }
  }, [volume]);

  const loadAudioBuffer = useCallback((audioBuffer: AudioBuffer, initialPitch: number = 0) => {
    initEngine().then(() => {
      resetEngine(); // Reset before loading new buffer
      currentBufferRef.current = audioBuffer;
      
      playerRef.current = new Tone.GrainPlayer(audioBuffer).toDestination();
      playerRef.current.connect(analyzerRef.current!);
      playerRef.current.grainSize = 0.18;
      playerRef.current.overlap = 0.1;
      
      setDuration(audioBuffer.duration);
      setPitchState(initialPitch);
      setTempoState(1);
      setVolumeState(-6);
      setFineTuneState(0);
      
      playerRef.current.detune = (initialPitch * 100) + 0;
      playerRef.current.playbackRate = 1;
      playerRef.current.volume.value = -6;
      
      if (!suppressToasts) {
        showSuccess("Audio Loaded");
      }
    }).catch((err) => {
      console.error("Failed to initialize audio engine or load buffer:", err);
      showError("Failed to initialize audio engine.");
    });
  }, [initEngine, resetEngine, suppressToasts]);

  const loadFromUrl = useCallback(async (url: string, initialPitch: number = 0) => {
    // Prevent re-fetching if the URL is the same and we already have a buffer
    if (url === currentUrl && currentBufferRef.current) {
        console.log("[useToneAudio] Skipping load: URL is same and buffer exists.");
        return;
    }

    if (!url) {
      console.warn("[useToneAudio] No URL provided to loadFromUrl. Skipping.");
      return;
    }

    console.log(`[useToneAudio] Loading new URL: ${url}`);
    setCurrentUrl(url); // Update currentUrl state immediately
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch error: ${response.status} ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      loadAudioBuffer(audioBuffer, initialPitch);
    } catch (err) {
      console.error("Audio load failed from URL:", url, "Error:", err);
      showError("Audio load failed.");
      setCurrentUrl(""); // Reset on failure
    }
  }, [loadAudioBuffer, currentUrl]);

  const togglePlayback = useCallback(async () => {
    await initEngine();
    if (!playerRef.current) return;

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
  }, [isPlaying, progress, duration, tempo, initEngine]);

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
    else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, animateProgress]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.detune = (pitch * 100) + fineTune;
    }
  }, [pitch, fineTune]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.playbackRate = tempo;
    }
  }, [tempo]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume.value = volume;
    }
  }, [volume]);

  const setPitch = useCallback((p: number) => {
    setPitchState(p);
    if (playerRef.current) playerRef.current.detune = (p * 100) + fineTune;
  }, [fineTune]);

  const setTempo = useCallback((t: number) => {
    setTempoState(t);
    if (playerRef.current) playerRef.current.playbackRate = t;
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (playerRef.current) playerRef.current.volume.value = v;
  }, []);

  const setFineTune = useCallback((f: number) => {
    setFineTuneState(f);
    if (playerRef.current) playerRef.current.detune = (pitch * 100) + f;
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
      }
    }
  }, [duration, isPlaying]);

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
    currentUrl, // Exposed currentUrl state
    
    setPitch,
    setTempo,
    setVolume,
    setFineTune,
    setProgress: setProgressHandler,
    
    loadAudioBuffer,
    loadFromUrl,
    togglePlayback,
    stopPlayback,
    resetEngine,
  };
}
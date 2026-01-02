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
  const [volume, setVolumeState] = useState(-6);
  const [currentUrl, setCurrentUrlState] = useState<string>("");
  const [isLoadingAudio, setIsLoadingAudioState] = useState(false);

  // Refs for internal state tracking to stabilize callbacks
  const currentUrlRef = useRef<string>("");
  const isLoadingAudioRef = useRef<boolean>(false);
  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const analyzerRef = useRef<Tone.Analyser | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);
  const requestRef = useRef<number>();
  
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);

  const initEngine = useCallback(async () => {
    if (Tone.getContext().state !== 'running') {
      console.log("[AudioEngine] Initializing Tone.js context...");
      await Tone.start();
      console.log("[AudioEngine] Tone.js context started successfully.");
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
      console.log("[AudioEngine] Previous player instance disposed.");
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
    console.log("[AudioEngine] Engine fully reset.");
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
      console.log(`[AudioEngine] Volume updated to: ${volume} dB`);
    }
  }, [volume]);

  const loadAudioBuffer = useCallback((audioBuffer: AudioBuffer, initialPitch: number = 0) => {
    console.log("[AudioEngine] Loading AudioBuffer into player...");
    
    // Reset player but keep loading status for a moment
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current.dispose();
      playerRef.current = null;
    }
    
    currentBufferRef.current = audioBuffer;
    playerRef.current = new Tone.GrainPlayer(audioBuffer).toDestination();
    
    if (!analyzerRef.current) {
      analyzerRef.current = new Tone.Analyser("fft", 256);
    }
    playerRef.current.connect(analyzerRef.current!);
    playerRef.current.grainSize = 0.18;
    playerRef.current.overlap = 0.1;
    
    setDuration(audioBuffer.duration);
    setPitchState(initialPitch);
    setTempoState(1);
    setVolumeState(-6);
    setFineTuneState(0);
    
    playerRef.current.detune = (initialPitch * 100);
    playerRef.current.playbackRate = 1;
    playerRef.current.volume.value = -6;
    
    isLoadingAudioRef.current = false;
    setIsLoadingAudioState(false);
    
    if (!suppressToasts) {
      showSuccess("Audio Loaded");
    }
    console.log("[AudioEngine] Audio ready for playback. Duration:", audioBuffer.duration);
  }, [suppressToasts]);

  const loadFromUrl = useCallback(async (url: string, initialPitch: number = 0, force: boolean = false) => {
    if (!url) {
      console.warn("[AudioEngine] Received empty URL in loadFromUrl. Aborting.");
      return;
    }

    // Use refs to bail early if already loading or same URL is loaded
    if (!force && (isLoadingAudioRef.current || (url === currentUrlRef.current && currentBufferRef.current))) {
      console.log("[AudioEngine] Bailing on load: URL already processing or loaded. Applying pitch only.");
      // If we bail, ensure pitch is still applied in case it changed since load
      if (playerRef.current) {
        playerRef.current.detune = (initialPitch * 100) + fineTune;
        setPitchState(initialPitch);
      }
      return;
    }

    console.log("[AudioEngine] Fetching audio from URL:", url);
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
      
      console.log("[AudioEngine] Fetch successful. Decoding audio data...");
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
  }, [loadAudioBuffer, fineTune]);

  const togglePlayback = useCallback(async () => {
    console.log(`[AudioEngine] Toggle Playback triggered. Current state: ${isPlaying ? 'Playing' : 'Stopped'}`);
    await initEngine();

    if (!playerRef.current) {
      console.log("[AudioEngine] Player not initialized. Attempting to load from current URL.");
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
      console.log("[AudioEngine] Playback stopped.");
    } else {
      const startTime = (progress / 100) * duration;
      playbackOffsetRef.current = startTime;
      playbackStartTimeRef.current = Tone.now();
      playerRef.current.start(0, startTime);
      setIsPlaying(true);
      console.log(`[AudioEngine] Playback started at offset: ${startTime.toFixed(2)}s`);
    }
  }, [isPlaying, progress, duration, tempo, initEngine, loadFromUrl, pitch]);

  const stopPlayback = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.stop();
      setIsPlaying(false);
      setProgress(0);
      playbackOffsetRef.current = 0;
      console.log("[AudioEngine] Playback fully reset and stopped.");
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
      console.log(`[AudioEngine] Pitch updated to: ${p} ST (Detune: ${playerRef.current.detune})`);
    }
  }, [fineTune]);

  const setTempo = useCallback((t: number) => {
    setTempoState(t);
    if (playerRef.current) {
      playerRef.current.playbackRate = t;
      console.log(`[AudioEngine] Tempo updated to: ${t}x`);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (playerRef.current) {
      playerRef.current.volume.value = v;
      console.log(`[AudioEngine] Volume updated to: ${v} dB`);
    }
  }, []);

  const setFineTune = useCallback((f: number) => {
    setFineTuneState(f);
    if (playerRef.current) {
      playerRef.current.detune = (pitch * 100) + f;
      console.log(`[AudioEngine] FineTune updated to: ${f} cents (Detune: ${playerRef.current.detune})`);
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
        console.log(`[AudioEngine] Seek and Restart: ${offset.toFixed(2)}s`);
      } else {
        console.log(`[AudioEngine] Seek only: ${offset.toFixed(2)}s`);
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
    currentUrl,
    isLoadingAudio,
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
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
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const analyzerRef = useRef<Tone.Analyser | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);
  const requestRef = useRef<number>();
  
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);

  // initEngine: Ensures Tone context is running and analyzer is ready.
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
    setCurrentUrl("");
    setIsLoadingAudio(false);
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

  // loadAudioBuffer: Loads the audio data into the player.
  const loadAudioBuffer = useCallback((audioBuffer: AudioBuffer, initialPitch: number = 0) => {
    resetEngine(); // Reset any previous state
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
    
    playerRef.current.detune = (initialPitch * 100) + 0;
    playerRef.current.playbackRate = 1;
    playerRef.current.volume.value = -6;
    
    if (!suppressToasts) {
      showSuccess("Audio Loaded");
    }
    setIsLoadingAudio(false);
  }, [resetEngine, suppressToasts]);

  const loadFromUrl = useCallback(async (url: string, initialPitch: number = 0, force: boolean = false) => {
    if (!url) return;

    // Prevent redundant loading
    if (!force && (isLoadingAudio || (url === currentUrl && currentBufferRef.current))) {
      return;
    }

    // Update state immediately to reflect the target URL
    setCurrentUrl(url);
    setIsLoadingAudio(true);
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch error: ${response.status} ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      loadAudioBuffer(audioBuffer, initialPitch);
    } catch (err) {
      console.error("Audio load failed from URL:", url, "Error:", err);
      showError("Audio load failed.");
      setCurrentUrl("");
      setIsLoadingAudio(false);
    } 
  }, [loadAudioBuffer, currentUrl, isLoadingAudio]);

  const togglePlayback = useCallback(async () => {
    await initEngine();

    // If no player exists, attempt to load from the current URL if available
    if (!playerRef.current) {
      if (currentUrl && !isLoadingAudio) {
        await loadFromUrl(currentUrl, pitch, true);
      }
    }

    // Check again after potential load attempt
    if (!playerRef.current) {
      showError("No audio loaded to play.");
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
  }, [isPlaying, progress, duration, tempo, initEngine, currentUrl, isLoadingAudio, loadFromUrl, pitch]);

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
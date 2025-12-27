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
  
  const playerRef = useRef<Tone.GrainPlayer | null>(null);
  const analyzerRef = useRef<Tone.Analyser | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);
  const requestRef = useRef<number>();
  
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);

  const initEngine = useCallback(async () => {
    console.log("[useToneAudio] initEngine called. Tone.getContext().state:", Tone.getContext().state);
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
      console.log("[useToneAudio] Tone.js audio context started.");
    }
    if (!analyzerRef.current) {
      analyzerRef.current = new Tone.Analyser("fft", 256);
      console.log("[useToneAudio] Tone.Analyser initialized.");
    }
    return true;
  }, []);

  const resetEngine = useCallback(() => {
    console.log("[useToneAudio] resetEngine called.");
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current.dispose();
      playerRef.current = null;
      console.log("[useToneAudio]   Player stopped and disposed.");
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      console.log("[useToneAudio]   Animation frame cancelled.");
    }
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    playbackOffsetRef.current = 0;
    currentBufferRef.current = null;
    console.log("[useToneAudio]   Engine state reset.");
  }, []);

  useEffect(() => {
    console.log("[useToneAudio] Effect: Component unmount cleanup. Dependencies: [resetEngine]");
    return () => {
      resetEngine();
      analyzerRef.current?.dispose();
      console.log("[useToneAudio]   Analyzer disposed on cleanup.");
    };
  }, [resetEngine]);

  const loadAudioBuffer = useCallback((audioBuffer: AudioBuffer, initialPitch: number = 0) => {
    console.log("[useToneAudio] loadAudioBuffer called. Buffer duration:", audioBuffer.duration, "initialPitch:", initialPitch);
    initEngine().then(() => {
      resetEngine();
      currentBufferRef.current = audioBuffer;
      
      playerRef.current = new Tone.GrainPlayer(audioBuffer).toDestination();
      playerRef.current.connect(analyzerRef.current!);
      playerRef.current.grainSize = 0.18;
      playerRef.current.overlap = 0.1;
      console.log("[useToneAudio]   New GrainPlayer created and connected to analyzer.");
      
      setDuration(audioBuffer.duration);
      setPitchState(initialPitch);
      setTempoState(1);
      setVolumeState(-6);
      setFineTuneState(0);
      
      playerRef.current.detune = (initialPitch * 100) + 0;
      playerRef.current.playbackRate = 1;
      playerRef.current.volume.value = -6;
      console.log("[useToneAudio]   Player parameters initialized.");
      
      if (!suppressToasts) {
        showSuccess("Audio Loaded");
      }
    }).catch((err) => {
      console.error("[useToneAudio] Failed to initialize audio engine or load buffer:", err);
      showError("Failed to initialize audio engine.");
    });
  }, [initEngine, resetEngine, suppressToasts]);

  const loadFromUrl = useCallback(async (url: string, initialPitch: number = 0) => {
    console.log("[useToneAudio] loadFromUrl called. URL:", url, "initialPitch:", initialPitch);
    if (!url) {
      console.warn("[useToneAudio]   No URL provided to loadFromUrl. Skipping.");
      return;
    }
    try {
      console.log("[useToneAudio]   Fetching audio from URL...");
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch error: ${response.status} ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      console.log("[useToneAudio]   Audio fetched. Decoding audio data...");
      const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      console.log("[useToneAudio]   Audio decoded. Calling loadAudioBuffer.");
      loadAudioBuffer(audioBuffer, initialPitch);
    } catch (err) {
      console.error("[useToneAudio] Audio load failed from URL:", url, "Error:", err);
      showError("Audio load failed.");
    }
  }, [loadAudioBuffer]);

  const togglePlayback = useCallback(async () => {
    console.log("[useToneAudio] togglePlayback called. Current isPlaying:", isPlaying);
    await initEngine();
    if (!playerRef.current) {
      console.warn("[useToneAudio]   No playerRef.current available. Cannot toggle playback.");
      return;
    }

    if (isPlaying) {
      playerRef.current.stop();
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      playbackOffsetRef.current += elapsed;
      setIsPlaying(false);
      console.log("[useToneAudio]   Playback stopped. Elapsed:", elapsed, "New offset:", playbackOffsetRef.current);
    } else {
      const startTime = (progress / 100) * duration;
      playbackOffsetRef.current = startTime;
      playbackStartTimeRef.current = Tone.now();
      playerRef.current.start(0, startTime);
      setIsPlaying(true);
      console.log("[useToneAudio]   Playback started from time:", startTime);
    }
  }, [isPlaying, progress, duration, tempo, initEngine]);

  const stopPlayback = useCallback(() => {
    console.log("[useToneAudio] stopPlayback called.");
    if (playerRef.current) {
      playerRef.current.stop();
      setIsPlaying(false);
      setProgress(0);
      playbackOffsetRef.current = 0;
      console.log("[useToneAudio]   Playback forcefully stopped and reset to 0.");
    } else {
      console.warn("[useToneAudio]   No playerRef.current to stop playback.");
    }
  }, []);

  const animateProgress = useCallback(() => {
    if (isPlaying && playerRef.current && duration > 0) {
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      const currentSeconds = playbackOffsetRef.current + elapsed;
      
      const newProgress = (currentSeconds / duration) * 100;
      
      if (currentSeconds >= duration) {
        console.log("[useToneAudio]   Playback reached end of duration. Stopping.");
        stopPlayback();
        return;
      }
      
      setProgress(newProgress);
      requestRef.current = requestAnimationFrame(animateProgress);
    }
  }, [isPlaying, duration, tempo, stopPlayback]);

  useEffect(() => {
    console.log("[useToneAudio] Effect: Playback animation loop setup. Dependencies: [isPlaying, animateProgress]");
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animateProgress);
      console.log("[useToneAudio]   Animation frame requested.");
    }
    else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      console.log("[useToneAudio]   Animation frame cancelled.");
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, animateProgress]);

  useEffect(() => {
    console.log("[useToneAudio] Effect: Pitch/FineTune changed. Dependencies: [pitch, fineTune]");
    if (playerRef.current) {
      playerRef.current.detune = (pitch * 100) + fineTune;
      console.log("[useToneAudio]   Player detune set to:", playerRef.current.detune);
    }
  }, [pitch, fineTune]);

  useEffect(() => {
    console.log("[useToneAudio] Effect: Tempo changed. Dependencies: [tempo]");
    if (playerRef.current) {
      playerRef.current.playbackRate = tempo;
      console.log("[useToneAudio]   Player playbackRate set to:", tempo);
    }
  }, [tempo]);

  useEffect(() => {
    console.log("[useToneAudio] Effect: Volume changed. Dependencies: [volume]");
    if (playerRef.current) {
      playerRef.current.volume.value = volume;
      console.log("[useToneAudio]   Player volume set to:", volume);
    }
  }, [volume]);

  const setPitch = useCallback((p: number) => {
    console.log("[useToneAudio] setPitch called. New pitch:", p);
    setPitchState(p);
    if (playerRef.current) playerRef.current.detune = (p * 100) + fineTune;
  }, [fineTune]);

  const setTempo = useCallback((t: number) => {
    console.log("[useToneAudio] setTempo called. New tempo:", t);
    setTempoState(t);
    if (playerRef.current) playerRef.current.playbackRate = t;
  }, []);

  const setVolume = useCallback((v: number) => {
    console.log("[useToneAudio] setVolume called. New volume:", v);
    setVolumeState(v);
    if (playerRef.current) playerRef.current.volume.value = v;
  }, []);

  const setFineTune = useCallback((f: number) => {
    console.log("[useToneAudio] setFineTune called. New fineTune:", f);
    setFineTuneState(f);
    if (playerRef.current) playerRef.current.detune = (pitch * 100) + f;
  }, [pitch]);

  const setProgressHandler = useCallback((p: number) => {
    console.log("[useToneAudio] setProgressHandler called. New progress:", p);
    setProgress(p);
    if (playerRef.current && duration > 0) {
      const offset = (p / 100) * duration;
      playbackOffsetRef.current = offset;
      if (isPlaying) {
        playerRef.current.stop();
        playbackStartTimeRef.current = Tone.now();
        playerRef.current.start(0, offset);
        console.log("[useToneAudio]   Player restarted from offset:", offset);
      } else {
        console.log("[useToneAudio]   Player not playing, just updating offset to:", offset);
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
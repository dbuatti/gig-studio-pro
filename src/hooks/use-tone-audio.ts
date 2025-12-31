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

  // initEngine: Now only responsible for setting up analyzer and ensuring context is running.
  // It will be called by togglePlayback.
  const initEngine = useCallback(async () => {
    console.log('[useToneAudio] initEngine called');
    if (Tone.getContext().state !== 'running') {
      console.log('[useToneAudio] Starting Tone Context');
      await Tone.start(); // This is the critical line that needs user gesture
    }
    if (!analyzerRef.current) {
      console.log('[useToneAudio] Initializing Analyzer');
      analyzerRef.current = new Tone.Analyser("fft", 256);
    }
    console.log('[useToneAudio] initEngine completed');
    return true;
  }, []);

  const resetEngine = useCallback(() => {
    console.log('[useToneAudio] resetEngine called');
    if (playerRef.current) {
      console.log('[useToneAudio] Disposing existing player.');
      playerRef.current.stop();
      playerRef.current.dispose();
      playerRef.current = null;
    }
    if (requestRef.current) {
      console.log('[useToneAudio] Cancelling animation frame.');
      cancelAnimationFrame(requestRef.current);
    }
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    playbackOffsetRef.current = 0;
    currentBufferRef.current = null;
    setCurrentUrl("");
    setIsLoadingAudio(false);
    console.log('[useToneAudio] resetEngine completed.');
    // Do NOT dispose analyzer here, it's reused.
  }, []);

  useEffect(() => {
    console.log('[useToneAudio] Component mounted. Setting up cleanup for unmount.');
    return () => {
      console.log('[useToneAudio] Component unmounting. Calling resetEngine.');
      resetEngine();
      // analyzerRef.current?.dispose(); // Keep analyzer for potential reuse
    };
  }, [resetEngine]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume.value = volume;
      console.log(`[useToneAudio] Volume updated to: ${volume}`);
    }
  }, [volume]);

  // loadAudioBuffer: Loads the audio data, but does NOT start the Tone context.
  const loadAudioBuffer = useCallback((audioBuffer: AudioBuffer, initialPitch: number = 0) => {
    console.log('[useToneAudio] loadAudioBuffer called', { initialPitch, duration: audioBuffer.duration });
    resetEngine(); // Reset any previous state
    currentBufferRef.current = audioBuffer;
    
    playerRef.current = new Tone.GrainPlayer(audioBuffer).toDestination();
    // Ensure analyzer is initialized before connecting
    if (!analyzerRef.current) { // Defensive check, should be initialized by initEngine on first play
      console.log('[useToneAudio] Initializing Analyzer (defensive check in loadAudioBuffer)');
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
    console.log('[useToneAudio] loadAudioBuffer SUCCESS');
    setIsLoadingAudio(false); // Loading is complete once buffer is loaded
  }, [resetEngine, suppressToasts]); // Removed initEngine from dependencies

  const loadFromUrl = useCallback(async (url: string, initialPitch: number = 0, force: boolean = false) => {
    console.log(`[useToneAudio] loadFromUrl called. URL: ${url}, Force: ${force}, CurrentUrl: ${currentUrl}, IsLoading: ${isLoadingAudio}, BufferExists: ${!!currentBufferRef.current}`);
    
    if (!url) {
      console.warn("[useToneAudio] No URL provided to loadFromUrl. Skipping.");
      return;
    }

    if (!force) {
      if (isLoadingAudio) {
        console.warn("[useToneAudio] Already loading audio. Skipping new request.");
        return;
      }
      if (url === currentUrl && currentBufferRef.current) {
          console.log("[useToneAudio] Skipping load: URL is same and buffer exists.");
          return;
      }
    }

    console.log(`[useToneAudio] Proceeding with fetch for: ${url}`);
    setCurrentUrl(url);
    setIsLoadingAudio(true); // Set loading state
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch error: ${response.status} ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
      loadAudioBuffer(audioBuffer, initialPitch); // This will set isLoadingAudio to false
      console.log(`[useToneAudio] Successfully loaded audio from URL: ${url}`);
    } catch (err) {
      console.error("Audio load failed from URL:", url, "Error:", err);
      showError("Audio load failed.");
      setCurrentUrl("");
      setIsLoadingAudio(false); // Reset loading state on error
    } 
  }, [loadAudioBuffer, currentUrl, isLoadingAudio]);

  const togglePlayback = useCallback(async () => {
    console.log('[useToneAudio] togglePlayback called');
    await initEngine(); // Ensure engine is initialized and context is running/resumed
    if (!playerRef.current) {
      console.warn('[useToneAudio] togglePlayback: No playerRef. Attempting to load audio if URL exists.');
      // If no player, but a URL is set, try to load it first.
      if (currentUrl && !isLoadingAudio) {
        console.log('[useToneAudio] togglePlayback: currentUrl exists, attempting to load from URL.');
        await loadFromUrl(currentUrl, pitch, true); // Force reload if needed
        if (!playerRef.current) { // Still no player after attempting to load
          showError("No audio loaded to play.");
          console.error('[useToneAudio] togglePlayback: Still no player after attempting to load from URL.');
          return;
        }
      } else {
        showError("No audio loaded to play.");
        console.error('[useToneAudio] togglePlayback: No currentUrl or already loading, cannot play.');
        return;
      }
    }

    if (isPlaying) {
      console.log('[useToneAudio] Pausing playback.');
      playerRef.current.stop();
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      playbackOffsetRef.current += elapsed;
      setIsPlaying(false);
      console.log('[useToneAudio] Paused');
    } else {
      console.log('[useToneAudio] Starting playback.');
      const startTime = (progress / 100) * duration;
      playbackOffsetRef.current = startTime;
      playbackStartTimeRef.current = Tone.now();
      playerRef.current.start(0, startTime);
      setIsPlaying(true);
      console.log('[useToneAudio] Playing');
    }
  }, [isPlaying, progress, duration, tempo, initEngine, currentUrl, isLoadingAudio, loadFromUrl, pitch]); // Added currentUrl, isLoadingAudio, loadFromUrl, pitch to dependencies

  const stopPlayback = useCallback(() => {
    console.log('[useToneAudio] stopPlayback called');
    if (playerRef.current) {
      console.log('[useToneAudio] Stopping player.');
      playerRef.current.stop();
      setIsPlaying(false);
      setProgress(0);
      playbackOffsetRef.current = 0;
      console.log('[useToneAudio] Playback stopped and reset.');
    } else {
      console.log('[useToneAudio] stopPlayback: No player to stop.');
    }
  }, []);

  const animateProgress = useCallback(() => {
    if (isPlaying && playerRef.current && duration > 0) {
      const elapsed = (Tone.now() - playbackStartTimeRef.current) * tempo;
      const currentSeconds = playbackOffsetRef.current + elapsed;
      
      const newProgress = (currentSeconds / duration) * 100;
      
      if (currentSeconds >= duration) {
        console.log('[useToneAudio] Playback reached end. Calling stopPlayback.');
        stopPlayback();
        return;
      }
      
      setProgress(newProgress);
      requestRef.current = requestAnimationFrame(animateProgress);
    }
  }, [isPlaying, duration, tempo, stopPlayback]);

  useEffect(() => {
    if (isPlaying) {
      console.log('[useToneAudio] isPlaying is true. Requesting animation frame.');
      requestRef.current = requestAnimationFrame(animateProgress);
    }
    else if (requestRef.current) {
      console.log('[useToneAudio] isPlaying is false. Cancelling animation frame.');
      cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, animateProgress]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.detune = (pitch * 100) + fineTune;
      console.log(`[useToneAudio] Detune updated to: ${(pitch * 100) + fineTune} (pitch: ${pitch}, fineTune: ${fineTune})`);
    }
  }, [pitch, fineTune]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.playbackRate = tempo;
      console.log(`[useToneAudio] Playback rate updated to: ${tempo}`);
    }
  }, [tempo]);

  const setPitch = useCallback((p: number) => {
    console.log(`[useToneAudio] setPitch called: ${p}`);
    setPitchState(p);
    if (playerRef.current) playerRef.current.detune = (p * 100) + fineTune;
  }, [fineTune]);

  const setTempo = useCallback((t: number) => {
    console.log(`[useToneAudio] setTempo called: ${t}`);
    setTempoState(t);
    if (playerRef.current) playerRef.current.playbackRate = t;
  }, []);

  const setVolume = useCallback((v: number) => {
    console.log(`[useToneAudio] setVolume called: ${v}`);
    setVolumeState(v);
    if (playerRef.current) playerRef.current.volume.value = v;
  }, []);

  const setFineTune = useCallback((f: number) => {
    console.log(`[useToneAudio] setFineTune called: ${f}`);
    setFineTuneState(f);
    if (playerRef.current) playerRef.current.detune = (pitch * 100) + f;
  }, [pitch]);

  const setProgressHandler = useCallback((p: number) => {
    console.log(`[useToneAudio] setProgress called: ${p}`);
    setProgress(p);
    if (playerRef.current && duration > 0) {
      const offset = (p / 100) * duration;
      playbackOffsetRef.current = offset;
      if (isPlaying) {
        console.log('[useToneAudio] setProgress: Player is playing, stopping and restarting at new offset.');
        playerRef.current.stop();
        playbackStartTimeRef.current = Tone.now();
        playerRef.current.start(0, offset);
      } else {
        console.log('[useToneAudio] setProgress: Player is paused, just updating offset.');
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
"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { SetlistSong } from '@/components/SetlistManager';
import { AudioEngineControls } from './use-tone-audio';
import { showInfo, showSuccess, showWarning } from '@/utils/toast';
import * as Tone from 'tone';

interface UseAutoplayProps {
  audio: AudioEngineControls;
  filteredSongs: SetlistSong[];
  masterRepertoire: SetlistSong[];
  isShuffleAll: boolean;
}

export function useAutoplay({ audio, filteredSongs, masterRepertoire, isShuffleAll }: UseAutoplayProps) {
  const [isAutoplayActive, setIsAutoplayActive] = useState(false);
  const [activeSong, setActiveSong] = useState<SetlistSong | null>(null);
  
  const isTransitioningRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);
  
  // Sync refs for the bridge
  const songsRef = useRef(filteredSongs);
  const activeSongRef = useRef(activeSong);
  const isShuffleRef = useRef(isShuffleAll);
  const masterRef = useRef(masterRepertoire);

  useEffect(() => {
    songsRef.current = filteredSongs;
    activeSongRef.current = activeSong;
    isShuffleRef.current = isShuffleAll;
    masterRef.current = masterRepertoire;
  }, [filteredSongs, activeSong, isShuffleAll, masterRepertoire]);

  const handleSelectSong = useCallback(async (song: SetlistSong, forceAutoplay = false) => {
    if (isTransitioningRef.current) return;
    
    isTransitioningRef.current = true;
    if (Tone.getContext().state !== 'running') await Tone.start();

    if (forceAutoplay) setIsAutoplayActive(true);
    setActiveSong(song);
    
    const audioUrl = song.audio_url || song.previewUrl;
    if (audioUrl) {
      try {
        audio.stopPlayback();
        Tone.getTransport().stop();
        Tone.getTransport().cancel();
      } catch (e) { /* Audio cleanup failed, safe to ignore */ }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      lastTriggerTimeRef.current = Date.now();
      
      try {
        await audio.loadFromUrl(audioUrl, song.pitch || 0, false);
        await new Promise(resolve => setTimeout(resolve, 400));
        
        if (forceAutoplay || isAutoplayActive) {
            Tone.getTransport().start();
            await new Promise(resolve => setTimeout(resolve, 100));
            if (Tone.getTransport().state !== 'started' || !audio.isPlaying) {
                audio.stopPlayback();
                Tone.getTransport().stop();
                await new Promise(resolve => setTimeout(resolve, 200));
                audio.togglePlayback();
            }
        }
      } catch (err) { /* Playback start failed, safe to ignore */ }
      
      setTimeout(() => { isTransitioningRef.current = false; }, 1500); 
    } else {
      isTransitioningRef.current = false;
    }
  }, [audio, isAutoplayActive]);

  const playNext = useCallback((isManual = false) => {
    const now = Date.now();
    if (!isManual && (now - lastTriggerTimeRef.current < 4000)) return;
    if (!isManual && !isAutoplayActive) return;
    if (!isManual && isTransitioningRef.current) return;
    if (!isManual && audio.isLoadingAudio) return;

    const progressPercent = audio.duration > 0 ? (audio.progress / audio.duration) : 0;
    if (!isManual && audio.duration > 10 && progressPercent < 0.85) return;

    isTransitioningRef.current = true;
    lastTriggerTimeRef.current = now;

    if (isShuffleRef.current) {
      const pool = masterRef.current.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) {
        const currentId = activeSongRef.current?.master_id || activeSongRef.current?.id;
        const others = pool.filter(s => (s.master_id || s.id) !== currentId);
        const next = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : pool[0];
        handleSelectSong(next, true);
        return;
      }
    }

    const songs = songsRef.current;
    if (songs.length === 0) {
      isTransitioningRef.current = false;
      setIsAutoplayActive(false);
      return;
    }

    const currentIndex = songs.findIndex(s => s.id === activeSongRef.current?.id);
    
    if (currentIndex !== -1 && currentIndex < songs.length - 1) {
      const nextSong = songs[currentIndex + 1];
      handleSelectSong(nextSong, true);
      showInfo(`Autoplay: ${nextSong.name}`);
    } else if (isAutoplayActive) {
      const firstSong = songs[0];
      handleSelectSong(firstSong, true);
      showInfo(`Autoplay Loop: ${firstSong.name}`);
    } else {
      setIsAutoplayActive(false);
      isTransitioningRef.current = false;
    }
  }, [audio, isAutoplayActive, handleSelectSong]);

  const toggleAutoplay = useCallback(async () => {
    if (isAutoplayActive) {
      setIsAutoplayActive(false);
      audio.stopPlayback();
      showInfo("Autoplay stopped");
    } else {
      if (songsRef.current.length === 0) {
        showWarning("Setlist is empty.");
        return;
      }
      try { await Tone.start(); } catch (e) { /* Tone start failed, safe to ignore */ }
      setIsAutoplayActive(true);
      handleSelectSong(songsRef.current[0], true);
      showSuccess("Starting Setlist Autoplay");
    }
  }, [isAutoplayActive, audio, handleSelectSong]);

  return {
    isAutoplayActive,
    activeSong,
    setActiveSong,
    handleSelectSong,
    playNext,
    toggleAutoplay
  };
}
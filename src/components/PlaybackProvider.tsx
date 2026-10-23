"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Tone from 'tone';
import { SetlistSong } from './SetlistManager';
import { useToneAudio, AudioEngineControls } from '@/hooks/use-tone-audio';
import { useAutoplay } from '@/hooks/use-autoplay';
import { showWarning } from '@/utils/toast';

interface SelectSongOptions {
  /** Replace the play queue with this list (e.g. the current setlist view). */
  songs?: SetlistSong[];
  /** Friendly name for the queue (e.g. the setlist name). */
  name?: string;
  /** Force start playback. Defaults to "keep playing if we already are". */
  autoplay?: boolean;
}

/** Stable control surface — its identity never changes, so consumers that only
 *  need the controls (e.g. the sheet reader) do not re-render as audio ticks. */
export interface PlaybackActions {
  /** Start playing a whole set from `startIndex`. */
  playQueue: (songs: SetlistSong[], name?: string, startIndex?: number) => void;
  /** Load a single song, optionally replacing the queue. */
  selectSong: (song: SetlistSong, opts?: SelectSongOptions) => void;
  /** Skip to the next track (always starts playing). */
  next: (manual?: boolean) => void;
  /** Go back a track (always starts playing). */
  previous: () => void;
  /** Play / pause the current track. */
  toggle: () => void;
  /** Stop playback but keep the current song loaded. */
  stop: () => void;
  /** Stop and dismiss the player. */
  clear: () => void;
  /** Toggle continuous playback of the queue. */
  toggleAutoplay: () => void;
}

export interface PlaybackContextValue extends PlaybackActions {
  /** The shared Tone.js audio engine. */
  audio: AudioEngineControls;
  /** The active play queue (only songs that actually have audio). */
  queue: SetlistSong[];
  /** Friendly name of the queue (setlist name, or "Shuffle All"). */
  queueName: string;
  /** Index of the active song within the queue (-1 if unknown). */
  currentIndex: number;
  /** The song currently loaded in the player. */
  activeSong: SetlistSong | null;
  /** True while the set is auto-advancing. */
  isAutoplayActive: boolean;
}

const PlaybackActionsContext = createContext<PlaybackActions | null>(null);
const PlaybackContext = createContext<PlaybackContextValue | null>(null);

/** Full reactive player state (re-renders as the track progresses). */
export const usePlayback = (): PlaybackContextValue => {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlayback must be used within a PlaybackProvider');
  return ctx;
};

/** Stable controls only — safe to use from heavy pages without extra renders. */
export const usePlaybackActions = (): PlaybackActions => {
  const ctx = useContext(PlaybackActionsContext);
  if (!ctx) throw new Error('usePlaybackActions must be used within a PlaybackProvider');
  return ctx;
};

/** The playable audio URL for a song (full mix if extracted, else the preview). */
export const songAudioUrl = (song: SetlistSong | null | undefined): string =>
  (song?.audio_url || song?.previewUrl || '') as string;

const matchIndex = (songs: SetlistSong[], song: SetlistSong | null): number =>
  songs.findIndex((s) => !!song && (s.id === song.id || (!!s.master_id && s.master_id === song.master_id)));

/**
 * Owns the single audio engine for the whole app plus the "play this set"
 * queue, so music keeps playing while the user navigates between pages.
 * Mounted once in MainLayout, above the routes.
 */
export const PlaybackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<SetlistSong[]>([]);
  const [queueName, setQueueName] = useState('');

  const playNextRef = useRef<(manual?: boolean) => void>(() => {});
  const isAutoplayActiveRef = useRef(false);
  const queueRef = useRef<SetlistSong[]>([]);
  const activeSongRef = useRef<SetlistSong | null>(null);

  const audio = useToneAudio(true, () => {
    // Auto-advance when a track finishes (handled in-engine, works in background).
    if (isAutoplayActiveRef.current) {
      setTimeout(() => playNextRef.current(true), 300);
    }
  });

  const autoplay = useAutoplay({
    audio,
    filteredSongs: queue,
    masterRepertoire: queue,
    isShuffleAll: false,
  });

  const { activeSong, isAutoplayActive } = autoplay;

  // Keep the latest engine / controller in refs so the stable actions can read
  // them without being recreated every render.
  const audioRef = useRef(audio);
  const autoplayRef = useRef(autoplay);
  audioRef.current = audio;
  autoplayRef.current = autoplay;

  useEffect(() => { isAutoplayActiveRef.current = isAutoplayActive; }, [isAutoplayActive]);
  useEffect(() => { playNextRef.current = autoplay.playNext; }, [autoplay.playNext]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { activeSongRef.current = activeSong; }, [activeSong]);

  // Safety net: if a set is still active but stalled at the end of a track
  // when the tab returns, nudge it forward.
  useEffect(() => {
    const handler = () => {
      const a = audioRef.current;
      // Only a finished track (progress reset to 0) counts as stalled; a mid-song
      // pause is deliberate and must not skip ahead.
      if (document.visibilityState === 'visible' && isAutoplayActiveRef.current && !a.isPlaying && !a.isLoadingAudio && a.progress === 0) {
        setTimeout(() => playNextRef.current(true), 800);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // ---- Stable actions (created once) ----
  const actions = useMemo<PlaybackActions>(() => ({
    playQueue: (songs, name, startIndex = 0) => {
      const playable = songs.filter((s) => songAudioUrl(s));
      setQueue(playable);
      setQueueName(name || '');
      if (playable.length === 0) {
        showWarning('No songs with audio in this set.');
        return;
      }
      const idx = Math.max(0, Math.min(startIndex, playable.length - 1));
      void Tone.start().catch(() => { /* resumed on next gesture */ });
      void autoplayRef.current.handleSelectSong(playable[idx], true);
    },
    selectSong: (song, opts = {}) => {
      if (opts.songs) setQueue(opts.songs.filter((s) => songAudioUrl(s)));
      if (opts.name !== undefined) setQueueName(opts.name);
      void autoplayRef.current.handleSelectSong(song, opts.autoplay ?? isAutoplayActiveRef.current);
    },
    next: (manual = true) => { autoplayRef.current.playNext(manual); },
    previous: () => {
      const songs = queueRef.current;
      const idx = matchIndex(songs, activeSongRef.current);
      if (idx > 0) {
        void autoplayRef.current.handleSelectSong(songs[idx - 1], true);
      } else {
        audioRef.current.setProgress(0);
      }
    },
    toggle: () => { void audioRef.current.togglePlayback(); },
    stop: () => {
      audioRef.current.stopPlayback();
      if (isAutoplayActiveRef.current) autoplayRef.current.toggleAutoplay();
    },
    clear: () => {
      audioRef.current.stopPlayback();
      if (isAutoplayActiveRef.current) autoplayRef.current.toggleAutoplay();
      autoplayRef.current.setActiveSong(null);
    },
    toggleAutoplay: () => { void autoplayRef.current.toggleAutoplay(); },
  }), []);

  const currentIndex = useMemo(() => matchIndex(queue, activeSong), [queue, activeSong]);

  const value = useMemo<PlaybackContextValue>(
    () => ({ ...actions, audio, queue, queueName, currentIndex, activeSong, isAutoplayActive }),
    [actions, audio, queue, queueName, currentIndex, activeSong, isAutoplayActive],
  );

  return (
    <PlaybackActionsContext.Provider value={actions}>
      <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>
    </PlaybackActionsContext.Provider>
  );
};

export default PlaybackProvider;

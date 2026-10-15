"use client";

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, ChevronUp, ChevronDown, X,
  Disc3, Loader2, ListMusic, Music2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayback } from './PlaybackProvider';

const formatTime = (seconds: number | undefined): string => {
  if (!seconds || !isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const SeekBar: React.FC<{
  progress: number;
  onSeek: (pct: number) => void;
  className?: string;
  big?: boolean;
}> = ({ progress, onSeek, className, big = false }) => (
  <div
    role="slider"
    aria-label="Seek"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(progress)}
    onClick={(e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      onSeek(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
    }}
    className={cn(
      'group relative w-full cursor-pointer rounded-full bg-white/10',
      big ? 'h-1.5' : 'h-1',
      className,
    )}
  >
    <div
      className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-colors group-hover:bg-indigo-400"
      style={{ width: `${progress}%` }}
    />
    <div
      className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
      style={{ left: `calc(${progress}% - 6px)` }}
    />
  </div>
);

/**
 * Persistent "now playing" surface for the active set.
 * - Desktop: a compact card pinned to the bottom-right corner.
 * - Mobile: a compact bar that expands into a full-screen player.
 * Because it lives above the routes it keeps working while you move around
 * the app or work in another window.
 */
const GlobalPlayer: React.FC = () => {
  const {
    audio, activeSong, queue, queueName, currentIndex,
    next, previous, toggle, clear, selectSong,
  } = usePlayback();
  const [expanded, setExpanded] = useState(false);

  // Lock background scroll while the full-screen player is open.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [expanded]);

  // Collapse the full-screen view if playback is dismissed.
  useEffect(() => {
    if (!activeSong) setExpanded(false);
  }, [activeSong]);

  if (!activeSong) return null;

  const isPlaying = audio.isPlaying;
  const isLoading = audio.isLoadingAudio;
  const progress = Math.min(100, Math.max(0, audio.progress || 0));
  const elapsed = (progress / 100) * (audio.duration || 0);
  const trackLabel = currentIndex >= 0 && queue.length > 0
    ? `Track ${currentIndex + 1} of ${queue.length}`
    : null;

  const handleSeek = (pct: number) => audio.setProgress(pct);

  const renderPlayPause = (size: 'md' | 'lg' | 'xl') => {
    const dims = size === 'xl'
      ? 'h-20 w-20'
      : size === 'lg'
        ? 'h-16 w-16'
        : 'h-11 w-11';
    const icon = size === 'xl' ? 'w-9 h-9' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={isLoading}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full shadow-xl transition-all active:scale-95 disabled:opacity-60',
          dims,
          isPlaying
            ? 'bg-white text-slate-900 hover:bg-slate-100'
            : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/30',
        )}
      >
        {isLoading ? (
          <Loader2 className={cn(icon, 'animate-spin')} />
        ) : isPlaying ? (
          <Pause className={cn(icon, 'fill-current')} />
        ) : (
          <Play className={cn(icon, 'fill-current ml-0.5')} />
        )}
      </button>
    );
  };

  const renderSteppers = (size: 'md' | 'lg' = 'md') => {
    const dims = size === 'lg' ? 'h-14 w-14' : 'h-9 w-9';
    const icon = size === 'lg' ? 'w-7 h-7' : 'w-4 h-4';
    return (
      <>
        <button
          type="button"
          onClick={previous}
          aria-label="Previous track"
          className={cn('flex items-center justify-center rounded-full text-slate-400 transition-all hover:bg-white/10 hover:text-white active:scale-90', dims)}
        >
          <SkipBack className={cn(icon, 'fill-current')} />
        </button>
        <button
          type="button"
          onClick={() => next(true)}
          aria-label="Next track"
          className={cn('flex items-center justify-center rounded-full text-slate-400 transition-all hover:bg-white/10 hover:text-white active:scale-90', dims)}
        >
          <SkipForward className={cn(icon, 'fill-current')} />
        </button>
      </>
    );
  };

  return (
    <>
      {/* ---------- Mini player ---------- */}
      <AnimatePresence>
        {!expanded && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className={cn(
              'fixed z-[300] left-4 right-4 bottom-24',
              'md:left-auto md:right-6 md:bottom-6 md:w-[360px]',
            )}
          >
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-[0_10px_50px_-10px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
              <SeekBar progress={progress} onSeek={handleSeek} className="rounded-none" />
              <div className="flex items-center gap-3 px-3 py-2.5">
                {renderPlayPause('md')}
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="min-w-0 flex-1 text-left"
                  aria-label="Open full-screen player"
                >
                  <div className="flex items-center gap-1.5">
                    {queueName && (
                      <span className="truncate rounded bg-indigo-500/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-indigo-300">
                        {queueName}
                      </span>
                    )}
                    {trackLabel && (
                      <span className="shrink-0 text-[8px] font-black uppercase tracking-wider text-slate-500">
                        {trackLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm font-bold leading-tight text-white">{activeSong.name}</p>
                  <p className="truncate text-[11px] font-medium text-slate-500">{activeSong.artist || 'Unknown Artist'}</p>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  {renderSteppers('md')}
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    aria-label="Expand player"
                    className="ml-0.5 hidden h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-white/10 hover:text-white md:flex"
                  >
                    <ChevronUp className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={clear}
                    aria-label="Close player"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Full-screen player ---------- */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="fixed inset-0 z-[500] flex flex-col bg-slate-950 text-white"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[120px]" />
              <div className="absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full bg-fuchsia-600/15 blur-[120px]" />
            </div>

            {/* Top bar */}
            <div className="relative z-10 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Minimise player"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-slate-300 transition-all hover:bg-white/10 hover:text-white"
              >
                <ChevronDown className="h-6 w-6" />
              </button>
              <div className="min-w-0 px-3 text-center">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                  {queueName || 'Now Playing'}
                </p>
                {trackLabel && (
                  <p className="truncate text-[10px] font-bold uppercase tracking-widest text-indigo-400">{trackLabel}</p>
                )}
              </div>
              <button
                type="button"
                onClick={clear}
                aria-label="Close player"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-slate-300 transition-all hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Artwork */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
              <motion.div
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={isPlaying ? { repeat: Infinity, duration: 14, ease: 'linear' } : { duration: 0.4 }}
                className="relative flex h-52 w-52 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-indigo-600/40 via-slate-900 to-slate-950 shadow-[0_0_80px_-20px_rgba(99,102,241,0.7)] sm:h-64 sm:w-64"
              >
                <Disc3 className="h-20 w-20 text-indigo-300/80" />
                <div className="absolute inset-8 rounded-full border border-white/5" />
                <div className="absolute h-6 w-6 rounded-full bg-slate-950 ring-1 ring-white/10" />
              </motion.div>

              <div className="mt-8 w-full max-w-xl text-center">
                <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">{activeSong.name}</h1>
                <p className="mt-1.5 truncate text-sm font-medium text-slate-400">{activeSong.artist || 'Unknown Artist'}</p>
              </div>
            </div>

            {/* Transport */}
            <div className="relative z-10 w-full max-w-xl self-center px-6 pb-6">
              <SeekBar progress={progress} onSeek={handleSeek} big />
              <div className="mt-2 flex items-center justify-between text-[11px] font-mono font-semibold text-slate-500">
                <span>{formatTime(elapsed)}</span>
                <span>-{formatTime((audio.duration || 0) - elapsed)}</span>
              </div>

              <div className="mt-5 flex items-center justify-center gap-8">
                {renderSteppers('lg')}
                {renderPlayPause('xl')}
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  aria-label="Minimise player"
                  className="flex h-14 w-14 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-white/10 hover:text-white active:scale-90"
                >
                  <ChevronDown className="h-7 w-7" />
                </button>
              </div>

              {/* Up next */}
              {queue.length > 1 && (
                <div className="mt-6">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                    <ListMusic className="h-3.5 w-3.5" /> Up next
                  </div>
                  <div className="max-h-52 space-y-1 overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.02] p-1.5">
                    {queue.map((song, i) => {
                      const isCurrent = i === currentIndex;
                      return (
                        <button
                          key={`${song.id}-${i}`}
                          type="button"
                          onClick={() => selectSong(song, { autoplay: true })}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                            isCurrent ? 'bg-indigo-600/20' : 'hover:bg-white/5',
                          )}
                        >
                          <span className={cn('w-5 shrink-0 text-center text-[10px] font-mono font-bold', isCurrent ? 'text-indigo-400' : 'text-slate-600')}>
                            {isCurrent && isPlaying ? <Music2 className="mx-auto h-3.5 w-3.5 animate-pulse" /> : i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-xs font-bold', isCurrent ? 'text-white' : 'text-slate-300')}>{song.name}</span>
                            <span className="block truncate text-[10px] text-slate-500">{song.artist || 'Unknown Artist'}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlobalPlayer;

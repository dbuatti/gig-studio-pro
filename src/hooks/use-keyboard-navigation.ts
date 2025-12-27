"use client";

import { useEffect } from 'react';

interface KeyboardNavigationOptions {
  onNext?: () => void;
  onPrev?: () => void;
  onClose?: () => void;
  onPlayPause?: () => void;
  onFullscreen?: () => void;
  disabled?: boolean;
}

export function useKeyboardNavigation({ 
  onNext, 
  onPrev, 
  onClose, 
  onPlayPause,
  onFullscreen,
  disabled = false 
}: KeyboardNavigationOptions) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          onNext?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onPrev?.();
          break;
        case 'Escape':
          e.preventDefault();
          onClose?.();
          break;
        case ' ':
          // Prevent page scroll and toggle playback
          e.preventDefault();
          onPlayPause?.();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          onFullscreen?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev, onClose, onPlayPause, onFullscreen, disabled]);
}
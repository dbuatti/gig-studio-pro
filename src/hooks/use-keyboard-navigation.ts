"use client";

import { useEffect } from 'react';

interface KeyboardNavigationOptions {
  onNext?: () => void;
  onPrev?: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  onClose?: () => void;
  onPlayPause?: () => void;
  onFullscreen?: () => void;
  onSelect?: () => void;
  disabled?: boolean;
}

export function useKeyboardNavigation({ 
  onNext, 
  onPrev, 
  onFirst,
  onLast,
  onClose, 
  onPlayPause,
  onFullscreen,
  onSelect,
  disabled = false 
}: KeyboardNavigationOptions) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
        case 'Home':
          e.preventDefault();
          onFirst?.();
          break;
        case 'End':
          e.preventDefault();
          onLast?.();
          break;
        case 'Escape':
          e.preventDefault();
          onClose?.();
          break;
        case ' ':
          e.preventDefault();
          onPlayPause?.();
          break;
        case 'Enter':
          e.preventDefault();
          onSelect?.();
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
  }, [onNext, onPrev, onFirst, onLast, onClose, onPlayPause, onFullscreen, onSelect, disabled]);
}
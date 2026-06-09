"use client";

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to prevent the screen from dimming or locking.
 * Useful for performance modes where the user might not touch the screen for long periods.
 */
export function useWakeLock(enabled: boolean) {
  const [sentinel, setSentinel] = useState<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && enabled) {
      try {
        const lock = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
        setSentinel(lock);
        
        lock.addEventListener('release', () => {
          // Wake lock was released
        });
        
        // Wake lock acquired
      } catch (err: unknown) {
        console.error(`[WakeLock] ${err instanceof Error ? err.name : 'Unknown'}, ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [enabled]);

  const releaseWakeLock = useCallback(async () => {
    if (sentinel) {
      await sentinel.release();
      setSentinel(null);
    }
  }, [sentinel]);

  useEffect(() => {
    if (enabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Re-acquire lock if page becomes visible again
    const handleVisibilityChange = () => {
      if (sentinel !== null && document.visibilityState === 'visible' && enabled) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  return { isActive: !!sentinel };
}
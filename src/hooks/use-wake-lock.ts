"use client";

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to prevent the screen from dimming or locking.
 * Useful for performance modes where the user might not touch the screen for long periods.
 */
export function useWakeLock(enabled: boolean) {
  const [sentinel, setSentinel] = useState<any>(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && enabled) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        setSentinel(lock);
        
        lock.addEventListener('release', () => {
          console.log('[WakeLock] Screen Wake Lock was released');
        });
        
        console.log('[WakeLock] Screen Wake Lock is active');
      } catch (err: any) {
        console.error(`[WakeLock] ${err.name}, ${err.message}`);
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
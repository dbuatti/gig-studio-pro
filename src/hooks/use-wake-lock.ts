"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

export function useWakeLock(enabled: boolean) {
  const [sentinel, setSentinel] = useState<WakeLockSentinel | null>(null);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && enabled) {
      try {
        const lock = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
        setSentinel(lock);
        sentinelRef.current = lock;
      } catch (err: unknown) {
        console.error(`[WakeLock] ${err instanceof Error ? err.name : 'Unknown'}, ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [enabled]);

  const releaseWakeLock = useCallback(async () => {
    const lock = sentinelRef.current;
    if (lock) {
      await lock.release();
      setSentinel(null);
      sentinelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (sentinelRef.current !== null && document.visibilityState === 'visible' && enabled) {
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
"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

const RENDER_WORKER_URL = "https://yt-audio-api-1-wedr.onrender.com";

const KeepAliveWorker: React.FC = () => {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;

    const pingWorker = async () => {
      try {
        // Use no-cors mode as this is a simple ping to keep the Deno server warm
        await fetch(RENDER_WORKER_URL, { mode: 'no-cors' });
      } catch (e) {
        // Silent fail on heartbeat
      }
    };

    pingWorker();
    const interval = setInterval(pingWorker, 10 * 60 * 1000); // Ping every 10 minutes
    
    return () => clearInterval(interval);
  }, [session]);

  return null;
};

export default KeepAliveWorker;
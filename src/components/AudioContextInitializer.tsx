"use client";

import React, { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';

function isContextUsable(): boolean {
  try {
    const ctx = Tone.getContext().rawContext;
    const osc = ctx.createOscillator();
    osc.start(0);
    osc.stop(0.001);
    osc.disconnect();
    return true;
  } catch {
    return false;
  }
}

function recreateToneContext() {
  try { Tone.getContext().close(); } catch {}
  Tone.setContext(new (Tone.Context)());
}

export function AudioContextInitializer({ children }: { children: React.ReactNode }) {
  const initialUsable = useRef(isContextUsable());
  const [isContextReady, setIsContextReady] = useState(initialUsable.current);

  useEffect(() => {
    if (!isContextReady) {
      recreateToneContext();
      setIsContextReady(true);
    }
  }, [isContextReady]);

  useEffect(() => {
    const resumeContext = async () => {
      if (Tone.getContext().state !== 'running' && Tone.getContext().state !== 'closed') {
        try {
          await Tone.start();
          setIsContextReady(true);
          document.removeEventListener('click', resumeContext);
          document.removeEventListener('keydown', resumeContext);
        } catch (error) {
          console.error("[AudioContextInitializer] Failed to resume AudioContext:", error);
        }
      }
    };

    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        try {
          if (Tone.getContext().state === 'suspended' || Tone.getContext().state === 'interrupted') {
            await Tone.start();
          }
        } catch (error) {
          console.error("[AudioContextInitializer] Failed to resume on visibility change:", error);
          recreateToneContext();
          try { await Tone.start(); } catch {}
        }
      }
    };

    document.addEventListener('click', resumeContext);
    document.addEventListener('keydown', resumeContext);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('click', resumeContext);
      document.removeEventListener('keydown', resumeContext);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return <>{children}</>;
}

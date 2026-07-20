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

    document.addEventListener('click', resumeContext);
    document.addEventListener('keydown', resumeContext);

    return () => {
      document.removeEventListener('click', resumeContext);
      document.removeEventListener('keydown', resumeContext);
    };
  }, []);

  return <>{children}</>;
}

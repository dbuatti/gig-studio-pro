"use client";

import React, { useEffect, useState } from 'react';
import * as Tone from 'tone';

/**
 * A component that attempts to resume the Tone.js AudioContext on the first user interaction.
 * This is necessary to comply with browser autoplay policies.
 */
export function AudioContextInitializer({ children }: { children: React.ReactNode }) {
  const [isContextRunning, setIsContextRunning] = useState(Tone.getContext().state === 'running');

  useEffect(() => {
    if (isContextRunning) return;

    const resumeContext = async () => {
      if (Tone.getContext().state !== 'running' && Tone.getContext().state !== 'closed') {
        try {
          await Tone.start();
          setIsContextRunning(true);
          // Remove the listener once the context is running
          document.removeEventListener('click', resumeContext);
          document.removeEventListener('keydown', resumeContext);
          console.log("[AudioContextInitializer] AudioContext resumed.");
        } catch (error) {
          console.error("[AudioContextInitializer] Failed to resume AudioContext:", error);
        }
      }
    };

    // Attach listeners to common user gestures
    document.addEventListener('click', resumeContext);
    document.addEventListener('keydown', resumeContext);

    // Clean up listeners on component unmount
    return () => {
      document.removeEventListener('click', resumeContext);
      document.removeEventListener('keydown', resumeContext);
    };
  }, [isContextRunning]);

  return <>{children}</>;
}

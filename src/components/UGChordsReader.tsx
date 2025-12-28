"use client";

import React, { useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatChordText, transposeChords } from '@/utils/chordUtils';
import { calculateSemitones } from '@/utils/keyUtils';
import { useSettings } from '@/hooks/use-settings';

interface UGChordsReaderProps {
  chordsText: string;
  config: {
    fontFamily: string;
    fontSize: number;
    chordBold: boolean;
    chordColor: string;
    lineSpacing: number;
    textAlign: "left" | "center" | "right";
  };
  isMobile: boolean;
  originalKey?: string;
  targetKey?: string;
  isPlaying: boolean;
  progress: number;
  duration: number;
  chordAutoScrollEnabled: boolean;
  chordScrollSpeed: number;
  readerKeyPreference?: 'sharps' | 'flats';
}

const UGChordsReader = React.memo(({
  chordsText,
  config,
  isMobile,
  originalKey,
  targetKey,
  isPlaying,
  progress,
  duration,
  chordAutoScrollEnabled,
  chordScrollSpeed,
  readerKeyPreference,
}: UGChordsReaderProps) => {
  const { keyPreference: globalKeyPreference } = useSettings();
  const activeKeyPreference = readerKeyPreference || globalKeyPreference;
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLPreElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const autoScrollRaf = useRef<number | null>(null);

  const transposedChordsText = useMemo(() => {
    if (!chordsText || !originalKey || !targetKey || originalKey === "TBC") {
      return chordsText;
    }
    
    const n = calculateSemitones(originalKey, targetKey);
    if (n === 0) return chordsText;
    
    return transposeChords(chordsText, n, activeKeyPreference);
  }, [chordsText, originalKey, targetKey, activeKeyPreference]);

  const readableChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  const formattedHtml = useMemo(() => 
    formatChordText(transposedChordsText, {
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      chordBold: config.chordBold,
      chordColor: readableChordColor,
      lineSpacing: config.lineSpacing
    }), 
    [transposedChordsText, config, readableChordColor]
  );

  // User interaction detection
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleUserInteractionStart = () => {
      isUserScrolling.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };

    const handleUserInteractionEnd = () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrolling.current = false;
      }, 3000);
    };

    container.addEventListener('wheel', handleUserInteractionStart, { passive: true });
    container.addEventListener('touchstart', handleUserInteractionStart, { passive: true });
    container.addEventListener('touchend', handleUserInteractionEnd, { passive: true });
    container.addEventListener('mousedown', handleUserInteractionStart, { passive: true });
    container.addEventListener('mouseup', handleUserInteractionEnd, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleUserInteractionStart);
      container.removeEventListener('touchstart', handleUserInteractionStart);
      container.removeEventListener('touchend', handleUserInteractionEnd);
      container.removeEventListener('mousedown', handleUserInteractionStart);
      container.removeEventListener('mouseup', handleUserInteractionEnd);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (!chordAutoScrollEnabled || !scrollContainerRef.current || duration === 0 || isUserScrolling.current) {
      if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current);
      return;
    }

    const container = scrollContainerRef.current;
    const content = contentRef.current;
    if (!content) return;

    const performScroll = () => {
      const scrollHeight = content.scrollHeight - container.clientHeight;
      if (scrollHeight <= 0) {
        if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current);
        return;
      }

      // Calculate target scroll position based on progress and speed
      // We map the progress (0-100) to the scrollable height
      // Adjusted to start scrolling slightly after 0% and finish slightly before 100%
      const normalizedProgress = Math.min(100, Math.max(0, progress));
      const scrollFactor = (normalizedProgress / 100) * chordScrollSpeed;
      
      // Calculate target position: (progress * speed) * totalHeight
      // We want to keep the current line centered-ish
      let targetScroll = scrollFactor * scrollHeight;
      
      // Clamp target scroll
      targetScroll = Math.max(0, Math.min(scrollHeight, targetScroll));

      const diff = targetScroll - container.scrollTop;
      
      // Smoothly interpolate scroll position
      if (Math.abs(diff) > 1) {
        container.scrollTop += diff * 0.1; // 10% of the difference per frame
        autoScrollRaf.current = requestAnimationFrame(performScroll);
      } else {
        // If we are very close, just set it and wait for next progress update
        container.scrollTop = targetScroll;
        // We don't request another frame here, we wait for the progress to change
        // However, to keep it smooth, we can keep requesting if playing
        if (isPlaying) {
            autoScrollRaf.current = requestAnimationFrame(performScroll);
        }
      }
    };

    // Start the loop
    if (isPlaying) {
        autoScrollRaf.current = requestAnimationFrame(performScroll);
    }

    return () => {
      if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current);
    };
  }, [progress, duration, chordAutoScrollEnabled, chordScrollSpeed, isPlaying]);

  return (
    <div 
      ref={scrollContainerRef}
      className={cn(
        "flex-1 bg-slate-950 rounded-xl p-4 overflow-y-auto border border-white/10 font-mono custom-scrollbar flex flex-col",
        isMobile ? "text-sm" : "text-base"
      )}
      style={{ 
        fontFamily: config.fontFamily,
        fontSize: `${config.fontSize}px`,
        lineHeight: config.lineSpacing,
        textAlign: config.textAlign as any,
        color: readableChordColor || "#ffffff",
        touchAction: 'pan-y'
      }}
    >
      {chordsText ? (
        <pre 
          ref={contentRef}
          className="whitespace-pre font-inherit h-full"
          dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />
      ) : (
        <div className="h-full flex items-center justify-center text-slate-500 text-sm">
          <p>No chords available. Add them in the "Edit UG Chords" tab.</p>
        </div>
      )}
    </div>
  );
});

export default UGChordsReader;
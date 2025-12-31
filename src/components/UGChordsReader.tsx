"use client";

import React, { useMemo, useRef, useEffect, useCallback } from 'react';
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
  readerKeyPreference?: 'sharps' | 'flats';
  onChartReady?: () => void;
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
  readerKeyPreference,
  onChartReady,
}: UGChordsReaderProps) => {
  const { keyPreference: globalKeyPreference } = useSettings();
  const activeKeyPreference = readerKeyPreference || globalKeyPreference;
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLPreElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Handle user interaction to pause auto-scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleInteraction = () => {
      isUserScrolling.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrolling.current = false;
      }, 3000); // Resume auto-scroll after 3 seconds of inactivity
    };

    container.addEventListener('wheel', handleInteraction, { passive: true });
    container.addEventListener('touchstart', handleInteraction, { passive: true });
    container.addEventListener('touchend', handleInteraction, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleInteraction);
      container.removeEventListener('touchstart', handleInteraction);
      container.removeEventListener('touchend', handleInteraction);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isPlaying || duration === 0 || isUserScrolling.current) return;

    const scrollHeight = container.scrollHeight - container.clientHeight;
    if (scrollHeight <= 0) return;

    const currentTime = (progress / 100) * duration;
    const scrollPercentage = currentTime / duration;
    const targetScroll = scrollPercentage * scrollHeight;

    // Smoothly scroll to the target position
    container.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });
  }, [isPlaying, progress, duration]);

  const transposedChordsText = useMemo(() => {
    if (!chordsText) return chordsText;
    const n = calculateSemitones(originalKey, targetKey);
    return transposeChords(chordsText, n, activeKeyPreference);
  }, [chordsText, originalKey, targetKey, activeKeyPreference]);

  const readableChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  const formattedHtml = useMemo(() => {
    return formatChordText(transposedChordsText, {
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      chordBold: config.chordBold,
      chordColor: readableChordColor,
      lineSpacing: config.lineSpacing
    });
  }, [transposedChordsText, config, readableChordColor]);

  useEffect(() => {
    if (chordsText && onChartReady) {
      const timer = setTimeout(() => onChartReady(), 10);
      return () => clearTimeout(timer);
    }
  }, [chordsText, onChartReady]);

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
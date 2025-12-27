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
  // NEW: Auto-scroll props
  autoScrollEnabled: boolean;
  scrollSpeed: number;
  isPlaying: boolean;
  progress: number; // 0-100
  duration: number; // seconds
}

const UGChordsReader: React.FC<UGChordsReaderProps> = ({ 
  chordsText, 
  config, 
  isMobile,
  originalKey,
  targetKey,
  // NEW: Auto-scroll props
  autoScrollEnabled,
  scrollSpeed,
  isPlaying,
  progress,
  duration
}) => {
  const { keyPreference } = useSettings();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Unified Transposition Logic: Calculate delta (n) between Original and Stage Key
  const transposedChordsText = useMemo(() => {
    if (!chordsText || !originalKey || !targetKey || originalKey === "TBC") return chordsText;
    
    const n = calculateSemitones(originalKey, targetKey);
    if (n === 0) return chordsText;
    
    return transposeChords(chordsText, n, keyPreference);
  }, [chordsText, originalKey, targetKey, keyPreference]);

  // Ensure chords are readable on dark background if color is set to black
  const readableChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  const formattedHtml = formatChordText(transposedChordsText, {
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    chordBold: config.chordBold,
    chordColor: readableChordColor,
    lineSpacing: config.lineSpacing
  });

  // NEW: Auto-scroll logic
  const handleUserScrollStart = useCallback(() => {
    isUserScrolling.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
  }, []);

  const handleUserScrollEnd = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrolling.current = false;
    }, 2000); // Resume auto-scroll after 2 seconds of inactivity
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleUserScrollStart, { passive: true });
    container.addEventListener('touchstart', handleUserScrollStart, { passive: true });
    container.addEventListener('touchend', handleUserScrollEnd, { passive: true });
    container.addEventListener('mousedown', handleUserScrollStart, { passive: true });
    container.addEventListener('mouseup', handleUserScrollEnd, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleUserScrollStart);
      container.removeEventListener('touchstart', handleUserScrollStart);
      container.removeEventListener('touchend', handleUserScrollEnd);
      container.removeEventListener('mousedown', handleUserScrollStart);
      container.removeEventListener('mouseup', handleUserScrollEnd);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [handleUserScrollStart, handleUserScrollEnd]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !autoScrollEnabled || !isPlaying || duration === 0 || isUserScrolling.current) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const animateScroll = () => {
      const scrollHeight = container.scrollHeight - container.clientHeight;
      if (scrollHeight <= 0) {
        animationFrameRef.current = requestAnimationFrame(animateScroll);
        return;
      }

      // Calculate target scroll position based on audio progress and scroll speed
      const targetScroll = (progress / 100) * scrollHeight * scrollSpeed;
      
      // Smoothly interpolate to the target scroll position
      const currentScroll = container.scrollTop;
      const diff = targetScroll - currentScroll;
      
      if (Math.abs(diff) > 1) { // Only scroll if difference is significant
        container.scrollTop += diff * 0.05; // Adjust scroll speed here (0.05 is a smoothing factor)
      } else {
        container.scrollTop = targetScroll; // Snap if very close
      }

      animationFrameRef.current = requestAnimationFrame(animateScroll);
    };

    animationFrameRef.current = requestAnimationFrame(animateScroll);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [autoScrollEnabled, scrollSpeed, isPlaying, progress, duration]);

  return (
    <div
      ref={scrollContainerRef} // Attach ref to the scrollable div
      className={cn(
        "flex-1 bg-slate-950 rounded-xl p-4 overflow-auto border border-white/10 font-mono custom-scrollbar flex flex-col",
        isMobile ? "text-sm" : "text-base"
      )}
      style={{
        fontFamily: config.fontFamily,
        fontSize: `${config.fontSize}px`,
        lineHeight: config.lineSpacing,
        textAlign: config.textAlign as any,
        color: readableChordColor || "#ffffff"
      }}
    >
      {chordsText ? (
        <pre 
          className="whitespace-pre-wrap font-inherit flex-1 h-full"
          dangerouslySetInnerHTML={{ __html: formattedHtml }} 
        />
      ) : (
        <div className="h-full flex items-center justify-center text-slate-500 text-sm">
          <p>No chords available. Add them in the "Edit UG Chords" tab.</p>
        </div>
      )}
    </div>
  );
};

export default UGChordsReader;
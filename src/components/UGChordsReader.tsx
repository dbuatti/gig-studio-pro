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
  isPlaying: boolean;
  progress: number;
  duration: number;
  chordAutoScrollEnabled: boolean;
  chordScrollSpeed: number;
  onLoad?: () => void; // NEW: Add onLoad prop
}

const UGChordsReader: React.FC<UGChordsReaderProps> = ({ 
  chordsText, 
  config, 
  isMobile,
  originalKey,
  targetKey,
  // NEW: Auto-scroll props
  isPlaying,
  progress,
  duration,
  chordAutoScrollEnabled,
  chordScrollSpeed,
  onLoad, // Destructure onLoad
}) => {
  const { keyPreference } = useSettings();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLPreElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const autoScrollRaf = useRef<number | null>(null);
  const hasLoadedRef = useRef(false); // To ensure onLoad fires only once

  // Unified Transposition Logic: Calculate delta (n) between Original and Stage Key
  const transposedChordsText = useMemo(() => {
    if (!chordsText || !originalKey || !targetKey || originalKey === "TBC") {
      console.log("[UGChordsReader] Skipping transposition: Missing chordsText, originalKey, or targetKey, or originalKey is TBC.");
      return chordsText;
    }
    
    const n = calculateSemitones(originalKey, targetKey);
    console.log(`[UGChordsReader] Calculating transposition for "${originalKey}" to "${targetKey}". Semitones: ${n}. Key Preference: ${keyPreference}`);
    
    // FIX: Ensure transposition is only applied if n is not 0
    if (n === 0) {
      console.log("[UGChordsReader] Semitones is 0. Returning original chordsText.");
      return chordsText;
    }
    
    const transposed = transposeChords(chordsText, n, keyPreference); // Pass keyPreference
    console.log("[UGChordsReader] Transposed chordsText generated.");
    return transposed;
  }, [chordsText, originalKey, targetKey, keyPreference]);

  // Ensure chords are readable on dark background if color is set to black
  const readableChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  const formattedHtml = useMemo(() => formatChordText(transposedChordsText, {
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    chordBold: config.chordBold,
    chordColor: readableChordColor,
    lineSpacing: config.lineSpacing
  }), [transposedChordsText, config, readableChordColor]);

  // NEW: Auto-scroll logic
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
      if (scrollHeight <= 0) { // No need to scroll if content fits
        if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current);
        return;
      }

      const adjustedProgress = (progress / 100) * chordScrollSpeed;
      let targetScroll = (adjustedProgress * scrollHeight) - (container.clientHeight * 0.35); // Center the current line
      targetScroll = Math.max(0, Math.min(scrollHeight, targetScroll));

      const diff = targetScroll - container.scrollTop;
      if (Math.abs(diff) > 1) {
        container.scrollTop += diff * 0.1; // Smooth scroll
        autoScrollRaf.current = requestAnimationFrame(performScroll);
      } else {
        container.scrollTop = targetScroll;
      }
    };

    autoScrollRaf.current = requestAnimationFrame(performScroll);

    return () => {
      if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current);
    };
  }, [progress, duration, chordAutoScrollEnabled, chordScrollSpeed, isPlaying]); // isPlaying added to trigger updates

  // NEW: Call onLoad once when content is rendered
  useEffect(() => {
    if (onLoad && !hasLoadedRef.current && chordsText) {
      onLoad();
      hasLoadedRef.current = true;
      console.log("[UGChordsReader] onLoad callback fired.");
    }
  }, [onLoad, chordsText]);

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
        color: readableChordColor || "#ffffff",
        touchAction: 'pan-y' // FIX: Add touch-action for smooth scrolling on touch devices
      }}
    >
      {chordsText ? (
        // FIX: Ensure pre tag takes full height
        <pre 
          ref={contentRef} // Attach ref to the content for scrollHeight
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
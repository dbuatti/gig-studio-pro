"use client";

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface PerformanceLyricsProps {
  lyrics: string;
  progress: number;
  duration: number;
  scrollSpeed: number;
  autoScrollEnabled: boolean;
  onToggleZenMode: () => void;
}

const PerformanceLyrics: React.FC<PerformanceLyricsProps> = ({
  lyrics,
  progress,
  duration,
  scrollSpeed,
  autoScrollEnabled,
  onToggleZenMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLDivElement[]>([]);
  const isUserScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const autoScrollRaf = useRef<number | null>(null);

  const parseLyricsWithTimestamps = useCallback((text: string) => {
    const lines = text.split('\n');
    const sections: { time: number; text: string }[] = [];
    let currentText: string[] = [];

    for (const line of lines) {
      const timestampMatch = line.match(/^\[(\d+):(\d{2})\]\s*(.*)$/);
      if (timestampMatch) {
        if (currentText.length > 0) {
          sections.push({ time: -1, text: currentText.join('\n') });
          currentText = [];
        }
        const minutes = parseInt(timestampMatch[1]);
        const seconds = parseInt(timestampMatch[2]);
        sections.push({ time: minutes * 60 + seconds, text: timestampMatch[3] || '' });
      } else {
        currentText.push(line);
      }
    }
    if (currentText.length > 0) {
      sections.push({ time: -1, text: currentText.join('\n') });
    }
    return sections;
  }, []);

  const lyricsSections = useMemo(() => parseLyricsWithTimestamps(lyrics), [lyrics, parseLyricsWithTimestamps]);
  const hasTimestamps = lyricsSections.some(s => s.time >= 0);
  const currentTimeValue = (progress / 100) * duration;
  const adjustedTime = currentTimeValue * scrollSpeed;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleInteractionStart = () => {
      isUserScrolling.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };

    const handleInteractionEnd = () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrolling.current = false;
      }, 3000);
    };

    container.addEventListener('wheel', handleInteractionStart, { passive: true });
    container.addEventListener('touchstart', handleInteractionStart, { passive: true });
    container.addEventListener('touchend', handleInteractionEnd, { passive: true });
    container.addEventListener('mousedown', handleInteractionStart, { passive: true });
    container.addEventListener('mouseup', handleInteractionEnd, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleInteractionStart);
      container.removeEventListener('touchstart', handleInteractionStart);
      container.removeEventListener('touchend', handleInteractionEnd);
      container.removeEventListener('mousedown', handleInteractionStart);
      container.removeEventListener('mouseup', handleInteractionEnd);
    };
  }, []);

  useEffect(() => {
    if (!autoScrollEnabled || !containerRef.current || duration === 0 || isUserScrolling.current) {
      if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current);
      return;
    }

    const container = containerRef.current;
    const performScroll = () => {
      let targetScroll = 0;
      if (hasTimestamps) {
        let targetIndex = lyricsSections.findIndex(s => s.time > adjustedTime);
        if (targetIndex === -1) targetIndex = lyricsSections.length;
        targetIndex = Math.max(0, targetIndex - 1);
        const targetEl = linesRef.current[targetIndex];
        if (targetEl) targetScroll = targetEl.offsetTop - container.offsetTop - container.clientHeight * 0.35;
      } else {
        const scrollHeight = container.scrollHeight - container.clientHeight;
        targetScroll = (adjustedTime / duration) * scrollHeight - container.clientHeight * 0.35;
      }

      const diff = targetScroll - container.scrollTop;
      if (Math.abs(diff) > 1) {
        container.scrollTop += diff * 0.1;
        autoScrollRaf.current = requestAnimationFrame(performScroll);
      } else {
        container.scrollTop = Math.max(0, targetScroll);
      }
    };

    autoScrollRaf.current = requestAnimationFrame(performScroll);
    return () => { if (autoScrollRaf.current) cancelAnimationFrame(autoScrollRaf.current); };
  }, [progress, duration, autoScrollEnabled, hasTimestamps, scrollSpeed, adjustedTime, lyricsSections]);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto px-4 md:px-40 py-10 md:py-32 custom-scrollbar scroll-smooth" onClick={onToggleZenMode}>
      <div className="max-w-6xl mx-auto space-y-12 md:space-y-32">
        {lyricsSections.map((section, i) => {
          const isPast = hasTimestamps && section.time >= 0 && section.time < adjustedTime;
          const isCurrent = hasTimestamps 
            ? (i === lyricsSections.findIndex(s => s.time > adjustedTime) - 1 || (i === lyricsSections.length - 1 && adjustedTime >= section.time))
            : false;
          const isProportionalCurrent = !hasTimestamps && Math.abs((i / (lyricsSections.length - 1)) - (progress / 100)) < 0.1;
          const active = autoScrollEnabled && (isCurrent || isProportionalCurrent);

          return (
            <div
              key={i}
              ref={el => el && (linesRef.current[i] = el)}
              className={cn(
                "transition-all duration-1000 text-center leading-tight whitespace-pre-wrap px-4",
                section.time >= 0
                  ? cn("text-3xl md:text-9xl font-black tracking-tighter uppercase", active ? "text-white scale-110 drop-shadow-[0_0_40px_rgba(255,255,255,0.5)] blur-none" : isPast ? "text-white/20 blur-[1px]" : "text-white/10 blur-[3px]")
                  : "text-xl md:text-6xl font-bold text-indigo-500/40 uppercase tracking-widest italic"
              )}
            >
              {section.text || <span className="italic text-white/10">...</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PerformanceLyrics;
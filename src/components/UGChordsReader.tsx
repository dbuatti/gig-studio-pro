"use client";
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { UGChordsConfig } from './SetlistManager';
import { transposeChords } from '@/utils/chordUtils';
import { KeyPreference } from '@/hooks/use-settings';
import { calculateSemitones } from '@/utils/keyUtils';
import { cn } from '@/lib/utils';
import { Play, Pause, ChevronUp, ChevronDown, MousePointer2 } from 'lucide-react';
import { Button } from './ui/button';

interface UGChordsReaderProps {
  chordsText: string;
  config: UGChordsConfig;
  isMobile: boolean;
  originalKey?: string;
  targetKey?: string;
  readerKeyPreference?: KeyPreference;
  onChartReady?: () => void;
  isFullScreen?: boolean;
}

const UGChordsReader: React.FC<UGChordsReaderProps> = ({ 
  chordsText, 
  config, 
  isMobile,
  originalKey,
  targetKey,
  readerKeyPreference = 'sharps',
  onChartReady,
  isFullScreen
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1); // 1-10
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const transposedText = useMemo(() => {
    if (!chordsText) return "";
    const n = calculateSemitones(originalKey || 'C', targetKey || originalKey || 'C');
    return transposeChords(chordsText, n, readerKeyPreference);
  }, [chordsText, originalKey, targetKey, readerKeyPreference]);

  useEffect(() => {
    if (onChartReady) onChartReady();
  }, [onChartReady]);

  // Auto-scroll logic
  useEffect(() => {
    if (isAutoScrolling) {
      scrollIntervalRef.current = setInterval(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop += scrollSpeed * 0.5;
        }
      }, 50);
    } else {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    }
    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, [isAutoScrolling, scrollSpeed]);

  const readableChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  return (
    <div className="relative h-full w-full flex flex-col bg-slate-950">
      {/* Auto-scroll Controls */}
      <div className="absolute bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900/90 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl">
        <div className="flex flex-col items-center gap-1 px-2">
          <button 
            onClick={() => setScrollSpeed(prev => Math.min(10, prev + 1))}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-black text-indigo-400 font-mono">{scrollSpeed}</span>
          <button 
            onClick={() => setScrollSpeed(prev => Math.max(1, prev - 1))}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
        <Button
          size="icon"
          onClick={(e) => { e.stopPropagation(); setIsAutoScrolling(!isAutoScrolling); }}
          className={cn(
            "h-10 w-10 rounded-xl transition-all",
            isAutoScrolling ? "bg-red-600 text-white" : "bg-indigo-600 text-white"
          )}
        >
          {isAutoScrolling ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
        </Button>
      </div>

      <div 
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto custom-scrollbar",
          isFullScreen ? "p-12" : "p-8"
        )}
        style={{ 
          fontFamily: config.fontFamily, 
          fontSize: `${config.fontSize}px`, 
          lineHeight: config.lineSpacing,
          textAlign: config.textAlign as any,
          color: readableChordColor
        }}
      >
        <pre className="whitespace-pre-wrap font-inherit w-full">
          {transposedText || "No chords available."}
        </pre>
      </div>
    </div>
  );
};

export default UGChordsReader;
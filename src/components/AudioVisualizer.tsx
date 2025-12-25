"use client";
import React, { useRef, useEffect } from 'react';
import * as Tone from 'tone';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  analyzer: Tone.Analyser | null;
  isPlaying: boolean; // Added isPlaying prop
  isMobile: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyzer, isPlaying, isMobile }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  const draw = () => {
    if (!analyzer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get waveform data
    const waveform: Float32Array = analyzer.getValue(); // Explicitly type as Float32Array
    const bufferLength = waveform.length;

    ctx.lineWidth = 2;
    ctx.strokeStyle = isPlaying ? '#6366f1' : '#475569'; // Indigo-500 when playing, Slate-600 when paused
    ctx.shadowBlur = isPlaying ? 10 : 0;
    ctx.shadowColor = isPlaying ? '#6366f1' : 'transparent';

    ctx.beginPath();

    const sliceWidth = width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = waveform[i] / 2 + 0.5; // Normalize to 0-1 range
      const y = v * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();

    animationFrameId.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    if (analyzer) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      animationFrameId.current = requestAnimationFrame(draw);
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [analyzer, isPlaying]); // Re-run effect if analyzer or isPlaying changes

  return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6">
      <h3 className="text-sm font-black uppercase tracking-[0.3em] text-indigo-400 mb-6">Audio Visualizer</h3>
      <canvas
        ref={canvasRef}
        width={isMobile ? 300 : 600}
        height={isMobile ? 150 : 300}
        className="w-full max-w-full h-auto rounded-xl border border-white/10"
      />
      <p className="text-xs text-slate-500 mt-4">Real-time waveform visualization</p>
    </div>
  );
};

export default AudioVisualizer;
"use client";

import React, { useRef, useEffect } from 'react';
import * as Tone from 'tone';

interface AudioVisualizerProps {
  analyzer: Tone.Analyser | null;
  isActive: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyzer, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyzer || !isActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const values = analyzer.getValue() as Float32Array;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      
      // Create a professional gradient
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#6366f1'); // indigo-500
      gradient.addColorStop(1, '#a5b4fc'); // indigo-300

      ctx.beginPath();
      ctx.moveTo(0, height);

      const barWidth = width / values.length;
      for (let i = 0; i < values.length; i++) {
        // Normalize values from dB-ish to canvas height
        const val = (values[i] + 140) * (height / 140);
        const x = i * barWidth;
        const y = height - val;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.6;
      ctx.fill();
      
      // Add a stroke top
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6366f1';
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [analyzer, isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={100} 
      className="w-full h-24 bg-slate-900/10 dark:bg-slate-900/50 rounded-lg border border-indigo-100/20"
    />
  );
};

export default AudioVisualizer;
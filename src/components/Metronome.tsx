"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Minus, Plus, Volume2 } from 'lucide-react';
import { cn } from "@/lib/utils";

interface MetronomeProps {
  initialBpm?: number;
}

const Metronome: React.FC<MetronomeProps> = ({ initialBpm = 120 }) => {
  const [bpm, setBpm] = useState(initialBpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const synthRef = useRef<Tone.MembraneSynth | null>(null);
  const loopRef = useRef<Tone.Loop | null>(null);

  useEffect(() => {
    synthRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      oscillator: { type: "sine" }
    }).toDestination();

    return () => {
      synthRef.current?.dispose();
      loopRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (loopRef.current) {
      Tone.getTransport().bpm.value = bpm;
    }
  }, [bpm]);

  const toggleMetronome = async () => {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    if (isPlaying) {
      Tone.getTransport().stop();
      loopRef.current?.stop();
      setIsPlaying(false);
      setBeat(0);
    } else {
      Tone.getTransport().bpm.value = bpm;
      
      if (!loopRef.current) {
        loopRef.current = new Tone.Loop((time) => {
          setBeat(prev => {
            const next = (prev % 4) + 1;
            const freq = next === 1 ? "C4" : "G3";
            synthRef.current?.triggerAttackRelease(freq, "32n", time, next === 1 ? 1 : 0.5);
            return next;
          });
        }, "4n").start(0);
      } else {
        loopRef.current.start(0);
      }
      
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  };

  return (
    <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Click Track</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className={cn(
                "h-1.5 w-4 rounded-full transition-all duration-100",
                beat === i ? "bg-indigo-500 scale-y-125 shadow-[0_0_10px_rgba(79,70,229,0.5)]" : "bg-white/5"
              )} 
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="text-center flex-1">
          <span className="text-3xl font-black font-mono tracking-tighter text-white">{bpm}</span>
          <span className="text-[10px] font-black text-indigo-400 block uppercase">BPM</span>
        </div>
        <Button 
          size="lg" 
          onClick={toggleMetronome}
          className={cn(
            "h-12 w-12 rounded-full transition-all",
            isPlaying ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
          )}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </Button>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => setBpm(b => Math.max(40, b - 1))}>
          <Minus className="w-3 h-3" />
        </Button>
        <Slider 
          value={[bpm]} 
          min={40} 
          max={240} 
          step={1} 
          onValueChange={(v) => setBpm(v[0])}
          className="flex-1"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => setBpm(b => Math.min(240, b + 1))}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

export default Metronome;
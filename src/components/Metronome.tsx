"use client";

import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { 
  Play, Pause, Minus, Plus, Volume2, 
  Activity, Settings2, Hash, Zap, Timer
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface MetronomeProps {
  initialBpm?: number;
}

const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "5/4", "6/8"];

const Metronome: React.FC<MetronomeProps> = ({ initialBpm = 120 }) => {
  const [bpm, setBpm] = useState(initialBpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [volume, setVolume] = useState(-12);
  
  // Tap Tempo State
  const tapTimes = useRef<number[]>([]);

  const synthRef = useRef<Tone.MembraneSynth | null>(null);
  const loopRef = useRef<Tone.Loop | null>(null);

  // Initialize synth only when needed or after first interaction
  const initSynth = () => {
    if (synthRef.current) return synthRef.current;
    
    synthRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 6,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.1
      }
    }).toDestination();
    
    synthRef.current.volume.value = volume;
    return synthRef.current;
  };

  useEffect(() => {
    return () => {
      synthRef.current?.dispose();
      loopRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.volume.value = volume;
    }
  }, [volume]);

  const getBeatCount = () => {
    return parseInt(timeSignature.split('/')[0]);
  };

  const getBeatDivision = () => {
    const den = timeSignature.split('/')[1];
    return den === '8' ? '8n' : '4n';
  };

  useEffect(() => {
    if (isPlaying) {
      stopMetronome();
      startMetronome();
    }
  }, [bpm, timeSignature]);

  const startMetronome = async () => {
    if (Tone.getContext().state !== 'running') await Tone.start();
    
    const synth = initSynth();
    Tone.getTransport().bpm.value = bpm;
    const count = getBeatCount();
    const division = getBeatDivision();

    loopRef.current = new Tone.Loop((time) => {
      setBeat(prev => {
        const next = (prev % count) + 1;
        const freq = next === 1 ? "C5" : "G4";
        synth.triggerAttackRelease(freq, "32n", time, next === 1 ? 1 : 0.4);
        return next;
      });
    }, division).start(0);

    Tone.getTransport().start();
    setIsPlaying(true);
  };

  const stopMetronome = () => {
    Tone.getTransport().stop();
    loopRef.current?.stop();
    loopRef.current?.dispose();
    loopRef.current = null;
    setIsPlaying(false);
    setBeat(0);
  };

  const toggleMetronome = async () => {
    if (isPlaying) stopMetronome();
    else await startMetronome();
  };

  const handleTap = () => {
    const now = Date.now();
    // Reset if more than 2 seconds since last tap
    if (tapTimes.current.length > 0 && now - tapTimes.current[tapTimes.current.length - 1] > 2000) {
      tapTimes.current = [];
    }
    
    tapTimes.current.push(now);
    
    if (tapTimes.current.length > 1) {
      if (tapTimes.current.length > 4) tapTimes.current.shift();
      
      const intervals = [];
      for (let i = 1; i < tapTimes.current.length; i++) {
        intervals.push(tapTimes.current[i] - tapTimes.current[i - 1]);
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      
      if (calculatedBpm >= 40 && calculatedBpm <= 240) {
        setBpm(calculatedBpm);
      }
    }
  };

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-[2rem] p-6 space-y-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Timing Engine v2.1</span>
        </div>
        <div className="flex items-center gap-2">
           <Zap className="w-3 h-3 text-indigo-400" />
           <span className="text-[9px] font-black text-indigo-400 uppercase">Latency: Ultra Low</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-6">
        <div className="flex flex-col items-center justify-center flex-1 bg-white/5 rounded-[1.5rem] py-4 border border-white/5">
          <span className="text-4xl font-black font-mono tracking-tighter text-white">{bpm}</span>
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">BPM</span>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            size="lg" 
            onClick={toggleMetronome}
            className={cn(
              "h-16 w-16 rounded-full transition-all hover:scale-105 active:scale-95 shadow-xl",
              isPlaying 
                ? "bg-red-600 hover:bg-red-700 shadow-red-600/20" 
                : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
            )}
          >
            {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleTap}
            className="h-10 w-16 bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white rounded-xl gap-2"
          >
            <Timer className="w-3 h-3" /> Tap
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
           <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
             <Hash className="w-3 h-3" /> Time Sig
           </Label>
           <Select value={timeSignature} onValueChange={setTimeSignature}>
              <SelectTrigger className="bg-white/5 border-white/10 h-10 rounded-xl font-black font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white">
                {TIME_SIGNATURES.map(sig => (
                  <SelectItem key={sig} value={sig} className="font-mono text-xs">{sig}</SelectItem>
                ))}
              </SelectContent>
           </Select>
        </div>

        <div className="space-y-2">
           <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
             <Volume2 className="w-3 h-3" /> Click Gain
           </Label>
           <div className="pt-3">
             <Slider 
               value={[volume]} 
               min={-48} 
               max={0} 
               step={1} 
               onValueChange={(v) => setVolume(v[0])}
             />
           </div>
        </div>
      </div>

      <div className="flex gap-2 justify-center">
        {Array.from({ length: getBeatCount() }).map((_, i) => (
          <div 
            key={i} 
            className={cn(
              "h-2 flex-1 rounded-full transition-all duration-75",
              beat === i + 1 
                ? i === 0 
                  ? "bg-indigo-400 scale-y-150 shadow-[0_0_15px_rgba(129,140,248,0.6)]" 
                  : "bg-slate-400 scale-y-125" 
                : "bg-white/5"
            )} 
          />
        ))}
      </div>

      <div className="flex items-center gap-4 pt-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-10 w-10 bg-white/5 rounded-xl text-slate-400 hover:text-white" 
          onClick={() => setBpm(b => Math.max(40, b - 1))}
        >
          <Minus className="w-4 h-4" />
        </Button>
        <Slider 
          value={[bpm]} 
          min={40} 
          max={240} 
          step={1} 
          onValueChange={(v) => setBpm(v[0])}
          className="flex-1"
        />
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-10 w-10 bg-white/5 rounded-xl text-slate-400 hover:text-white" 
          onClick={() => setBpm(b => Math.min(240, b + 1))}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default Metronome;
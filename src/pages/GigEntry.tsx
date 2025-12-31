"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Music2, ArrowRight, Waves } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';

const GigEntry = () => {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      navigate(`/gig/${code.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 selection:bg-indigo-500/30">
      <div className="max-w-md w-full space-y-12 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="flex flex-col items-center gap-6">
          <div className="bg-indigo-600 p-4 rounded-[2rem] shadow-2xl shadow-indigo-600/20">
            <Waves className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black uppercase tracking-tighter">Gig Access</h1>
            <p className="text-muted-foreground font-medium tracking-tight">Enter your specific gig code to view tonight's setlist.</p>
          </div>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div className="relative group">
            <Input 
              autoFocus
              placeholder="E.G. ROCKBAR-25"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-20 bg-card border-border rounded-3xl text-center text-3xl font-black uppercase tracking-[0.2em] focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
            />
            <div className="absolute inset-0 rounded-3xl border-2 border-indigo-500/0 group-hover:border-indigo-500/10 pointer-events-none transition-all" />
          </div>
          <Button 
            type="submit" 
            disabled={!code.trim()}
            className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-2xl gap-3 shadow-2xl shadow-indigo-600/30 transition-all active:scale-95"
          >
            Enter Show <ArrowRight className="w-5 h-5" />
          </Button>
        </form>

        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
          Powered by Gig Studio Technologies
        </p>
      </div>
      <div className="fixed bottom-0 w-full">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default GigEntry;
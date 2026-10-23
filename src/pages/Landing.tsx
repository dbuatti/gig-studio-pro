"use client";

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Waves, Sparkles, Rocket, Globe, 
  ShieldCheck, Activity, Layers, Zap
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { MadeWithDyad } from '@/components/SupportBanner';
import { useTheme } from '@/hooks/use-theme';

const Landing = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { theme } = useTheme();

  const features = [
    {
      icon: <Sparkles className="w-6 h-6 text-indigo-400" />,
      title: "AI Metadata Engine",
      description: "Automatically fill in BPM, musical key and other details for the songs in your library."
    },
    {
      icon: <Waves className="w-6 h-6 text-indigo-400" />,
      title: "Real-time Transposition",
      description: "Change the key and tempo of any backing track without losing audio quality. Perfect for finding your vocal sweet spot."
    },
    {
      icon: <Activity className="w-6 h-6 text-indigo-400" />,
      title: "Stage Performance Mode",
      description: "A distraction-free teleprompter for lyrics, PDF charts, and visualizers. Everything you need for the gig, in one view."
    },
    {
      icon: <Globe className="w-6 h-6 text-indigo-400" />,
      title: "Public Repertoire",
      description: "Generate a stunning public-facing link to showcase your repertoire to clients and booking agents."
    },
    {
      icon: <Layers className="w-6 h-6 text-indigo-400" />,
      title: "Asset Matrix",
      description: "Link PDF leadsheets, Ultimate Guitar tabs, and reference videos directly to your tracks for instant access."
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-indigo-400" />,
      title: "Cloud Sync",
      description: "Your setlists and performance settings are synced across all your devices. Never lose a gig configuration again."
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-border px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Waves className="w-5 h-5 text-white" />
          </div>
          <span className="font-black uppercase tracking-tighter text-foreground text-xl">Gig Studio <span className="text-indigo-600">Pro</span></span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors hidden md:block">Features</a>
          <Button 
            onClick={() => navigate(session ? '/dashboard' : '/login')}
            className="bg-indigo-600 text-white hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-xl shadow-lg shadow-indigo-600/20"
          >
            {session ? 'Go to Dashboard' : 'Sign In'}
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/10 border border-indigo-500/20 rounded-full mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">The Future of Live Music Management</span>
          </div>
          
          <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tight mb-8 leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Manage your gig.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-500">Master your craft.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
            The all-in-one studio for professional musicians. AI-powered setlists, real-time transposition, and high-fidelity stage tools.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
            <Button 
              size="lg"
              onClick={() => navigate(session ? '/dashboard' : '/login')}
              className="w-full sm:w-auto bg-indigo-600 text-white hover:bg-indigo-700 h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-xs gap-3 shadow-2xl shadow-indigo-600/30"
            >
              Start Your First Gig <Rocket className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-40 px-6 bg-background relative scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-500 mb-4">Professional Ecosystem</h2>
            <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-foreground">Built for the Stage</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="group p-10 bg-card border border-border rounded-[3rem] hover:bg-indigo-50 dark:hover:bg-indigo-600/10 hover:border-indigo-200 dark:hover:border-indigo-500/20 transition-all duration-500">
                <div className="bg-secondary w-14 h-14 rounded-2xl flex items-center justify-center mb-8 shadow-xl group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h4 className="text-xl font-black uppercase tracking-tight text-foreground mb-4">{f.title}</h4>
                <p className="text-muted-foreground font-medium leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 px-6 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/30 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-3xl mx-auto relative z-10">
          <h3 className="text-4xl md:text-7xl font-black uppercase tracking-tight text-foreground mb-8">Ready to play?</h3>
          <p className="text-xl text-muted-foreground mb-12 font-medium">Build your repertoire, sync it across your devices, and take it to the stage.</p>
          <Button 
            size="lg"
            onClick={() => navigate(session ? '/dashboard' : '/login')}
            className="bg-white text-indigo-600 hover:bg-slate-100 h-16 px-12 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-white/10"
          >
            Create My Studio Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-border bg-secondary">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1 rounded-md">
                <Waves className="w-4 h-4 text-white" />
              </div>
              <span className="font-black uppercase tracking-tighter text-foreground">Gig Studio Pro</span>
            </div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">© {new Date().getFullYear()} Gig Studio Pro</p>
          </div>
        </div>
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default Landing;
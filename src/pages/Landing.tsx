"use client";

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Waves, Sparkles, Music, Rocket, Globe, 
  ShieldCheck, Activity, Layers, ArrowRight,
  Zap, Headphones, Mic2, Star, Check
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useTheme } from '@/hooks/use-theme'; // NEW: Import useTheme

const Landing = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { theme } = useTheme(); // NEW: Use theme hook

  const features = [
    {
      icon: <Sparkles className="w-6 h-6 text-indigo-400" />,
      title: "AI Metadata Engine",
      description: "Automatically fetch BPM, musical keys, and high-fidelity metadata for your entire library using our proprietary AI worker."
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
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Waves className="w-5 h-5 text-white" />
          </div>
          <span className="font-black uppercase tracking-tighter text-xl">Gig Studio <span className="text-indigo-600">Pro</span></span>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors hidden md:block">Features</button>
          <button className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors hidden md:block">Pricing</button>
          <Button 
            onClick={() => navigate(session ? '/dashboard' : '/login')}
            className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-xl shadow-lg shadow-indigo-600/20"
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
          
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-12 font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
            The all-in-one studio for professional musicians. AI-powered setlists, real-time transposition, and high-fidelity stage tools.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
            <Button 
              size="lg"
              onClick={() => navigate(session ? '/dashboard' : '/login')}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-xs gap-3 shadow-2xl shadow-indigo-600/30"
            >
              Start Your First Gig <Rocket className="w-4 h-4" />
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="w-full sm:w-auto h-16 px-10 rounded-2xl border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 font-black uppercase tracking-widest text-xs text-slate-900 dark:text-white"
            >
              Watch Demo
            </Button>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="max-w-6xl mx-auto mt-24 px-4 animate-in fade-in zoom-in duration-1000 delay-500">
          <div className="bg-slate-100 dark:bg-slate-900 rounded-[3rem] border-8 border-slate-200 dark:border-white/5 shadow-2xl overflow-hidden aspect-video relative group">
            <div className="absolute inset-0 bg-slate-100/80 dark:bg-slate-950/80 to-transparent" />
            <img 
              src="https://images.unsplash.com/photo-1514525253361-bee8718a74a2?q=80&w=2000&auto=format&fit=crop" 
              alt="Live Performance" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
            />
            <div className="absolute bottom-12 left-12 right-12 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="h-16 w-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-xl">
                  <Mic2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h4 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Stage Ready</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest">Optimized for iPad & Desktop</p>
                </div>
              </div>
              <div className="hidden md:flex gap-4">
                <div className="h-12 w-32 bg-slate-200/50 dark:bg-white/10 backdrop-blur-md rounded-xl border border-slate-200 dark:border-white/10" />
                <div className="h-12 w-32 bg-slate-200/50 dark:bg-white/10 backdrop-blur-md rounded-xl border border-slate-200 dark:border-white/10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-40 px-6 bg-slate-100 dark:bg-slate-950 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-500 mb-4">Professional Ecosystem</h2>
            <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Built for the Stage</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="group p-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-[3rem] hover:bg-indigo-50 dark:hover:bg-indigo-600/10 hover:border-indigo-200 dark:hover:border-indigo-500/20 transition-all duration-500">
                <div className="bg-slate-100 dark:bg-slate-900 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 shadow-xl group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h4 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-4">{f.title}</h4>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-40 px-6 border-y border-slate-200 dark:border-white/5 bg-white dark:bg-black/20">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
          <div>
            <p className="text-5xl font-black text-indigo-500 mb-2">12K+</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Songs Managed</p>
          </div>
          <div>
            <p className="text-5xl font-black text-indigo-500 mb-2">2.5K</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Performers</p>
          </div>
          <div>
            <p className="text-5xl font-black text-indigo-500 mb-2">99.9%</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Engine Uptime</p>
          </div>
          <div>
            <p className="text-5xl font-black text-indigo-500 mb-2">150+</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Countries Served</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 px-6 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/30 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-3xl mx-auto relative z-10">
          <h3 className="text-4xl md:text-7xl font-black uppercase tracking-tight text-slate-900 dark:text-white mb-8">Ready to play?</h3>
          <p className="text-xl text-slate-500 dark:text-slate-400 mb-12 font-medium">Join thousands of musicians who have already transformed their live workflow with Gig Studio Pro.</p>
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
      <footer className="py-20 px-6 border-t border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-black/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1 rounded-md">
                <Waves className="w-4 h-4 text-white" />
              </div>
              <span className="font-black uppercase tracking-tighter text-slate-900 dark:text-white">Gig Studio Pro</span>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">© 2024 Gig Studio Technologies Inc.</p>
          </div>
          
          <div className="flex gap-12 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <button className="hover:text-indigo-400 transition-colors">Twitter</button>
            <button className="hover:text-indigo-400 transition-colors">Instagram</button>
            <button className="hover:text-indigo-400 transition-colors">Discord</button>
            <button className="hover:text-indigo-400 transition-colors">Contact</button>
          </div>
        </div>
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default Landing;
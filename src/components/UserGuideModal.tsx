"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BookOpen, Keyboard, Lightbulb, LayoutDashboard, ListMusic, Library, 
  Rocket, FileText, Waves, Sparkles, ShieldCheck, X, Settings, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'SPACE', desc: 'Play / Pause Audio (Global)' },
  { key: '←', desc: 'Previous Song (Performance Mode)' },
  { key: '→', desc: 'Next Song (Performance Mode)' },
  { key: 'S', desc: 'Toggle Auto-Scroll (Performance Mode)' },
  { key: 'E', desc: 'Edit Active Song (Performance Mode)' },
  { key: 'R', desc: 'Open Sheet Reader (Global)' },
  { key: 'H', desc: 'Toggle Repertoire Heatmap (Global)' },
  { key: 'K', desc: 'Toggle Shortcut Legend (Performance Mode)' },
  { key: 'ESC', desc: 'Exit Modals / Performance Mode' },
  { key: '⌘ + 1-6', desc: 'Switch Studio Tabs (Song Studio)' },
];

const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[90vw] h-[90vh] bg-slate-950 text-white border-white/10 rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-indigo-600 shrink-0 relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Gig Studio Pro Guide</DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 font-medium">
              Your comprehensive guide to mastering live music management.
            </DialogDescription>
          </DialogHeader>

        <ScrollArea className="flex-1 p-8 custom-scrollbar">
          <div className="space-y-10">
            {/* Welcome Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xl font-black uppercase tracking-tight">Welcome to Gig Studio Pro!</h3>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Your all-in-one platform for managing live music performances, from studio prep to stage delivery. 
                This guide will help you navigate the core features and optimize your workflow.
              </p>
            </section>

            {/* Key Features Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Lightbulb className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xl font-black uppercase tracking-tight">Key Features</h3>
              </div>
              <ul className="space-y-3 text-slate-400">
                <li className="flex items-start gap-3">
                  <ListMusic className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-white">Setlists:</p>
                    <p className="text-sm">Create, manage, and organize your gig setlists. Each setlist is a unique performance configuration.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Library className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-white">Repertoire:</p>
                    <p className="text-sm">Your master library of all songs, with detailed metadata and assets. Syncs across all your gigs.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Settings className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-white">Song Studio:</p>
                    <p className="text-sm">Deep-dive into individual songs to adjust audio, manage charts, lyrics, and more. Accessible via the 'Edit' button on any song.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Rocket className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-white">Performance Mode:</p>
                    <p className="text-sm">A distraction-free view for live gigs, with auto-scroll for lyrics/charts and real-time audio controls.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-white">Sheet Reader:</p>
                    <p className="text-sm">A dedicated mode for practicing with your linked charts and lyrics, with filtering and sorting options.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Waves className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-white">Public Repertoire & Gigs:</p>
                    <p className="text-sm">Generate stunning public-facing links to showcase your repertoire to clients or share active gig setlists with your audience.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-white">AI Engine:</p>
                    <p className="text-sm">Leverage AI for smart-link discovery, metadata enrichment, song suggestions, and lyrics formatting.</p>
                  </div>
                </li>
              </ul>
            </section>

            {/* Keyboard Shortcuts Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Keyboard className="w-5 h-5 text-purple-400" />
                <h3 className="text-xl font-black uppercase tracking-tight">Keyboard Shortcuts</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SHORTCUTS.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.desc}</span>
                    <kbd className="px-3 py-1 bg-indigo-600/20 text-indigo-400 border border-indigo-600/20 rounded-lg font-mono text-xs font-black">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>

            {/* Tips Section */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                <h3 className="text-xl font-black uppercase tracking-tight">Pro Tips & Best Practices</h3>
              </div>
              <ul className="space-y-3 text-slate-400">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
                  <p className="text-sm">
                    Use the 'Smart-Link Missing' feature in the Repertoire view to quickly find YouTube links for your songs.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
                  <p className="text-sm">
                    Regularly audit your resources using the 'Resource Audit Matrix' (accessible via the 'Resource Audit' button in Setlist/Repertoire view) to ensure all assets are linked and verified.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
                  <p className="text-sm">
                    Leverage the 'Global Auto-Sync' in the Admin Panel to keep your metadata up-to-date with official iTunes records.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
                  <p className="text-sm">
                    Customize your public profile in 'Preferences' to showcase your unique brand and repertoire to clients.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
                  <p className="text-sm">
                    For optimal performance, ensure your YouTube API key is configured in 'Preferences' for enhanced search capabilities.
                  </p>
                </li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default UserGuideModal;
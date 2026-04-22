"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Sparkles, Loader2, Check, Plus, Music, Clock, Zap, 
  AlertCircle, ExternalLink, Library, ListMusic, X, Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';

interface GigPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  repertoire: SetlistSong[];
  onAddExternalSong: (song: any) => Promise<void>;
  onAddLibrarySong: (songId: string) => Promise<void>;
  activeSetlistName?: string;
}

interface GigPlan {
  gigDetails: {
    duration: string;
    vibe: string;
    specialRequests: string[];
  };
  suggestedLibrarySongs: string[];
  suggestedExternalSongs: any[];
}

const GigPlannerModal: React.FC<GigPlannerModalProps> = ({
  isOpen,
  onClose,
  repertoire,
  onAddExternalSong,
  onAddLibrarySong,
  activeSetlistName
}) => {
  const [emailText, setEmailText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState<GigPlan | null>(null);
  const [addedSongs, setAddedSongs] = useState<Set<string>>(new Set());

  const handleGenerate = async () => {
    if (!emailText.trim()) {
      showError("Please paste the gig inquiry email content.");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-gig-planner', {
        body: {
          emailText,
          repertoire: repertoire.map(s => ({
            id: s.id,
            name: s.name,
            artist: s.artist,
            genre: s.genre,
            energy_level: s.energy_level
          }))
        }
      });

      if (error) throw error;
      setPlan(data);
      showSuccess("Gig plan generated!");
    } catch (err: any) {
      console.error("Gig Planner Error:", err);
      showError("Failed to generate gig plan. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddLibrary = async (songId: string) => {
    try {
      await onAddLibrarySong(songId);
      setAddedSongs(prev => new Set(prev).add(songId));
    } catch (err) {
      // Error handled by parent
    }
  };

  const handleAddExternal = async (song: any, index: number) => {
    try {
      await onAddExternalSong(song);
      setAddedSongs(prev => new Set(prev).add(`ext-${index}`));
    } catch (err) {
      // Error handled by parent
    }
  };

  const reset = () => {
    setEmailText('');
    setPlan(null);
    setAddedSongs(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        setTimeout(reset, 300);
      }
    }}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] bg-slate-950 border-white/10 text-white rounded-[2.5rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-indigo-600 shrink-0 relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4 mb-2">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">
                AI Gig Planner
              </DialogTitle>
              <DialogDescription className="text-indigo-100 font-bold uppercase tracking-widest text-[10px]">
                Transform inquiries into structured setlists
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {!plan ? (
            <div className="flex-1 p-8 flex flex-col gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" /> Paste Gig Inquiry Email
                </label>
                <Textarea 
                  placeholder="Paste the email from the client here... (e.g. 'Hi, we're looking for a piano player for a 3-hour wedding cocktail hour. We love upbeat pop and some jazz standards...')"
                  className="min-h-[300px] bg-slate-900/50 border-white/5 rounded-2xl p-6 text-sm font-medium focus:ring-indigo-500/50 resize-none custom-scrollbar"
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleGenerate}
                disabled={isGenerating || !emailText.trim()}
                className="h-16 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-indigo-600/20 gap-3 transition-all active:scale-95"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Generate Smart Plan
              </Button>
            </div>
          ) : (
            <>
              <div className="w-full md:w-1/3 border-r border-white/5 p-8 bg-slate-900/30 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3">Gig Parameters</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold">{plan.gigDetails.duration}</span>
                      </div>
                      <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold">{plan.gigDetails.vibe}</span>
                      </div>
                    </div>
                  </div>

                  {plan.gigDetails.specialRequests.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3">Special Requests</h3>
                      <div className="flex flex-wrap gap-2">
                        {plan.gigDetails.specialRequests.map((req, i) => (
                          <Badge key={i} variant="outline" className="bg-indigo-500/10 border-indigo-500/20 text-indigo-300 text-[9px] font-bold uppercase py-1 px-2.5 rounded-lg">
                            {req}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Button 
                  variant="outline" 
                  onClick={() => setPlan(null)}
                  className="mt-auto border-white/5 bg-white/5 hover:bg-white/10 text-slate-400 font-black uppercase tracking-widest text-[10px] h-12 rounded-xl"
                >
                  Start Over
                </Button>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-slate-900/50 flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <ListMusic className="w-4 h-4" /> Proposed Setlist for <span className="text-indigo-400">"{activeSetlistName}"</span>
                  </h3>
                </div>
                
                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-8">
                    {/* Library Hits */}
                    <div>
                      <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                        <Library className="w-3.5 h-3.5" /> Library Hits ({plan.suggestedLibrarySongs.length})
                      </h4>
                      <div className="space-y-2">
                        {plan.suggestedLibrarySongs.map(id => {
                          const song = repertoire.find(s => s.id === id);
                          if (!song) return null;
                          const isAdded = addedSongs.has(id);
                          return (
                            <div key={id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group hover:border-indigo-500/30 transition-all">
                              <div className="flex items-center gap-4">
                                <div className="bg-indigo-600/20 p-2 rounded-xl text-indigo-400">
                                  <Music className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-black uppercase tracking-tight">{song.name}</p>
                                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{song.artist}</p>
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                disabled={isAdded}
                                onClick={() => handleAddLibrary(id)}
                                className={cn(
                                  "h-9 px-4 rounded-xl font-black uppercase tracking-widest text-[9px] gap-2 transition-all",
                                  isAdded ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/20" : "bg-indigo-600 hover:bg-indigo-500 text-white"
                                )}
                              >
                                {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                {isAdded ? "Added" : "Add to Gig"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* New Discoveries */}
                    <div>
                      <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5" /> New Discoveries ({plan.suggestedExternalSongs.length})
                      </h4>
                      <div className="space-y-2">
                        {plan.suggestedExternalSongs.map((song, i) => {
                          const isAdded = addedSongs.has(`ext-${i}`);
                          const inLibrary = repertoire.some(s => s.name.toLowerCase() === song.name.toLowerCase() && s.artist?.toLowerCase() === song.artist?.toLowerCase());
                          
                          return (
                            <div key={i} className="flex items-center justify-between p-4 bg-indigo-600/5 border border-indigo-500/10 rounded-2xl group hover:border-indigo-500/30 transition-all">
                              <div className="flex items-center gap-4">
                                {song.artworkUrl ? (
                                  <img src={song.artworkUrl} alt={song.name} className="w-10 h-10 rounded-xl shadow-lg" />
                                ) : (
                                  <div className="bg-purple-600/20 p-2 rounded-xl text-purple-400">
                                    <ExternalLink className="w-4 h-4" />
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs font-black uppercase tracking-tight">{song.name}</p>
                                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{song.artist}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {inLibrary && !isAdded && (
                                  <Badge variant="outline" className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[8px] font-black uppercase">
                                    In Library
                                  </Badge>
                                )}
                                <Button 
                                  size="sm" 
                                  disabled={isAdded}
                                  onClick={() => handleAddExternal(song, i)}
                                  className={cn(
                                    "h-9 px-4 rounded-xl font-black uppercase tracking-widest text-[9px] gap-2 transition-all",
                                    isAdded ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/20" : "bg-purple-600 hover:bg-purple-500 text-white"
                                  )}
                                >
                                  {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                  {isAdded ? "Added" : "Add to Library & Gig"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="p-6 border-t border-white/5 bg-slate-900/50">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="font-black uppercase tracking-widest text-[10px] h-12 rounded-xl text-slate-400 hover:text-white"
          >
            Close Planner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GigPlannerModal;
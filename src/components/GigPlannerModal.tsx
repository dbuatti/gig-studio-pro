"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  Sparkles, Loader2, Check, Plus, Music, Clock, Zap, 
  AlertCircle, ExternalLink, Library, ListMusic, X, Info,
  Calendar, LayoutGrid, ArrowRight, Edit3
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
  onAddExternalSong: (song: any, setGroup?: number) => Promise<void>;
  onAddLibrarySong: (songId: string, setGroup?: number) => Promise<void>;
  onBuildGig: (proposedName: string, librarySongs: {id: string, setGroup: number}[], externalSongs: any[], setNames: Record<string, string>, stimulusText: string) => Promise<void>;
  activeSetlistName?: string;
  initialStimulus?: string;
}

interface GigPlan {
  proposedName: string;
  setNames: Record<string, string>;
  gigDetails: {
    duration: string;
    vibe: string;
    specialRequests: string[];
  };
  suggestedLibrarySongs: {id: string, setGroup: number}[];
  suggestedExternalSongs: any[];
}

const GigPlannerModal: React.FC<GigPlannerModalProps> = ({
  isOpen,
  onClose,
  repertoire,
  onAddExternalSong,
  onAddLibrarySong,
  onBuildGig,
  activeSetlistName,
  initialStimulus
}) => {
  const [emailText, setEmailText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [plan, setPlan] = useState<GigPlan | null>(null);
  const [addedSongs, setAddedSongs] = useState<Set<string>>(new Set());
  const [editingSetNames, setEditingSetNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && initialStimulus) {
      setEmailText(initialStimulus);
    }
  }, [isOpen, initialStimulus]);

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
      setEditingSetNames(data.setNames || {});
      showSuccess("Gig plan generated!");
    } catch (err: any) {
      console.error("Gig Planner Error:", err);
      showError("Failed to generate gig plan. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddLibrary = async (songId: string, setGroup?: number) => {
    try {
      await onAddLibrarySong(songId, setGroup);
      setAddedSongs(prev => new Set(prev).add(songId));
    } catch (err) {
      // Error handled by parent
    }
  };

  const handleAddExternal = async (song: any, index: number) => {
    try {
      await onAddExternalSong(song, song.setGroup);
      setAddedSongs(prev => new Set(prev).add(`ext-${index}`));
    } catch (err) {
      // Error handled by parent
    }
  };

  const handleBuildFullGig = async () => {
    if (!plan) return;
    setIsBuilding(true);
    try {
      await onBuildGig(plan.proposedName, plan.suggestedLibrarySongs, plan.suggestedExternalSongs, editingSetNames, emailText);
      onClose();
      setTimeout(reset, 300);
    } catch (err) {
      // Error handled by parent
    } finally {
      setIsBuilding(false);
    }
  };

  const reset = () => {
    setEmailText('');
    setPlan(null);
    setAddedSongs(new Set());
    setEditingSetNames({});
  };

  const getSetLabel = (group: number) => {
    if (editingSetNames[group.toString()]) return editingSetNames[group.toString()];
    if (group === 99) return "Surplus / Backup";
    return `Set ${group}`;
  };

  const groupedSongs = plan ? [
    ...plan.suggestedLibrarySongs.map(s => ({ ...s, type: 'library' as const })),
    ...plan.suggestedExternalSongs.map((s, i) => ({ ...s, type: 'external' as const, extIndex: i }))
  ].reduce((acc, song) => {
    const group = song.setGroup || 1;
    if (!acc[group]) acc[group] = [];
    acc[group].push(song);
    return acc;
  }, {} as Record<number, any[]>) : {};

  const sortedGroups = Object.keys(groupedSongs).map(Number).sort((a, b) => {
    if (a === 99) return 1;
    if (b === 99) return -1;
    return a - b;
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        setTimeout(reset, 300);
      }
    }}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] bg-slate-950 border-white/10 text-white rounded-[2.5rem] p-0 overflow-hidden flex flex-col shadow-2xl">
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
                Smart Gig Architect
              </DialogTitle>
              <DialogDescription className="text-indigo-100 font-bold uppercase tracking-widest text-[10px]">
                AI-Powered Multi-Set Planning
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
                Architect My Gig
              </Button>
            </div>
          ) : (
            <>
              <div className="w-full md:w-1/3 border-r border-white/5 p-8 bg-slate-900/30 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3">Proposed Event</h3>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-sm font-black uppercase tracking-tight text-white">{plan.proposedName}</p>
                    </div>
                  </div>

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

                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3">Edit Set Names</h3>
                    <div className="space-y-3">
                      {sortedGroups.map(groupNum => (
                        <div key={groupNum} className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                            {groupNum === 99 ? "Surplus" : `Set ${groupNum}`}
                          </label>
                          <Input 
                            value={editingSetNames[groupNum.toString()] || ""}
                            onChange={(e) => setEditingSetNames(prev => ({ ...prev, [groupNum.toString()]: e.target.value }))}
                            placeholder={groupNum === 99 ? "Surplus / Backup" : `Set ${groupNum}`}
                            className="h-10 bg-white/5 border-white/5 rounded-xl text-xs font-bold"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <Button 
                    onClick={handleBuildFullGig}
                    disabled={isBuilding}
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl shadow-emerald-600/20 gap-2"
                  >
                    {isBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />}
                    Build Full Gig
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setPlan(null)}
                    className="w-full border-white/5 bg-white/5 hover:bg-white/10 text-slate-400 font-black uppercase tracking-widest text-[10px] h-12 rounded-xl"
                  >
                    Start Over
                  </Button>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-slate-900/50 flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <ListMusic className="w-4 h-4" /> Multi-Set Structure
                  </h3>
                </div>
                
                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-10">
                    {sortedGroups.map(groupNum => (
                      <div key={groupNum} className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-8 px-4 rounded-full flex items-center justify-center text-[10px] font-black uppercase tracking-widest",
                            groupNum === 99 ? "bg-slate-800 text-slate-400" : "bg-indigo-600 text-white"
                          )}>
                            {getSetLabel(groupNum)}
                          </div>
                          <div className="h-px flex-1 bg-white/5" />
                        </div>

                        <div className="space-y-2">
                          {groupedSongs[groupNum].map((item, idx) => {
                            if (item.type === 'library') {
                              const song = repertoire.find(s => s.id === item.id);
                              if (!song) return null;
                              const isAdded = addedSongs.has(song.id);
                              
                              return (
                                <div key={`${song.id}-${idx}`} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group hover:border-indigo-500/30 transition-all">
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
                                    onClick={() => handleAddLibrary(song.id, groupNum)}
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
                            } else {
                              const isAdded = addedSongs.has(`ext-${item.extIndex}`);
                              const inLibrary = repertoire.some(s => s.name.toLowerCase() === item.name.toLowerCase() && s.artist?.toLowerCase() === item.artist?.toLowerCase());
                              
                              return (
                                <div key={`ext-${item.extIndex}`} className="flex items-center justify-between p-4 bg-indigo-600/5 border border-indigo-500/10 rounded-2xl group hover:border-indigo-500/30 transition-all">
                                  <div className="flex items-center gap-4">
                                    {item.artworkUrl ? (
                                      <img src={item.artworkUrl} alt={item.name} className="w-10 h-10 rounded-xl shadow-lg" />
                                    ) : (
                                      <div className="bg-purple-600/20 p-2 rounded-xl text-purple-400">
                                        <ExternalLink className="w-4 h-4" />
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-xs font-black uppercase tracking-tight">{item.name}</p>
                                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{item.artist}</p>
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
                                      onClick={() => handleAddExternal(item, item.extIndex)}
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
                            }
                          })}
                        </div>
                      </div>
                    ))}
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
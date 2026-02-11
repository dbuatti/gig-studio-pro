"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListMusic, GripVertical, Check, X, Sparkles, Loader2, Zap, Heart, Music, TrendingUp } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { Progress } from './ui/progress';

interface SetlistSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: SetlistSong[];
  onReorder: (newOrder: SetlistSong[]) => void;
  setlistName: string;
}

const SORTING_PRESETS = [
  { 
    id: 'wedding-dinner', 
    label: 'Wedding Dinner Service', 
    icon: Heart,
    instruction: 'Create a 2-hour elegant dinner set. Start with soft ambient tracks, gradually build energy for mingling, but keep it sophisticated.',
    color: 'bg-pink-600/10 border-pink-500/30 text-pink-500 hover:bg-pink-600 hover:text-white'
  },
  { 
    id: 'wedding-dance', 
    label: 'Wedding Dance Floor', 
    icon: Music,
    instruction: 'Create a 3-hour wedding reception dance set. Start with moderate energy, build to high energy, include slower breaks, end with anthems.',
    color: 'bg-purple-600/10 border-purple-500/30 text-purple-500 hover:bg-purple-600 hover:text-white'
  },
  { 
    id: 'energy-ramp', 
    label: 'Energy Ramp (Club Style)', 
    icon: TrendingUp,
    instruction: 'Order songs from lowest to highest energy for a continuous build-up. Perfect for club sets or late-night parties.',
    color: 'bg-indigo-600/10 border-indigo-500/30 text-indigo-500 hover:bg-indigo-600 hover:text-white'
  },
  { 
    id: 'balanced-flow', 
    label: 'Balanced Flow (2 Hours)', 
    icon: Zap,
    instruction: 'Create a balanced 2-hour set with good energy variation. Mix high and low energy songs to keep the audience engaged.',
    color: 'bg-emerald-600/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-600 hover:text-white'
  },
];

const SetlistSortModal: React.FC<SetlistSortModalProps> = ({
  isOpen,
  onClose,
  songs,
  onReorder,
  setlistName,
}) => {
  const [localSongs, setLocalSongs] = useState(songs);
  const [aiInstruction, setAiInstruction] = useState('');
  const [isAiSorting, setIsAiSorting] = useState(false);
  const [sortingProgress, setSortingProgress] = useState(0);
  const [sortingStatus, setSortingStatus] = useState('');

  React.useEffect(() => {
    setLocalSongs(songs);
  }, [songs]);

  const handleAiSort = async (instruction?: string) => {
    const finalInstruction = instruction || aiInstruction;
    
    if (!finalInstruction.trim()) {
      showError("Please enter an instruction or select a preset");
      return;
    }

    setIsAiSorting(true);
    setSortingProgress(10);
    setSortingStatus('Analyzing your setlist...');

    try {
      setSortingProgress(30);
      setSortingStatus(`Processing ${localSongs.length} songs...`);

      const { data, error } = await supabase.functions.invoke('ai-setlist-sorter', {
        body: {
          songs: localSongs.map(s => ({
            id: s.id,
            name: s.name,
            artist: s.artist,
            bpm: s.bpm,
            genre: s.genre,
            energy_level: s.energy_level,
            duration_seconds: s.duration_seconds
          })),
          instruction: finalInstruction
        }
      });

      setSortingProgress(70);
      setSortingStatus('Applying AI recommendations...');

      if (error) throw error;

      if (data?.orderedIds) {
        const newOrder = data.orderedIds
          .map((id: string) => localSongs.find(s => s.id === id))
          .filter(Boolean) as SetlistSong[];
        
        setSortingProgress(100);
        setSortingStatus('Complete!');
        
        setLocalSongs(newOrder);
        showSuccess(`Setlist reordered!`);
        setAiInstruction('');
      }
    } catch (err: any) {
      console.error("AI Sort Error:", err);
      showError(`AI Sorting failed: ${err.message}`);
    } finally {
      setTimeout(() => {
        setIsAiSorting(false);
        setSortingProgress(0);
        setSortingStatus('');
      }, 1000);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newItems = Array.from(localSongs);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);

    setLocalSongs(newItems);
  };

  const handleSave = () => {
    onReorder(localSongs);
    onClose();
  };

  const hasChanges = JSON.stringify(songs.map(s => s.id)) !== JSON.stringify(localSongs.map(s => s.id));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] bg-popover border-border text-foreground rounded-[2.5rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-slate-950 shrink-0 relative border-b border-white/5">
          <button
            onClick={onClose}
            className="absolute top-8 right-8 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          
          <DialogHeader className="mb-8">
            <div className="flex items-center gap-4 mb-3">
              <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
                <ListMusic className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-white leading-none">
                  Smart Sequencing
                </DialogTitle>
                <DialogDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                  Optimizing <span className="text-indigo-400">"{setlistName}"</span> with AI
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Quick Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {SORTING_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleAiSort(preset.instruction)}
                  disabled={isAiSorting}
                  className={cn(
                    "group flex flex-col items-start text-left p-4 rounded-[1.5rem] border transition-all duration-300",
                    preset.color,
                    "hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
                      <preset.icon className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-tight leading-tight">
                      {preset.label}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                    {preset.instruction}
                  </p>
                </button>
              ))}
            </div>

            {/* Custom Instruction Input */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                <Input
                  placeholder="Describe your ideal flow (e.g., 'Start with 80s pop, end with rock anthems')"
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  className="pl-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-2xl h-14 text-sm font-medium focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiSort()}
                  disabled={isAiSorting}
                />
              </div>
              <Button
                onClick={() => handleAiSort()}
                disabled={isAiSorting || !aiInstruction.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[11px] h-14 px-8 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
              >
                {isAiSorting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Run AI Sort"}
              </Button>
            </div>

            {/* Progress Indicator */}
            {isAiSorting && (
              <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-5 space-y-3 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {sortingStatus}
                  </span>
                  <span>{sortingProgress}%</span>
                </div>
                <Progress value={sortingProgress} className="h-1.5 bg-indigo-950" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex bg-background">
          {/* Manual Drag & Drop Section */}
          <div className="flex-1 flex flex-col border-r border-border">
            <div className="px-8 py-4 border-b border-border bg-secondary/30 shrink-0 flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                <GripVertical className="w-4 h-4" />
                Manual Sequence ({localSongs.length} tracks)
              </h3>
              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full">
                Drag to fine-tune
              </span>
            </div>
            
            <ScrollArea className="flex-1 p-6 custom-scrollbar">
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="setlist-songs">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2.5"
                    >
                      {localSongs.map((song, index) => (
                        <Draggable key={song.id} draggableId={song.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                "p-4 bg-card border border-border rounded-2xl flex items-center gap-4 shadow-sm transition-all duration-200",
                                "hover:border-indigo-500/30 hover:shadow-md",
                                snapshot.isDragging && "ring-2 ring-indigo-500 bg-indigo-500/5 shadow-2xl scale-[1.02] z-50"
                              )}
                            >
                              <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0 cursor-grab active:cursor-grabbing" />
                              <span className="text-[11px] font-mono font-black text-indigo-500/50 w-6">
                                {(index + 1).toString().padStart(2, '0')}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-black uppercase tracking-tight truncate text-foreground leading-tight">
                                  {song.name}
                                </h4>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate mt-0.5">
                                  {song.artist || "Unknown Artist"}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {song.bpm && (
                                  <span className="text-[9px] font-mono font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-lg">
                                    {song.bpm} BPM
                                  </span>
                                )}
                                {song.energy_level && (
                                  <span className={cn(
                                    "text-[9px] font-black uppercase px-3 py-1 rounded-full",
                                    song.energy_level === 'Peak' && "bg-red-500/10 text-red-500 border border-red-500/20",
                                    song.energy_level === 'Groove' && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                                    song.energy_level === 'Pulse' && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
                                    song.energy_level === 'Ambient' && "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                  )}>
                                    {song.energy_level}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </ScrollArea>
          </div>

          {/* Info Panel */}
          <div className="w-80 bg-secondary/20 p-8 space-y-8 overflow-y-auto custom-scrollbar hidden lg:block">
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-6 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Curation Tips
              </h4>
              <div className="space-y-4">
                {[
                  { title: "🎵 Wedding Flow", desc: "Start soft for dinner, build for dancing, end with anthems." },
                  { title: "⚡ Energy Zones", desc: "Ambient → Pulse → Groove → Peak. Avoid sudden jumps." },
                  { title: "⏱️ Set Length", desc: "AI prioritizes flow for your target duration." }
                ].map((tip, i) => (
                  <div key={i} className="p-4 bg-card rounded-[1.25rem] border border-border shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-tight text-foreground mb-1">{tip.title}</p>
                    <p className="text-[10px] leading-relaxed text-muted-foreground font-medium">
                      {tip.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8 border-t border-border">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                Setlist Overview
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Tracks</span>
                  <span className="text-xs font-black text-foreground">{localSongs.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Est. Runtime</span>
                  <span className="text-xs font-black text-foreground">
                    {Math.floor(localSongs.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / 60)}m
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Vibe Checked</span>
                  <span className="text-xs font-black text-indigo-500">
                    {localSongs.filter(s => s.energy_level).length} / {localSongs.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-8 border-t border-border bg-secondary/30 flex flex-col sm:flex-row gap-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 font-black uppercase tracking-widest text-[11px] h-14 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
          >
            Discard Changes
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isAiSorting}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.25em] text-[11px] h-14 rounded-2xl shadow-2xl shadow-indigo-500/30 gap-3 transition-all active:scale-[0.98]"
          >
            <Check className="w-5 h-5" /> Apply New Sequence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SetlistSortModal;
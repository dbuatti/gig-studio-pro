"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListMusic, GripVertical, Check, X, Sparkles, Loader2, Zap, Heart, Music, TrendingUp, Clock } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess, showInfo } from '@/utils/toast';
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
    instruction: 'Create a 2-hour elegant dinner set. Start with soft ambient tracks, gradually build energy for mingling, but keep it sophisticated. No high-energy peaks during dinner.',
    color: 'bg-pink-600'
  },
  { 
    id: 'wedding-dance', 
    label: 'Wedding Dance Floor', 
    icon: Music,
    instruction: 'Create a 3-hour wedding reception dance set. Start with moderate energy for first dance and parent dances, build to high energy for dancing, include some slower moments for breaks, end with peak energy anthems.',
    color: 'bg-purple-600'
  },
  { 
    id: 'energy-ramp', 
    label: 'Energy Ramp (Club Style)', 
    icon: TrendingUp,
    instruction: 'Order songs from lowest to highest energy for a continuous build-up. Perfect for club sets or late-night parties.',
    color: 'bg-indigo-600'
  },
  { 
    id: 'balanced-flow', 
    label: 'Balanced Flow (2 Hours)', 
    icon: Zap,
    instruction: 'Create a balanced 2-hour set with good energy variation. Mix high and low energy songs to keep the audience engaged without fatigue.',
    color: 'bg-emerald-600'
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
        showSuccess(`Setlist reordered! (${data.processingTime}ms)`);
        
        // Clear instruction after successful sort
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
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] bg-popover border-border text-foreground rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
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
                <ListMusic className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">
                Smart Setlist Sequencing
              </DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 font-medium">
              Use AI or manual drag-and-drop to perfect the flow for <span className="text-white font-bold">"{setlistName}"</span>
            </DialogDescription>
          </DialogHeader>

          {/* AI Sorting Section */}
          <div className="mt-6 space-y-4">
            {/* Quick Presets */}
            <div className="grid grid-cols-2 gap-2">
              {SORTING_PRESETS.map(preset => (
                <Button
                  key={preset.id}
                  onClick={() => handleAiSort(preset.instruction)}
                  disabled={isAiSorting}
                  className={cn(
                    "h-16 flex flex-col items-start justify-center gap-1 text-left p-4 rounded-xl transition-all",
                    preset.color,
                    "text-white hover:opacity-90"
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    <preset.icon className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-tight truncate flex-1">
                      {preset.label}
                    </span>
                  </div>
                  <span className="text-[8px] opacity-80 line-clamp-1">
                    {preset.instruction.split('.')[0]}
                  </span>
                </Button>
              ))}
            </div>

            {/* Custom Instruction */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
                <Input
                  placeholder="Custom instruction (e.g., 'Order by energy for 2 hours')"
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl h-11 focus-visible:ring-white/30"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiSort()}
                  disabled={isAiSorting}
                />
              </div>
              <Button
                onClick={() => handleAiSort()}
                disabled={isAiSorting || !aiInstruction.trim()}
                className="bg-white text-indigo-600 hover:bg-indigo-50 font-black uppercase tracking-widest text-[10px] h-11 px-6 rounded-xl shadow-lg"
              >
                {isAiSorting ? <Loader2 className="w-4 h-4 animate-spin" /> : "AI Sort"}
              </Button>
            </div>

            {/* Progress Indicator */}
            {isAiSorting && (
              <div className="bg-white/10 rounded-xl p-4 space-y-2 animate-in fade-in duration-300">
                <div className="flex items-center justify-between text-white text-xs font-bold">
                  <span>{sortingStatus}</span>
                  <span>{sortingProgress}%</span>
                </div>
                <Progress value={sortingProgress} className="h-2 bg-white/20" />
                <p className="text-[9px] text-white/60 uppercase tracking-widest">
                  AI is analyzing song metadata, energy levels, and flow patterns...
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Manual Drag & Drop Section */}
          <div className="flex-1 flex flex-col border-r border-border">
            <div className="p-4 border-b border-border bg-secondary shrink-0">
              <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                Manual Reordering ({localSongs.length} songs)
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">Drag and drop to customize order</p>
            </div>
            
            <ScrollArea className="flex-1 p-4 custom-scrollbar">
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="setlist-songs">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {localSongs.map((song, index) => (
                        <Draggable key={song.id} draggableId={song.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                "p-3 bg-card border border-border rounded-xl flex items-center gap-3 shadow-sm transition-all",
                                "hover:border-indigo-500/50",
                                snapshot.isDragging && "ring-2 ring-indigo-500 bg-indigo-500/10 shadow-xl"
                              )}
                            >
                              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" />
                              <span className="text-[10px] font-mono font-black text-muted-foreground w-6">
                                {(index + 1).toString().padStart(2, '0')}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-black uppercase tracking-tight truncate text-foreground">
                                  {song.name}
                                </h4>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">
                                  {song.artist || "Unknown Artist"}
                                </p>
                              </div>
                              {song.energy_level && (
                                <span className={cn(
                                  "text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0",
                                  song.energy_level === 'Peak' && "bg-red-500/20 text-red-400",
                                  song.energy_level === 'Groove' && "bg-amber-500/20 text-amber-400",
                                  song.energy_level === 'Pulse' && "bg-emerald-500/20 text-emerald-400",
                                  song.energy_level === 'Ambient' && "bg-blue-500/20 text-blue-400"
                                )}>
                                  {song.energy_level}
                                </span>
                              )}
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

          {/* Tips & Info Panel */}
          <div className="w-80 bg-secondary p-6 space-y-6 overflow-y-auto custom-scrollbar">
            <div>
              <h4 className="text-sm font-black uppercase tracking-tight mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Pro Tips
              </h4>
              <div className="space-y-3 text-xs text-muted-foreground">
                <div className="p-3 bg-card rounded-xl border border-border">
                  <p className="font-bold text-foreground mb-1">🎵 Wedding Flow</p>
                  <p className="text-[10px] leading-relaxed">
                    Start soft during dinner, build energy for dancing, include breaks with slower songs, end with crowd favorites.
                  </p>
                </div>
                <div className="p-3 bg-card rounded-xl border border-border">
                  <p className="font-bold text-foreground mb-1">⚡ Energy Zones</p>
                  <p className="text-[10px] leading-relaxed">
                    Ambient (background) → Pulse (foot-tappers) → Groove (dance floor) → Peak (anthems)
                  </p>
                </div>
                <div className="p-3 bg-card rounded-xl border border-border">
                  <p className="font-bold text-foreground mb-1">⏱️ Timing</p>
                  <p className="text-[10px] leading-relaxed">
                    AI will prioritize your best songs for the requested duration and place extras at the end.
                  </p>
                </div>
                <div className="p-3 bg-card rounded-xl border border-border">
                  <p className="font-bold text-foreground mb-1">🎹 Manual Control</p>
                  <p className="text-[10px] leading-relaxed">
                    Drag and drop songs on the left to fine-tune the AI's suggestions.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Current Stats
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Songs:</span>
                  <span className="font-bold text-foreground">{localSongs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Duration:</span>
                  <span className="font-bold text-foreground">
                    {Math.floor(localSongs.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / 60)} min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">With Energy Data:</span>
                  <span className="font-bold text-foreground">
                    {localSongs.filter(s => s.energy_level).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 border-t border-border bg-secondary flex flex-col sm:flex-row gap-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 font-black uppercase tracking-widest text-xs h-12 rounded-xl text-foreground hover:bg-accent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isAiSorting}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-xs h-12 rounded-xl shadow-xl shadow-indigo-500/20 gap-3"
          >
            <Check className="w-4 h-4" /> Save New Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SetlistSortModal;
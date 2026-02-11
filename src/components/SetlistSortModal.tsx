"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  ListMusic, GripVertical, Check, X, Sparkles, Loader2, Zap, Heart, 
  Music, TrendingUp, ChevronDown, ChevronUp, LayoutGrid 
} from 'lucide-react';
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
  const [showPresets, setShowPresets] = useState(true);

  React.useEffect(() => {
    setLocalSongs(songs);
  }, [songs]);

  const handleFallbackSort = (instruction: string) => {
    showInfo("Applying smart local sequence...");
    let sorted = [...localSongs];
    const lowerInstr = instruction.toLowerCase();

    // Smarter heuristic mapping
    const energyMap = { 'Peak': 4, 'Groove': 3, 'Pulse': 2, 'Ambient': 1, 'Unknown': 0 };
    
    const getScore = (s: SetlistSong) => {
      let score = (energyMap[s.energy_level || 'Unknown'] || 0) * 100;
      score += parseInt(s.bpm || '0') / 10; // BPM as a tie-breaker
      return score;
    };

    if (lowerInstr.includes('energy') || lowerInstr.includes('ramp') || lowerInstr.includes('dance')) {
      sorted.sort((a, b) => getScore(a) - getScore(b));
      if (lowerInstr.includes('high') && !lowerInstr.includes('ramp')) sorted.reverse();
    } else if (lowerInstr.includes('bpm')) {
      sorted.sort((a, b) => parseInt(a.bpm || '0') - parseInt(b.bpm || '0'));
    } else {
      // Default to energy build
      sorted.sort((a, b) => getScore(a) - getScore(b));
    }

    setLocalSongs(sorted);
    showSuccess("Local sequence applied!");
  };

  const handleAiSort = async (instruction?: string) => {
    const finalInstruction = instruction || aiInstruction;
    if (!finalInstruction.trim()) {
      showError("Please enter an instruction");
      return;
    }

    setIsAiSorting(true);
    setSortingProgress(20);
    setSortingStatus('Consulting Gemini 2.0 Flash...');

    try {
      const { data, error } = await supabase.functions.invoke('ai-setlist-sorter', {
        body: {
          songs: localSongs.map(s => ({
            id: s.id, name: s.name, artist: s.artist, bpm: s.bpm,
            genre: s.genre, energy_level: s.energy_level, duration_seconds: s.duration_seconds
          })),
          instruction: finalInstruction
        }
      });

      if (error) throw error;

      if (data?.orderedIds) {
        const newOrder = data.orderedIds
          .map((id: string) => localSongs.find(s => s.id === id))
          .filter(Boolean) as SetlistSong[];
        
        // Ensure no songs were lost
        const missing = localSongs.filter(s => !data.orderedIds.includes(s.id));
        setLocalSongs([...newOrder, ...missing]);
        showSuccess(`AI sequence applied!`);
        setAiInstruction('');
      }
    } catch (err: any) {
      console.error("AI Sort Error:", err);
      handleFallbackSort(finalInstruction);
    } finally {
      setIsAiSorting(false);
      setSortingProgress(0);
      setSortingStatus('');
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newItems = Array.from(localSongs);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);
    setLocalSongs(newItems);
  };

  const hasChanges = JSON.stringify(songs.map(s => s.id)) !== JSON.stringify(localSongs.map(s => s.id));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] bg-popover border-border text-foreground rounded-[2.5rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 bg-slate-950 shrink-0 relative border-b border-white/5">
          <button onClick={onClose} className="absolute top-8 right-8 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors z-10">
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
                  Optimizing <span className="text-indigo-400">"{setlistName}"</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setShowPresets(!showPresets)}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <LayoutGrid className="w-3 h-3" />
                {showPresets ? "Hide Presets" : "Show Presets"}
                {showPresets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {showPresets && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                {SORTING_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handleAiSort(preset.instruction)}
                    disabled={isAiSorting}
                    className={cn(
                      "group flex flex-col items-start text-left p-4 rounded-[1.5rem] border transition-all duration-300",
                      preset.color,
                      "hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-white/10 group-hover:bg-white/20">
                        <preset.icon className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-tight">{preset.label}</span>
                    </div>
                    <p className="text-[10px] font-medium leading-relaxed opacity-80">{preset.instruction}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                <Input
                  placeholder="Describe your ideal flow (e.g., 'High energy, high readiness')"
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  className="pl-12 bg-white/5 border-white/10 text-white rounded-2xl h-14 text-sm font-medium focus:ring-indigo-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiSort()}
                  disabled={isAiSorting}
                />
              </div>
              <Button
                onClick={() => handleAiSort()}
                disabled={isAiSorting || !aiInstruction.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[11px] h-14 px-8 rounded-2xl shadow-xl transition-all active:scale-95"
              >
                {isAiSorting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Run AI Sort"}
              </Button>
            </div>

            {isAiSorting && (
              <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                  <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> {sortingStatus}</span>
                  <span>{sortingProgress}%</span>
                </div>
                <Progress value={sortingProgress} className="h-1.5 bg-indigo-950" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex bg-background">
          <div className="flex-1 flex flex-col border-r border-border">
            <div className="px-8 py-4 border-b border-border bg-secondary/30 shrink-0 flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                <GripVertical className="w-4 h-4" /> Manual Sequence ({localSongs.length} tracks)
              </h3>
            </div>
            
            <ScrollArea className="flex-1 p-6 custom-scrollbar">
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="setlist-songs">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2.5">
                      {localSongs.map((song, index) => (
                        <Draggable key={song.id} draggableId={song.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                "p-4 bg-card border border-border rounded-2xl flex items-center gap-4 shadow-sm transition-all duration-200",
                                "hover:border-indigo-500/30 hover:bg-indigo-500/[0.02]",
                                snapshot.isDragging && "ring-2 ring-indigo-500 bg-indigo-500/10 shadow-2xl scale-[1.02] z-50 border-indigo-500"
                              )}
                            >
                              <GripVertical className={cn(
                                "w-4 h-4 shrink-0 transition-colors",
                                snapshot.isDragging ? "text-indigo-500" : "text-muted-foreground/50"
                              )} />
                              <span className="text-[11px] font-mono font-black text-indigo-500/50 w-6">{(index + 1).toString().padStart(2, '0')}</span>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-black uppercase tracking-tight truncate text-foreground">{song.name}</h4>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{song.artist || "Unknown Artist"}</p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {song.energy_level && (
                                  <span className={cn(
                                    "text-[9px] font-black uppercase px-3 py-1 rounded-full",
                                    song.energy_level === 'Peak' && "bg-red-500/10 text-red-500 border border-red-500/20",
                                    song.energy_level === 'Groove' && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                                    song.energy_level === 'Pulse' && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
                                    song.energy_level === 'Ambient' && "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                  )}>{song.energy_level}</span>
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
        </div>

        <DialogFooter className="p-8 border-t border-border bg-secondary/30 flex flex-col sm:flex-row gap-4">
          <Button variant="ghost" onClick={onClose} className="flex-1 font-black uppercase tracking-widest text-[11px] h-14 rounded-2xl">Discard</Button>
          <Button
            onClick={() => { onReorder(localSongs); onClose(); }}
            disabled={!hasChanges || isAiSorting}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.25em] text-[11px] h-14 rounded-2xl shadow-2xl shadow-indigo-500/30 gap-3 transition-all active:scale-95"
          >
            <Check className="w-5 h-5" /> Apply Sequence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SetlistSortModal;
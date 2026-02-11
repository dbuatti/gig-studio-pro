"use client";

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  ListMusic, GripVertical, Check, X, Sparkles, Loader2, Zap, Heart, 
  Music, TrendingUp, ChevronDown, ChevronUp, LayoutGrid, Coffee,
  Lock, Unlock, BarChart3, Info, Copy
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { Progress } from './ui/progress';
import { calculateReadiness } from '@/utils/repertoireSync';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface SetlistSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: SetlistSong[];
  onReorder: (newOrder: SetlistSong[]) => void;
  setlistName: string;
}

const SORTING_PRESETS = [
  { 
    id: 'jazz-to-anthemic', 
    label: 'Jazz to Anthemic', 
    icon: Coffee,
    instruction: 'Start with Jazz Standards and Bossa Nova (Ambient/Pulse energy). Transition into mid-tempo Pop/Motown (Pulse/Groove). End with high-energy Dance Anthems (Peak energy). Strictly keep high-energy pop like ABBA or Whitney Houston for the final 30% of the set.',
    color: 'bg-blue-600/10 border-blue-500/30 text-blue-500 hover:bg-blue-600 hover:text-white'
  },
  { 
    id: 'wedding-dinner', 
    label: 'Wedding Dinner', 
    icon: Heart,
    instruction: 'Create an elegant dinner flow. Start with soft acoustic and jazz tracks. Build very slightly to mid-tempo "feel good" tracks, but never reach Peak energy. Prioritize songs with 80%+ readiness.',
    color: 'bg-pink-600/10 border-pink-500/30 text-pink-500 hover:bg-pink-600 hover:text-white'
  },
  { 
    id: 'wedding-dance', 
    label: 'Wedding Dance', 
    icon: Music,
    instruction: 'High-energy reception set. Start with Groove energy (Motown/Funk), build to Peak energy (Disco/Pop), include one or two "breather" ballads in the middle, and finish with massive anthems.',
    color: 'bg-purple-600/10 border-purple-500/30 text-purple-500 hover:bg-purple-600 hover:text-white'
  },
  { 
    id: 'energy-ramp', 
    label: 'Energy Ramp', 
    icon: TrendingUp,
    instruction: 'Strictly order songs from lowest energy (Ambient) to highest energy (Peak). Use BPM as a secondary tie-breaker for the ramp.',
    color: 'bg-indigo-600/10 border-indigo-500/30 text-indigo-500 hover:bg-indigo-600 hover:text-white'
  },
];

const EnergyFlowViz = ({ songs }: { songs: SetlistSong[] }) => {
  const energyMap = { 'Peak': 4, 'Groove': 3, 'Pulse': 2, 'Ambient': 1, 'Unknown': 0 };
  
  return (
    <div className="flex items-end gap-0.5 h-8 w-32 px-1 bg-white/5 rounded-lg overflow-hidden">
      {songs.map((song, i) => {
        const level = energyMap[song.energy_level || 'Unknown'] || 0;
        const height = (level / 4) * 100;
        return (
          <div 
            key={`${song.id}-${i}`}
            className={cn(
              "flex-1 rounded-t-[1px] transition-all duration-500",
              song.energy_level === 'Peak' ? "bg-red-500" :
              song.energy_level === 'Groove' ? "bg-amber-500" :
              song.energy_level === 'Pulse' ? "bg-emerald-500" :
              song.energy_level === 'Ambient' ? "bg-blue-500" : "bg-slate-800"
            )}
            style={{ height: `${Math.max(10, height)}%` }}
          />
        );
      })}
    </div>
  );
};

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
  const [showPresets, setShowPresets] = useState(false);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    setLocalSongs(songs);
  }, [songs]);

  const toggleLock = (id: string) => {
    const next = new Set(lockedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLockedIds(next);
  };

  const handleAiSort = async (instruction?: string) => {
    const finalInstruction = instruction || aiInstruction;
    if (!finalInstruction.trim()) {
      showError("Please enter an instruction");
      return;
    }

    setIsAiSorting(true);
    setSortingProgress(20);
    setSortingStatus('Consulting Musical Director AI...');

    try {
      const { data, error } = await supabase.functions.invoke('ai-setlist-sorter', {
        body: {
          songs: localSongs.map((s, idx) => ({
            id: s.id, 
            name: s.name, 
            artist: s.artist, 
            bpm: s.bpm,
            genre: s.genre, 
            energy_level: s.energy_level, 
            duration_seconds: s.duration_seconds,
            readiness: calculateReadiness(s),
            isLocked: lockedIds.has(s.id),
            lockedPosition: lockedIds.has(s.id) ? idx : null
          })),
          instruction: finalInstruction
        }
      });

      if (error) throw error;

      if (data?.orderedIds) {
        const newOrder = data.orderedIds
          .map((id: string) => localSongs.find(s => s.id === id))
          .filter(Boolean) as SetlistSong[];
        
        const missing = localSongs.filter(s => !data.orderedIds.includes(s.id));
        setLocalSongs([...newOrder, ...missing]);
        showSuccess(`AI sequence applied!`);
        setAiInstruction('');
      }
    } catch (err: any) {
      console.error("AI Sort Error:", err);
      showError("AI sorting failed. Please try again.");
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
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] bg-popover border-border text-foreground rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
        <div className="p-5 bg-slate-950 shrink-0 relative border-b border-white/5">
          <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors z-10">
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight text-white leading-none">
                  Smart Sequencing
                </DialogTitle>
                <DialogDescription className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mt-1">
                  Optimizing <span className="text-indigo-400">"{setlistName}"</span>
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Energy Flow</span>
                <EnergyFlowViz songs={localSongs} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                <Input
                  placeholder="Describe your ideal flow (e.g., 'Start with jazz, end with disco')"
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white rounded-xl h-11 text-xs font-medium focus:ring-indigo-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleAiSort()}
                  disabled={isAiSorting}
                />
              </div>
              <Button
                onClick={() => handleAiSort()}
                disabled={isAiSorting || !aiInstruction.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[10px] h-11 px-6 rounded-xl shadow-xl transition-all active:scale-95"
              >
                {isAiSorting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Run AI Sort"}
              </Button>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
              <button 
                onClick={() => setShowPresets(!showPresets)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors shrink-0",
                  showPresets ? "bg-indigo-600 text-white" : "bg-white/5 text-indigo-400 hover:bg-white/10"
                )}
              >
                <LayoutGrid className="w-3 h-3" />
                Presets
              </button>
              
              {showPresets && SORTING_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleAiSort(preset.instruction)}
                  disabled={isAiSorting}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-transparent shrink-0",
                    "bg-white/5 text-slate-300 hover:bg-white/10 hover:border-white/10 disabled:opacity-50"
                  )}
                >
                  <preset.icon className="w-3 h-3" />
                  {preset.label}
                </button>
              ))}
            </div>

            {isAiSorting && (
              <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-indigo-400 text-[9px] font-black uppercase tracking-widest">
                  <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> {sortingStatus}</span>
                  <span>{sortingProgress}%</span>
                </div>
                <Progress value={sortingProgress} className="h-1 bg-indigo-950" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex bg-background">
          <div className="flex-1 flex flex-col border-r border-border">
            <div className="px-6 py-3 border-b border-border bg-secondary/30 shrink-0 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <GripVertical className="w-3.5 h-3.5" /> Sequence ({localSongs.length} tracks)
              </h3>
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                <Lock className="w-2.5 h-2.5" /> Locked songs stay in position
              </div>
            </div>
            
            <ScrollArea className="flex-1 p-4 custom-scrollbar">
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="setlist-songs">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1.5">
                      {localSongs.map((song, index) => {
                        const isLocked = lockedIds.has(song.id);
                        return (
                          <Draggable key={song.id} draggableId={song.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "p-3 bg-card border border-border rounded-xl flex items-center gap-3 shadow-sm transition-all duration-200",
                                  "hover:border-indigo-500/30 hover:bg-indigo-500/[0.02]",
                                  snapshot.isDragging && "ring-2 ring-indigo-500 bg-indigo-500/10 shadow-2xl scale-[1.01] z-50 border-indigo-500",
                                  isLocked && "border-indigo-500/50 bg-indigo-500/[0.03]"
                                )}
                              >
                                <GripVertical className={cn(
                                  "w-3.5 h-3.5 shrink-0 transition-colors",
                                  snapshot.isDragging ? "text-indigo-500" : "text-muted-foreground/30"
                                )} />
                                <span className="text-[10px] font-mono font-black text-indigo-500/50 w-5">{(index + 1).toString().padStart(2, '0')}</span>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-black uppercase tracking-tight truncate text-foreground leading-none">{song.name}</h4>
                                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate mt-1">{song.artist || "Unknown Artist"}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex flex-col items-end mr-1">
                                    <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">Ready</span>
                                    <span className="text-[9px] font-mono font-bold text-indigo-500">{calculateReadiness(song)}%</span>
                                  </div>
                                  {song.energy_level && (
                                    <span className={cn(
                                      "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                                      song.energy_level === 'Peak' && "bg-red-500/10 text-red-500 border-red-500/20",
                                      song.energy_level === 'Groove' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                                      song.energy_level === 'Pulse' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                      song.energy_level === 'Ambient' && "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                    )}>{song.energy_level}</span>
                                  )}
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); toggleLock(song.id); }}
                                    className={cn(
                                      "p-1.5 rounded-lg transition-all",
                                      isLocked ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-secondary text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600"
                                    )}
                                  >
                                    {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-5 border-t border-border bg-secondary/30 flex flex-col sm:flex-row gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 font-black uppercase tracking-widest text-[10px] h-12 rounded-xl">Discard</Button>
          <Button
            onClick={() => { onReorder(localSongs); onClose(); }}
            disabled={!hasChanges || isAiSorting}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[10px] h-12 rounded-xl shadow-xl shadow-indigo-500/20 gap-2 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" /> Apply Sequence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SetlistSortModal;
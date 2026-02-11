"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListMusic, GripVertical, Check, X, Sparkles, Loader2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess, showInfo } from '@/utils/toast';

interface SetlistSortModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: SetlistSong[];
  onReorder: (newOrder: SetlistSong[]) => void;
  setlistName: string;
}

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

  // Update localSongs when the prop changes (e.g., when modal opens with new data)
  React.useEffect(() => {
    setLocalSongs(songs);
  }, [songs]);

  const handleAiSort = async () => {
    if (!aiInstruction.trim()) {
      showError("Please enter an instruction for the AI");
      return;
    }

    setIsAiSorting(true);
    showInfo("AI is analyzing your setlist...");

    try {
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
          instruction: aiInstruction
        }
      });

      if (error) throw error;

      if (data?.orderedIds) {
        const newOrder = data.orderedIds
          .map((id: string) => localSongs.find(s => s.id === id))
          .filter(Boolean) as SetlistSong[];
        
        setLocalSongs(newOrder);
        showSuccess("Setlist reordered by AI!");
      }
    } catch (err: any) {
      console.error("AI Sort Error:", err);
      showError(`AI Sorting failed: ${err.message}`);
    } finally {
      setIsAiSorting(false);
    }
  };

  const onDragEnd = (result: DropResult) => {

    // Removed setDraggingItem(null) as DragOverlay is no longer used.
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

  const hasChanges = JSON.stringify(songs) !== JSON.stringify(localSongs);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-[90vw] h-[85vh] bg-popover border-border text-foreground rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
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
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Manual Setlist Order</DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 font-medium">
              Drag and drop songs to customize the order for <span className="text-white font-bold">"{setlistName}"</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 flex gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
              <Input
                placeholder="AI Instruction (e.g. 'Order by energy for 2 hours')"
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl h-11 focus-visible:ring-white/30"
                onKeyDown={(e) => e.key === 'Enter' && handleAiSort()}
              />
            </div>
            <Button
              onClick={handleAiSort}
              disabled={isAiSorting || !aiInstruction.trim()}
              className="bg-white text-indigo-600 hover:bg-indigo-50 font-black uppercase tracking-widest text-[10px] h-11 px-6 rounded-xl shadow-lg"
            >
              {isAiSorting ? <Loader2 className="w-4 h-4 animate-spin" /> : "AI Sort"}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6 custom-scrollbar">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="setlist-songs">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-3"
                >
                  {localSongs.map((song, index) => (
                    <Draggable key={song.id} draggableId={song.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={cn(
                            "p-4 bg-card border border-border rounded-2xl flex items-center gap-4 shadow-sm transition-all",
                            "hover:border-indigo-500/50",
                            snapshot.isDragging
                              ? "ring-2 ring-indigo-500 bg-indigo-500/10 shadow-xl transform rotate-1 translate-y-1"
                              : "transform-none"
                          )}
                          style={{
                            ...provided.draggableProps.style,
                            // Ensure the original item is not visible when dragging, but the clone is styled
                            opacity: snapshot.isDragging ? 0.95 : 1,
                            background: snapshot.isDragging ? 'var(--card)' : undefined,
                            border: snapshot.isDragging ? '2px solid var(--indigo-500)' : undefined,
                            boxShadow: snapshot.isDragging ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : undefined,
                          }}
                        >
                          <GripVertical className="w-5 h-5 text-muted-foreground shrink-0 cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black uppercase tracking-tight truncate text-foreground">{song.name}</h4>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{song.artist || "Unknown Artist"}</p>
                          </div>
                          <span className="text-[9px] font-mono font-black text-muted-foreground shrink-0">
                            {(index + 1).toString().padStart(2, '0')}
                          </span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            {/* DragOverlay removed */}
          </DragDropContext>
        </ScrollArea>

        <DialogFooter className="p-6 border-t border-border bg-secondary flex flex-col sm:flex-row gap-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 font-black uppercase tracking-widest text-xs h-12 rounded-xl text-foreground hover:bg-accent dark:hover:bg-secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
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
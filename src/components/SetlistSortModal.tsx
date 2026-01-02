"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListMusic, GripVertical, Check, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult, DragStart } from 'react-beautiful-dnd';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

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
  // Removed draggingItem state as DragOverlay is no longer used.

  // Update localSongs when the prop changes (e.g., when modal opens with new data)
  React.useEffect(() => {
    setLocalSongs(songs);
  }, [songs]);

  // Removed onBeforeCapture as DragOverlay is no longer used.

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

  const renderDraggableItem = (song: SetlistSong, index: number, isDragging: boolean) => (
    <div
      className={cn(
        "p-4 bg-card border border-border rounded-2xl flex items-center gap-4 shadow-sm transition-all",
        isDragging ? "ring-2 ring-indigo-500 bg-indigo-500/10" : "hover:border-indigo-500/50"
      )}
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
  );

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
                            snapshot.isDragging ? "opacity-0" : "hover:border-indigo-500/50" // Hide original item when dragging
                          )}
                        >
                          {renderDraggableItem(song, index, snapshot.isDragging)}
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
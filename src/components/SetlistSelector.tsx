"use client";

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, ListMusic, MoreVertical, Trash2, Copy, Sparkles, Layers } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface SetlistSelectorProps {
  setlists: { id: string; name: string; stimulus_text?: string }[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onOpenGigPlanner?: () => void;
  onOpenVariation?: () => void;
}

const SetlistSelector: React.FC<SetlistSelectorProps> = ({ 
  setlists, 
  currentId, 
  onSelect, 
  onCreate, 
  onDelete, 
  onDuplicate, 
  onOpenGigPlanner,
  onOpenVariation
}) => {
  const currentSetlist = setlists.find(s => s.id === currentId);
  const hasStimulus = !!currentSetlist?.stimulus_text;

  return (
    <div className="flex items-center gap-2 bg-card p-1.5 rounded-lg border border-border shadow-sm">
      <div className="flex items-center gap-2 pl-2 border-r border-border pr-3">
        <ListMusic className="w-4 h-4 text-indigo-600" />
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden sm:inline">Active Gig</span>
      </div>
      
      <Select value={currentId} onValueChange={onSelect}>
        <SelectTrigger className="h-8 min-w-[180px] border-none shadow-none focus:ring-0 text-sm font-bold bg-transparent text-foreground">
          <SelectValue placeholder="Select Setlist" />
        </SelectTrigger>
        <SelectContent className="bg-popover text-foreground border-border">
          {setlists.map(list => (
            <SelectItem key={list.id} value={list.id} className="text-sm font-medium">
              {list.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 border-l border-border pl-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 rounded-md text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-black uppercase tracking-widest text-[9px] gap-2"
          onClick={onOpenGigPlanner}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Gig Planner</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          onClick={onCreate}
          title="Create New Setlist"
        >
          <Plus className="w-4 h-4" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover text-foreground border-border">
            {hasStimulus && (
              <>
                <DropdownMenuItem 
                  className="cursor-pointer text-indigo-600 font-bold" 
                  onClick={() => onOpenVariation?.()}
                >
                  <Layers className="w-4 h-4 mr-2" /> Create Variation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem 
              className="cursor-pointer" 
              onClick={() => onDuplicate?.(currentId)}
            >
              <Copy className="w-4 h-4 mr-2" /> Duplicate Setlist
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={() => onDelete(currentId)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete Setlist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default SetlistSelector;
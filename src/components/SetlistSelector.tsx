"use client";

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, ListMusic, MoreVertical, Trash2, Copy, Sparkles, Layers, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

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
    <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3 pl-3 border-r border-white/10 pr-4">
        <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg shadow-indigo-600/20">
          <ListMusic className="w-4 h-4 text-white" />
        </div>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hidden sm:inline">Active Gig</span>
      </div>
      
      <Select value={currentId} onValueChange={onSelect}>
        <SelectTrigger className="h-10 min-w-[160px] sm:min-w-[220px] border-none shadow-none focus:ring-0 text-sm font-black uppercase tracking-tight bg-transparent text-white hover:text-indigo-400 transition-colors">
          <SelectValue placeholder="Select Setlist" />
        </SelectTrigger>
        <SelectContent className="bg-slate-950 text-white border-white/10 rounded-2xl shadow-2xl">
          {setlists.map(list => (
            <SelectItem key={list.id} value={list.id} className="text-xs font-bold uppercase h-11 rounded-xl focus:bg-indigo-600 focus:text-white">
              {list.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 border-l border-white/10 pl-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-10 px-4 rounded-xl text-indigo-400 hover:bg-indigo-600/10 font-black uppercase tracking-widest text-[9px] gap-2.5 transition-all"
          onClick={onOpenGigPlanner}
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden lg:inline">Gig Planner</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl text-indigo-400 hover:bg-indigo-600/10 transition-all"
          onClick={onCreate}
          title="Create New Setlist"
        >
          <Plus className="w-5 h-5" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-slate-500 hover:bg-white/5 transition-all">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-950 text-white border-white/10 rounded-2xl shadow-2xl p-2">
            {hasStimulus && (
              <>
                <DropdownMenuItem 
                  className="cursor-pointer text-indigo-400 font-bold uppercase text-[10px] h-11 rounded-xl" 
                  onClick={() => onOpenVariation?.()}
                >
                  <Layers className="w-4 h-4 mr-3" /> Create Variation
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/5" />
              </>
            )}
            <DropdownMenuItem 
              className="cursor-pointer font-bold uppercase text-[10px] h-11 rounded-xl" 
              onClick={() => onDuplicate?.(currentId)}
            >
              <Copy className="w-4 h-4 mr-3" /> Duplicate Setlist
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-400 focus:text-red-300 focus:bg-red-400/10 cursor-pointer font-bold uppercase text-[10px] h-11 rounded-xl" onClick={() => onDelete(currentId)}>
              <Trash2 className="w-4 h-4 mr-3" /> Delete Setlist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default SetlistSelector;
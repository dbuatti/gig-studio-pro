"use client";

import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, ListMusic, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface SetlistSelectorProps {
  setlists: { id: string; name: string }[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

const SetlistSelector: React.FC<SetlistSelectorProps> = ({ setlists, currentId, onSelect, onCreate, onDelete }) => {
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-lg border shadow-sm">
      <div className="flex items-center gap-2 pl-2 border-r pr-3">
        <ListMusic className="w-4 h-4 text-indigo-600" />
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">Active Gig</span>
      </div>
      
      <Select value={currentId} onValueChange={onSelect}>
        <SelectTrigger className="h-8 min-w-[180px] border-none shadow-none focus:ring-0 text-sm font-bold bg-transparent">
          <SelectValue placeholder="Select Setlist" />
        </SelectTrigger>
        <SelectContent>
          {setlists.map(list => (
            <SelectItem key={list.id} value={list.id} className="text-sm font-medium">
              {list.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 border-l pl-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 rounded-md text-indigo-600 hover:bg-indigo-50"
          onClick={onCreate}
        >
          <Plus className="w-4 h-4" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-slate-400">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => onDelete(currentId)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete Setlist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default SetlistSelector;
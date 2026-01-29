"use client";

import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, ListMusic, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

interface SetlistSelectorProps {
  setlists: { id: string; name: string }[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

const SetlistSelector: React.FC<SetlistSelectorProps> = ({ setlists, currentId, onSelect, onCreate, onDelete, onRename }) => {
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    const defaultName = `New Setlist ${setlists.length + 1}`;
    onCreate(defaultName);
  };

  const handleRenameStart = (id: string, currentName: string) => {
    setIsRenaming(id);
    setNewName(currentName);
  };

  const handleRenameSave = (id: string) => {
    if (newName.trim() && newName.trim() !== setlists.find(s => s.id === id)?.name) {
      onRename(id, newName.trim());
    }
    setIsRenaming(null);
    setNewName("");
  };

  return (
    <div className="flex items-center gap-2 bg-card p-1.5 rounded-lg border border-border shadow-sm">
      <div className="flex items-center gap-2 pl-2 border-r border-border pr-3 shrink-0">
        <ListMusic className="w-4 h-4 text-indigo-600" />
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden sm:inline">Active Set</span>
      </div>
      
      {isRenaming ? (
        <div className="flex items-center gap-2 flex-1">
          <Input 
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => handleRenameSave(isRenaming!)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameSave(isRenaming!)}
            className="h-8 text-sm font-bold bg-background border-indigo-500/50 text-foreground"
          />
          <Button variant="ghost" size="icon" onClick={() => handleRenameSave(isRenaming!)} className="h-8 w-8 text-indigo-500 hover:bg-indigo-500/10">
            <Check className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <>
          <Select value={currentId} onValueChange={onSelect}>
            <SelectTrigger className="h-8 min-w-[180px] border-none shadow-none focus:ring-0 text-sm font-bold bg-transparent text-foreground">
              <SelectValue placeholder="Select Setlist" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-foreground border-border rounded-xl">
              {setlists.map(list => (
                <SelectItem key={list.id} value={list.id} className="text-sm font-medium">
                  {list.name}
                </SelectItem>
              ))}
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCreate(); }} className="text-indigo-400 font-bold cursor-pointer">
                <Plus className="w-4 h-4 mr-2" /> Create New Setlist
              </DropdownMenuItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground hover:bg-accent">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover text-foreground border-border rounded-xl">
              <DropdownMenuItem className="text-indigo-400 h-10 rounded-lg gap-2" onClick={() => handleRenameStart(currentId, setlists.find(s => s.id === currentId)?.name || "")}>
                <Edit2 className="w-4 h-4" /> Rename Setlist
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive h-10 rounded-lg gap-2" onClick={() => onDelete(currentId)}>
                <Trash2 className="w-4 h-4" /> Delete Setlist
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
};

export default SetlistSelector;
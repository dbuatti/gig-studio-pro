"use client";

import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, ListMusic, MoreVertical, Trash2, Edit, Settings2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface SetlistSelectorProps {
  setlists: { id: string; name: string }[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  onOpenSettings: () => void;
}

const SetlistSelector: React.FC<SetlistSelectorProps> = ({ setlists, currentId, onSelect, onCreate, onDelete, onRename, onOpenSettings }) => {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this setlist?")) return;
    setIsDeleting(id);
    try {
      const { error } = await supabase.from('setlists').delete().eq('id', id);
      if (error) throw error;
      onDelete(id);
      showSuccess("Setlist deleted.");
    } catch (err: any) {
      showError(`Deletion failed: ${err.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="lg" className="h-10 px-4 rounded-xl border-border bg-secondary hover:bg-accent text-foreground font-black uppercase tracking-widest text-[10px] shadow-md">
            <ListMusic className="w-4 h-4 mr-2" />
            {setlists.find(l => l.id === currentId)?.name || "Select Setlist"}
            <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 bg-popover border-border text-foreground rounded-2xl p-2">
          <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">
            Manage Setlists
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={onCreate} className="text-indigo-600 hover:bg-indigo-50/10 h-10 rounded-xl px-3 cursor-pointer gap-2">
            <Plus className="w-4 h-4" /> Create New Setlist
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border" />
          {setlists.map((setlist) => (
            <div key={setlist.id} className="flex items-center justify-between group">
              <DropdownMenuItem 
                onClick={() => onSelect(setlist.id)}
                className={cn(
                  "flex-1 h-10 rounded-lg px-3 cursor-pointer text-sm font-bold truncate",
                  setlist.id === currentId ? "bg-indigo-600 text-white" : "hover:bg-accent text-foreground"
                )}
              >
                {setlist.id === currentId && <Check className="w-4 h-4 mr-2" />}
                <span className="truncate">{setlist.name}</span>
              </DropdownMenuItem>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" onClick={() => onRename(setlist.id)} className="h-8 w-8 text-muted-foreground hover:text-indigo-400">
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(setlist.id)} disabled={isDeleting === setlist.id} className="h-8 w-8 text-muted-foreground hover:text-red-500">
                  {isDeleting === setlist.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          ))}
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem onClick={onOpenSettings} className="text-muted-foreground hover:bg-accent h-10 rounded-xl px-3 cursor-pointer gap-2">
            <Settings2 className="w-4 h-4" /> Setlist Global Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default SetlistSelector;
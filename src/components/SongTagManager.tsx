"use client";

import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Tag, X } from 'lucide-react';
import { SetlistSong } from './SetlistManager';

interface SongTagManagerProps {
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
}

const SongTagManager: React.FC<SongTagManagerProps> = ({ formData, handleAutoSave }) => {
  const [newTag, setNewTag] = useState("");

  const addTag = () => {
    if (!newTag.trim()) return;
    const currentTags = formData.user_tags || [];
    if (!currentTags.includes(newTag.trim())) {
      const updated = [...currentTags, newTag.trim()];
      handleAutoSave({ user_tags: updated });
    }
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    const updated = (formData.user_tags || []).filter(t => t !== tag);
    handleAutoSave({ user_tags: updated });
  };

  return (
    <div className="space-y-4">
      <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Custom Tags</Label>
      <div className="flex flex-wrap gap-2 mb-3">
        {(formData.user_tags || []).map(t => (
          <Badge key={t} variant="secondary" className="bg-white/5 text-indigo-300 border-white/10 px-3 py-1.5 gap-2 text-[10px] font-bold uppercase rounded-lg">
            {t} <button onClick={() => removeTag(t)}><X className="w-3 h-3 hover:text-white" /></button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add tag..."
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          className="h-10 text-xs bg-white/5 border-white/10 font-bold uppercase"
        />
        <Button size="icon" variant="ghost" className="h-10 w-10 bg-white/5" onClick={addTag}><Tag className="w-4 h-4" /></Button>
      </div>
    </div>
  );
};

export default SongTagManager;
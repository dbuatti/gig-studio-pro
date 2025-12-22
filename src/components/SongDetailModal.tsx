"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SetlistSong } from './SetlistManager';
import { ALL_KEYS } from '@/utils/keyUtils';
import { Music, Clock, FileText, Youtube, User as UserIcon, Settings2, Save } from 'lucide-react';

interface SongDetailModalProps {
  song: SetlistSong | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<SetlistSong>) => void;
}

const SongDetailModal: React.FC<SongDetailModalProps> = ({ song, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});

  useEffect(() => {
    if (song) {
      setFormData({
        name: song.name,
        artist: song.artist || "",
        bpm: song.bpm || "",
        originalKey: song.originalKey || "C",
        targetKey: song.targetKey || "C",
        notes: song.notes || "",
        youtubeUrl: song.youtubeUrl || ""
      });
    }
  }, [song, isOpen]);

  const handleSave = () => {
    if (song) {
      onSave(song.id, formData);
      onClose();
    }
  };

  if (!song) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
            <Settings2 className="w-6 h-6 text-indigo-600" />
            Song Metadata
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium">
            Fine-tune the performance details for "{song.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 py-4">
          <div className="space-y-4 col-span-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Music className="w-3 h-3" /> Title & Artist
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input 
                  placeholder="Song Title" 
                  value={formData.name} 
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="font-bold border-indigo-50 focus-visible:ring-indigo-500"
                />
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Artist" 
                    value={formData.artist} 
                    onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
                    className="pl-9 border-indigo-50 focus-visible:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Clock className="w-3 h-3" /> Tempo (BPM)
            </Label>
            <Input 
              type="number" 
              placeholder="e.g. 120" 
              value={formData.bpm} 
              onChange={(e) => setFormData(prev => ({ ...prev, bpm: e.target.value }))}
              className="font-mono border-indigo-50 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Youtube className="w-3 h-3" /> Video Reference
            </Label>
            <Input 
              placeholder="YouTube URL" 
              value={formData.youtubeUrl} 
              onChange={(e) => setFormData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
              className="text-xs border-indigo-50 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Original Key</Label>
            <Select 
              value={formData.originalKey} 
              onValueChange={(val) => setFormData(prev => ({ ...prev, originalKey: val }))}
            >
              <SelectTrigger className="font-mono border-indigo-50">
                <SelectValue placeholder="Original" />
              </SelectTrigger>
              <SelectContent>
                {ALL_KEYS.map(k => (
                  <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Target Key</Label>
            <Select 
              value={formData.targetKey} 
              onValueChange={(val) => setFormData(prev => ({ ...prev, targetKey: val }))}
            >
              <SelectTrigger className="font-mono border-indigo-200 bg-indigo-50 text-indigo-700">
                <SelectValue placeholder="Target" />
              </SelectTrigger>
              <SelectContent>
                {ALL_KEYS.map(k => (
                  <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 col-span-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <FileText className="w-3 h-3" /> Musician's Performance Notes
            </Label>
            <Textarea 
              placeholder="Intro style, bridge dynamics, ending cues..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="min-h-[100px] text-sm border-indigo-50 focus-visible:ring-indigo-500"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-[10px] font-black uppercase tracking-widest">Cancel</Button>
          <Button 
            onClick={handleSave} 
            className="bg-indigo-600 hover:bg-indigo-700 px-8 gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <Save className="w-3.5 h-3.5" /> Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SongDetailModal;
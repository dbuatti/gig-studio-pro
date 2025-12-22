"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SetlistSong } from './SetlistManager';
import { ALL_KEYS } from '@/utils/keyUtils';
import { 
  Music, Clock, FileText, Youtube, Settings2, 
  Save, FileCheck, FileDown, Sparkles, Waves, 
  Activity, Play, Volume2, Gauge, ExternalLink,
  ChevronRight, Library
} from 'lucide-react';
import { cn } from "@/lib/utils";

interface SongStudioModalProps {
  song: SetlistSong | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<SetlistSong>) => void;
  onUpdateKey: (id: string, targetKey: string) => void;
  onPerform?: (song: SetlistSong) => void;
}

const RESOURCE_TYPES = [
  { id: 'UG', label: 'Ultimate Guitar', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'FS', label: 'ForScore', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'SM', label: 'Sheet Music', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'LS', label: 'Lead Sheet', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'PDF', label: 'iPad PDF', color: 'bg-red-100 text-red-700 border-red-200' },
];

const SongStudioModal: React.FC<SongStudioModalProps> = ({ 
  song, 
  isOpen, 
  onClose, 
  onSave, 
  onUpdateKey,
  onPerform 
}) => {
  const [formData, setFormData] = useState<Partial<SetlistSong>>({});
  const [activeTab, setActiveTab] = useState<'details' | 'studio'>('details');

  useEffect(() => {
    if (song) {
      setFormData({
        name: song.name,
        artist: song.artist || "",
        bpm: song.bpm || "",
        originalKey: song.originalKey || "C",
        targetKey: song.targetKey || "C",
        notes: song.notes || "",
        youtubeUrl: song.youtubeUrl || "",
        pdfUrl: song.pdfUrl || "",
        resources: song.resources || []
      });
    }
  }, [song, isOpen]);

  const handleSave = () => {
    if (song) {
      onSave(song.id, formData);
      onClose();
    }
  };

  const toggleResource = (id: string) => {
    const current = formData.resources || [];
    const updated = current.includes(id) 
      ? current.filter(rid => rid !== id) 
      : [...current, id];
    setFormData(prev => ({ ...prev, resources: updated }));
  };

  const getYoutubeId = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  if (!song) return null;
  const videoId = getYoutubeId(formData.youtubeUrl);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-slate-950 text-white">
        <div className="flex h-[750px]">
          {/* Sidebar / Left Control Panel */}
          <div className="w-80 bg-slate-900/50 border-r border-white/5 flex flex-col">
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-indigo-600 p-1.5 rounded-lg">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="font-black uppercase tracking-tighter text-sm">Studio Config</span>
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight line-clamp-2 leading-none">
                {formData.name}
              </h2>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-2">
                {formData.artist || "Unknown Artist"}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Harmonic Configuration */}
              <div className="space-y-4">
                <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Harmonic Engine</Label>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] font-bold text-slate-400">Original</span>
                    <span className="text-sm font-mono font-bold">{formData.originalKey}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-indigo-400">Performance Key</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {song.pitch > 0 ? '+' : ''}{song.pitch} ST Shift
                      </span>
                    </div>
                    <Select 
                      value={formData.targetKey} 
                      onValueChange={(val) => {
                        setFormData(prev => ({ ...prev, targetKey: val }));
                        onUpdateKey(song.id, val);
                      }}
                    >
                      <SelectTrigger className="bg-indigo-600 border-none text-white font-bold font-mono h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {ALL_KEYS.map(k => (
                          <SelectItem key={k} value={k} className="font-mono">{k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Resource Checklist */}
              <div className="space-y-4">
                <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Performance Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {RESOURCE_TYPES.map(res => {
                    const isActive = formData.resources?.includes(res.id);
                    return (
                      <button
                        key={res.id}
                        onClick={() => toggleResource(res.id)}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-xl border transition-all",
                          isActive 
                            ? "bg-indigo-600/20 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.1)]" 
                            : "bg-white/5 text-slate-500 border-white/5 hover:border-white/10"
                        )}
                      >
                        <span className="text-[10px] font-black">{res.id}</span>
                        <span className="text-[7px] font-bold uppercase mt-0.5 opacity-60">{res.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-4 space-y-2">
                <Button 
                  onClick={() => onPerform?.(song)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-12 gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Load into Engine
                </Button>
                {formData.pdfUrl && (
                  <Button 
                    variant="outline" 
                    asChild
                    className="w-full border-white/10 hover:bg-white/5 font-black uppercase tracking-widest text-[10px] h-10 gap-2"
                  >
                    <a href={formData.pdfUrl} target="_blank" rel="noreferrer">
                      <FileDown className="w-3.5 h-3.5" /> Open Sheet Music
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-black/20">
              <Button 
                onClick={handleSave} 
                className="w-full bg-green-600 hover:bg-green-700 font-black uppercase tracking-widest text-[10px] h-11 gap-2"
              >
                <Save className="w-4 h-4" /> Commit Changes
              </Button>
            </div>
          </div>

          {/* Main Visual Content Area */}
          <div className="flex-1 flex flex-col bg-slate-950">
            <div className="h-14 border-b border-white/5 flex items-center px-8 justify-between">
              <div className="flex gap-6">
                <button 
                  onClick={() => setActiveTab('details')}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-[0.2em] pb-4 mt-4 transition-all border-b-2",
                    activeTab === 'details' ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white"
                  )}
                >
                  Master Details
                </button>
                <button 
                  onClick={() => setActiveTab('studio')}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-[0.2em] pb-4 mt-4 transition-all border-b-2",
                    activeTab === 'studio' ? "text-indigo-400 border-indigo-500" : "text-slate-500 border-transparent hover:text-white"
                  )}
                >
                  Visual Reference
                </button>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-500 hover:text-white">Close</Button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {activeTab === 'details' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Track Title</Label>
                      <Input 
                        value={formData.name} 
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-white/5 border-white/10 text-lg font-bold h-12 focus-visible:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Primary Artist</Label>
                      <Input 
                        value={formData.artist} 
                        onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
                        className="bg-white/5 border-white/10 text-lg font-bold h-12 focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tempo (BPM)</Label>
                      <Input 
                        placeholder="e.g. 128"
                        value={formData.bpm} 
                        onChange={(e) => setFormData(prev => ({ ...prev, bpm: e.target.value }))}
                        className="bg-white/5 border-white/10 font-mono focus-visible:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">YouTube Reference URL</Label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Paste link..."
                          value={formData.youtubeUrl} 
                          onChange={(e) => setFormData(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                          className="bg-white/5 border-white/10 text-xs focus-visible:ring-indigo-500"
                        />
                        <Button variant="outline" size="icon" className="shrink-0 border-white/10" onClick={() => window.open(`https://www.youtube.com/results?search_query=${formData.artist} ${formData.name}`, '_blank')}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Musician's Performance Notes</Label>
                    <Textarea 
                      placeholder="Intro style, dynamics, bridge transitions..."
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="min-h-[200px] bg-white/5 border-white/10 text-sm focus-visible:ring-indigo-500 leading-relaxed"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                      <Youtube className="w-4 h-4" /> Associated Media
                    </h3>
                  </div>

                  {videoId ? (
                    <div className="space-y-6">
                      <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                        <iframe 
                          width="100%" 
                          height="100%" 
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title="Reference Video" 
                          frameBorder="0" 
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                          allowFullScreen
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Sparkles className="w-5 h-5 text-indigo-400" />
                          <p className="text-xs font-medium text-slate-300">YouTube link is synced with your performance engine.</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setFormData(prev => ({ ...prev, youtubeUrl: "" }))} className="text-red-400 text-[10px] font-black uppercase">Remove Link</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10 space-y-4">
                      <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center text-slate-600">
                        <Youtube className="w-8 h-8 opacity-20" />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No Video Association</p>
                        <p className="text-xs text-slate-600 mt-1 max-w-[250px]">Link a YouTube video in the Details tab to enable visual reference.</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-400">
                        <Gauge className="w-3 h-3" /> Transpose Analysis
                      </div>
                      <p className="text-xs text-slate-400">Targetting <b>{formData.targetKey}</b> from <b>{formData.originalKey}</b>. Engine pitch shift set to <b>{song.pitch}</b> semitones.</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-400">
                        <Library className="w-3 h-3" /> Repertoire Tags
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {formData.resources?.map(r => (
                          <span key={r} className="text-[9px] font-black px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded border border-indigo-500/30">{r}</span>
                        ))}
                        {(!formData.resources || formData.resources.length === 0) && <span className="text-[9px] font-bold text-slate-600 italic">No resources tagged</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SongStudioModal;
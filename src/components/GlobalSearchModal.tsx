"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Sparkles, X, Globe, Music, Library } from 'lucide-react';
import { SongSearch } from './SongSearch';
import GlobalLibrary from './GlobalLibrary';
import SongSuggestions from './SongSuggestions';
import MyLibrary from './MyLibrary';
import { SetlistSong } from './SetlistManager';
import { cn } from '@/lib/utils';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSong: (url: string, name: string, artist: string, youtubeUrl?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string) => void;
  repertoire: SetlistSong[];
  onAddExistingSong?: (song: SetlistSong) => void;
}

const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ 
  isOpen, 
  onClose, 
  onAddSong, 
  repertoire,
  onAddExistingSong 
}) => {
  const [activeTab, setActiveTab] = useState("search");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] bg-slate-950 border-white/10 text-white rounded-[2rem] p-0 overflow-hidden flex flex-col shadow-2xl">
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
                <Search className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">Discovery Engine</DialogTitle>
            </div>
            <DialogDescription className="text-indigo-100 font-medium">
              Source tracks from the global ecosystem or your private library.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-8">
            <TabsList className="grid w-full grid-cols-4 h-12 bg-black/20 p-1.5 rounded-2xl border border-white/5">
              <TabsTrigger value="search" className="text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 transition-all">
                <Search className="w-3.5 h-3.5" /> iTunes
              </TabsTrigger>
              <TabsTrigger value="community" className="text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 transition-all">
                <Globe className="w-3.5 h-3.5" /> Community
              </TabsTrigger>
              <TabsTrigger value="suggestions" className="text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 transition-all">
                <Sparkles className="w-3.5 h-3.5" /> Discover
              </TabsTrigger>
              <TabsTrigger value="repertoire" className="text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 transition-all">
                <Library className="w-3.5 h-3.5" /> Library
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-950">
          <div className="h-full overflow-y-auto p-8 custom-scrollbar">
            <Tabs value={activeTab} className="w-full">
              <TabsContent value="search" className="mt-0 outline-none">
                <SongSearch 
                  onSelectSong={() => {}} 
                  onAddToSetlist={(url, name, artist, yt, ug, apple, gen) => {
                    onAddSong(url, name, artist, yt, ug, apple, gen);
                  }}
                />
              </TabsContent>

              <TabsContent value="community" className="mt-0 outline-none">
                <GlobalLibrary 
                  onImport={(song) => {
                    if (onAddExistingSong) onAddExistingSong(song as SetlistSong);
                  }} 
                />
              </TabsContent>

              <TabsContent value="suggestions" className="mt-0 outline-none">
                <SongSuggestions 
                  repertoire={repertoire} 
                  onSelectSuggestion={(query) => {
                    setActiveTab("search");
                  }}
                  onAddExistingSong={(song) => {
                    if (onAddExistingSong) onAddExistingSong(song);
                  }}
                />
              </TabsContent>

              <TabsContent value="repertoire" className="mt-0 outline-none">
                <MyLibrary 
                  repertoire={repertoire} 
                  onAddSong={(song) => {
                    if (onAddExistingSong) onAddExistingSong(song);
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        <div className="p-6 border-t border-white/5 bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Discovery Matrix Active</span>
          </div>
          <p className="text-[9px] font-mono text-slate-700 uppercase">Sync Engine v4.5</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearchModal;
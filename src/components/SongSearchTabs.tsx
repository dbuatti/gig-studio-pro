"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Globe, Sparkles, Library } from 'lucide-react';
import SongSearch from './SongSearch';
import GlobalLibrary from './GlobalLibrary';
import SongSuggestions from './SongSuggestions';
import MyLibrary from './MyLibrary';
import { SetlistSong } from './SetlistManager';

interface SongSearchTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSelectSong: (url: string, name: string, artist: string, youtubeUrl?: string) => void;
  onAddToSetlist: (url: string, name: string, artist: string, youtubeUrl?: string, ugUrl?: string, appleMusicUrl?: string, genre?: string, pitch?: number) => void;
  onAddExistingSong: (song: SetlistSong) => void;
  externalQuery: string;
  repertoire: SetlistSong[];
  currentList?: { id: string; name: string; songs: SetlistSong[] };
}

const SongSearchTabs: React.FC<SongSearchTabsProps> = ({
  activeTab,
  setActiveTab,
  onSelectSong,
  onAddToSetlist,
  onAddExistingSong,
  externalQuery,
  repertoire,
  currentList,
}) => {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4 h-9 bg-slate-100 dark:bg-slate-800 p-1 mb-6">
        <TabsTrigger value="search" className="text-[10px] uppercase font-bold gap-1.5"><Search className="w-3 h-3" /> iTunes</TabsTrigger>
        <TabsTrigger value="community" className="text-[10px] uppercase font-bold gap-1.5"><Globe className="w-3 h-3" /> Community</TabsTrigger>
        <TabsTrigger value="suggestions" className="text-[10px] uppercase font-bold gap-1.5"><Sparkles className="w-3 h-3" /> Discover</TabsTrigger>
        <TabsTrigger value="repertoire" className="text-[10px] uppercase font-bold gap-1.5"><Library className="w-3 h-3" /> Library</TabsTrigger>
      </TabsList>
      
      <TabsContent value="search" className="mt-0 space-y-4">
        <SongSearch 
          onSelectSong={onSelectSong} 
          onAddToSetlist={onAddToSetlist}
          externalQuery={externalQuery}
        />
      </TabsContent>

      <TabsContent value="community" className="mt-0 space-y-4">
        <GlobalLibrary onImport={onAddExistingSong} />
      </TabsContent>

      <TabsContent value="suggestions" className="mt-0 space-y-4">
        <SongSuggestions repertoire={repertoire} onSelectSuggestion={(query) => {
          setActiveTab("search");
          onAddToSetlist("", "", "", undefined, undefined, undefined, undefined, 0); // Clear current song in transposer
          // This is a bit of a hack to trigger the search in SongSearch.
          // A more robust solution would involve lifting the search query state higher.
          // For now, we'll rely on the externalQuery prop being updated.
          // The parent component (AudioTransposer) will need to manage this.
        }} />
      </TabsContent>

      <TabsContent value="repertoire" className="mt-0 space-y-4">
        <MyLibrary 
          repertoire={repertoire} 
          onAddSong={onAddExistingSong}
        />
      </TabsContent>
    </Tabs>
  );
};

export default SongSearchTabs;
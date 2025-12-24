"use client";

import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Globe, Check, Clock, Zap, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';

interface YoutubeResultsShelfProps {
  results: any[];
  currentVideoId: string | null;
  onSelect: (videoUrl: string) => void;
  // onSyncAndExtract: (videoUrl: string) => void; // Removed
  isLoading: boolean;
  // isExtracting?: boolean; // Removed
}

const YoutubeResultsShelf: React.FC<YoutubeResultsShelfProps> = ({ 
  results, 
  currentVideoId, 
  onSelect, 
  // onSyncAndExtract, // Removed
  isLoading,
  // isExtracting // Removed
}) => {
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 animate-in fade-in duration-500">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="min-w-[220px] aspect-video rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div className="space-y-3 animate-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Global Search Results</span>
        <span className="text-[8px] font-mono text-slate-600 uppercase">{results.length} Discovery Matches</span>
      </div>
      
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {results.map((video) => {
            const isSelected = currentVideoId === video.videoId;
            return (
              <div
                key={video.videoId}
                className={cn(
                  "min-w-[220px] flex flex-col bg-slate-900 border rounded-xl overflow-hidden transition-all group relative shadow-lg",
                  isSelected ? "border-indigo-500 ring-1 ring-indigo-500/20" : "border-white/5 hover:border-white/10"
                )}
              >
                <div className="aspect-video relative overflow-hidden bg-black">
                  <img 
                    src={video.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`} 
                    alt={video.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                  
                  {/* Hover Overlay Automation - Removed Sync & Extract button */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                     <Button 
                       onClick={() => onSelect(`https://www.youtube.com/watch?v=${video.videoId}`)}
                       className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] h-10 px-4 rounded-xl shadow-2xl gap-2 active:scale-95 transition-transform"
                     >
                       <Check className="w-3 h-3" /> Select Video
                     </Button>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 left-2 bg-indigo-600 p-1 rounded-full text-white shadow-xl">
                      <Check className="w-3 h-3" />
                    </div>
                  )}

                  <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded text-[8px] font-mono font-bold text-white">
                    {video.duration || '0:00'}
                  </div>
                </div>
                
                <button
                  onClick={() => onSelect(`https://www.youtube.com/watch?v=${video.videoId}`)}
                  className="p-3 space-y-1.5 text-left"
                >
                  <h4 className="font-bold text-[10px] leading-tight line-clamp-1 uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
                    {video.title}
                  </h4>
                  <div className="flex items-center justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest">
                    <span className="truncate max-w-[100px]">{video.author}</span>
                    <span>{video.viewCountText?.split(' ')[0] || 'Vivid'}</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default YoutubeResultsShelf;
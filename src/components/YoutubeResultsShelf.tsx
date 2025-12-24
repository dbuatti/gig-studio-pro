"use client";

import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Globe, Check, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

interface YoutubeResultsShelfProps {
  results: any[];
  currentVideoId: string | null;
  onSelect: (videoUrl: string) => void;
  isLoading: boolean;
}

const YoutubeResultsShelf: React.FC<YoutubeResultsShelfProps> = ({ results, currentVideoId, onSelect, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 animate-in fade-in duration-500">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="min-w-[200px] aspect-video rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div className="space-y-3 animate-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Alternate Records</span>
        <span className="text-[8px] font-mono text-slate-600 uppercase">{results.length} Discovery Matches</span>
      </div>
      
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {results.map((video) => {
            const isSelected = currentVideoId === video.videoId;
            return (
              <button
                key={video.videoId}
                onClick={() => onSelect(`https://www.youtube.com/watch?v=${video.videoId}`)}
                className={cn(
                  "min-w-[200px] flex flex-col bg-slate-900 border rounded-xl overflow-hidden transition-all group text-left shadow-lg",
                  isSelected ? "border-indigo-500 ring-1 ring-indigo-500/20" : "border-white/5 hover:border-white/10"
                )}
              >
                <div className="aspect-video relative overflow-hidden bg-black">
                  <img 
                    src={video.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`} 
                    alt={video.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center">
                      <div className="bg-white p-1.5 rounded-full text-indigo-600 shadow-xl">
                        <Check className="w-4 h-4" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded text-[8px] font-mono font-bold text-white">
                    {Math.floor(video.lengthSeconds / 60)}:{(video.lengthSeconds % 60).toString().padStart(2, '0')}
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  <h4 className="font-bold text-[10px] leading-tight line-clamp-1 uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
                    {video.title}
                  </h4>
                  <div className="flex items-center justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest">
                    <span className="truncate max-w-[80px]">{video.author}</span>
                    <span>{video.viewCountText?.split(' ')[0] || 'Vivid'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default YoutubeResultsShelf;
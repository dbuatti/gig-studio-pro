"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Youtube, Search, Loader2, X, Download, ExternalLink, PlayCircle, Terminal, CheckCircle2
} from 'lucide-react';
import { cn } from "@/lib/utils";
import YoutubeResultsShelf from './YoutubeResultsShelf';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import { SetlistSong } from './SetlistManager';
import { cleanYoutubeUrl } from '@/utils/youtubeUtils';

interface YoutubeMediaManagerProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onOpenAdmin?: () => void;
  onLoadAudioFromUrl: (url: string, initialPitch?: number) => Promise<void>;
  onSwitchTab: (tab: 'config' | 'details' | 'audio' | 'visual' | 'lyrics' | 'charts' | 'library') => void;
}

const YoutubeMediaManager: React.FC<YoutubeMediaManagerProps> = ({
  song,
  formData,
  handleAutoSave,
  onOpenAdmin,
  onLoadAudioFromUrl,
  onSwitchTab,
}) => {
  const { user } = useAuth();
  const [ytApiKey, setYtApiKey] = useState("");
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);
  const [ytResults, setYtResults] = useState<any[]>([]);
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  const currentVideoId = useMemo(() => {
    if (!formData.youtubeUrl) return null;
    const match = formData.youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }, [formData.youtubeUrl]);

  useEffect(() => {
    if (user) {
      fetchYtKey();
    }
  }, [user]);

  const fetchYtKey = async () => {
    const { data } = await supabase.from('profiles').select('youtube_api_key').eq('id', user?.id).single();
    if (data?.youtube_api_key) setYtApiKey(data.youtube_api_key);
  };

  const parseISO8601Duration = (duration: string): string => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return "0:00";
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const performYoutubeDiscovery = async (searchTerm: string) => {
    console.log("[YoutubeMediaManager] Starting YouTube discovery for:", searchTerm);
    if (!searchTerm.trim()) {
      console.log("[YoutubeMediaManager] Search term is empty. Skipping discovery.");
      return;
    }
    
    if (searchTerm.startsWith('http')) {
      console.log("[YoutubeMediaManager] Search term is a URL. Linking directly:", searchTerm);
      handleAutoSave({ youtubeUrl: cleanYoutubeUrl(searchTerm) });
      showSuccess("YouTube URL Linked");
      return;
    }

    setIsSearchingYoutube(true);
    setYtResults([]);
    setLastQuery(searchTerm);

    if (ytApiKey) {
      console.log("[YoutubeMediaManager] Using YouTube Data API key for search.");
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=video&videoCategoryId=10&relevanceLanguage=en&maxResults=12&key=${ytApiKey}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.items && searchData.items.length > 0) {
          const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
          const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${ytApiKey}`;
          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();

          if (detailsData.items) {
            const resultsWithDurations = detailsData.items.map((item: any) => ({
              videoId: item.id,
              title: item.snippet.title,
              author: item.snippet.channelTitle,
              videoThumbnails: [{ url: item.snippet.thumbnails.medium.url }],
              duration: parseISO8601Duration(item.contentDetails.duration),
              durationSeconds: (parseInt(item.contentDetails.duration.match(/(\d+)H/)?.[1] || "0") * 3600) + 
                               (parseInt(item.contentDetails.duration.match(/(\d+)M/)?.[1] || "0") * 60) + 
                               parseInt(item.contentDetails.duration.match(/(\d+)S/)?.[1] || "0"),
              viewCountText: `${parseInt(item.statistics.viewCount).toLocaleString()} views`
            }));

            setYtResults(resultsWithDurations);
            setIsSearchingYoutube(false);
            showSuccess(`Discovery Match: ${resultsWithDurations.length} records found`);
            console.log("[YoutubeMediaManager] YouTube Data API search successful. Results:", resultsWithDurations);
            return;
          }
        }
      } catch (e) {
        console.error("[YoutubeMediaManager] YouTube Data API search failed:", e);
      }
    } else {
      console.warn("[YoutubeMediaManager] No YouTube Data API key found. Falling back to Invidious instances.");
    }

    // Fallback search strategy
    try {
      const proxies = ["https://api.allorigins.win/get?url=", "https://corsproxy.io/?"];
      const instances = ['https://iv.ggtyler.dev', 'https://yewtu.be', 'https://invidious.flokinet.to'];
      
      let success = false;
      for (const proxy of proxies) {
        if (success) break;
        for (const instance of instances) {
          if (success) break;
          try {
            const target = encodeURIComponent(`${instance}/api/v1/search?q=${encodeURIComponent(searchTerm)}`);
            const res = await fetch(`${proxy}${target}`);
            if (!res.ok) continue;
            
            const raw = await res.json();
            const data = typeof raw.contents === 'string' ? JSON.parse(raw.contents) : raw;
            const videos = data?.filter?.((i: any) => i.type === "video").slice(0, 10);
            
            if (videos && videos.length > 0) {
              setYtResults(videos.map((v: any) => ({
                videoId: v.videoId,
                title: v.title,
                author: v.author,
                videoThumbnails: v.videoThumbnails,
                durationSeconds: v.durationSeconds,
                duration: v.durationSeconds ? `${Math.floor(v.durationSeconds/60)}:${(v.durationSeconds%60).toString().padStart(2, '0')}` : '0:00',
                viewCountText: v.viewCountText
              })));
              success = true;
              console.log("[YoutubeMediaManager] Invidious fallback search successful. Results:", videos);
            }
          } catch (err) {
            console.error("[YoutubeMediaManager] Invidious instance search failed:", err);
          }
        }
      }
      
      if (!success) {
        showError("Global discovery engine congested or no results found.");
        console.warn("[YoutubeMediaManager] All fallback search attempts failed.");
      }
    } catch (err) {
      showError("Search services offline.");
      console.error("[YoutubeMediaManager] General search service error:", err);
    } finally {
      setIsSearchingYoutube(false);
    }
  };

  const handleYoutubeSearch = () => {
    const artist = (formData.artist || "").replace(/&/g, 'and'); 
    const title = (formData.name || "").replace(/&/g, 'and');
    const query = `${artist} - ${title} (Official Audio)`;
    performYoutubeDiscovery(query);
  };

  const handleSelectYoutubeVideo = (url: string) => {
    console.log("[YoutubeMediaManager] Selected YouTube video:", url);
    handleAutoSave({ youtubeUrl: cleanYoutubeUrl(url) });
  };

  const handleBackgroundExtraction = async (videoUrlToDownload?: string) => {
    const targetVideoUrl = cleanYoutubeUrl(videoUrlToDownload || formData.youtubeUrl || '');

    console.log("[YoutubeMediaManager] Initiating background extraction for:", targetVideoUrl);

    if (!targetVideoUrl) {
      showError("Link a YouTube URL first.");
      console.error("[YoutubeMediaManager] No target video URL for extraction.");
      return;
    }
    if (!user?.id || !song?.id) {
      showError("Session data missing. Please log in.");
      console.error("[YoutubeMediaManager] User ID or Song ID missing for extraction.");
      return;
    }

    handleAutoSave({ youtubeUrl: targetVideoUrl });
    setIsTriggering(true);
    console.log("[YoutubeMediaManager] Invoking 'download-audio' edge function...");

    try {
      const { data, error } = await supabase.functions.invoke('download-audio', {
        body: { 
          videoUrl: targetVideoUrl,
          songId: song.id,
          userId: user.id
        }
      });

      if (error) throw error;

      showInfo("Background extraction started. You can close this window; the audio will update automatically.");
      showSuccess("Task Queued Successfully");
      console.log("[YoutubeMediaManager] 'download-audio' edge function invoked successfully. Response:", data);
      
    } catch (err: any) {
      showError(`Trigger failed: ${err.message}`);
      console.error("[YoutubeMediaManager] 'download-audio' edge function invocation failed:", err);
    } finally {
      setIsTriggering(false);
      console.log("[YoutubeMediaManager] Background extraction process finished.");
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black uppercase tracking-tight text-indigo-400">Discovery Matrix</h3>
        {lastQuery && (
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/10">
            <Terminal className="w-3 h-3 text-slate-500" />
            <span className="text-[9px] font-mono text-slate-400 uppercase truncate max-w-[200px]">Query: {lastQuery}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search song or paste URL..."
          value={formData.youtubeUrl || ""}
          onChange={(e) => handleAutoSave({ youtubeUrl: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && performYoutubeDiscovery(formData.youtubeUrl || '')}
          className="flex-1 bg-slate-900 border-white/10 h-14 px-6 rounded-xl text-white placeholder:text-slate-600"
        />
        <div className="flex gap-3">
          <Button
            variant="default"
            onClick={handleYoutubeSearch}
            disabled={isSearchingYoutube || isTriggering}
            className="bg-red-600 hover:bg-red-700 text-white h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3 shadow-lg shadow-red-600/20"
          >
            {isSearchingYoutube ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-4 h-4" />} SEARCH
          </Button>
          <Button
            onClick={() => handleBackgroundExtraction()}
            disabled={isSearchingYoutube || isTriggering || !formData.youtubeUrl}
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3 shadow-lg shadow-indigo-600/20"
          >
            {isTriggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-4 h-4" />} 
            {isTriggering ? 'TRIGGERING...' : 'START BACKGROUND EXTRACT'}
          </Button>
        </div>
      </div>

      {ytResults.length > 0 && (
        <YoutubeResultsShelf
          results={ytResults}
          currentVideoId={currentVideoId}
          onSelect={handleSelectYoutubeVideo}
          onDownloadAudio={handleBackgroundExtraction}
          onPreviewVideo={(url) => {
            handleAutoSave({ youtubeUrl: cleanYoutubeUrl(url) });
            onSwitchTab('visual');
          }}
          isLoading={isSearchingYoutube}
          isDownloading={isTriggering}
          downloadStatus={isTriggering ? 'processing' : 'idle'}
        />
      )}
    </div>
  );
};

export default YoutubeMediaManager;
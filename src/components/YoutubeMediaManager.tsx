"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Youtube, Search, Loader2, X, Download, ExternalLink
} from 'lucide-react';
import { cn } from "@/lib/utils";
import YoutubeResultsShelf from './YoutubeResultsShelf';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { SetlistSong } from './SetlistManager';

interface YoutubeMediaManagerProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onOpenAdmin?: () => void;
  onLoadAudioFromUrl: (url: string, initialPitch: number) => Promise<void>;
}

const YoutubeMediaManager: React.FC<YoutubeMediaManagerProps> = ({
  song,
  formData,
  handleAutoSave,
  onOpenAdmin,
  onLoadAudioFromUrl,
}) => {
  const { user } = useAuth();
  const [ytApiKey, setYtApiKey] = useState("");
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);
  const [ytResults, setYtResults] = useState<any[]>([]);

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

  // Helper to parse ISO 8601 duration (e.g., PT4M13S -> 4:13)
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
    if (!searchTerm.trim()) return;
    
    // Check if it's a URL first
    if (searchTerm.startsWith('http')) {
      handleAutoSave({ youtubeUrl: searchTerm });
      showSuccess("YouTube URL Linked");
      return;
    }

    setIsSearchingYoutube(true);
    setYtResults([]);

    // Strategy 1: Google YouTube API (Premium/Official Duration Data)
    if (ytApiKey) {
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=video&maxResults=10&key=${ytApiKey}`;
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
              viewCountText: `${parseInt(item.statistics.viewCount).toLocaleString()} views`
            }));

            setYtResults(resultsWithDurations);
            setIsSearchingYoutube(false);
            showSuccess(`Engine Synced: Found ${resultsWithDurations.length} records`);
            return;
          }
        }
      } catch (e) {
        console.error("YouTube API failed, trying fallback...", e);
      }
    }

    // Strategy 2: Proxy Fallback (Public Search Engine)
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
                duration: v.durationSeconds ? `${Math.floor(v.durationSeconds/60)}:${(v.durationSeconds%60).toString().padStart(2, '0')}` : '0:00',
                viewCountText: v.viewCountText
              })));
              success = true;
            }
          } catch (err) {}
        }
      }
      
      if (!success) {
        showError("Search engines congested. Check network connection.");
      } else {
        showSuccess("Discovery complete.");
      }
    } catch (err) {
      showError("Global search engine offline.");
    } finally {
      setIsSearchingYoutube(false);
    }
  };

  const handleYoutubeSearch = () => {
    const artist = (formData.artist || "").replace(/&/g, 'and'); 
    const name = (formData.name || "").replace(/&/g, 'and');
    const query = `${artist} ${name} official music video`;
    performYoutubeDiscovery(query);
  };

  const handleSelectYoutubeVideo = (url: string) => {
    handleAutoSave({ youtubeUrl: url });
  };

  const handleClearYoutubeSelection = () => {
    handleAutoSave({ youtubeUrl: "" });
    setYtResults([]); // Clear results when selection is cleared
  };

  // NEW: Logic to download audio from the Render API
  const handleDownloadFromRender = async () => {
    if (!formData.youtubeUrl) {
      showError("Please link a YouTube URL first.");
      return;
    }

    // Show loading state in the UI (you might want to add a specific state for this)
    setIsSearchingYoutube(true); 
    
    const renderUrl = "https://yt-audio-api-2fxp.onrender.com";
    const fullUrl = `${renderUrl}/?url=${encodeURIComponent(formData.youtubeUrl)}`;

    try {
      // Step 1: Get Token
      const tokenResponse = await fetch(fullUrl);
      if (!tokenResponse.ok) throw new Error("Failed to get token");
      
      const { token } = await tokenResponse.json();
      showSuccess("Token received. Downloading...");
      
      // Step 2: Poll for download
      const downloadUrl = `${renderUrl}/download?token=${token}`;
      
      // We can't fetch the binary file directly into the browser state easily without a download prompt.
      // So we will open the download URL in a new tab, which triggers the browser download.
      // However, the API returns JSON if processing, so we need to handle that.
      
      const checkDownload = async () => {
        const res = await fetch(downloadUrl);
        if (res.status === 202) {
          // Still processing, wait and try again
          setTimeout(checkDownload, 2000);
        } else if (res.ok) {
          // Success - create a link to trigger download
          const blob = await res.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `${formData.name || 'audio'}.mp3`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
          showSuccess("Audio downloaded successfully!");
          setIsSearchingYoutube(false);
        } else {
          throw new Error("Download failed");
        }
      };

      // Start polling
      checkDownload();

    } catch (err) {
      showError("Render API connection failed. Ensure the service is running.");
      setIsSearchingYoutube(false);
    }
  };

  return (
    <div className="space-y-10">
      <h3 className="text-xl font-black uppercase tracking-tight text-indigo-400 shrink-0">REFERENCE MEDIA</h3>
      <div className="flex flex-col md:flex-row gap-4 shrink-0">
        <Input
          placeholder="Search song or paste URL..."
          value={formData.youtubeUrl || ""}
          onChange={(e) => handleAutoSave({ youtubeUrl: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && performYoutubeDiscovery(formData.youtubeUrl || '')}
          className="flex-1 bg-slate-900 border-white/10 h-14 px-6 rounded-xl"
        />
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleYoutubeSearch}
            disabled={isSearchingYoutube}
            className="bg-red-950/30 border-red-900/50 text-red-500 h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3"
          >
            {isSearchingYoutube ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-4 h-4" />} SEARCH
          </Button>
          <Button
            onClick={handleDownloadFromRender}
            disabled={isSearchingYoutube}
            className="bg-indigo-600 hover:bg-indigo-700 h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3"
          >
            {isSearchingYoutube ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-4 h-4" />} DOWNLOAD
          </Button>
        </div>
      </div>
      {ytResults.length > 0 && (
        <YoutubeResultsShelf
          results={ytResults}
          currentVideoId={currentVideoId}
          onSelect={handleSelectYoutubeVideo}
          isLoading={isSearchingYoutube}
        />
      )}

      {/* New section for selected video and download links */}
      {formData.youtubeUrl && currentVideoId && (
        <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 space-y-8 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Youtube className="w-6 h-6 text-red-500" />
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Linked YouTube Media</h3>
                <p className="text-sm text-slate-400">Use the "Download" button above to fetch audio from Render.</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClearYoutubeSelection}
              className="h-10 w-10 rounded-full hover:bg-white/10 text-slate-400"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-2xl p-6 space-y-4 border border-white/5 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white mb-2">Render API Status</h4>
                <p className="text-xs text-slate-400">Ensure your Render service is active and updated with CORS enabled.</p>
              </div>
              <div className="flex gap-2">
                 <a href="https://yt-audio-api-2fxp.onrender.com" target="_blank" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                   Check API <ExternalLink className="w-3 h-3" />
                 </a>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 space-y-4 border border-white/5 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white mb-2">Manual Download</h4>
                <p className="text-xs text-slate-400">If the automated download fails, use the link below.</p>
              </div>
              <Button 
                className="w-full bg-red-600 hover:bg-red-700 font-black uppercase tracking-widest text-xs h-12 rounded-xl gap-2"
                onClick={() => window.open(`https://yt-audio-api-2fxp.onrender.com/?url=${encodeURIComponent(formData.youtubeUrl || '')}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4" /> Open API Link
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YoutubeMediaManager;
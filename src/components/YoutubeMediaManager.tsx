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
import { CustomProgress } from '@/components/CustomProgress'; // Import CustomProgress component
import * as Tone from 'tone'; // Import Tone.js
import { cleanYoutubeUrl } from '@/utils/youtubeUtils'; // Import the utility function

interface YoutubeMediaManagerProps {
  song: SetlistSong | null;
  formData: Partial<SetlistSong>;
  handleAutoSave: (updates: Partial<SetlistSong>) => void;
  onOpenAdmin?: () => void;
  onLoadAudioFromUrl: (url: string, initialPitch?: number) => Promise<void>; // Changed prop name and type
}

const YoutubeMediaManager: React.FC<YoutubeMediaManagerProps> = ({
  song,
  formData,
  handleAutoSave,
  onOpenAdmin,
  onLoadAudioFromUrl, // Changed prop name
}) => {
  const { user } = useAuth();
  const [ytApiKey, setYtApiKey] = useState("");
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);
  const [ytResults, setYtResults] = useState<any[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'processing' | 'downloading' | 'error' | 'success'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0); // New state for progress

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
      console.log("[YoutubeMediaManager] Direct URL provided, linking:", searchTerm);
      handleAutoSave({ youtubeUrl: cleanYoutubeUrl(searchTerm) }); // Apply sanitization here
      showSuccess("YouTube URL Linked");
      return;
    }

    setIsSearchingYoutube(true);
    setYtResults([]);
    console.log("[YoutubeMediaManager] Starting YouTube discovery for:", searchTerm);

    // Strategy 1: Google YouTube API (Premium/Official Duration Data)
    if (ytApiKey) {
      console.log("[YoutubeMediaManager] Attempting search with Google YouTube API (API Key available).");
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=video&maxResults=10&key=${ytApiKey}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.items && searchData.items.length > 0) {
          console.log(`[YoutubeMediaManager] Google API: Found ${searchData.items.length} videos. Fetching details...`);
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
            console.log("[YoutubeMediaManager] Google API search successful.");
            return;
          }
        }
      } catch (e) {
        console.error("[YoutubeMediaManager] Google YouTube API failed, trying fallback...", e);
      }
    } else {
      console.log("[YoutubeMediaManager] No YouTube API Key configured. Skipping Google API search.");
    }

    // Strategy 2: Proxy Fallback (Public Search Engine)
    console.log("[YoutubeMediaManager] Attempting search with Invidious proxy fallback.");
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
            console.log(`[YoutubeMediaManager] Trying proxy: ${proxy}, instance: ${instance}`);
            const res = await fetch(`${proxy}${target}`);
            if (!res.ok) {
              console.warn(`[YoutubeMediaManager] Proxy/instance failed with status ${res.status}`);
              continue;
            }
            
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
              console.log(`[YoutubeMediaManager] Invidious proxy search successful. Found ${videos.length} videos.`);
            }
          } catch (err) {
            console.error("[YoutubeMediaManager] Error with proxy/instance:", err);
          }
        }
      }
      
      if (!success) {
        showError("Search engines congested. Check network connection.");
        console.warn("[YoutubeMediaManager] All proxy attempts failed.");
      } else {
        showSuccess("Discovery complete.");
      }
    } catch (err) {
      showError("Global search engine offline.");
      console.error("[YoutubeMediaManager] Global search engine offline:", err);
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
    console.log("[YoutubeMediaManager] Selected YouTube video URL:", url);
    handleAutoSave({ youtubeUrl: cleanYoutubeUrl(url) }); // Apply sanitization here
  };

  const handleClearYoutubeSelection = () => {
    console.log("[YoutubeMediaManager] Clearing YouTube video selection.");
    handleAutoSave({ youtubeUrl: "" });
    setYtResults([]);
  };

  // UPDATED: Logic to download audio via Client-Side Proxy with polling and Supabase upload
  const handleDownloadViaProxy = async (videoUrlToDownload?: string) => {
    const targetVideoUrl = cleanYoutubeUrl(videoUrlToDownload || formData.youtubeUrl || ''); // Apply sanitization here

    if (!targetVideoUrl) {
      showError("Please link a YouTube URL first.");
      console.warn("[YoutubeMediaManager] Download aborted: No YouTube URL linked.");
      return;
    }
    if (!user?.id || !song?.id) {
      showError("User or song ID missing. Cannot upload to Supabase.");
      console.error("[YoutubeMediaManager] User or song ID missing for Supabase upload.");
      return;
    }

    // NEW: Update the formData.youtubeUrl with the selected video's URL if a specific videoUrlToDownload is provided
    if (videoUrlToDownload && targetVideoUrl !== formData.youtubeUrl) {
      handleAutoSave({ youtubeUrl: targetVideoUrl });
      showSuccess("YouTube URL updated and download initiated.");
    } else if (!formData.youtubeUrl) {
      showError("Please link a YouTube URL first.");
      return;
    }

    setDownloadStatus('processing');
    setIsDownloading(true);
    setDownloadProgress(0); // Reset progress
    console.log("[YoutubeMediaManager] Initiating audio download via Render API proxy for URL:", targetVideoUrl);

    try {
      const API_BASE_URL = "https://yt-audio-api-1-wedr.onrender.com";
      const videoId = currentVideoId;
      if (!videoId) throw new Error("Invalid YouTube URL");
      console.log("[YoutubeMediaManager] Valid YouTube Video ID:", videoId);

      // Initial request to get a token
      console.log("[YoutubeMediaManager] Requesting download token from Render API...");
      const tokenResponse = await fetch(`${API_BASE_URL}/?url=${encodeURIComponent(targetVideoUrl)}`);
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Failed to get download token from Render API: ${tokenResponse.status} - ${errorText}`);
      }
      const { token } = await tokenResponse.json();
      console.log("[YoutubeMediaManager] Received download token:", token);

      let attempts = 0;
      const MAX_POLLING_ATTEMPTS = 30; // Increased max retries
      const POLLING_INTERVAL_MS = 5000; // 5 seconds

      let fileResponse: Response | undefined;
      let downloadReady = false;

      while (attempts < MAX_POLLING_ATTEMPTS && !downloadReady) {
        attempts++;
        console.log(`[YoutubeMediaManager] Polling attempt ${attempts}/${MAX_POLLING_ATTEMPTS}...`);
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS)); // Wait before polling

        fileResponse = await fetch(`${API_BASE_URL}/download?token=${token}`);
        const clonedResponse = fileResponse.clone(); // Clone the response before reading its body
        const responseData = await clonedResponse.json().catch(() => ({})); // Try to parse JSON even on error
        console.log(`[YoutubeMediaManager] Polling response status: ${fileResponse.status}, progress: ${responseData.progress_percentage || 0}%`);

        if (fileResponse.status === 200) {
          downloadReady = true;
          setDownloadStatus('downloading');
          console.log("[YoutubeMediaManager] Audio file is ready for download.");
          break;
        } else if (fileResponse.status === 202) {
          setDownloadProgress(responseData.progress_percentage || 0); // Update progress
          showSuccess(`Audio is still processing. Attempt ${attempts}/${MAX_POLLING_ATTEMPTS}. Progress: ${responseData.progress_percentage || 0}%`);
          // Continue polling
        } else if (fileResponse.status === 500) {
          if (responseData.error === "YouTube Block") {
            console.error("[YoutubeMediaManager] YouTube blocked the download during processing.");
            throw new Error("YouTube blocked the download. Try again later or use manual fallback.");
          }
          console.error("[YoutubeMediaManager] Download failed with server error:", responseData.error || fileResponse.statusText);
          throw new Error(responseData.error || "Download failed with server error.");
        } else {
          console.error(`[YoutubeMediaManager] Download failed with unexpected status: ${fileResponse.status} ${fileResponse.statusText}`);
          throw new Error(`Download failed with status: ${fileResponse.status} ${fileResponse.statusText}`);
        }
      }

      if (!downloadReady || !fileResponse) {
        console.error("[YoutubeMediaManager] Audio processing timed out or failed after multiple attempts.");
        throw new Error("Audio processing timed out or failed after multiple attempts.");
      }

      // If we reach here, the file is ready (status 200)
      console.log("[YoutubeMediaManager] Fetching final audio file as ArrayBuffer...");
      const audioArrayBuffer = await fileResponse.arrayBuffer(); // Now this should work
      console.log("[YoutubeMediaManager] Decoding audio data into AudioBuffer to get duration...");
      const audioBuffer = await Tone.getContext().decodeAudioData(audioArrayBuffer.slice(0)); // Decode a copy to get duration without consuming original

      // --- Upload to Supabase Storage ---
      console.log("[YoutubeMediaManager] Uploading audio to Supabase Storage...");
      const fileExt = 'mp3'; // Assuming mp3 from yt-dlp
      const fileName = `${user.id}/${song.id}/${Date.now()}.${fileExt}`;
      const bucket = 'public_audio'; 
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, audioArrayBuffer, {
          contentType: 'audio/mpeg', 
          upsert: true
        });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);
      console.log("[YoutubeMediaManager] Audio uploaded to Supabase. Public URL:", publicUrl);

      // Load into Tone.js from Supabase URL
      await onLoadAudioFromUrl(publicUrl, formData.pitch || 0);
      handleAutoSave({ previewUrl: publicUrl, duration_seconds: audioBuffer.duration }); // Save duration and new URL
      showSuccess("Audio loaded into playback engine from Supabase!");
      setDownloadStatus('success');
      setDownloadProgress(100);
      console.log("[YoutubeMediaManager] Audio successfully loaded into playback engine from Supabase. Duration:", audioBuffer.duration);

    } catch (err: any) {
      console.error("[YoutubeMediaManager] Critical download error:", err);
      showError(`Download failed: ${err.message}. The Render API might be down or blocked.`);
      setDownloadStatus('error');
      setDownloadProgress(0);
    } finally {
      setIsDownloading(false);
      console.log("[YoutubeMediaManager] Download process finished.");
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
            disabled={isSearchingYoutube || isDownloading}
            className="bg-red-950/30 border-red-900/50 text-red-500 h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3"
          >
            {isSearchingYoutube ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-4 h-4" />} SEARCH
          </Button>
          <Button
            onClick={() => handleDownloadViaProxy()} // Call with no argument to use formData.youtubeUrl
            disabled={isSearchingYoutube || isDownloading || !formData.youtubeUrl}
            className="bg-indigo-600 hover:bg-indigo-700 h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3"
          >
            {(isSearchingYoutube || isDownloading) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-4 h-4" />} 
            {downloadStatus === 'processing' ? `PROCESSING... ${downloadProgress}%` : 'DOWNLOAD'}
          </Button>
        </div>
      </div>
      {isDownloading && downloadStatus === 'processing' && (
        <div className="space-y-2 animate-in fade-in duration-300">
          <CustomProgress value={downloadProgress} className="h-2 bg-white/10" indicatorClassName="bg-indigo-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
            Audio conversion in progress... {downloadProgress}%
          </p>
        </div>
      )}
      {ytResults.length > 0 && (
        <YoutubeResultsShelf
          results={ytResults}
          currentVideoId={currentVideoId}
          onSelect={handleSelectYoutubeVideo}
          onDownloadAudio={handleDownloadViaProxy} // Pass the download handler
          isLoading={isSearchingYoutube}
          isDownloading={isDownloading} // Pass download state
          downloadStatus={downloadStatus} // Pass download status
        />
      )}

      {/* Selected Video & Status Section */}
      {formData.youtubeUrl && currentVideoId && (
        <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 space-y-8 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Youtube className="w-6 h-6 text-red-500" />
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Linked YouTube Media</h3>
                <p className="text-sm text-slate-400">Use the "Download" button to fetch audio via Client Proxy.</p>
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
                <h4 className="text-sm font-black uppercase tracking-tight text-white mb-2">Client Proxy Status</h4>
                <p className="text-xs text-slate-400">Using public Render API proxy. Rate limits may apply.</p>
              </div>
              <div className="flex gap-2">
                 <a href="https://yt-audio-api-1-wedr.onrender.com/" target="_blank" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                   Check API Status <ExternalLink className="w-3 h-3" />
                 </a>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 space-y-4 border border-white/5 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white mb-2">Manual Fallback</h4>
                <p className="text-xs text-slate-400">If automated download fails, use the direct Render API link.</p>
              </div>
              <Button 
                className="w-full bg-red-600 hover:bg-red-700 font-black uppercase tracking-widest text-xs h-12 rounded-xl gap-2"
                onClick={() => window.open(`https://yt-audio-api-1-wedr.onrender.com/?url=${encodeURIComponent(formData.youtubeUrl || '')}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4" /> Open Render API
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YoutubeMediaManager;
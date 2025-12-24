"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Youtube, Search, Zap, Loader2, AlertTriangle, Wrench, Check
} from 'lucide-react';
import { cn } from "@/lib/utils";
import YoutubeResultsShelf from './YoutubeResultsShelf';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { cleanYoutubeUrl } from '@/utils/youtubeUtils';
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
  const [isSyncingAudio, setIsSyncingAudio] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [engineError, setEngineError] = useState<string | null>(null);

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

  const handleSyncYoutubeAudio = async (videoUrl?: string) => {
    const targetUrl = videoUrl || formData.youtubeUrl;
    if (!targetUrl || !user || !song) {
      showError("Paste a YouTube URL first.");
      return;
    }

    const cleanedUrl = cleanYoutubeUrl(targetUrl);
    const apiBase = "https://yt-audio-api-docker.onrender.com";

    setIsSyncingAudio(true);
    setSyncStatus("Initializing Engine...");
    setEngineError(null);
    
    try {
      setSyncStatus("Waking up extraction engine...");
      // Add a small delay for Render cold-starts
      const tokenUrl = `${apiBase}/?url=${encodeURIComponent(cleanedUrl)}`;
      
      const tokenRes = await fetch(tokenUrl, {
        headers: { 'Accept': 'application/json' }
      }).catch(() => {
        throw new Error("Engine unreachable. The Render server might be rebuilding or sleeping.");
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.json().catch(() => ({}));
        const specificError = errBody.detail || errBody.error || tokenRes.statusText;
        if (specificError.includes("format is not available") || 
            specificError.includes("Signature solving failed") || 
            specificError.includes("Sign in to confirm")) {
          setEngineError(`YouTube Protection Triggered: ${specificError}. Upload fresh cookies in Admin.`);
        } else {
          setEngineError(`Engine Error: ${specificError}`);
        }
        throw new Error(specificError);
      }
      
      const { token } = await tokenRes.json();
      setSyncStatus("Extracting Audio Stream...");

      const downloadUrl = `${apiBase}/download?token=${token}`;
      const downloadRes = await fetch(downloadUrl);
      
      if (!downloadRes.ok) throw new Error("Audio extraction failed at source.");
      const blob = await downloadRes.blob();

      setSyncStatus("Syncing to Cloud Vault...");
      const fileName = `${user.id}/${song.id}/extracted-${Date.now()}.mp3`;
      const bucket = 'public_assets';
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      const updates = { previewUrl: publicUrl, youtubeUrl: cleanedUrl };
      handleAutoSave(updates);
      await onLoadAudioFromUrl(publicUrl, formData.pitch || 0);
      showSuccess("YT-Master Audio Linked");
      
    } catch (err: any) {
      console.error("YT Sync Error:", err);
      showError(err.message || "Connection refused by extraction engine.");
    } finally {
      setIsSyncingAudio(false);
      setSyncStatus("");
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
            onClick={() => handleSyncYoutubeAudio()}
            disabled={isSyncingAudio || !formData.youtubeUrl}
            className="bg-indigo-600 hover:bg-indigo-700 h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3"
          >
            {isSyncingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} EXTRACT
          </Button>
          <Button
            variant="outline"
            onClick={handleYoutubeSearch}
            disabled={isSearchingYoutube}
            className="bg-red-950/30 border-red-900/50 text-red-500 h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3"
          >
            {isSearchingYoutube ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-4 h-4" />} SEARCH
          </Button>
        </div>
      </div>
      {ytResults.length > 0 && (
        <YoutubeResultsShelf
          results={ytResults}
          currentVideoId={currentVideoId}
          onSelect={handleSelectYoutubeVideo}
          onSyncAndExtract={(url) => handleSyncYoutubeAudio(url)}
          isLoading={isSearchingYoutube}
          isExtracting={isSyncingAudio}
        />
      )}
      {(isSyncingAudio || engineError) && (
        <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4">
          {engineError ? (
            <div className="max-w-md bg-slate-900 border border-red-500/30 p-8 rounded-[2rem] shadow-2xl text-center space-y-6 animate-in zoom-in-95">
              <div className="bg-red-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-red-500">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-black uppercase tracking-tight text-white">Engine Blocked</p>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">{engineError}</p>
              </div>
              <div className="pt-2 flex flex-col gap-3">
                <Button onClick={() => setEngineError(null)} className="bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] h-11 rounded-xl">Clear</Button>
                <Button
                  onClick={() => {
                    setEngineError(null);
                    onOpenAdmin?.();
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] h-11 rounded-xl gap-2 shadow-lg shadow-red-600/20"
                >
                  <Wrench className="w-3.5 h-3.5" /> Launch Session Admin
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
              <div className="text-center space-y-2 max-w-sm px-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-white">
                  {syncStatus || 'Extracting Audio...'}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default YoutubeMediaManager;
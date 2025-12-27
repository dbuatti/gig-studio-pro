"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Youtube, Search, Loader2, X, Download, ExternalLink, PlayCircle, Terminal
} from 'lucide-react';
import { cn } from "@/lib/utils";
import YoutubeResultsShelf from './YoutubeResultsShelf';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { SetlistSong } from './SetlistManager';
import { CustomProgress } from '@/components/CustomProgress';
import * as Tone from 'tone';
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'processing' | 'downloading' | 'error' | 'success'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
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
    if (!searchTerm.trim()) return;
    
    if (searchTerm.startsWith('http')) {
      handleAutoSave({ youtubeUrl: cleanYoutubeUrl(searchTerm) });
      showSuccess("YouTube URL Linked");
      return;
    }

    setIsSearchingYoutube(true);
    setYtResults([]);
    setLastQuery(searchTerm);

    // Debug Log as per notes
    console.log(`[YoutubeDiscovery] Executing Level 1 Query: "${searchTerm}"`);

    // Strategy 1: Google YouTube API (Optimized with Developer Notes Alignment)
    if (ytApiKey) {
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
            return;
          }
        }
      } catch (e) {
        console.error("YouTube API failed, switching to proxy fallback", e);
      }
    }

    // Strategy 2: Proxy Fallback (Desktop Chrome Header Simulation)
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
            }
          } catch (err) {}
        }
      }
      
      if (!success) showError("Global discovery engine congested.");
    } catch (err) {
      showError("Search services offline.");
    } finally {
      setIsSearchingYoutube(false);
    }
  };

  const handleYoutubeSearch = () => {
    const artist = (formData.artist || "").replace(/&/g, 'and'); 
    const title = (formData.name || "").replace(/&/g, 'and');
    // Level 1 Strict Query Logic as per Developer Notes
    const query = `${artist} - ${title} (Official Audio)`;
    performYoutubeDiscovery(query);
  };

  const handleSelectYoutubeVideo = (url: string) => {
    handleAutoSave({ youtubeUrl: cleanYoutubeUrl(url) });
  };

  const handleClearYoutubeSelection = () => {
    handleAutoSave({ youtubeUrl: "" });
    setYtResults([]);
    setLastQuery("");
  };

  const handleDownloadViaProxy = async (videoUrlToDownload?: string) => {
    const targetVideoUrl = cleanYoutubeUrl(videoUrlToDownload || formData.youtubeUrl || '');

    if (!targetVideoUrl) {
      showError("Link a YouTube URL first.");
      return;
    }
    if (!user?.id || !song?.id) {
      showError("Session data missing.");
      return;
    }

    setDownloadStatus('processing');
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const API_BASE_URL = "https://yt-audio-api-1-wedr.onrender.com";
      const tokenResponse = await fetch(`${API_BASE_URL}/?url=${encodeURIComponent(targetVideoUrl)}`);
      if (!tokenResponse.ok) throw new Error("API Connection Failed");
      const { token } = await tokenResponse.json();

      let attempts = 0;
      let fileResponse: Response | undefined;
      let downloadReady = false;

      while (attempts < 30 && !downloadReady) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000));
        fileResponse = await fetch(`${API_BASE_URL}/download?token=${token}`);
        const clonedResponse = fileResponse.clone();
        const responseData = await clonedResponse.json().catch(() => ({}));

        if (fileResponse.status === 200) {
          downloadReady = true;
          setDownloadStatus('downloading');
          break;
        } else if (fileResponse.status === 202) {
          setDownloadProgress(responseData.progress_percentage || 0);
        }
      }

      if (!downloadReady || !fileResponse) throw new Error("Audio extraction timed out.");

      const audioArrayBuffer = await fileResponse.arrayBuffer();
      const audioBuffer = await Tone.getContext().decodeAudioData(audioArrayBuffer.slice(0));

      const fileName = `${user.id}/${song.id}/${Date.now()}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from('public_audio')
        .upload(fileName, audioArrayBuffer, { contentType: 'audio/mpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('public_audio').getPublicUrl(fileName);

      await onLoadAudioFromUrl(publicUrl, formData.pitch || 0);
      handleAutoSave({ previewUrl: publicUrl, duration_seconds: audioBuffer.duration });
      showSuccess("Master Audio Bound");
      setDownloadStatus('success');

    } catch (err: any) {
      showError(`Extraction failed: ${err.message}`);
      setDownloadStatus('error');
    } finally {
      setIsDownloading(false);
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
            onClick={() => handleDownloadViaProxy()}
            disabled={isSearchingYoutube || isDownloading || !formData.youtubeUrl}
            className="bg-indigo-600 hover:bg-indigo-700 h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] gap-3"
          >
            {(isSearchingYoutube || isDownloading) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-4 h-4" />} 
            {downloadStatus === 'processing' ? `SYNCING... ${downloadProgress}%` : 'EXTRACT'}
          </Button>
        </div>
      </div>

      {isDownloading && downloadStatus === 'processing' && (
        <div className="space-y-2 animate-in fade-in duration-300">
          <CustomProgress value={downloadProgress} className="h-2 bg-white/10" indicatorClassName="bg-indigo-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">
            Cloud Conversion in progress... {downloadProgress}%
          </p>
        </div>
      )}

      {ytResults.length > 0 && (
        <YoutubeResultsShelf
          results={ytResults}
          currentVideoId={currentVideoId}
          onSelect={handleSelectYoutubeVideo}
          onDownloadAudio={handleDownloadViaProxy}
          onPreviewVideo={(url) => {
            handleAutoSave({ youtubeUrl: cleanYoutubeUrl(url) });
            onSwitchTab('visual');
          }}
          isLoading={isSearchingYoutube}
          isDownloading={isDownloading}
          downloadStatus={downloadStatus}
        />
      )}

      {formData.youtubeUrl && currentVideoId && (
        <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 space-y-8 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Youtube className="w-6 h-6 text-red-500" />
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Linked Reference Media</h3>
                <p className="text-sm text-slate-400">Audio ready for extraction via Cloud Proxy.</p>
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
                <h4 className="text-sm font-black uppercase tracking-tight text-white mb-2">Extraction Source</h4>
                <p className="text-xs text-slate-400 font-mono">{formData.youtubeUrl}</p>
              </div>
              <div className="flex gap-2">
                 <a href={formData.youtubeUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                   Open Native <ExternalLink className="w-3 h-3" />
                 </a>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 space-y-4 border border-white/5 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight text-white mb-2">Direct Portal</h4>
                <p className="text-xs text-slate-400">Launch manual processing via external service.</p>
              </div>
              <Button 
                className="w-full bg-red-600 hover:bg-red-700 font-black uppercase tracking-widest text-xs h-12 rounded-xl gap-2"
                onClick={() => window.open(`https://yt-audio-api-1-wedr.onrender.com/?url=${encodeURIComponent(formData.youtubeUrl || '')}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4" /> Service Portal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YoutubeMediaManager;
"use client";

import { supabase } from '@/integrations/supabase/client';

export interface YoutubeVideo {
  videoId: string;
  title: string;
  author: string;
  videoThumbnails?: { url: string }[];
  duration?: string;
  viewCountText?: string;
}

interface YoutubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails?: { medium?: { url: string } };
  };
}

interface InvidiousVideo {
  type: string;
  videoId: string;
  title: string;
  author: string;
  videoThumbnails?: { url: string }[];
  durationSeconds?: number;
  viewCountText?: string;
}

const INVIDIOUS_INSTANCES = ['https://iv.ggtyler.dev', 'https://yewtu.be', 'https://invidious.flokinet.to'];

const formatDuration = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

/**
 * Searches YouTube through the `youtube-search` edge function, falling back to public
 * Invidious instances. Resolves to an empty array when no source returns results.
 */
export const searchYoutubeVideos = async (query: string): Promise<YoutubeVideo[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('youtube-search', {
      body: { query },
    });
    if (!error && data?.items?.length > 0) {
      return (data.items as YoutubeSearchItem[]).map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        author: item.snippet.channelTitle,
        videoThumbnails: item.snippet.thumbnails?.medium?.url
          ? [{ url: item.snippet.thumbnails.medium.url }]
          : undefined,
      }));
    }
  } catch {
    // Primary search unavailable; try Invidious below.
  }

  const encodedQuery = encodeURIComponent(query.replace(/&/g, 'and'));
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/search?q=${encodedQuery}`);
      if (!res.ok) continue;
      const data: InvidiousVideo[] = await res.json();
      const videos = (Array.isArray(data) ? data : [])
        .filter((item) => item.type === 'video')
        .slice(0, 10);
      if (videos.length > 0) {
        return videos.map((v) => ({
          videoId: v.videoId,
          title: v.title,
          author: v.author,
          videoThumbnails: v.videoThumbnails,
          duration: v.durationSeconds ? formatDuration(v.durationSeconds) : undefined,
          viewCountText: v.viewCountText,
        }));
      }
    } catch {
      // Instance unreachable; try the next one.
    }
  }

  return [];
};

/**
 * Cleans a YouTube URL by removing playlist-related parameters
 * and normalizing short links (youtu.be) to full watch links.
 */
export const cleanYoutubeUrl = (url: string): string => {
  if (!url) return "";
  
  try {
    const parsed = new URL(url);
    
    // Check if it's actually a YouTube domain
    const isYouTube = parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be');
    if (!isYouTube) {
      return url;
    }

    // Convert short links (youtu.be/ID) to full watch links
    if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.slice(1);
      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // For youtube.com/watch?v=ID... links, strip playlist junk
    // Common playlist parameters: list, index, start_radio, feature
    const paramsToStrip = ['list', 'index', 'start_radio', 'feature'];
    
    paramsToStrip.forEach(param => {
      parsed.searchParams.delete(param);
    });

    // Return the cleaned URL
    return parsed.toString();
  } catch (error) {
    // If URL parsing fails, return the original string
    return url;
  }
};
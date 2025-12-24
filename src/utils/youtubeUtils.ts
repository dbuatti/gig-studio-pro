"use client";

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
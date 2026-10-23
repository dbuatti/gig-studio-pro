"use client";

/** The fields we use from an iTunes Search API song result. */
export interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  primaryGenreName?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  trackExplicitness?: string;
  artworkUrl60?: string;
  artworkUrl100?: string;
}

/**
 * Searches iTunes for songs. Tries the API directly first and only falls back
 * to the public CORS proxy if the direct request is blocked.
 */
export const searchItunes = async (term: string, limit = 15): Promise<ItunesTrack[]> => {
  const targetUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}`;
  try {
    const response = await fetch(targetUrl);
    if (response.ok) {
      const data = await response.json();
      return (data.results || []) as ItunesTrack[];
    }
  } catch {
    // Fall through to the proxy
  }
  const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
  if (!response.ok) return [];
  const proxyData = await response.json();
  return (JSON.parse(proxyData.contents).results || []) as ItunesTrack[];
};

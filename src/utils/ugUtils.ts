"use client";

/**
 * Sanitizes an Ultimate Guitar URL by removing tracking parameters.
 */
export const sanitizeUGUrl = (rawUrl: string): string => {
  if (!rawUrl || !rawUrl.includes('ultimate-guitar.com')) return rawUrl;
  
  try {
    const url = new URL(rawUrl);
    // Keep only the origin and pathname to strip ?utm_source, ?ref, etc.
    return `${url.origin}${url.pathname}`;
  } catch (error) {
    return rawUrl;
  }
};

/**
 * Heuristic validation to check if a UG page title likely matches the song record.
 * This is used for the warning flag ⚠️.
 */
export const validateUGMatch = (pageTitle: string, songName: string, artistName: string): boolean => {
  if (!pageTitle) return true; // Can't validate without title
  
  const title = pageTitle.toLowerCase();
  const sName = songName.toLowerCase();
  const aName = artistName.toLowerCase();
  
  // Check if both artist and song name (or parts of them) exist in the page title
  const hasArtist = title.includes(aName);
  const hasSong = title.includes(sName);
  
  return hasArtist && hasSong;
};
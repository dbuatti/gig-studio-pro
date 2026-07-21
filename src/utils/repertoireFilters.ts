"use client";

import { SetlistSong } from "@/components/SetlistManager";
import { FilterState } from "@/components/SetlistFilters";
import { calculateReadiness } from "./repertoireSync";

/**
 * Applies filters and sorting to a list of songs.
 */
export const filterAndSortRepertoire = (
  songs: SetlistSong[],
  searchTerm: string,
  activeFilters: FilterState,
  sortMode: string,
  activeSetlistSongs?: SetlistSong[]
): SetlistSong[] => {
  let filtered = [...songs];
  const q = searchTerm.toLowerCase();

  filtered = filtered.filter(s => {
    // Search match
    const matchesSearch = s.name.toLowerCase().includes(q) ||
                          s.artist?.toLowerCase().includes(q) ||
                          s.user_tags?.some(tag => tag.toLowerCase().includes(q));
    if (!matchesSearch) return false;
    
    // Filter criteria
    const readiness = calculateReadiness(s);
    const hasAudio = !!s.audio_url;
    const hasItunesPreview = !!s.previewUrl && (s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'));
    const hasVideo = !!s.youtubeUrl;
    const hasPdf = !!s.pdfUrl || !!s.leadsheetUrl || !!s.sheet_music_url;
    const hasUg = !!s.ugUrl;
    const hasUgChords = !!s.ug_chords_text && s.ug_chords_text.trim().length > 0;
    const hasLyrics = !!s.lyrics && s.lyrics.length > 20;

    if (activeFilters.readiness > 0 && readiness < activeFilters.readiness) return false;
    if (activeFilters.isConfirmed === 'yes' && !s.isKeyConfirmed) return false;
    if (activeFilters.isConfirmed === 'no' && s.isKeyConfirmed) return false;
    if (activeFilters.isApproved === 'yes' && !s.isApproved) return false;
    if (activeFilters.isApproved === 'no' && s.isApproved) return false;
    
    if (activeFilters.hasAudio === 'full' && !hasAudio) return false;
    if (activeFilters.hasAudio === 'itunes' && !hasItunesPreview) return false;
    if (activeFilters.hasAudio === 'none' && (hasAudio || hasItunesPreview)) return false;
    
    if (activeFilters.hasVideo === 'yes' && !hasVideo) return false;
    if (activeFilters.hasVideo === 'no' && hasVideo) return false;
    
    if (activeFilters.hasChart === 'yes' && !(hasPdf || hasUg || hasUgChords)) return false;
    if (activeFilters.hasChart === 'no' && (hasPdf || hasUg || hasUgChords)) return false;
    
    if (activeFilters.hasPdf === 'yes' && !hasPdf) return false;
    if (activeFilters.hasPdf === 'no' && hasPdf) return false;
    
    if (activeFilters.hasUg === 'yes' && !hasUg) return false;
    if (activeFilters.hasUg === 'no' && hasUg) return false;
    
    if (activeFilters.hasUgChords === 'yes' && !hasUgChords) return false;
    if (activeFilters.hasUgChords === 'no' && hasUgChords) return false;
    
    if (activeFilters.hasLyrics === 'yes' && !hasLyrics) return false;
    if (activeFilters.hasLyrics === 'no' && hasLyrics) return false;
    
    if (activeFilters.hasHighestNote === 'yes' && !s.highest_note_original) return false; 
    if (activeFilters.hasHighestNote === 'no' && s.highest_note_original) return false;
    
    if (activeFilters.hasOriginalKey === 'yes' && (!s.originalKey || s.originalKey === 'TBC')) return false;
    if (activeFilters.hasOriginalKey === 'no' && (s.originalKey && s.originalKey !== 'TBC')) return false;
    
    if (activeFilters.inSetlist !== 'all' && activeSetlistSongs) {
      const isInSetlist = activeSetlistSongs.some(ss => ss.master_id === s.id);
      if (activeFilters.inSetlist === 'yes' && !isInSetlist) return false;
      if (activeFilters.inSetlist === 'no' && isInSetlist) return false;
    }

    return true;
  });

  // Sorting
  if (sortMode === 'ready') {
    filtered.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
  } else if (sortMode === 'work') {
    filtered.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
  } else if (sortMode === 'none') {
    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortMode === 'artist') {
    filtered.sort((a, b) => (a.artist || '').localeCompare(b.artist || '') || (a.name || '').localeCompare(b.name || ''));
  }

  return filtered;
};
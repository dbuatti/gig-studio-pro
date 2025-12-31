export const isItunesPreview = (url: string | undefined | null): boolean => {
  if (!url) return false;
  const itunesKeywords = ['apple.com', 'itunes-assets', 'mzstatic.com'];
  return itunesKeywords.some(kw => url.includes(kw));
};

export const hasFullAudio = (song: { previewUrl?: string | null; extraction_status?: string | null }): boolean => {
  return !!song.previewUrl && !isItunesPreview(song.previewUrl) && song.extraction_status === 'completed';
};
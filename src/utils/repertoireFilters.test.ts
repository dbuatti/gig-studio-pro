import { describe, expect, it } from 'vitest';
import type { SetlistSong } from '@/components/SetlistManager';
import type { FilterState } from '@/components/SetlistFilters';
import { filterSongs } from './repertoireFilters';

const filters: FilterState = {
  hasAudio: 'all',
  hasVideo: 'all',
  hasChart: 'all',
  hasPdf: 'all',
  hasUg: 'all',
  isConfirmed: 'all',
  isApproved: 'all',
  readiness: 0,
  hasUgChords: 'all',
  hasLyrics: 'all',
  hasHighestNote: 'all',
  hasOriginalKey: 'all',
  inSetlist: 'all',
};

const song = (id: string, name: string, overrides: Partial<SetlistSong> = {}): SetlistSong => ({
  id,
  name,
  artist: 'Artist',
  previewUrl: '',
  pitch: 0,
  ...overrides,
});

describe('filterSongs', () => {
  it('keeps source order while applying search and matrix filters', () => {
    const songs = [
      song('1', 'First', { audio_url: 'first.mp3', isKeyConfirmed: true }),
      song('2', 'Second', { audio_url: 'second.mp3', isKeyConfirmed: false }),
      song('3', 'Third', { audio_url: '', isKeyConfirmed: true }),
    ];

    const result = filterSongs(songs, '', { ...filters, hasAudio: 'full', isConfirmed: 'yes' });

    expect(result.map((item) => item.id)).toEqual(['1']);
  });

  it('matches normalized title, artist, and tag search', () => {
    const songs = [
      song('1', 'A Thousand Years', { artist: 'Christina Perri' }),
      song('2', 'Blue Bossa', { user_tags: ['Jazz Standard'] }),
    ];

    expect(filterSongs(songs, 'christina', filters).map((item) => item.id)).toEqual(['1']);
    expect(filterSongs(songs, 'jazz standard', filters).map((item) => item.id)).toEqual(['2']);
  });

  it('does not mutate the supplied songs array', () => {
    const songs = [song('2', 'Second'), song('1', 'First')];
    const original = [...songs];

    filterSongs(songs, '', { ...filters, hasAudio: 'none' });

    expect(songs).toEqual(original);
  });
});

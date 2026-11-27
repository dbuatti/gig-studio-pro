export interface SongWithAudio {
  audio_url?: string | null;
  previewUrl?: string | null;
}

function usableAudioUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  return trimmed ? trimmed : null;
}

/** Prefer the full audio source, falling back to a usable preview URL. */
export function songAudioUrl(song: SongWithAudio | null | undefined): string | null {
  return usableAudioUrl(song?.audio_url) ?? usableAudioUrl(song?.previewUrl);
}

/** Filter songs with audio while preserving the supplied order. */
export function getPlayableSongs<T extends SongWithAudio>(songs: readonly T[]): T[] {
  return songs.filter((song) => songAudioUrl(song) !== null);
}

/** Split songs into playable and skipped groups without changing their order. */
export function partitionSongsByAudio<T extends SongWithAudio>(songs: readonly T[]): {
  playable: T[];
  skipped: T[];
} {
  const playable: T[] = [];
  const skipped: T[] = [];

  for (const song of songs) {
    if (songAudioUrl(song) !== null) {
      playable.push(song);
    } else {
      skipped.push(song);
    }
  }

  return { playable, skipped };
}

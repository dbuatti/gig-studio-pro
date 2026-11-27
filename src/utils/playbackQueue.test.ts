import { describe, expect, it } from "vitest";

import {
  getPlayableSongs,
  partitionSongsByAudio,
  songAudioUrl,
  type SongWithAudio,
} from "./playbackQueue";

interface TestSong extends SongWithAudio {
  id: string;
}

describe("songAudioUrl", () => {
  it("prefers audio_url when both sources are available", () => {
    expect(
      songAudioUrl({ audio_url: "https://example.com/full.mp3", previewUrl: "https://example.com/preview.m4a" }),
    ).toBe("https://example.com/full.mp3");
  });

  it("falls back to previewUrl when audio_url is missing", () => {
    expect(songAudioUrl({ previewUrl: "https://example.com/preview.m4a" })).toBe(
      "https://example.com/preview.m4a",
    );
  });

  it("falls back to previewUrl when audio_url is blank", () => {
    expect(
      songAudioUrl({ audio_url: "   ", previewUrl: " https://example.com/preview.m4a " }),
    ).toBe("https://example.com/preview.m4a");
  });

  it("returns null for missing or blank audio sources", () => {
    expect(songAudioUrl({})).toBeNull();
    expect(songAudioUrl({ audio_url: "", previewUrl: "  " })).toBeNull();
    expect(songAudioUrl(null)).toBeNull();
  });
});

describe("playback queue selection", () => {
  const songs: TestSong[] = [
    { id: "full", audio_url: "https://example.com/full.mp3" },
    { id: "missing" },
    { id: "preview", previewUrl: "https://example.com/preview.m4a" },
    { id: "blank", audio_url: " ", previewUrl: "" },
    { id: "full-with-preview", audio_url: "https://example.com/full.mp3", previewUrl: "https://example.com/other.m4a" },
  ];

  it("gets playable songs in their original order", () => {
    expect(getPlayableSongs(songs)).toEqual([songs[0], songs[2], songs[4]]);
  });

  it("partitions songs while preserving order within each group", () => {
    const result = partitionSongsByAudio(songs);

    expect(result.playable).toEqual([songs[0], songs[2], songs[4]]);
    expect(result.skipped).toEqual([songs[1], songs[3]]);
    expect([...result.playable, ...result.skipped]).toHaveLength(songs.length);
  });

  it("accepts readonly input without mutating it", () => {
    const readonlySongs: readonly TestSong[] = songs;

    expect(partitionSongsByAudio(readonlySongs).playable).toEqual([
      songs[0],
      songs[2],
      songs[4],
    ]);
    expect(readonlySongs).toEqual(songs);
  });

  it("handles an empty queue", () => {
    expect(getPlayableSongs([])).toEqual([]);
    expect(partitionSongsByAudio([])).toEqual({ playable: [], skipped: [] });
  });
});

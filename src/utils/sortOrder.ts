"use client";

/**
 * The sort_order that places a new setlist row after every existing one.
 * Uses the highest existing value rather than a count, because removals and
 * per-set additions leave gaps that would otherwise drop the song mid-list.
 */
export const nextSortOrder = (songs: { sort_order?: number | null }[] = []): number =>
  songs.reduce((max, s) => Math.max(max, s.sort_order ?? -1), -1) + 1;

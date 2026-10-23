"use client";

/**
 * Reads a JSON value from localStorage, returning `fallback` when the key is
 * missing, the stored text is corrupt, or storage is unavailable (private mode).
 */
export const readStoredJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ((JSON.parse(raw) as T) ?? fallback) : fallback;
  } catch {
    return fallback;
  }
};

"use client";

import { v4 as uuidv4 } from 'uuid';

interface NewSong {
  id: string;
  name: string;
  artist: string;
  previewUrl: string;
  youtubeUrl: string;
  originalKey: string;
  targetKey: string;
  pitch: number;
  isPlayed: boolean;
  isMetadataConfirmed: boolean;
}

export const useImportSetlist = () => {
  const handleImport = (title: string, artist: string, originalKey: string, youtubeUrl: string) => {
    const newSong: NewSong = {
      id: uuidv4(),
      name: title,
      artist: artist,
      previewUrl: "",
      youtubeUrl: youtubeUrl,
      originalKey: originalKey,
      targetKey: originalKey,
      pitch: 0,
      isPlayed: false,
      isMetadataConfirmed: false,
    };
    return newSong;
  };

  return { handleImport };
};
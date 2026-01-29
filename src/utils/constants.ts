// src/utils/constants.ts

export const RESOURCE_TYPES = [
  { value: 'youtube', label: 'YouTube Video' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'spotify', label: 'Spotify' },
  { value: 'ug_link', label: 'Ultimate Guitar Link' },
  { value: 'pdf', label: 'PDF Chart' },
  { value: 'leadsheet', label: 'Leadsheet' },
  { value: 'lyrics', label: 'Lyrics' },
  { value: 'audio', label: 'Audio File' },
  { value: 'other', label: 'Other Link' },
];

export const DEFAULT_UG_CHORDS_CONFIG = {
  fontSize: 16,
  chordBold: true,
  textAlign: 'left',
  chordColor: '#ffffff',
  fontFamily: 'monospace',
  lineSpacing: 1.5,
};
"use client";

export const READINESS_CHECKLIST = [
  { 
    id: 'performance_confidence', 
    label: 'Performance Confidence', 
    description: 'Rated your confidence and readiness to perform this song live.' 
  },
  { 
    id: 'every_section_checked', 
    label: 'Every Section Checked', 
    description: 'Can play verse 3/4, bridge, and outro cold without getting lost.' 
  },
  { 
    id: 'key_and_range_confirmed', 
    label: 'Key & Range Confirmed', 
    description: 'Stage key locked, highest note known and comfortable to sing.' 
  },
  { 
    id: 'structure_marked', 
    label: 'Structure Marked', 
    description: 'Section labels (V1, C, Br, etc.) visible in chart for quick navigation.' 
  },
  { 
    id: 'reader_ready', 
    label: 'Reader Is Ready', 
    description: 'Chart opened on device, readable, and you know which format you\'re using.' 
  },
  { 
    id: 'tricky_bit_noted', 
    label: 'Tricky Bit Noted', 
    description: 'One specific gotcha written down: wordy bridge, key change, held note, etc.' 
  },
];

export const RESOURCE_TYPES = [
  { id: 'UG', label: 'Ultimate Guitar', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  { id: 'LYRICS', label: 'Has Lyrics', color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
  { id: 'LEAD', label: 'Lead Sheet', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  { id: 'UGP', label: 'UG Playlist', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  { id: 'FS', label: 'ForScore', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  { id: 'PDF', label: 'Stage PDF', color: 'bg-red-500/10 text-red-700 border-red-200' },
];

export const DEFAULT_UG_CHORDS_CONFIG = {
  fontFamily: "monospace",
  fontSize: 16,
  chordBold: true,
  lineSpacing: 1.5,
  chordColor: "#ffffff",
  textAlign: "left" as "left" | "center" | "right"
};
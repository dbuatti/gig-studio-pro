-- Add "Somewhere Over the Rainbow" (Harold Arlen) to the user's repertoire.
-- Run this in the Supabase SQL editor if the in-app "add" flow is not persisting it.
INSERT INTO public.repertoire (
  id, user_id, title, artist,
  original_key, target_key, pitch, bpm, genre, duration_seconds,
  preview_url, youtube_url, ug_url, apple_music_url, pdf_url, leadsheet_url, audio_url, sheet_music_url,
  is_metadata_confirmed, is_key_confirmed, is_pitch_linked, is_approved, is_ready_to_sing,
  is_active, is_ug_chords_present, is_sheet_verified, auto_synced,
  comfort_level, needs_improvement, energy_level,
  lyrics, notes, resources, user_tags, ug_chords_text, ug_chords_config, readiness_checklist,
  preferred_reader, extraction_status, sync_status,
  original_key_updated_at, target_key_updated_at, pdf_updated_at, updated_at
)
VALUES (
  '99999999-8888-7777-6666-555544443333',
  '6f9fd115-fae0-4d91-8840-471220c1b774',
  'Somewhere Over the Rainbow',
  'Harold Arlen',
  'TBC', 'TBC', 0, NULL, NULL, 0,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  false, false, true, false, false,
  true, false, false, false,
  0, false, NULL,
  NULL, NULL, '[]'::jsonb, '[]'::jsonb, NULL, '{"fontFamily":"monospace","fontSize":16,"chordBold":true,"lineSpacing":1.5,"chordColor":"#ffffff","textAlign":"left"}'::jsonb, '[]'::jsonb,
  NULL, 'idle', 'IDLE',
  now(), now(), now(), now()
)
ON CONFLICT (id) DO NOTHING;
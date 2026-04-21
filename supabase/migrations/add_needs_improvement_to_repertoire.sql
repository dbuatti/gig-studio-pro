-- Add needs_improvement column to repertoire table
ALTER TABLE repertoire ADD COLUMN IF NOT EXISTS needs_improvement BOOLEAN DEFAULT FALSE;

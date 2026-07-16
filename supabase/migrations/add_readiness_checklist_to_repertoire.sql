-- Add readiness_checklist column to repertoire table
ALTER TABLE public.repertoire ADD COLUMN IF NOT EXISTS readiness_checklist JSONB DEFAULT '[]'::jsonb;

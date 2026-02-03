-- Add the new column to repertoire table
ALTER TABLE public.repertoire
ADD COLUMN energy_level TEXT DEFAULT 'Pulse';

-- Update the readiness score calculation to include the energy level
-- Note: This is a conceptual update. The actual readiness score logic is handled client-side in repertoireSync.ts, 
-- but we ensure the column exists for the AI worker.
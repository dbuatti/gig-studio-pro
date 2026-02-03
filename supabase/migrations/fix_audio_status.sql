-- 1. FIX DATA INCONSISTENCY: Set extraction_status to 'completed' for songs that already have an audio URL but are stuck on an incorrect status.
UPDATE public.repertoire
SET 
  extraction_status = 'completed',
  last_sync_log = 'Data inconsistency fixed by migration',
  updated_at = NOW()
WHERE 
  audio_url IS NOT NULL 
  AND extraction_status != 'completed';
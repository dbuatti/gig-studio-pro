CREATE OR REPLACE FUNCTION public.admin_force_purge_storage(target_bucket TEXT, days_old INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage, public
AS $$
DECLARE
    row_count INTEGER;
BEGIN
    -- We delete directly from the objects table. 
    -- In a SECURITY DEFINER function, we have the permissions to bypass standard user restrictions.
    DELETE FROM storage.objects 
    WHERE bucket_id = target_bucket 
    AND created_at < NOW() - (days_old || ' days')::INTERVAL;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    
    RETURN 'SUCCESS: Purged ' || row_count || ' file records from ' || target_bucket || '. Supabase will now reclaim this space.';
EXCEPTION WHEN OTHERS THEN
    RETURN 'CRITICAL ERROR: ' || SQLERRM;
END;
$$;
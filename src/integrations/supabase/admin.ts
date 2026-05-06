import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://rqesjpnhrjdjnrzdhzgw.supabase.co";
// WARNING: This key has bypass-RLS privileges. 
// Rotate this key in Supabase Dashboard after the emergency cleanup is complete.
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZXNqcG5ocmpkam5yemRoemd3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAzODA3OCwiZXhwIjoyMDc3NjE0MDc4fQ.biqoJfL_9mo9oMNY1KdAJ9sELl68HIgnFpnqzTpLoNk";

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
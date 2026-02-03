-- 2. CRITICAL SECURITY FIX: Enable Row Level Security (RLS) on the repertoire table.
-- NOTE: Policies already exist to manage user access and public viewing, but RLS must be enabled for them to take effect.
ALTER TABLE public.repertoire ENABLE ROW LEVEL SECURITY;
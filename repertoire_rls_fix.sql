-- Enable Row Level Security on the repertoire table
ALTER TABLE public.repertoire ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own repertoire
-- This allows you to Insert, Update, and Delete your own songs
DROP POLICY IF EXISTS "repertoire_manage_own" ON public.repertoire;
CREATE POLICY "repertoire_manage_own" ON public.repertoire
FOR ALL TO authenticated
USING (auth.uid() = user_id);

-- Policy: Public can view repertoire if the profile is set to public
-- This allows the 'Public Repertoire' feature to work securely
DROP POLICY IF EXISTS "repertoire_public_view" ON public.repertoire;
CREATE POLICY "repertoire_public_view" ON public.repertoire
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = repertoire.user_id
    AND profiles.is_repertoire_public = true
  )
);
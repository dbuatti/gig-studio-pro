-- 1. Gig Sessions (Public Portals)
CREATE TABLE IF NOT EXISTS public.gig_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    setlist_id UUID REFERENCES public.setlists(id) ON DELETE CASCADE,
    access_code TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Sheet Links (Interactive PDF Navigation)
CREATE TABLE IF NOT EXISTS public.sheet_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    song_id UUID REFERENCES public.repertoire(id) ON DELETE CASCADE,
    source_page INTEGER NOT NULL,
    source_x FLOAT NOT NULL,
    source_y FLOAT NOT NULL,
    target_page INTEGER NOT NULL,
    target_x FLOAT NOT NULL,
    target_y FLOAT NOT NULL,
    link_size TEXT DEFAULT 'medium',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Follows (Community Features)
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    followed_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(follower_id, followed_id)
);

-- 4. Ensure Repertoire has all necessary columns
ALTER TABLE public.repertoire 
ADD COLUMN IF NOT EXISTS comfort_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS needs_improvement BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS energy_level TEXT,
ADD COLUMN IF NOT EXISTS lyrics_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS chords_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ug_link_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS highest_note_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS original_key_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS target_key_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pdf_updated_at TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE public.gig_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheet_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Policies for Gig Sessions
CREATE POLICY "Users can manage their own gig sessions" ON public.gig_sessions
    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public can view active gig sessions by code" ON public.gig_sessions
    FOR SELECT USING (is_active = true);

-- Policies for Sheet Links
CREATE POLICY "Users can manage their own sheet links" ON public.sheet_links
    FOR ALL USING (auth.uid() = user_id);

-- Policies for Follows
CREATE POLICY "Users can manage their own follows" ON public.follows
    FOR ALL USING (auth.uid() = follower_id);
CREATE POLICY "Anyone can see follow counts" ON public.follows
    FOR SELECT USING (true);
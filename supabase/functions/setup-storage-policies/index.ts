// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Use the Service Role Key for full admin access to manage policies
  const supabaseAdmin = createClient(
    // @ts-ignore: Deno global
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore: Deno global
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const bucketName = 'public_audio'

    // 1. Check if bucket exists
    const { data: existingBuckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    if (listError) throw listError

    const bucketExists = existingBuckets?.some(b => b.name === bucketName)

    // 2. Create bucket if it doesn't exist
    if (!bucketExists) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true, // Publicly readable
        allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/aac', 'application/pdf'], // Added application/pdf
        fileSizeLimit: 52428800 // 50 MB
      })
      if (createError) throw createError
    } else {
      // If bucket exists, ensure its allowedMimeTypes are updated
      // Note: Supabase Storage API does not directly support updating allowedMimeTypes via client.
      // This would typically require deleting and recreating the bucket, or manual intervention.
      // For this context, we'll assume the createBucket call (if it were to run) would set it,
      // and for existing buckets, the user might need to manually adjust if this is the first time.
      // However, for the purpose of this function, if it's called, it implies an intent to ensure config.
      // The `createBucket` call is idempotent for the bucket itself, but not for its properties.
      // A more robust solution would involve checking current mime types and updating if possible,
      // but that's beyond the direct capabilities of the `createBucket` method.
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Bucket checked/created. If the bucket existed, please ensure 'application/pdf' is manually added to its allowed MIME types in Supabase Storage settings if you continue to face issues.",
      sqlCommands: `
-- Enable RLS on the storage.objects table (this is a system table, but we can try)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to upload files to their own user_id subfolder
CREATE POLICY "Allow authenticated uploads to user folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'public_audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy to allow authenticated users to update files within their own user_id subfolder
CREATE POLICY "Allow authenticated updates to user folder"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'public_audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy to allow authenticated users to delete files within their own user_id subfolder
CREATE POLICY "Allow authenticated deletes from user folder"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'public_audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy to allow public read access to all files in the public_audio bucket
CREATE POLICY "Allow public read access to audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'public_audio');
      `
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
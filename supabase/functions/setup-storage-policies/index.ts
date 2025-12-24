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
  // @ts-ignore: Deno global
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
        allowedMimeTypes: ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/aac'],
        fileSizeLimit: 52428800 // 50 MB
      })
      if (createError) throw createError
      console.log(`Bucket '${bucketName}' created successfully.`)
    } else {
      console.log(`Bucket '${bucketName}' already exists.`)
    }

    // 3. Set up RLS policies using the Storage API
    // Note: The Storage API for policies is not directly exposed in the JS client.
    // We will use SQL commands via the admin client for this part, as it's the only way to manage storage policies programmatically.
    // The previous SQL error was due to missing permissions, but using the Service Role Key via `supabaseAdmin.rpc` or direct SQL execution should work.
    // However, the `supabaseAdmin` client doesn't have a direct method for storage policies.
    // The most reliable way is to execute SQL commands using the Service Role Key.
    
    // Let's try a different approach: Use `supabaseAdmin.rpc` to execute SQL commands that manage storage policies.
    // This requires the `pg_crypto` extension to be enabled, which is usually default.
    
    // We will execute the SQL commands directly using the admin client's `rpc` capability if available, or fall back to a message.
    // Since `supabase-js` doesn't have a direct method for storage RLS, we'll provide the SQL commands for the user to run manually in the Supabase SQL Editor.
    // This is a limitation of the current Supabase JS client for storage policies.

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Bucket checked/created. To complete setup, please run the provided SQL commands in your Supabase SQL Editor.",
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

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
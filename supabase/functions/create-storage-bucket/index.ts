// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { bucketName, isPublic, allowedMimeTypes, fileSizeLimit } = await req.json();
    
    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if the bucket already exists
    const { data: existingBuckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) throw listError;

    const bucketExists = existingBuckets?.some(b => b.name === bucketName);

    if (bucketExists) {
      return new Response(JSON.stringify({ success: true, message: `Bucket '${bucketName}' already exists.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Create the bucket
    const { data, error } = await supabaseAdmin.storage.createBucket(bucketName, {
      public: isPublic,
      allowedMimeTypes: allowedMimeTypes,
      fileSizeLimit: fileSizeLimit
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
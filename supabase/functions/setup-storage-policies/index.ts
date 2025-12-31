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

  const supabaseAdmin = createClient(
    // @ts-ignore: Deno global
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore: Deno global
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const bucketName = 'public_audio'
    
    // @ts-ignore: Deno console log
    console.log(`[Setup] Checking bucket: ${bucketName}`);

    const { data: existingBuckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    if (listError) throw listError

    const bucketExists = existingBuckets?.some(b => b.name === bucketName)

    if (!bucketExists) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: [
          'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/aac', 
          'application/pdf', 'application/x-pdf', 'application/octet-stream'
        ],
        fileSizeLimit: 52428800 // 50 MB
      })
      if (createError) throw createError
    } else {
      // Update bucket to allow PDFs if it was missing them
      const { error: updateError } = await supabaseAdmin.storage.updateBucket(bucketName, {
        public: true,
        allowedMimeTypes: [
          'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/aac', 
          'application/pdf', 'application/x-pdf', 'application/octet-stream'
        ],
        fileSizeLimit: 52428800 
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Infrastructure updated. application/pdf now whitelisted."
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
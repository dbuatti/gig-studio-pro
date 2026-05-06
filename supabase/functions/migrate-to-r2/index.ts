// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.450.0"
// @ts-ignore: Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const s3Client = new S3Client({
      region: "auto",
      // @ts-ignore: Deno global
      endpoint: Deno.env.get('S3_ENDPOINT') ?? '',
      credentials: {
        // @ts-ignore: Deno global
        accessKeyId: Deno.env.get('S3_ACCESS_KEY_ID') ?? '',
        // @ts-ignore: Deno global
        secretAccessKey: Deno.env.get('S3_SECRET_ACCESS_KEY') ?? '',
      },
    })

    // @ts-ignore: Deno global
    const bucketName = Deno.env.get('S3_BUCKET_NAME')
    // @ts-ignore: Deno global
    const publicBaseUrl = Deno.env.get('R2_PUBLIC_URL')?.replace(/\/$/, '')

    // 1. Fetch all songs that have Supabase URLs
    const { data: songs, error: fetchError } = await supabaseAdmin
      .from('repertoire')
      .select('*')
      .or('audio_url.ilike.%supabase.co%,pdf_url.ilike.%supabase.co%,leadsheet_url.ilike.%supabase.co%');

    if (fetchError) throw fetchError;

    let migratedCount = 0;
    let skippedCount = 0;

    for (const song of (songs || [])) {
      const updates: any = {};
      const fields = ['audio_url', 'pdf_url', 'leadsheet_url'];

      for (const field of fields) {
        const oldUrl = song[field];
        if (oldUrl && oldUrl.includes('supabase.co/storage/v1/object/public/public_audio/')) {
          try {
            const path = oldUrl.split('/public_audio/')[1];
            
            const { data: fileData, error: downloadError } = await supabaseAdmin
              .storage
              .from('public_audio')
              .download(path);

            if (downloadError) {
              if (downloadError.message.includes('Object not found')) {
                console.warn(`[migrate-to-r2] Skipping ${field} for song ${song.id}: File missing in Supabase storage.`);
                skippedCount++;
                // Null out the broken link in the DB to clean up
                updates[field] = null;
                if (field === 'audio_url') updates.preview_url = null;
                continue;
              }
              throw downloadError;
            }

            const contentType = field === 'audio_url' ? 'audio/mpeg' : 'application/pdf';
            await s3Client.send(new PutObjectCommand({
              Bucket: bucketName,
              Key: path,
              Body: new Uint8Array(await fileData.arrayBuffer()),
              ContentType: contentType,
            }));

            updates[field] = `${publicBaseUrl}/${path}`;
            if (field === 'audio_url') updates.preview_url = updates[field];
            
            migratedCount++;
          } catch (err: any) {
            console.error(`[migrate-to-r2] Failed to migrate ${field} for song ${song.id}:`, err.message);
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('repertoire').update(updates).eq('id', song.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      migratedCount,
      skippedCount,
      message: `Successfully migrated ${migratedCount} assets to Cloudflare R2. Skipped and cleaned up ${skippedCount} missing files.`
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("[migrate-to-r2] Fatal Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
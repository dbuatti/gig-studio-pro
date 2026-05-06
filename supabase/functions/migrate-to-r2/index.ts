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

  console.log("[migrate-to-r2] Comprehensive migration process initiated.");

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

    const sanitize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').trim();

    // 1. Fetch all songs that have Supabase URLs in ANY relevant field
    const { data: songs, error: fetchError } = await supabaseAdmin
      .from('repertoire')
      .select('*')
      .or('audio_url.ilike.%supabase.co%,pdf_url.ilike.%supabase.co%,leadsheet_url.ilike.%supabase.co%,preview_url.ilike.%supabase.co%,sheet_music_url.ilike.%supabase.co%');

    if (fetchError) throw fetchError;

    console.log(`[migrate-to-r2] Found ${songs?.length || 0} songs with legacy Supabase links.`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const song of (songs || [])) {
      const updates: any = {};
      const fields = ['audio_url', 'pdf_url', 'leadsheet_url', 'preview_url', 'sheet_music_url'];

      const artistPart = sanitize(song.artist || 'artist');
      const titlePart = sanitize(song.title || 'track');
      const descriptiveFolder = `${song.id}_${artistPart}_${titlePart}`;

      for (const field of fields) {
        const oldUrl = song[field];
        if (oldUrl && oldUrl.includes('supabase.co/storage/v1/object/public/public_audio/')) {
          try {
            const path = oldUrl.split('/public_audio/')[1].split('?')[0]; // Strip query params
            
            const { data: fileData, error: downloadError } = await supabaseAdmin
              .storage
              .from('public_audio')
              .download(path);

            if (downloadError) {
              console.warn(`[migrate-to-r2]   -> SKIP: ${field} for "${song.title}" (File not found in storage)`);
              skippedCount++;
              continue;
            }

            const type = field.replace('_url', '');
            const isAudio = field === 'audio_url' || field === 'preview_url';
            const ext = isAudio ? 'mp3' : 'pdf';
            const fileName = `${artistPart}_${titlePart}_${type}.${ext}`;
            const newPath = `${song.user_id}/${descriptiveFolder}/${fileName}`;

            await s3Client.send(new PutObjectCommand({
              Bucket: bucketName,
              Key: newPath,
              Body: new Uint8Array(await fileData.arrayBuffer()),
              ContentType: isAudio ? 'audio/mpeg' : 'application/pdf',
            }));

            const newUrl = `${publicBaseUrl}/${newPath}`;
            updates[field] = newUrl;
            
            migratedCount++;
            console.log(`[migrate-to-r2]   -> SUCCESS: Migrated ${field} for "${song.title}"`);
          } catch (err: any) {
            errorCount++;
            console.error(`[migrate-to-r2]   -> ERROR migrating ${field} for "${song.title}":`, err.message);
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
      message: `Migration complete. ${migratedCount} files moved to R2.`
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
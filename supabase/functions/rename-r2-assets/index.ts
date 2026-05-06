// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.450.0"
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

  console.log("[rename-r2-assets] Maintenance cycle started.");

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error("[rename-r2-assets] Error: No authorization header.");
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

    // 1. Fetch all songs that have R2 URLs
    const { data: songs, error: fetchError } = await supabaseAdmin
      .from('repertoire')
      .select('*')
      .or(`audio_url.ilike.%${publicBaseUrl}%,pdf_url.ilike.%${publicBaseUrl}%,leadsheet_url.ilike.%${publicBaseUrl}%`);

    if (fetchError) {
      console.error("[rename-r2-assets] DB Fetch Error:", fetchError);
      throw fetchError;
    }

    console.log(`[rename-r2-assets] Auditing ${songs?.length || 0} songs for path compliance.`);

    let renamedCount = 0;
    let missingCount = 0;

    for (const song of (songs || [])) {
      const updates: any = {};
      const fields = ['audio_url', 'pdf_url', 'leadsheet_url'];

      const artistPart = sanitize(song.artist || 'artist');
      const titlePart = sanitize(song.title || 'track');
      const descriptiveFolder = `${song.id}_${artistPart}_${titlePart}`;

      for (const field of fields) {
        const currentUrl = song[field];
        if (currentUrl && currentUrl.includes(publicBaseUrl)) {
          const oldPath = currentUrl.replace(`${publicBaseUrl}/`, '');
          
          const type = field.replace('_url', '');
          const ext = field === 'audio_url' ? 'mp3' : 'pdf';
          const newFileName = `${artistPart}_${titlePart}_${type}.${ext}`;
          const expectedPath = `${song.user_id}/${descriptiveFolder}/${newFileName}`;

          if (oldPath !== expectedPath) {
            try {
              // Check if source exists before attempting copy
              await s3Client.send(new HeadObjectCommand({
                Bucket: bucketName,
                Key: oldPath,
              }));

              console.log(`[rename-r2-assets] Moving "${song.title}" (${field}) to descriptive path...`);

              await s3Client.send(new CopyObjectCommand({
                Bucket: bucketName,
                CopySource: `${bucketName}/${oldPath}`,
                Key: expectedPath,
              }));

              await s3Client.send(new DeleteObjectCommand({
                Bucket: bucketName,
                Key: oldPath,
              }));

              updates[field] = `${publicBaseUrl}/${expectedPath}`;
              if (field === 'audio_url') updates.preview_url = updates[field];
              
              renamedCount++;
            } catch (err: any) {
              if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
                console.warn(`[rename-r2-assets] SKIP: Asset missing in R2 for "${song.title}" (${field}). Path: ${oldPath}`);
                missingCount++;
                // Optionally clear the broken link in DB
                // updates[field] = null;
              } else {
                console.error(`[rename-r2-assets] FAILED to move ${field} for "${song.title}":`, err.message);
              }
            }
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('repertoire').update(updates).eq('id', song.id);
      }
    }

    console.log(`[rename-r2-assets] Maintenance complete. Renamed: ${renamedCount}, Missing: ${missingCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      renamedCount,
      missingCount,
      message: `Maintenance complete. Moved ${renamedCount} assets. Found ${missingCount} missing files.`
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("[rename-r2-assets] CRITICAL ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
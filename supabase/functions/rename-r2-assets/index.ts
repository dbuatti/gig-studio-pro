// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.450.0"
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

  console.log("[rename-r2-assets] Request received. Starting maintenance cycle...");

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error("[rename-r2-assets] Error: No authorization header provided.");
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

    console.log("[rename-r2-assets] Fetching songs with R2 assets...");

    // 1. Fetch all songs that have R2 URLs
    const { data: songs, error: fetchError } = await supabaseAdmin
      .from('repertoire')
      .select('*')
      .or(`audio_url.ilike.%${publicBaseUrl}%,pdf_url.ilike.%${publicBaseUrl}%,leadsheet_url.ilike.%${publicBaseUrl}%`);

    if (fetchError) {
      console.error("[rename-r2-assets] Database fetch error:", fetchError);
      throw fetchError;
    }

    console.log(`[rename-r2-assets] Found ${songs?.length || 0} songs to audit.`);

    let renamedCount = 0;

    for (const song of (songs || [])) {
      const updates: any = {};
      const fields = ['audio_url', 'pdf_url', 'leadsheet_url'];

      for (const field of fields) {
        const currentUrl = song[field];
        if (currentUrl && currentUrl.includes(publicBaseUrl)) {
          const oldPath = currentUrl.replace(`${publicBaseUrl}/`, '');
          const fileName = oldPath.split('/').pop();
          
          // Check if it's a generic name (doesn't contain artist/title)
          const artistPart = sanitize(song.artist || 'artist');
          const titlePart = sanitize(song.title || 'track');
          const isDescriptive = fileName.includes(artistPart) && fileName.includes(titlePart);

          if (!isDescriptive) {
            try {
              const type = field.replace('_url', '');
              const ext = field === 'audio_url' ? 'mp3' : 'pdf';
              const newFileName = `${artistPart}_${titlePart}_${type}.${ext}`;
              // Ensure the path uses slashes to create folders in R2 UI
              const newPath = `${song.user_id}/${song.id}/${newFileName}`;

              console.log(`[rename-r2-assets] Renaming ${field} for "${song.title}":`);
              console.log(`[rename-r2-assets]   FROM: ${oldPath}`);
              console.log(`[rename-r2-assets]   TO:   ${newPath}`);

              // S3 Rename is Copy + Delete
              await s3Client.send(new CopyObjectCommand({
                Bucket: bucketName,
                CopySource: `${bucketName}/${oldPath}`,
                Key: newPath,
              }));

              await s3Client.send(new DeleteObjectCommand({
                Bucket: bucketName,
                Key: oldPath,
              }));

              updates[field] = `${publicBaseUrl}/${newPath}`;
              if (field === 'audio_url') updates.preview_url = updates[field];
              
              renamedCount++;
              console.log(`[rename-r2-assets]   SUCCESS: ${field} updated.`);
            } catch (err: any) {
              console.error(`[rename-r2-assets]   FAILED: ${field} for song ${song.id}:`, err.message);
            }
          } else {
            console.log(`[rename-r2-assets] Skipping ${field} for "${song.title}" (Already descriptive).`);
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabaseAdmin.from('repertoire').update(updates).eq('id', song.id);
        if (updateError) {
          console.error(`[rename-r2-assets] Error updating database for song ${song.id}:`, updateError);
        }
      }
    }

    console.log(`[rename-r2-assets] Maintenance complete. Total assets renamed: ${renamedCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      renamedCount,
      message: `Successfully renamed ${renamedCount} assets in R2 to the descriptive format.`
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
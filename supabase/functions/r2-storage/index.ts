// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "https://esm.sh/@aws-sdk/client-s3@3.450.0"
// @ts-ignore: Deno runtime import
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.450.0"
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
    const supabaseClient = createClient(
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
    }

    const { action, path, contentType, bucket } = await req.json()
    
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
    const bucketName = bucket || Deno.env.get('S3_BUCKET_NAME')
    // @ts-ignore: Deno global
    const publicBaseUrl = Deno.env.get('R2_PUBLIC_URL')

    if (action === 'getUploadUrl') {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: path,
        ContentType: contentType,
      })
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
      return new Response(JSON.stringify({ url, publicBaseUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: path,
      })
      await s3Client.send(command)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'list') {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: path,
      })
      const data = await s3Client.send(command)
      return new Response(JSON.stringify({ files: data.Contents || [], publicBaseUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error("Invalid action")

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
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

    const contentType = req.headers.get('content-type') || ''

    // Handle multipart/form-data uploads (browser-friendly, no CORS issues)
    if (contentType.includes('multipart/form-data')) {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
      }

      const formData = await req.formData()
      const path = formData.get('path') as string
      const file = formData.get('file') as File

      if (!path || !file) {
        return new Response(JSON.stringify({ error: "Missing path or file" }), { status: 400, headers: corsHeaders })
      }

      // @ts-ignore: Deno global
      const r2Endpoint = (Deno.env.get('S3_ENDPOINT') ?? '').replace(/\/$/, '')
      // @ts-ignore: Deno global
      const s3Client = new S3Client({
        region: "auto",
        endpoint: r2Endpoint,
        credentials: {
          // @ts-ignore: Deno global
          accessKeyId: (Deno.env.get('S3_ACCESS_KEY_ID') ?? '').trim(),
          // @ts-ignore: Deno global
          secretAccessKey: (Deno.env.get('S3_SECRET_ACCESS_KEY') ?? '').trim(),
        },
      })

      // @ts-ignore: Deno global
      const bucketName = Deno.env.get('S3_BUCKET_NAME')
      // @ts-ignore: Deno global
      const publicBaseUrl = Deno.env.get('R2_PUBLIC_URL')

      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: path,
        ContentType: file.type,
      })
      const presignedUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 3600 })

      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: await file.arrayBuffer(),
        headers: { 'Content-Type': file.type },
      })

      if (!uploadRes.ok) {
        const errText = await uploadRes.text()
        throw new Error(`R2 PUT failed (${uploadRes.status}): ${errText}`)
      }

      const publicUrl = `${publicBaseUrl.replace(/\/$/, '')}/${path}`
      return new Response(JSON.stringify({ url: publicUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { action, path: jsonPath, contentType: jsonContentType, bucket } = await req.json()

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
    }
    
    // @ts-ignore: Deno global
    const r2Endpoint = (Deno.env.get('S3_ENDPOINT') ?? '').replace(/\/$/, '').trim()
    const s3Client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint,
      credentials: {
        // @ts-ignore: Deno global
        accessKeyId: (Deno.env.get('S3_ACCESS_KEY_ID') ?? '').trim(),
        // @ts-ignore: Deno global
        secretAccessKey: (Deno.env.get('S3_SECRET_ACCESS_KEY') ?? '').trim(),
      },
    })

    // @ts-ignore: Deno global
    const bucketName = bucket || (Deno.env.get('S3_BUCKET_NAME') ?? '').trim()
    // @ts-ignore: Deno global
    const publicBaseUrl = (Deno.env.get('R2_PUBLIC_URL') ?? '').replace(/\/$/, '').trim()

    if (action === 'getUploadUrl') {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: jsonPath,
        ContentType: jsonContentType,
      })
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
      return new Response(JSON.stringify({ url, publicBaseUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'delete') {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: jsonPath,
      })
      await s3Client.send(command)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'list') {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: jsonPath,
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
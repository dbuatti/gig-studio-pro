import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "https://esm.sh/@aws-sdk/client-s3@3.450.0"
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.450.0"
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
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
      endpoint: Deno.env.get('S3_ENDPOINT') ?? '',
      credentials: {
        accessKeyId: Deno.env.get('S3_ACCESS_KEY_ID') ?? '',
        secretAccessKey: Deno.env.get('S3_SECRET_ACCESS_KEY') ?? '',
      },
    })

    const bucketName = bucket || Deno.env.get('S3_BUCKET_NAME')

    if (action === 'getUploadUrl') {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: path,
        ContentType: contentType,
      })
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
      return new Response(JSON.stringify({ url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
        Prefix: path, // Usually user_id/
      })
      const data = await s3Client.send(command)
      return new Response(JSON.stringify({ files: data.Contents || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error("Invalid action")

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import * as ytdl from "https://deno.land/x/ytdl_core/mod.ts";
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

  try {
    const { videoUrl, userId, songId } = await req.json();

    console.log(`[extract-youtube-audio] Received request for videoUrl: ${videoUrl}, userId: ${userId}, songId: ${songId}`);

    if (!videoUrl || !userId || !songId) {
      console.error("[extract-youtube-audio] Missing videoUrl, userId, or songId in request body.");
      return new Response(JSON.stringify({ error: "Missing videoUrl, userId, or songId" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create a Supabase client with the service role key for storage upload
    const supabaseAdmin = createClient(
      (globalThis as any).Deno.env.get('SUPABASE_URL') ?? '',
      (globalThis as any).Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let info;
    try {
      console.log(`[extract-youtube-audio] Getting info for video: ${videoUrl}`);
      info = await ytdl.getInfo(videoUrl);
      // Defensive check for info and videoDetails
      if (!info || !info.videoDetails) {
        console.error(`[extract-youtube-audio] Video info or videoDetails is undefined for ${videoUrl}`);
        throw new Error("Failed to retrieve complete video details.");
      }
      console.log("[extract-youtube-audio] Successfully got video info.");
      console.log("[extract-youtube-audio] Video info details:", JSON.stringify(info.videoDetails, null, 2)); // Added for debugging
    } catch (e) {
      console.error(`[extract-youtube-audio] Error getting video info for ${videoUrl}: ${e.message}`);
      throw new Error(`Failed to get video info: ${e.message}`);
    }
    
    let audioFormat;
    try {
      console.log("[extract-youtube-audio] Choosing highest audio format.");
      audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
      if (!audioFormat) {
        throw new Error("No audio-only format found for this video.");
      }
      console.log(`[extract-youtube-audio] Chosen audio format: ${audioFormat.mimeType}, quality: ${audioFormat.qualityLabel || audioFormat.audioQuality}`);
    } catch (e) {
      console.error(`[extract-youtube-audio] Error choosing audio format: ${e.message}`);
      throw new Error(`Failed to choose audio format: ${e.message}`);
    }

    let audioStream;
    try {
      console.log("[extract-youtube-audio] Downloading audio stream.");
      // ytdl.downloadFromInfo returns a ReadableStream in Node.js, assuming Deno compatibility
      audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });
      console.log("[extract-youtube-audio] Audio stream initiated.");
    } catch (e) {
      console.error(`[extract-youtube-audio] Error initiating audio download: ${e.message}`);
      throw new Error(`Failed to download audio: ${e.message}`);
    }

    const fileName = `${userId}/${songId}_${Date.now()}.m4a`; // Using m4a as a common high-quality audio format
    const bucketName = 'youtube_audio';

    console.log(`[extract-youtube-audio] Attempting to upload to Supabase Storage bucket '${bucketName}' as '${fileName}'`);
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, audioStream, {
        contentType: audioFormat.mimeType || 'audio/mp4',
        upsert: true,
      });

    if (uploadError) {
      console.error(`[extract-youtube-audio] Supabase Storage upload error: ${uploadError.message}`);
      throw uploadError;
    }
    console.log(`[extract-youtube-audio] Successfully uploaded to Supabase Storage: ${uploadData.path}`);

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    console.log(`[extract-youtube-audio] Public URL generated: ${publicUrl}`);

    // Add a check for info.videoDetails before accessing lengthSeconds
    const durationSeconds = info.videoDetails?.lengthSeconds ? parseInt(info.videoDetails.lengthSeconds) : 0;

    return new Response(JSON.stringify({ 
      publicUrl, 
      duration_seconds: durationSeconds
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("[extract-youtube-audio] Unhandled error in Edge Function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
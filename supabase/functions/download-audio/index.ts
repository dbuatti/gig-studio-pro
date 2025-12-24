// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { videoUrl } = await req.json();
    
    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "Video URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const renderUrl = "https://yt-audio-api-1-wedr.onrender.com";

    let token = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 3; // Max retries for getting a token/download

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      
      // 1. Get Token from Render API
      const tokenResponse = await fetch(`${renderUrl}/?url=${encodeURIComponent(videoUrl)}`);
      if (!tokenResponse.ok) {
        throw new Error(`Render API token request failed: ${tokenResponse.statusText}`);
      }
      const tokenData = await tokenResponse.json();
      token = tokenData.token;

      // 2. Poll for the file to be ready
      const downloadUrl = `${renderUrl}/download?token=${token}`;
      
      // Wait a moment for processing (Render usually takes a few seconds)
      await new Promise(resolve => setTimeout(resolve, 3000));

      const fileResponse = await fetch(downloadUrl);
      
      if (fileResponse.status === 202) {
        // Still processing, return the token so the client can poll or open the link
        return new Response(JSON.stringify({ 
          status: 'processing', 
          message: 'Audio is being converted. Please try again in a few seconds.',
          token: token,
          downloadUrl: downloadUrl
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (fileResponse.status === 404 && attempts < MAX_ATTEMPTS) {
        // Token not found on Render, likely due to server restart. Retry.
        console.warn(`[download-audio] Render API returned 404 for token ${token}. Retrying... (Attempt ${attempts})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts)); // Exponential backoff
        continue; // Go to next attempt
      }

      if (fileResponse.status === 500) {
        const errorData = await fileResponse.json();
        if (errorData.error === "YouTube Block") {
          return new Response(JSON.stringify({ 
            error: "YouTube blocked the download. Try again later or use manual fallback.", 
            details: errorData.detail 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        throw new Error(errorData.error || `Download failed with status 500: ${fileResponse.statusText}`);
      }

      if (!fileResponse.ok) {
        throw new Error(`Download failed: ${fileResponse.statusText}`);
      }

      // If we reached here, fileResponse.ok is true, so we have the file.
      // 3. Return the audio file directly
      const audioBuffer = await fileResponse.arrayBuffer();
      const headers = new Headers(corsHeaders);
      headers.set('Content-Type', 'audio/mpeg');
      headers.set('Content-Disposition', `attachment; filename="audio.mp3"`);

      return new Response(audioBuffer, { headers });
    }

    // If all attempts fail
    return new Response(JSON.stringify({ error: "Failed to download audio after multiple attempts. Render API might be unstable or blocked." }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
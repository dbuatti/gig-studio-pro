// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    console.log("[download-audio] OPTIONS request received.");
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { videoUrl } = await req.json();
    console.log(`[download-audio] Request received for videoUrl: ${videoUrl}`);
    
    if (!videoUrl) {
      console.error("[download-audio] Error: Video URL is required.");
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
      console.log(`[download-audio] Attempt ${attempts}/${MAX_ATTEMPTS}: Requesting token from Render API for ${videoUrl}`);
      
      // 1. Get Token from Render API
      const tokenResponse = await fetch(`${renderUrl}/?url=${encodeURIComponent(videoUrl)}`);
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`[download-audio] Attempt ${attempts}: Render API token request failed: ${tokenResponse.status} - ${errorText}`);
        throw new Error(`Render API token request failed: ${tokenResponse.statusText}`);
      }
      const tokenData = await tokenResponse.json();
      token = tokenData.token;
      console.log(`[download-audio] Attempt ${attempts}: Received token: ${token}`);

      // 2. Poll for the file to be ready
      const downloadUrl = `${renderUrl}/download?token=${token}`;
      
      // Wait a moment for processing (Render usually takes a few seconds)
      console.log(`[download-audio] Attempt ${attempts}: Waiting 3 seconds before first poll.`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      const fileResponse = await fetch(downloadUrl);
      
      if (fileResponse.status === 202) {
        const responseData = await fileResponse.json().catch(() => ({}));
        console.log(`[download-audio] Attempt ${attempts}: Render API status 202 (processing). Progress: ${responseData.progress_percentage || 0}%`);
        // Still processing, return the token so the client can poll or open the link
        return new Response(JSON.stringify({ 
          status: 'processing', 
          message: 'Audio is being converted. Please try again in a few seconds.',
          token: token,
          downloadUrl: downloadUrl,
          progress_percentage: responseData.progress_percentage || 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (fileResponse.status === 404 && attempts < MAX_ATTEMPTS) {
        // Token not found on Render, likely due to server restart. Retry.
        console.warn(`[download-audio] Attempt ${attempts}: Render API returned 404 for token ${token}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts)); // Exponential backoff
        continue; // Go to next attempt
      }

      if (fileResponse.status === 500) {
        const errorData = await fileResponse.json();
        console.error(`[download-audio] Attempt ${attempts}: Render API returned 500. Error: ${errorData.error}, Details: ${errorData.detail}`);
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
        console.error(`[download-audio] Attempt ${attempts}: Download failed with status: ${fileResponse.status} - ${fileResponse.statusText}`);
        throw new Error(`Download failed: ${fileResponse.statusText}`);
      }

      // If we reached here, fileResponse.ok is true, so we have the file.
      // 3. Return the audio file directly
      console.log(`[download-audio] Attempt ${attempts}: Audio file successfully retrieved from Render API.`);
      const audioBuffer = await fileResponse.arrayBuffer();
      const headers = new Headers(corsHeaders);
      headers.set('Content-Type', 'audio/mpeg');
      headers.set('Content-Disposition', `attachment; filename="audio.mp3"`);

      return new Response(audioBuffer, { headers });
    }

    // If all attempts fail
    console.error("[download-audio] All attempts failed to download audio from Render API.");
    return new Response(JSON.stringify({ error: "Failed to download audio after multiple attempts. Render API might be unstable or blocked." }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[download-audio] Uncaught error in Edge Function: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
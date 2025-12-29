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
    const { videoUrl, songId, userId } = await req.json();
    console.log("[download-audio] Function started.", { videoUrl, songId, userId });
    
    if (!videoUrl) {
      console.error("[download-audio] Video URL is required.");
      return new Response(JSON.stringify({ error: "Video URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const renderUrl = "https://yt-audio-api-1-wedr.onrender.com";
    
    // @ts-ignore: Deno global
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-ignore: Deno global
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log("[download-audio] Triggering Render API for background audio extraction.");
    
    const MAX_RETRIES = 3;
    let triggerResponse: Response | null = null;
    let lastError: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const queryParams = new URLSearchParams({
          url: videoUrl,
          s_url: supabaseUrl || '',
          s_key: supabaseKey || '',
          song_id: songId || '',
          user_id: userId || ''
        });

        triggerResponse = await fetch(`${renderUrl}/?${queryParams.toString()}`);
        
        if (triggerResponse.ok) {
          console.log(`[download-audio] Render API trigger successful on attempt ${attempt + 1}.`);
          break; // Success, exit retry loop
        } else {
          const errorText = await triggerResponse.text();
          lastError = new Error(`Render API trigger failed (Status: ${triggerResponse.status}, Text: ${errorText})`);
          console.warn(`[download-audio] Attempt ${attempt + 1} failed: ${lastError.message}`);
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
          }
        }
      } catch (e: any) {
        lastError = e;
        console.warn(`[download-audio] Fetch error on attempt ${attempt + 1}: ${e.message}`);
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    if (!triggerResponse || !triggerResponse.ok) {
      console.error(`[download-audio] All retry attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
      throw new Error(`Render API trigger failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
    }

    const data = await triggerResponse.json();
    console.log("[download-audio] Render API trigger successful. Response data:", data);

    return new Response(JSON.stringify({ 
      success: true, 
      status: 'background_started', 
      message: 'Background audio extraction initialized. This may take a minute and will update automatically.',
      token: data.token
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[download-audio] Fatal Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
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
    
    if (!videoUrl) {
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

    // Trigger Render API with background sync parameters
    const queryParams = new URLSearchParams({
      url: videoUrl,
      s_url: supabaseUrl || '',
      s_key: supabaseKey || '',
      song_id: songId || '',
      user_id: userId || ''
    });

    const triggerResponse = await fetch(`${renderUrl}/?${queryParams.toString()}`);
    
    if (!triggerResponse.ok) {
      throw new Error(`Render API trigger failed: ${triggerResponse.statusText}`);
    }

    const data = await triggerResponse.json();

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
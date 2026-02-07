import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
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
    const { songIds } = await req.json();
    
    if (!songIds || !Array.isArray(songIds)) {
      throw new Error("Invalid songIds payload.");
    }

    console.log(`[queue-audio-extraction] Received request to queue audio for ${songIds.length} songs.`);
    // Log the first few IDs for verification
    console.log(`[queue-audio-extraction] First 5 Song IDs: ${songIds.slice(0, 5).join(', ')}`);

    // --- RENDER.COM INTEGRATION POINT ---
    // In a real scenario, this is where you would make an API call to your
    // external Python service (e.g., on Render.com) to trigger the queue.
    //
    // Example:
    // const RENDER_API_URL = Deno.env.get('RENDER_API_URL');
    // const RENDER_SECRET = Deno.env.get('RENDER_SECRET');
    //
    // const response = await fetch(`${RENDER_API_URL}/queue-extraction`, {
    //   method: 'POST',
    //   headers: { 
    //     'Content-Type': 'application/json', 
    //     'Authorization': `Bearer ${RENDER_SECRET}` 
    //   },
    //   body: JSON.stringify({ songIds })
    // });
    //
    // if (!response.ok) {
    //   const errorText = await response.text();
    //   console.error(`[queue-audio-extraction] External queue trigger failed: ${response.status} - ${errorText}`);
    //   throw new Error('Failed to trigger external queue service.');
    // }
    // ------------------------------------

    // For now, we just log and return success to confirm the Edge Function is triggered.
    return new Response(
      JSON.stringify({ message: `Successfully queued ${songIds.length} songs for audio extraction.` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error(`[queue-audio-extraction] Error processing request: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

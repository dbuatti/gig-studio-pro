// Queue Audio Extraction Edge Function
// Updated to actually perform database updates for the Python worker to pick up.
// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
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
    const { songIds } = await req.json();
    
    if (!songIds || !Array.isArray(songIds)) {
      throw new Error("Invalid songIds payload.");
    }

    console.log(`[queue-audio-extraction] Received request to queue audio for ${songIds.length} songs.`);

    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update the repertoire table to set status to 'queued'
    // This allows the Python worker (main.py) to see and process these jobs.
    const { error } = await supabaseAdmin
      .from('repertoire')
      .update({ 
        extraction_status: 'queued',
        last_sync_log: 'Queued via bulk automation hub.'
      })
      .in('id', songIds);

    if (error) throw error;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully queued ${songIds.length} songs for audio extraction.` 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error(`[queue-audio-extraction] Error: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
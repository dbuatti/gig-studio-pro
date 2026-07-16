// Re-extract Legacy Audio Edge Function
// Finds songs with stale Supabase storage URLs and re-queues them for extraction
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log("[re-extract-legacy] Finding songs with stale Supabase storage URLs...");

    const { data: songs, error: fetchError } = await supabaseAdmin
      .from('repertoire')
      .select('id, title, artist, youtube_url, audio_url, extraction_status')
      .or('audio_url.ilike.%supabase.co%,preview_url.ilike.%supabase.co%')
      .not('youtube_url', 'is', null);

    if (fetchError) throw fetchError;

    if (!songs || songs.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No songs found with legacy Supabase URLs and a YouTube link.",
        queued: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[re-extract-legacy] Found ${songs.length} songs to re-queue.`);

    const songIds = songs.map(s => s.id);
    const { error: updateError } = await supabaseAdmin
      .from('repertoire')
      .update({
        audio_url: null,
        preview_url: null,
        extraction_status: 'queued',
        extraction_error: null,
        last_sync_log: 'Re-queued via re-extract-legacy migration.',
      })
      .in('id', songIds);

    if (updateError) throw updateError;

    console.log(`[re-extract-legacy] Successfully queued ${songIds.length} songs.`);

    return new Response(JSON.stringify({
      success: true,
      message: `Found ${songs.length} songs with legacy URLs. All have been cleared and re-queued for extraction from their YouTube links.`,
      queued: songs.length,
      songs: songs.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
      })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[re-extract-legacy] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})

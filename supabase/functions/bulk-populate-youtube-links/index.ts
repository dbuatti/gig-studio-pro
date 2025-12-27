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

  const supabaseAdmin = createClient(
    // @ts-ignore: Deno global
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore: Deno global
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { songIds } = await req.json();
    
    if (!songIds || !Array.isArray(songIds)) {
      throw new Error("Invalid song list provided.");
    }

    console.log(`[bulk-populate-youtube-links] Processing ${songIds.length} tracks...`);

    const results = [];

    for (const id of songIds) {
      try {
        // 1. Fetch current song data
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('id, title, artist')
          .eq('id', id)
          .single();

        if (fetchErr || !song) throw new Error(`Fetch failed for ID ${id}`);

        await supabaseAdmin.from('repertoire').update({ sync_status: 'SYNCING' }).eq('id', id);

        // 2. Smart-Search (YouTube)
        const ytSearchQuery = `${song.artist} ${song.title} official audio`;

        // Using Invidious proxy logic
        const instance = 'https://iv.ggtyler.dev';
        const ytRes = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(ytSearchQuery)}`);
        
        if (!ytRes.ok) throw new Error(`Search engine error: ${ytRes.status}`);
        
        const ytData = await ytRes.json();
        // Strictly select Result Index [0] and verify it's a video
        const topVideo = ytData?.filter?.((v: any) => v.type === "video")[0];

        if (topVideo) {
          const youtubeUrl = `https://www.youtube.com/watch?v=${topVideo.videoId}`;
          
          // 4. Update Song Record
          await supabaseAdmin.from('repertoire').update({
            youtube_url: youtubeUrl,
            metadata_source: 'auto_populated',
            sync_status: 'COMPLETED',
            last_sync_log: `Auto-populated top hit: ${topVideo.videoId}`
          }).eq('id', id);

          results.push({ id, status: 'SUCCESS', title: song.title, videoId: topVideo.videoId });
        } else {
          throw new Error("No YouTube video match found.");
        }

      } catch (err) {
        console.error(`[bulk-populate-youtube-links] Error on track ${id}:`, err.message);
        await supabaseAdmin.from('repertoire').update({ 
          sync_status: 'ERROR',
          last_sync_log: err.message 
        }).eq('id', id);
        results.push({ id, status: 'ERROR', msg: err.message });
      }

      // Throttling: 1.5s delay to prevent rate-limiting
      await new Promise(r => setTimeout(r, 1500));
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
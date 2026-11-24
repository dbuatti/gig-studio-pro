// Bulk Populate YouTube Links Edge Function
// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INVIDIOUS_INSTANCES = [
  'https://iv.ggtyler.dev',
  'https://yewtu.be',
  'https://invidious.flokinet.to',
  'https://inv.vern.cc',
  'https://invidious.nerdvpn.de',
  'https://inv.tux.pro',
  'https://invidious.no-logs.com',
  'https://inv.zzls.xyz'
];

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

    const results = [];
    const EXCLUDED_KEYWORDS = ['cover', 'tutorial', 'karaoke', 'lesson', 'instrumental', 'remix', 'mashup'];

    for (const id of songIds) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        continue;
      }

      let lastSyncLog = '';
      try {
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('id, title, artist, genre, energy_level')
          .eq('id', id)
          .single();

        if (fetchErr || !song) throw new Error(`Fetch failed for ID ${id}`);

        await supabaseAdmin.from('repertoire').update({ sync_status: 'SYNCING', last_sync_log: 'Discovery engine active...' }).eq('id', id);

        const isJazz = (song.genre || '').toLowerCase().includes('jazz') ||
          (song.energy_level || '').toLowerCase() === 'ambient' ||
          /jazz|sinatra|standards|blue|moon/i.test(song.title + ' ' + song.artist);

        // Prioritise male jazz singers (Michael Bublé, Sammy Davis Jr) for jazz standards
        const primaryQuery = isJazz
          ? `Michael Bublé ${song.title}`
          : `${song.artist} ${song.title}`;

        // Use yt-dlp's built-in YouTube search (ytsearch1:) so we don't depend on
        // fragile Invidious instances. The Render worker resolves it at download time.
        const youtubeUrl = `ytsearch1:${primaryQuery}`;
        lastSyncLog = `Bound via ytsearch: ${primaryQuery}`;

        await supabaseAdmin.from('repertoire').update({
          youtube_url: youtubeUrl,
          metadata_source: 'auto_populated',
          sync_status: 'COMPLETED',
          last_sync_log: lastSyncLog
        }).eq('id', id);

        results.push({ id, status: 'SUCCESS', title: song.title, videoId: primaryQuery });

      } catch (err: any) {
        console.error("[bulk-populate-youtube-links] Error processing song:", id, err.message);
        await supabaseAdmin.from('repertoire').update({ 
          sync_status: 'ERROR',
          last_sync_log: err.message 
        }).eq('id', id);
        results.push({ id, status: 'ERROR', msg: err.message, song_id: id });
      }

      await new Promise(r => setTimeout(r, 800));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: songIds.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[bulk-populate-youtube-links] Fatal Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
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
    const { songIds, overwrite = false } = await req.json();
    
    if (!songIds || !Array.isArray(songIds)) {
      throw new Error("Invalid song list provided.");
    }

    // console.log("[global-auto-sync] Processing batch of size:", songIds.length); // Removed verbose log

    const results = [];

    for (const id of songIds) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) continue;

      try {
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchErr || !song) throw new Error(`Fetch failed for ID ${id}`);

        if (song.metadata_source === 'itunes_autosync' && !overwrite) {
          results.push({ id, status: 'SKIPPED', msg: 'Already synced' });
          continue;
        }

        await supabaseAdmin.from('repertoire').update({ sync_status: 'SYNCING', last_sync_log: 'Syncing with iTunes...' }).eq('id', id);

        const itunesQuery = encodeURIComponent(`${song.artist} ${song.title}`);
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${itunesQuery}&entity=song&limit=1`);
        
        if (!itunesRes.ok) throw new Error("iTunes API unavailable");
        
        const itunesData = await itunesRes.json();
        const topResult = itunesData.results?.[0];

        if (topResult) {
          await supabaseAdmin.from('repertoire').update({
            title: topResult.trackName,
            artist: topResult.artistName,
            genre: topResult.primaryGenreName,
            apple_music_url: topResult.trackViewUrl,
            metadata_source: 'itunes_autosync',
            auto_synced: true,
            sync_status: 'COMPLETED',
            last_sync_log: 'Successfully matched with iTunes Master'
          }).eq('id', id);

          results.push({ id, status: 'SUCCESS', title: topResult.trackName });
        } else {
          throw new Error('No iTunes match found.');
        }

      } catch (err: any) {
        console.error("[global-auto-sync] Sync failed for:", id, err.message);
        await supabaseAdmin.from('repertoire').update({ 
          sync_status: 'ERROR',
          last_sync_log: err.message 
        }).eq('id', id);
        results.push({ id, status: 'ERROR', msg: err.message });
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[global-auto-sync] Fatal Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})